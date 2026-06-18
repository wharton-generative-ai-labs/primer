/**
 * Pure transition logic for the workflow-phase manager.
 *
 * `transition` is a pure function: given the experience config, the current
 * phase state, the current `experienceCompleted` flag, and a request, it
 * returns the new state, the events to append, the system message to inject
 * into the agent's conversation, and the snapshot (if any) to restore for the
 * destination phase.
 *
 * The manager is intentionally I/O-free. Persistence, lock acquisition, and
 * agent-side message injection are the caller's responsibility (see
 * `mutateSessionMetadata`, `/api/workflow-phases/transition`, and
 * `RealtimeController`).
 *
 * The eight `TransitionOp` kinds and their detailed semantics are documented
 * in plan Task A6 of `docs/superpowers/plans/2026-04-28-workflow-phases-and-doc-history.md`
 * — that plan is the source of truth for any ambiguity.
 */

import {
  formatWorkflowPhaseChangeMessage,
  type WorkflowPhaseChangePayload,
} from '@/app/lib/agent-context/workflowPhaseChangeMessage';
import { SESSION_EVENTS, type SessionEvent } from '@/app/lib/file-utils';
import type { ExperienceConfig } from '@/app/lib/types';
import type {
  WorkflowPhaseConfig,
  WorkflowPhaseObjective,
  WorkflowPhaseSnapshot,
  WorkflowPhaseState,
} from '@/app/lib/workflow-phases';
import {
  loadWorkflowPhases,
  resolveInitialWorkflowPhase,
} from '@/app/lib/workflow-phases/loadWorkflowPhases';
import {
  InvalidPhaseError,
  NoNextPhaseError,
} from '@/app/lib/workflow-phases/errors';

// Re-export so existing import sites (`route.ts`, `HarnessToolContext.ts`,
// `WorkflowPhaseManager.test.ts`) keep their `from '...WorkflowPhaseManager'`
// imports working unchanged. The classes themselves now live in `./errors`
// so `loadWorkflowPhases.ts` can throw them without a circular import.
export { InvalidPhaseError, NoNextPhaseError };

export type TransitionOp =
  | { kind: 'init' }
  | { kind: 'complete' }
  | { kind: 'advance' }
  | { kind: 'nextPhase' }
  | { kind: 'set'; targetPhase: string }
  | { kind: 'setNext'; targetPhase: string }
  | { kind: 'goTo'; targetPhase: string }
  | { kind: 'finishExperience' }
  | { kind: 'rewind' }
  | { kind: 'markObjective'; id: string; note?: string };

export interface TransitionRequest {
  op: TransitionOp;
  trigger: 'user' | 'agent' | 'system';
  reason?: string;
  /**
   * The current view-state snapshot for the *leaving* phase. Required for
   * navigation ops that should preserve where the user was on the way out
   * (`goTo` backward, `rewind`).
   */
  currentSnapshot?: WorkflowPhaseSnapshot;
}

export interface TransitionResult {
  newState: WorkflowPhaseState;
  experienceCompleted: boolean;
  eventsToAppend: SessionEvent[];
  /** Non-null for navigation ops; null for pure-state ops (complete, setNext, no-op). */
  systemMessage: string | null;
  restoredSnapshot?: WorkflowPhaseSnapshot;
  unmetObjectives?: { phase: string; objectives: WorkflowPhaseObjective[] }[];
}

/**
 * Signal handed to `evaluateSatisfiedBy` from a hook point. Discriminated
 * union so each kind carries exactly the fields the evaluator needs.
 *
 * - `delegateSuccess` is emitted at every successful delegate-completion
 *   exit (HTTP route, socket, core). `resolvedAgentKey` is the post-aliasing
 *   agent that actually ran — match against this, not the raw `agentType`
 *   from tool args.
 * - `artifactWrite` is emitted at the artifact storage write boundary on
 *   every successful create/update. `newlyPopulated` is true iff the write
 *   transitioned the artifact body from absent/empty to non-empty.
 */
export type ObjectiveSignal =
  | { kind: 'delegateSuccess'; resolvedAgentKey: string }
  | { kind: 'artifactWrite'; slug: string; newlyPopulated: boolean };

/**
 * Pure evaluator: given the current state, the current phase config, and a
 * runtime signal, return the list of objective ids that should be marked.
 *
 * - Skips objectives without `satisfiedBy`.
 * - Skips already-marked objectives.
 * - Matches `delegateSuccess` triggers on `resolvedAgentKey`.
 * - Matches `artifactPopulated` triggers on `slug`, but only when
 *   `newlyPopulated === true`.
 */
export function evaluateSatisfiedBy(
  state: WorkflowPhaseState,
  phase: WorkflowPhaseConfig,
  signal: ObjectiveSignal,
): string[] {
  const marked = new Set(state.completedObjectives?.[phase.id] ?? []);
  const out: string[] = [];
  for (const objective of phase.objectives ?? []) {
    if (marked.has(objective.id)) continue;
    const trigger = objective.satisfiedBy;
    if (!trigger) continue;
    if (
      trigger.kind === 'delegateSuccess' &&
      signal.kind === 'delegateSuccess' &&
      trigger.agentType === signal.resolvedAgentKey
    ) {
      out.push(objective.id);
      continue;
    }
    if (
      trigger.kind === 'artifactPopulated' &&
      signal.kind === 'artifactWrite' &&
      signal.newlyPopulated &&
      trigger.slug === signal.slug
    ) {
      out.push(objective.id);
      continue;
    }
  }
  return out;
}

const SYSTEM_AGENT = 'system';

function nowIso(): string {
  return new Date().toISOString();
}

function makeEvent(
  event: string,
  trigger: TransitionRequest['trigger'],
  data: Record<string, unknown>,
): SessionEvent {
  return {
    event,
    agent: trigger === 'agent' ? 'agent' : SYSTEM_AGENT,
    timestamp: nowIso(),
    data: { ...data, trigger },
  };
}

function findIndex(
  phases: WorkflowPhaseConfig[],
  id: string | undefined,
): number {
  if (id === undefined) return -1;
  return phases.findIndex((p) => p.id === id);
}

function requireKnownPhase(
  phases: WorkflowPhaseConfig[],
  id: string,
): WorkflowPhaseConfig {
  const phase = phases.find((p) => p.id === id);
  if (!phase) {
    throw new InvalidPhaseError(
      `Unknown workflow phase id "${id}".`,
    );
  }
  return phase;
}

function buildSystemMessage(
  payload: WorkflowPhaseChangePayload,
  toPhase: WorkflowPhaseConfig,
  allPhases: WorkflowPhaseConfig[],
): string {
  return formatWorkflowPhaseChangeMessage(payload, toPhase, allPhases);
}

function appendVisited(visited: string[], phaseId: string): string[] {
  if (visited[visited.length - 1] === phaseId) return visited;
  return [...visited, phaseId];
}

function pickFurthest(
  phases: WorkflowPhaseConfig[],
  current: string | undefined,
  candidate: string,
): string {
  if (!current) return candidate;
  const a = findIndex(phases, current);
  const b = findIndex(phases, candidate);
  return b > a ? candidate : current;
}

function ensureCompleted(
  state: WorkflowPhaseState,
  phaseId: string,
): { completedPhases: string[]; alreadyCompleted: boolean } {
  if (state.completedPhases.includes(phaseId)) {
    return {
      completedPhases: state.completedPhases,
      alreadyCompleted: true,
    };
  }
  return {
    completedPhases: [...state.completedPhases, phaseId],
    alreadyCompleted: false,
  };
}

function requireState(
  state: WorkflowPhaseState | undefined,
): WorkflowPhaseState {
  if (!state || !state.currentPhase) {
    throw new InvalidPhaseError(
      'Cannot transition: workflow-phase state is uninitialized.',
    );
  }
  return state;
}

function handleInit(
  config: ExperienceConfig,
  req: TransitionRequest,
): TransitionResult {
  const phases = loadWorkflowPhases(config);
  if (phases.length === 0) {
    throw new InvalidPhaseError(
      'Cannot init workflow-phase state: experience declares no phases.',
    );
  }
  const initialId = resolveInitialWorkflowPhase(config);
  if (!initialId) {
    throw new InvalidPhaseError(
      'Cannot init workflow-phase state: no initial phase resolved.',
    );
  }
  const initialPhase = requireKnownPhase(phases, initialId);

  const newState: WorkflowPhaseState = {
    currentPhase: initialId,
    furthestPhase: initialId,
    visited: [initialId],
    completedPhases: [],
    snapshots: {},
  };

  const events: SessionEvent[] = [
    makeEvent(SESSION_EVENTS.WORKFLOW_PHASE_ENTERED, req.trigger, {
      phase: initialId,
      direction: 'initial',
    }),
  ];

  const systemMessage = buildSystemMessage(
    {
      direction: 'initial',
      isFirstEntry: true,
      toPhase: initialId,
      trigger: req.trigger,
    },
    initialPhase,
    phases,
  );

  return {
    newState,
    experienceCompleted: false,
    eventsToAppend: events,
    systemMessage,
  };
}

function handleComplete(
  config: ExperienceConfig,
  state: WorkflowPhaseState,
  experienceCompleted: boolean,
  req: TransitionRequest,
): TransitionResult {
  const phases = loadWorkflowPhases(config);
  const currentId = state.currentPhase;
  if (!currentId) {
    throw new InvalidPhaseError(
      'Cannot complete: no current phase in state.',
    );
  }
  // Validate the phase still exists in config — protects against config drift.
  const currentPhase = requireKnownPhase(phases, currentId);

  // Auto-mark any unmet objectives. The objective list is documentation +
  // telemetry, not a gate — when the agent calls `complete`/`nextPhase` it
  // is asserting the phase's intent has been met, and we want the workflow
  // to advance instead of stalling on per-objective `markObjective` hygiene.
  // Each auto-mark emits its own event so analytics / replay can identify
  // phases where the agent never marked an objective explicitly. The
  // existing `handleForwardNavigation` skip path is unaffected; that
  // surfaces unmet objectives to the agent via `unmetObjectives` on the
  // result for the *destination* phase, not the leaving phase.
  let nextCompletedObjectives = state.completedObjectives ?? {};
  const autoMarkEvents: SessionEvent[] = [];
  if (currentPhase.objectives && currentPhase.objectives.length > 0) {
    const done = new Set(nextCompletedObjectives[currentId] ?? []);
    const unmet = currentPhase.objectives.filter((o) => !done.has(o.id));
    if (unmet.length > 0) {
      const updatedDone = [
        ...(nextCompletedObjectives[currentId] ?? []),
        ...unmet.map((o) => o.id),
      ];
      nextCompletedObjectives = {
        ...nextCompletedObjectives,
        [currentId]: updatedDone,
      };
      for (const objective of unmet) {
        autoMarkEvents.push(
          makeEvent(
            SESSION_EVENTS.OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE,
            req.trigger,
            {
              phase: currentId,
              objectiveId: objective.id,
              op: req.op.kind,
            },
          ),
        );
      }
    }
  }

  const { completedPhases, alreadyCompleted } = ensureCompleted(
    state,
    currentId,
  );

  const events: SessionEvent[] = [
    ...autoMarkEvents,
    ...(alreadyCompleted
      ? []
      : [
          makeEvent(SESSION_EVENTS.PHASE_COMPLETED, req.trigger, {
            phase: currentId,
          }),
        ]),
  ];

  return {
    newState: {
      ...state,
      completedPhases,
      completedObjectives: nextCompletedObjectives,
    },
    experienceCompleted,
    eventsToAppend: events,
    systemMessage: null,
  };
}

function handleMarkObjective(
  config: ExperienceConfig,
  state: WorkflowPhaseState,
  experienceCompleted: boolean,
  req: TransitionRequest,
): TransitionResult {
  const phases = loadWorkflowPhases(config);
  const currentId = state.currentPhase;
  if (!currentId) {
    throw new InvalidPhaseError(
      'Cannot markObjective: no current phase in state.',
    );
  }
  const currentPhase = requireKnownPhase(phases, currentId);
  const objectives = currentPhase.objectives ?? [];
  if (objectives.length === 0) {
    throw new InvalidPhaseError(
      `Cannot markObjective: phase "${currentId}" has no declared objectives.`,
    );
  }
  if (req.op.kind !== 'markObjective') {
    // Type narrowing for the compiler — never hit at runtime.
    throw new Error('handleMarkObjective called with wrong op kind');
  }
  const targetId = req.op.id;
  const valid = objectives.find((o) => o.id === targetId);
  if (!valid) {
    const validIds = objectives.map((o) => o.id).join(', ');
    throw new InvalidPhaseError(
      `Cannot markObjective: objective "${targetId}" is not declared on phase "${currentId}". Valid ids: ${validIds}.`,
    );
  }
  const completedObjectives = state.completedObjectives ?? {};
  const alreadyDone = new Set(completedObjectives[currentId] ?? []);
  if (alreadyDone.has(targetId)) {
    // Idempotent: state unchanged, no event emitted.
    return {
      newState: state,
      experienceCompleted,
      eventsToAppend: [],
      systemMessage: null,
    };
  }
  const updated = {
    ...completedObjectives,
    [currentId]: [...(completedObjectives[currentId] ?? []), targetId],
  };
  return {
    newState: { ...state, completedObjectives: updated },
    experienceCompleted,
    eventsToAppend: [
      makeEvent(SESSION_EVENTS.OBJECTIVE_MARKED, req.trigger, {
        phase: currentId,
        objectiveId: targetId,
        ...(req.op.note ? { note: req.op.note } : {}),
      }),
    ],
    systemMessage: null,
  };
}

function handleForwardNavigation(
  config: ExperienceConfig,
  state: WorkflowPhaseState,
  experienceCompleted: boolean,
  req: TransitionRequest,
  targetId: string,
  skipped: string[],
): TransitionResult {
  const phases = loadWorkflowPhases(config);
  const fromId = state.currentPhase!;
  const fromIndex = findIndex(phases, fromId);
  const targetIndex = findIndex(phases, targetId);
  if (targetIndex < 0) {
    throw new InvalidPhaseError(`Unknown workflow phase id "${targetId}".`);
  }
  if (targetIndex <= fromIndex) {
    throw new InvalidPhaseError(
      `Forward navigation requires a target after the current phase ("${fromId}"), got "${targetId}".`,
    );
  }
  const toPhase = phases[targetIndex];

  const events: SessionEvent[] = [];

  // Implicit completion of leaving phase, if not already complete.
  const { completedPhases, alreadyCompleted } = ensureCompleted(
    state,
    fromId,
  );
  if (!alreadyCompleted) {
    events.push(
      makeEvent(SESSION_EVENTS.PHASE_COMPLETED, req.trigger, {
        phase: fromId,
      }),
    );
  }

  events.push(
    makeEvent(SESSION_EVENTS.WORKFLOW_PHASE_LEFT, req.trigger, {
      phase: fromId,
      to: targetId,
      reason: req.reason,
    }),
  );

  for (const skippedId of skipped) {
    events.push(
      makeEvent(SESSION_EVENTS.WORKFLOW_PHASE_SKIPPED, req.trigger, {
        phase: skippedId,
        from: fromId,
        to: targetId,
      }),
    );
  }

  events.push(
    makeEvent(SESSION_EVENTS.WORKFLOW_PHASE_ENTERED, req.trigger, {
      phase: targetId,
      from: fromId,
      direction: 'forward',
      ...(skipped.length > 0 ? { skipped } : {}),
    }),
  );

  // Build skipped-objectives payload for the system message.
  const skippedObjectives = skipped
    .map((id) => {
      const phase = phases.find((p) => p.id === id);
      return phase?.objectives && phase.objectives.length > 0
        ? { phase: id, objectives: phase.objectives }
        : undefined;
    })
    .filter((entry): entry is { phase: string; objectives: WorkflowPhaseObjective[] } =>
      entry !== undefined,
    );

  // Compute first-entry against the pre-mutation visited list — appendVisited
  // hasn't run yet, so `state.visited` is the source of truth here.
  const isFirstEntry = !state.visited.includes(targetId);

  const systemMessage = buildSystemMessage(
    {
      direction: 'forward',
      isFirstEntry,
      fromPhase: fromId,
      toPhase: targetId,
      trigger: req.trigger,
      ...(skipped.length > 0 ? { skipped } : {}),
      ...(skippedObjectives.length > 0 ? { skippedObjectives } : {}),
    },
    toPhase,
    phases,
  );

  const newState: WorkflowPhaseState = {
    ...state,
    currentPhase: targetId,
    furthestPhase: pickFurthest(phases, state.furthestPhase, targetId),
    visited: appendVisited(state.visited, targetId),
    completedPhases,
    nextPhaseOverride: undefined,
  };

  // Compute unmetObjectives from skipped phases for caller surface.
  const unmetObjectives =
    skippedObjectives.length > 0 ? skippedObjectives : undefined;

  return {
    newState,
    experienceCompleted,
    eventsToAppend: events,
    systemMessage,
    ...(unmetObjectives ? { unmetObjectives } : {}),
  };
}

/**
 * `nextPhase` = complete + advance, atomically, except when the current phase
 * declares `requireEducatorAdvance: true`. In that case it behaves like
 * `complete` only — the educator's Next button must drive the actual advance.
 * This is the standard agent-facing forward op; `complete` and `advance` remain
 * as low-level primitives for the rare case an agent or the UI needs them
 * separately.
 */
function handleNextPhase(
  config: ExperienceConfig,
  state: WorkflowPhaseState,
  experienceCompleted: boolean,
  req: TransitionRequest,
): TransitionResult {
  const phases = loadWorkflowPhases(config);
  const currentId = state.currentPhase;
  if (!currentId) {
    throw new InvalidPhaseError(
      'Cannot nextPhase: no current phase in state.',
    );
  }
  const currentPhase = requireKnownPhase(phases, currentId);

  if (currentPhase.requireEducatorAdvance) {
    return handleComplete(config, state, experienceCompleted, req);
  }

  // Mark complete first (idempotent on completedPhases), then advance.
  const completeResult = handleComplete(
    config,
    state,
    experienceCompleted,
    req,
  );
  const advanceResult = handleAdvance(
    config,
    completeResult.newState,
    completeResult.experienceCompleted,
    req,
  );

  return {
    newState: advanceResult.newState,
    experienceCompleted: advanceResult.experienceCompleted,
    eventsToAppend: [
      ...completeResult.eventsToAppend,
      ...advanceResult.eventsToAppend,
    ],
    systemMessage: advanceResult.systemMessage,
    ...(advanceResult.restoredSnapshot
      ? { restoredSnapshot: advanceResult.restoredSnapshot }
      : {}),
    ...(advanceResult.unmetObjectives
      ? { unmetObjectives: advanceResult.unmetObjectives }
      : {}),
  };
}

function handleAdvance(
  config: ExperienceConfig,
  state: WorkflowPhaseState,
  experienceCompleted: boolean,
  req: TransitionRequest,
): TransitionResult {
  const phases = loadWorkflowPhases(config);
  const fromId = state.currentPhase!;
  const fromIndex = findIndex(phases, fromId);

  let targetId: string;
  if (state.nextPhaseOverride !== undefined) {
    targetId = state.nextPhaseOverride;
    const targetIndex = findIndex(phases, targetId);
    if (targetIndex < 0) {
      throw new InvalidPhaseError(
        `nextPhaseOverride references unknown phase "${targetId}".`,
      );
    }
    if (targetIndex <= fromIndex) {
      throw new InvalidPhaseError(
        `nextPhaseOverride "${targetId}" is not forward of current phase "${fromId}".`,
      );
    }
  } else {
    if (fromIndex < 0) {
      throw new InvalidPhaseError(
        `Current phase "${fromId}" not found in config.`,
      );
    }
    if (fromIndex >= phases.length - 1) {
      throw new NoNextPhaseError(
        `Cannot advance: "${fromId}" is the last phase and no nextPhaseOverride is set. The agent should call finishExperience.`,
      );
    }
    targetId = phases[fromIndex + 1].id;
  }

  // Skipped intermediates only if jumping further than one ahead via override.
  const targetIndex = findIndex(phases, targetId);
  const skipped: string[] = [];
  for (let i = fromIndex + 1; i < targetIndex; i += 1) {
    skipped.push(phases[i].id);
  }

  return handleForwardNavigation(
    config,
    state,
    experienceCompleted,
    req,
    targetId,
    skipped,
  );
}

function handleSet(
  config: ExperienceConfig,
  state: WorkflowPhaseState,
  experienceCompleted: boolean,
  req: TransitionRequest,
  targetId: string,
): TransitionResult {
  const phases = loadWorkflowPhases(config);
  const fromId = state.currentPhase!;
  const fromIndex = findIndex(phases, fromId);
  const targetIndex = findIndex(phases, targetId);
  if (targetIndex < 0) {
    throw new InvalidPhaseError(`Unknown workflow phase id "${targetId}".`);
  }
  if (targetIndex <= fromIndex) {
    throw new InvalidPhaseError(
      `set requires a forward target; "${targetId}" is not after current phase "${fromId}".`,
    );
  }

  const skipped: string[] = [];
  for (let i = fromIndex + 1; i < targetIndex; i += 1) {
    skipped.push(phases[i].id);
  }

  return handleForwardNavigation(
    config,
    state,
    experienceCompleted,
    req,
    targetId,
    skipped,
  );
}

function handleSetNext(
  config: ExperienceConfig,
  state: WorkflowPhaseState,
  experienceCompleted: boolean,
  req: TransitionRequest,
  targetId: string,
): TransitionResult {
  const phases = loadWorkflowPhases(config);
  const fromId = state.currentPhase!;
  const fromIndex = findIndex(phases, fromId);
  const targetIndex = findIndex(phases, targetId);

  if (targetIndex < 0) {
    throw new InvalidPhaseError(
      `Unknown workflow phase id "${targetId}".`,
    );
  }
  if (targetIndex === fromIndex) {
    throw new InvalidPhaseError(
      `setNext target cannot be the current phase ("${fromId}").`,
    );
  }
  if (targetIndex < fromIndex) {
    throw new InvalidPhaseError(
      `setNext requires a forward target; "${targetId}" is before current phase "${fromId}".`,
    );
  }

  const newState: WorkflowPhaseState = {
    ...state,
    nextPhaseOverride: targetId,
  };

  const events: SessionEvent[] = [
    makeEvent(SESSION_EVENTS.WORKFLOW_NEXT_OVERRIDDEN, req.trigger, {
      targetPhase: targetId,
      from: fromId,
    }),
  ];

  return {
    newState,
    experienceCompleted,
    eventsToAppend: events,
    systemMessage: null,
  };
}

function handleGoTo(
  config: ExperienceConfig,
  state: WorkflowPhaseState,
  experienceCompleted: boolean,
  req: TransitionRequest,
  targetId: string,
): TransitionResult {
  const phases = loadWorkflowPhases(config);
  const fromId = state.currentPhase!;
  const fromIndex = findIndex(phases, fromId);
  const targetIndex = findIndex(phases, targetId);

  if (targetIndex < 0) {
    throw new InvalidPhaseError(`Unknown workflow phase id "${targetId}".`);
  }

  // No-op when target is current phase.
  if (targetIndex === fromIndex) {
    return {
      newState: state,
      experienceCompleted,
      eventsToAppend: [],
      systemMessage: null,
    };
  }

  const toPhase = phases[targetIndex];
  const direction: 'forward' | 'backward' =
    targetIndex < fromIndex ? 'backward' : 'forward';

  const events: SessionEvent[] = [];
  const snapshots = { ...state.snapshots };
  let restoredSnapshot: WorkflowPhaseSnapshot | undefined;

  let newCompletedPhases = state.completedPhases;
  let newCompletedObjectives = state.completedObjectives ?? {};
  // Phase ids whose completion / objectives were cleared by this transition
  // because they sit between target and current and declared
  // `resetOnReentry`. Empty for forward goTo or when no flagged phase sits in
  // the backward range. Surfaced to the agent via the system message.
  let resetPhaseIds: string[] = [];
  let postExperienceCompleted = experienceCompleted;

  if (direction === 'backward') {
    // Save leaving snapshot if provided.
    if (req.currentSnapshot) {
      snapshots[fromId] = req.currentSnapshot;
    }
    restoredSnapshot = snapshots[targetId];

    // Cascade reset: any phase in (targetIndex, fromIndex] that declares
    // `resetOnReentry` AND actually has something to clear (completion or
    // objectives) has its completion + objectives + snapshot wiped. We
    // require "something to clear" so the agent doesn't get a misleading
    // `WORKFLOW_PHASE_RESET: design` notice when it backed out of design
    // without ever marking an objective. The landing phase (targetId) is
    // intentionally excluded — we're returning to it, not leaving it behind.
    // The leaving phase (fromId) is included.
    const phasesToReset = phases
      .slice(targetIndex + 1, fromIndex + 1)
      .filter((p) => {
        if (!p.resetOnReentry) return false;
        const wasCompleted = state.completedPhases.includes(p.id);
        const hadObjectives =
          (state.completedObjectives?.[p.id]?.length ?? 0) > 0;
        return wasCompleted || hadObjectives;
      });
    if (phasesToReset.length > 0) {
      const resetIds = new Set(phasesToReset.map((p) => p.id));
      newCompletedPhases = newCompletedPhases.filter(
        (id) => !resetIds.has(id),
      );
      const filteredObjectives: Record<string, string[]> = {};
      for (const [phaseId, objectives] of Object.entries(
        newCompletedObjectives,
      )) {
        if (!resetIds.has(phaseId)) {
          filteredObjectives[phaseId] = objectives;
        }
      }
      newCompletedObjectives = filteredObjectives;
      // Drop saved layout snapshots for reset phases — the underlying
      // artifacts may be regenerated upstream, so a snapshot's
      // `activeArtifactId` could point at content that's no longer the right
      // surface to restore. Symmetric with clearing completion + objectives.
      for (const id of resetIds) {
        delete snapshots[id];
      }
      resetPhaseIds = phasesToReset.map((p) => p.id);
    }

    // EXPERIENCE_REWOUND must come first per the locked design (it frames the
    // backward navigation that follows).
    if (experienceCompleted) {
      events.push(
        makeEvent(SESSION_EVENTS.EXPERIENCE_REWOUND, req.trigger, {
          from: fromId,
          to: targetId,
        }),
      );
      postExperienceCompleted = false;
    }

    events.push(
      makeEvent(SESSION_EVENTS.WORKFLOW_PHASE_LEFT, req.trigger, {
        phase: fromId,
        to: targetId,
        reason: req.reason,
      }),
    );
    events.push(
      makeEvent(SESSION_EVENTS.WORKFLOW_PHASE_REVISITED, req.trigger, {
        phase: targetId,
        from: fromId,
        reason: req.reason,
      }),
    );
    events.push(
      makeEvent(SESSION_EVENTS.WORKFLOW_PHASE_ENTERED, req.trigger, {
        phase: targetId,
        from: fromId,
        direction: 'backward',
        ...(resetPhaseIds.length > 0 ? { phasesReset: resetPhaseIds } : {}),
      }),
    );
  } else {
    // Forward goTo to a visited phase: no skip events; preserve completedPhases.
    restoredSnapshot = snapshots[targetId];
    events.push(
      makeEvent(SESSION_EVENTS.WORKFLOW_PHASE_LEFT, req.trigger, {
        phase: fromId,
        to: targetId,
        reason: req.reason,
      }),
    );
    events.push(
      makeEvent(SESSION_EVENTS.WORKFLOW_PHASE_ENTERED, req.trigger, {
        phase: targetId,
        from: fromId,
        direction: 'forward',
      }),
    );
  }

  // goTo can land on a never-visited phase (forward jump past gaps) or a
  // visited one (backward navigation, or forward to a previously-visited
  // phase). Compute against the pre-mutation visited list.
  const isFirstEntry = !state.visited.includes(targetId);

  const systemMessage = buildSystemMessage(
    {
      direction,
      isFirstEntry,
      fromPhase: fromId,
      toPhase: targetId,
      trigger: req.trigger,
      ...(experienceCompleted && direction === 'backward'
        ? { experienceRewound: true }
        : {}),
      ...(resetPhaseIds.length > 0 ? { resetPhaseIds } : {}),
    },
    toPhase,
    phases,
  );

  const newState: WorkflowPhaseState = {
    ...state,
    currentPhase: targetId,
    furthestPhase: pickFurthest(phases, state.furthestPhase, targetId),
    visited: appendVisited(state.visited, targetId),
    completedPhases: newCompletedPhases,
    completedObjectives: newCompletedObjectives,
    // User redirection always clears any pending forward override — moving
    // somewhere other than the override target invalidates it.
    nextPhaseOverride: undefined,
    snapshots,
  };

  return {
    newState,
    experienceCompleted: postExperienceCompleted,
    eventsToAppend: events,
    systemMessage,
    ...(restoredSnapshot ? { restoredSnapshot } : {}),
  };
}

function handleFinishExperience(
  config: ExperienceConfig,
  state: WorkflowPhaseState,
  req: TransitionRequest,
): TransitionResult {
  const phases = loadWorkflowPhases(config);
  const currentId = state.currentPhase!;
  const currentPhase = requireKnownPhase(phases, currentId);

  const events: SessionEvent[] = [
    makeEvent(SESSION_EVENTS.EXPERIENCE_COMPLETED, req.trigger, {
      phase: currentId,
    }),
  ];

  const systemMessage = buildSystemMessage(
    {
      // No navigation; the formatter still renders a transition summary, but
      // the destination is the current phase. The terminal experience-completed
      // line is what the agent must act on. Current phase is by definition
      // already visited, so this is never a first entry.
      direction: 'forward',
      isFirstEntry: false,
      fromPhase: currentId,
      toPhase: currentId,
      trigger: req.trigger,
      experienceCompleted: true,
    },
    currentPhase,
    phases,
  );

  const newState: WorkflowPhaseState = {
    ...state,
    nextPhaseOverride: undefined,
  };

  return {
    newState,
    experienceCompleted: true,
    eventsToAppend: events,
    systemMessage,
  };
}

function handleRewind(
  config: ExperienceConfig,
  state: WorkflowPhaseState,
  experienceCompleted: boolean,
  req: TransitionRequest,
): TransitionResult {
  if (!experienceCompleted) {
    throw new InvalidPhaseError(
      'rewind is only valid when experienceCompleted is true.',
    );
  }
  // The previous visited phase is the one immediately before the current
  // entry in the visited list. If somehow the current phase isn't in the
  // visited list, fall back to the last entry.
  const visited = state.visited;
  if (visited.length < 2) {
    throw new InvalidPhaseError(
      'rewind requires at least two visited phases.',
    );
  }
  const currentId = state.currentPhase!;
  let targetId: string | undefined;
  for (let i = visited.length - 1; i >= 0; i -= 1) {
    if (visited[i] !== currentId) {
      targetId = visited[i];
      break;
    }
  }
  if (!targetId) {
    throw new InvalidPhaseError(
      'rewind: no previous visited phase available.',
    );
  }

  // Delegate to goTo; experienceCompleted=true ensures EXPERIENCE_REWOUND
  // is emitted and the flag is cleared.
  return handleGoTo(config, state, experienceCompleted, req, targetId);
}

export function transition(
  config: ExperienceConfig,
  state: WorkflowPhaseState | undefined,
  experienceCompleted: boolean,
  req: TransitionRequest,
): TransitionResult {
  switch (req.op.kind) {
    case 'init':
      return handleInit(config, req);
    case 'complete':
      return handleComplete(
        config,
        requireState(state),
        experienceCompleted,
        req,
      );
    case 'advance':
      return handleAdvance(
        config,
        requireState(state),
        experienceCompleted,
        req,
      );
    case 'nextPhase':
      return handleNextPhase(
        config,
        requireState(state),
        experienceCompleted,
        req,
      );
    case 'set':
      return handleSet(
        config,
        requireState(state),
        experienceCompleted,
        req,
        req.op.targetPhase,
      );
    case 'setNext':
      return handleSetNext(
        config,
        requireState(state),
        experienceCompleted,
        req,
        req.op.targetPhase,
      );
    case 'goTo':
      return handleGoTo(
        config,
        requireState(state),
        experienceCompleted,
        req,
        req.op.targetPhase,
      );
    case 'finishExperience':
      return handleFinishExperience(config, requireState(state), req);
    case 'rewind':
      return handleRewind(
        config,
        requireState(state),
        experienceCompleted,
        req,
      );
    case 'markObjective':
      return handleMarkObjective(config, requireState(state), experienceCompleted, req);
    default: {
      // Exhaustiveness guard.
      const _exhaustive: never = req.op;
      throw new Error(
        `Unknown transition op: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}
