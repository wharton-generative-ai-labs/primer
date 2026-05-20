/**
 * Phase-change message formatter (system role).
 *
 * Pure function that turns a workflow phase-transition payload + the target
 * phase config into a structured prose string. The output is injected into
 * the AI's conversation as a `system`-role item via the same channel
 * `RealtimeController` already uses for component events.
 *
 * The output always:
 *   - starts with the framing prefix `[SYSTEM/workflow_phase_change]` so the
 *     AI cannot mistake it for user prose
 *   - ends with a fixed directive line so the AI knows what to do next
 *
 * No markdown chrome, no LLM-friendliness flourishes — direct lines,
 * predictable structure. The prompt-fragment system already concatenates
 * these injections.
 */

import type {
  WorkflowPhaseConfig,
  WorkflowPhaseObjective,
} from '@/app/lib/workflow-phases';

export interface WorkflowPhaseChangePayload {
  direction: 'forward' | 'backward' | 'initial';
  /**
   * True when the destination phase has never been visited in this session
   * before this transition. Drives cold-start framing and the `coldStart`
   * prompt fragment. Independent of `direction` — `forward` into a
   * never-visited phase is a first entry too.
   */
  isFirstEntry: boolean;
  /** Phase id; undefined when `direction === 'initial'`. */
  fromPhase?: string;
  /** Phase id of the destination. */
  toPhase: string;
  trigger: 'user' | 'agent' | 'system';
  /** Phase ids skipped over on a forward jump. */
  skipped?: string[];
  /** Objectives belonging to skipped phases, paired with the phase id. */
  skippedObjectives?: { phase: string; objectives: WorkflowPhaseObjective[] }[];
  /** True when this transition is `finishExperience`. */
  experienceCompleted?: boolean;
  /** True when this transition cleared `experienceCompleted`. */
  experienceRewound?: boolean;
  /**
   * Phase ids whose completion + objectives were cleared by this transition
   * because the user navigated backward past a phase declaring
   * `resetOnReentry: true`. Surfaced to the agent so it knows it must re-earn
   * those approvals before the educator can advance again.
   */
  resetPhaseIds?: string[];
}

const PREFIX = '[SYSTEM/workflow_phase_change]';
/**
 * Token that identifies a "phase approvals were cleared" notice in the
 * formatted system message. Exported so tests + downstream agents can grep for
 * the same string. Drifting this constant without updating consumers would
 * silently break the agent's reset-recovery instructions, so the test suite
 * pins it.
 */
export const WORKFLOW_PHASE_RESET_PREFIX = 'WORKFLOW_PHASE_RESET:';
const DIRECTIVE =
  'Acknowledge the transition naturally and proceed. CRITICAL: any handoff statement you make in chat ("I\'ll do X", "moving on", "hang tight", "let me draft that") MUST be paired with the corresponding tool call IN THE SAME TURN. Saying you will advance and then ending the turn with no `workflowPhase nextPhase` (or whichever tool fits) leaves the workflow stuck — verbal narration is not action. If you are not ready to act yet, end the turn with an explicit question to the user instead.';
/**
 * Directive override for non-interactive surfaces (`mode: 'build'` and
 * `mode: 'result'`). The user has no chat surface in those phases, so a voice
 * agent that "acknowledges naturally" ends up monologuing into a hidden
 * surface — and on reentry, asking "would you like to resume?" with no answer
 * affordance. Replacing the directive removes both failure modes.
 */
const NON_INTERACTIVE_DIRECTIVE =
  'Do NOT acknowledge or narrate this transition — the user has no chat surface in this phase. Inspect artifact state and resume orchestration silently via tool calls.';

/**
 * Mode-specific guidance auto-injected on every phase entry. Keeps per-experience
 * coldStart fragments terse — agents learn the surface contract from this string,
 * not from per-experience prose.
 */
const MODE_GUIDANCE: Record<NonNullable<WorkflowPhaseConfig['mode']>, string> = {
  interactive:
    'This phase is interactive — converse with the user via the chat surface as normal.',
  build:
    'This phase is non-interactive (build mode). The user sees a checklist UI, NOT the chat. Do NOT narrate progress. Drive the public checklist artifact tagged `phase:<phase_id>` via the `checklist` tool as work completes.',
  result:
    'This phase is a result tile (no chat surface). Stay quiet unless the user initiates further conversation. The tile renders from the configured result artifact.',
};

export function formatWorkflowPhaseChangeMessage(
  payload: WorkflowPhaseChangePayload,
  toPhaseConfig: WorkflowPhaseConfig,
  allPhases?: WorkflowPhaseConfig[],
): string {
  const lines: string[] = [];

  lines.push(PREFIX);

  // Transition summary — always present, in a fixed order.
  lines.push(`direction: ${payload.direction}`);
  if (payload.fromPhase !== undefined) {
    lines.push(`from: ${payload.fromPhase}`);
  }
  lines.push(`to: ${payload.toPhase}`);
  lines.push(`trigger: ${payload.trigger}`);

  // Forward skip framing.
  const hasSkipped = (payload.skipped?.length ?? 0) > 0;
  if (hasSkipped) {
    lines.push(`skipped: ${payload.skipped!.join(', ')}`);
    if (payload.skippedObjectives && payload.skippedObjectives.length > 0) {
      lines.push('skipped_objectives:');
      for (const entry of payload.skippedObjectives) {
        lines.push(`  ${entry.phase}:`);
        for (const objective of entry.objectives) {
          lines.push(`    - ${objective.description}`);
        }
      }
    }
  }

  // Backward → revisit framing.
  if (payload.direction === 'backward') {
    lines.push(
      `WORKFLOW_PHASE_REVISITED: the user has moved back to ${payload.toPhase}. Treat this as a revisit, not a fresh entry.`,
    );
  }

  // Reset notice — the user navigated backward past one or more phases that
  // declared `resetOnReentry`. Their completion + objectives have been
  // cleared, so the corresponding approval gates are locked again until the
  // agent re-earns them. Wording acknowledges `requireEducatorAdvance`: the
  // agent re-marks objectives + calls nextPhase, but the human still has to
  // click the button on educator-gated phases.
  if (payload.resetPhaseIds && payload.resetPhaseIds.length > 0) {
    lines.push(
      `${WORKFLOW_PHASE_RESET_PREFIX} the following phase approvals were cleared because the user navigated backward past them: ${payload.resetPhaseIds.join(', ')}. For each, re-mark its objectives and call workflowPhase nextPhase. The phase will return to the same gate state it was in before — phases with \`requireEducatorAdvance: true\` will re-lock the user-side button until you complete and the user re-confirms.`,
    );
  }

  // First entry into the destination phase → cold-start framing + optional
  // coldStart fragment. Triggered by ANY first entry (initial session bootstrap
  // OR forward navigation into a never-visited phase) — gating on
  // `direction === 'initial'` would drop coldStart for all advance/set/goTo
  // moves, leaving downstream phases with no instructions.
  if (payload.isFirstEntry) {
    if (payload.direction === 'initial') {
      lines.push(
        `Cold start: this is the first entry into ${payload.toPhase}. The session begins here.`,
      );
    } else {
      lines.push(
        `Cold start: this is the first entry into ${payload.toPhase}.`,
      );
    }
    const coldStart = toPhaseConfig.promptFragments?.coldStart;
    if (coldStart) {
      lines.push(coldStart);
    }
  }

  // Re-entry → optional reentry fragment when the phase has been visited
  // before.
  if (!payload.isFirstEntry) {
    const reentry = toPhaseConfig.promptFragments?.reentry;
    if (reentry) {
      lines.push(reentry);
    }
  }

  // After-skip fragment, only when something was actually skipped.
  if (hasSkipped) {
    const afterSkip = toPhaseConfig.promptFragments?.afterSkip;
    if (afterSkip) {
      lines.push(afterSkip);
    }
  }

  // Phase title + description from config.
  lines.push(`phase_title: ${toPhaseConfig.title}`);
  // Phase position within the workflow — lets the agent locate itself without
  // a tool round-trip. Skipped when `allPhases` isn't passed (legacy callers)
  // or when the destination phase isn't in the list (defensive).
  if (allPhases && allPhases.length > 0) {
    const positionIdx = allPhases.findIndex((p) => p.id === payload.toPhase);
    if (positionIdx >= 0) {
      lines.push(`phase_position: ${positionIdx + 1} of ${allPhases.length}`);
    }
  }
  if (toPhaseConfig.description) {
    lines.push(`phase_description: ${toPhaseConfig.description}`);
  }

  // Auto-derived per-phase contract. Everything here comes from phase config
  // — no per-experience prose required. Keeping these in the system message
  // means agents always see the up-to-date contract, even when individual
  // prompt files drift.
  const mode = toPhaseConfig.mode ?? 'interactive';
  lines.push(`mode: ${mode}`);
  lines.push(
    `mode_guidance: ${MODE_GUIDANCE[mode].replace('<phase_id>', payload.toPhase)}`,
  );

  // Objectives for the destination phase (separate from skipped_objectives,
  // which only appears on a forward jump). Pure documentation: the list
  // tells the agent what success looks like in this phase. There is no
  // `markObjective` tool action and no gate — when the agent calls
  // `nextPhase` the server auto-marks any unmet ids and proceeds. Earlier
  // revisions appended an `objectives_directive` line teaching the agent
  // to call `markObjective` per objective; that surfaced a recover-after-
  // rejection failure mode that prompt engineering couldn't eliminate, so
  // the directive (and the underlying gate) was removed in favor of
  // server-side auto-marking. See `WorkflowPhaseManager.handleComplete`.
  if (toPhaseConfig.objectives && toPhaseConfig.objectives.length > 0) {
    lines.push('objectives:');
    for (const objective of toPhaseConfig.objectives) {
      lines.push(`  - ${objective.id}: ${objective.description}`);
    }
  }

  // Allowed-delegates allowlist. Only emitted when the field is defined; an
  // empty array means "no delegates allowed in this phase" and is meaningful.
  if (toPhaseConfig.allowedDelegates !== undefined) {
    if (toPhaseConfig.allowedDelegates.length === 0) {
      lines.push(
        'allowed_delegates: (none) — `agent` tool `delegate` action is refused in this phase. Advance via `workflowPhase nextPhase` first.',
      );
    } else {
      lines.push(
        `allowed_delegates: ${toPhaseConfig.allowedDelegates.join(', ')} — other delegate targets will be refused server-side.`,
      );
    }
  }

  // Forward-op guidance. Tells the agent exactly which tool call moves the
  // workflow on, with semantics matching this phase's config.
  if (allPhases && allPhases.length > 0) {
    const idx = allPhases.findIndex((p) => p.id === payload.toPhase);
    const isLast = idx >= 0 && idx === allPhases.length - 1;
    if (isLast) {
      lines.push(
        'forward_op: This is the final phase. Use `finishExperience({ reason })` to close out — do NOT call `workflowPhase nextPhase`.',
      );
    } else if (toPhaseConfig.requireEducatorAdvance) {
      lines.push(
        'forward_op: When ready to move on, call `workflowPhase nextPhase`. The phase is marked complete but does NOT auto-advance — the user will press Next themselves when ready.',
      );
    } else {
      lines.push(
        'forward_op: When ready to move on, call `workflowPhase nextPhase` — that single call marks this phase complete AND advances to the next phase atomically.',
      );
    }
  } else if (toPhaseConfig.requireEducatorAdvance) {
    // Defensive fallback — when phases list isn't passed we can't detect the
    // last phase, so we omit the last-phase variant but still surface the
    // educator-gated semantics where applicable.
    lines.push(
      'forward_op: When ready to move on, call `workflowPhase nextPhase`. The phase is marked complete but does NOT auto-advance — the user will press Next themselves when ready.',
    );
  } else {
    lines.push(
      'forward_op: When ready to move on, call `workflowPhase nextPhase` — that single call marks this phase complete AND advances to the next phase atomically.',
    );
  }

  // Terminal experience-completed line.
  if (payload.experienceCompleted) {
    lines.push(
      'EXPERIENCE_COMPLETED: the experience is finished. Deliver a brief wrap-up message to the user that closes out the session.',
    );
  }

  // Rewound from a finished state.
  if (payload.experienceRewound) {
    lines.push(
      `EXPERIENCE_REWOUND: the user navigated back from finished — here is where we are now: ${payload.toPhase}.`,
    );
  }

  // Fixed directive line — must always be last. Non-interactive phases get
  // the silent-orchestrate variant so voice agents don't narrate into a
  // surface the user can't see (and don't ask "want to resume?" on reentry
  // with no chat to answer in).
  const nonInteractive = mode === 'build' || mode === 'result';
  lines.push(nonInteractive ? NON_INTERACTIVE_DIRECTIVE : DIRECTIVE);

  return lines.join('\n');
}
