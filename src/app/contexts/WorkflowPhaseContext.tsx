"use client";

/**
 * Client provider that mirrors the server-side workflow-phase state for the
 * current session. Mounted *inside* `PlayPageInner` so it can compose
 * `LayoutContext`, `SceneContext`, `ArtifactContext`, and the local
 * `selectedAgentKey` when snapshot capture lands in Task A10.
 *
 * Responsibilities:
 *   - Hydrate from `GET /api/workflow-phases/state` once on mount.
 *   - Drive backward / forward navigation through
 *     `POST /api/workflow-phases/transition`, applying the response to local
 *     state.
 *   - Dispatch a `workflow-phase-change` window event after each navigation so
 *     `useAgentSwitching` (Task A12) can inject the system message and queue
 *     any required agent transfer.
 *
 * No-phases fallback: when the experience declares no phases, the provider
 * still renders children but exposes empty arrays / no-op handlers so consumers
 * (e.g. the navigation strip in Task A14) can render nothing.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  WorkflowPhaseConfig,
  WorkflowPhaseSnapshot,
  WorkflowPhaseState,
} from '@/app/lib/workflow-phases';
import type { TransitionOp } from '@/app/lib/workflow-phases/WorkflowPhaseManager';

/**
 * Public result of a non-navigation transition triggered by the agent. The
 * agent tool's contract surfaces `ok` and an optional message; the additional
 * fields let the LLM observe what changed without re-querying state.
 */
export interface PhaseOperationResult {
  ok: boolean;
  message?: string;
  currentPhase?: string;
  nextPhaseOverride?: string;
  experienceCompleted?: boolean;
}

export interface WorkflowPhaseContextValue {
  phases: WorkflowPhaseConfig[];
  currentPhase?: WorkflowPhaseConfig;
  furthestPhase?: WorkflowPhaseConfig;
  visited: string[];
  completedPhases: string[];
  /**
   * Per-phase per-objective ledger. Mirrors `state.completedObjectives`.
   * Used by the strip to build the advance-request message; also surfaced
   * via `workflowPhase current` to the agent.
   */
  completedObjectives: Record<string, string[]>;
  nextPhaseOverride?: string;
  experienceCompleted: boolean;
  isLoading: boolean;
  /** User-driven backward nav to any visited phase. */
  goToPhase: (id: string, opts?: { reason?: string }) => Promise<void>;
  /**
   * Forward-by-one. Honors override. The strip's Next button calls this with
   * no args (defaulting to `trigger: 'user'`); the agent path passes
   * `{ trigger: 'agent' }` so the event log records the right source.
   */
  advance: (opts?: { trigger?: 'user' | 'agent' | 'system' }) => Promise<void>;
  /** Backward-by-one via the strip's Back button. If experienceCompleted, also clears the flag (rewind). */
  goBack: () => Promise<void>;
  /**
   * Mark the current phase ready-to-advance. Does not navigate. Idempotent.
   * Updates local `completedPhases` so the strip's Next button enables.
   */
  complete: () => Promise<PhaseOperationResult>;
  /**
   * Mark complete + advance forward by one, atomically. The agent-preferred
   * forward op. If the current phase declares `requireEducatorAdvance: true`,
   * collapses to `complete` only.
   */
  nextPhase: () => Promise<PhaseOperationResult>;
  /** Forward jump to a named phase. Backward jumps are refused server-side. */
  setPhase: (targetPhase: string) => Promise<PhaseOperationResult>;
  /** Record a forward override for the next `advance`. Forward-only. */
  setNext: (targetPhase: string) => Promise<PhaseOperationResult>;
  /**
   * Record that a named objective on the current phase has been covered.
   * Idempotent; does not navigate. Mirrors `state.completedObjectives` into
   * the per-phase ledger so the strip's advance-request message and the
   * agent's `workflowPhase current` output reflect the mark.
   */
  markObjective: (
    id: string,
    opts?: { note?: string },
  ) => Promise<PhaseOperationResult>;
  /** Finalize the experience. Sets `experienceCompleted` and shows the closing dialog. */
  finishExperience: (reason?: string) => Promise<PhaseOperationResult>;
  /**
   * Re-fetches `/api/workflow-phases/state` and applies the response to local
   * state. Call this after any backend-agent transition (e.g. after
   * `agent.delegate` returns) so the strip's Next button reflects server-side
   * changes that bypassed the provider's mutation callbacks.
   */
  refetchState: () => Promise<void>;
  /** Resolved next-phase target after consulting nextPhaseOverride. */
  resolvedNextPhaseId?: string;
  /**
   * Resolved next-phase config (looked up from `resolvedNextPhaseId`). Exposed
   * so the strip can branch on `resolvedNextPhase.mode` — pressing Next into a
   * non-interactive phase (`mode: 'build'` or `'result'`) has different
   * semantics than an interactive-to-interactive hop, and the strip needs the
   * destination's full config (not just its id) to make that call without
   * re-implementing override math.
   */
  resolvedNextPhase?: WorkflowPhaseConfig;
  /**
   * Resolved backward-nav target: nearest earlier entry in `visited` whose
   * phase is interactive (i.e. not `mode: 'build'` or `mode: 'result'`).
   * Undefined when no interactive predecessor exists — in that case the strip
   * hides the Back button entirely.
   */
  backTargetId?: string;
}

export const WorkflowPhaseContext =
  createContext<WorkflowPhaseContextValue | null>(null);

export function useWorkflowPhase(): WorkflowPhaseContextValue {
  const value = useContext(WorkflowPhaseContext);
  if (!value) {
    throw new Error(
      'useWorkflowPhase must be used inside a WorkflowPhaseProvider',
    );
  }
  return value;
}

export interface WorkflowPhaseProviderProps {
  /** Phases from ConfigResponse.metadata.workflowPhases — empty/undefined disables the provider. */
  phases?: WorkflowPhaseConfig[];
  experienceId: string;
  sessionId: string;
  /** Currently selected agent key from PlayPageInner; used in snapshots. */
  selectedAgentKey?: string;
  children: React.ReactNode;
}

interface TransitionResponse {
  newState: WorkflowPhaseState;
  experienceCompleted: boolean;
  systemMessage: string | null;
  restoredSnapshot?: WorkflowPhaseSnapshot;
}

/**
 * Discriminated result of a `POST /api/workflow-phases/transition` call.
 *
 * On `ok: false` we carry `message` — for HTTP errors we forward the route's
 * `{ error }` payload verbatim. The transition manager builds richly
 * actionable strings (e.g. "Cannot advance: \"review\" is the last phase
 * and no nextPhaseOverride is set. The agent should call finishExperience.")
 * and the agent can only self-correct if the client surfaces them instead
 * of swallowing into a generic "transition failed".
 */
type PostTransitionResult =
  | { ok: true; response: TransitionResponse }
  | { ok: false; message: string };

interface StateResponse {
  workflowPhaseState: WorkflowPhaseState | null;
  experienceCompleted: boolean;
  workflowPhases: WorkflowPhaseConfig[];
}

const EMPTY_STATE: WorkflowPhaseState = {
  visited: [],
  completedPhases: [],
  completedObjectives: {},
  snapshots: {},
};

function buildEmptyValue(): WorkflowPhaseContextValue {
  const noop = async () => {
    /* no-op for experiences without workflow phases */
  };
  const noopOp = async (): Promise<PhaseOperationResult> => ({ ok: true });
  return {
    phases: [],
    currentPhase: undefined,
    furthestPhase: undefined,
    visited: [],
    completedPhases: [],
    completedObjectives: {},
    nextPhaseOverride: undefined,
    experienceCompleted: false,
    isLoading: false,
    goToPhase: noop,
    advance: noop,
    goBack: noop,
    complete: noopOp,
    nextPhase: noopOp,
    setPhase: noopOp,
    setNext: noopOp,
    markObjective: noopOp,
    finishExperience: noopOp,
    refetchState: noop,
    resolvedNextPhaseId: undefined,
    resolvedNextPhase: undefined,
    backTargetId: undefined,
  };
}

/**
 * Walk `visited` backward (skipping the current entry at the tail) and return
 * the first id whose phase is interactive. Non-interactive phases (`build` /
 * `result`) are transit-only surfaces with no chat affordance — landing the
 * user there on Back leaves them stuck and risks the agent re-running the
 * build's coldStart. We skip past them to the nearest interactive ancestor.
 */
function findBackwardTarget(
  visited: string[],
  phases: WorkflowPhaseConfig[],
): string | undefined {
  for (let i = visited.length - 2; i >= 0; i--) {
    const id = visited[i];
    const cfg = phases.find((p) => p.id === id);
    if (!cfg) continue;
    const mode = cfg.mode ?? 'interactive';
    if (mode !== 'build' && mode !== 'result') return id;
  }
  return undefined;
}

function resolveAgentForPhase(
  phaseConfig: WorkflowPhaseConfig | undefined,
  restoredSnapshot: WorkflowPhaseSnapshot | undefined,
  fallback: 'initial' | 'reentry',
): string | undefined {
  if (!phaseConfig) return undefined;
  if (fallback === 'reentry') {
    // Backward / re-entry: author's reentryAgent wins, then snapshot, then initial.
    if (phaseConfig.reentryAgent) return phaseConfig.reentryAgent;
    if (restoredSnapshot?.selectedAgentKey) {
      return restoredSnapshot.selectedAgentKey;
    }
    return phaseConfig.initialAgent;
  }
  // Forward into a (possibly-new) phase: prefer initialAgent, fall back to
  // reentryAgent or snapshot if for some reason it has been visited before.
  if (phaseConfig.initialAgent) return phaseConfig.initialAgent;
  if (restoredSnapshot?.selectedAgentKey) {
    return restoredSnapshot.selectedAgentKey;
  }
  return phaseConfig.reentryAgent;
}

export function WorkflowPhaseProvider(
  props: WorkflowPhaseProviderProps,
): React.ReactElement {
  const { phases: initialPhases, experienceId, sessionId, children } = props;

  const hasPhases = (initialPhases?.length ?? 0) > 0;

  // Hold the empty-value object stable across renders for the no-phases path.
  const emptyValueRef = useRef<WorkflowPhaseContextValue | null>(null);
  if (!emptyValueRef.current) {
    emptyValueRef.current = buildEmptyValue();
  }

  const [phases, setPhases] = useState<WorkflowPhaseConfig[]>(
    initialPhases ?? [],
  );
  const [state, setState] = useState<WorkflowPhaseState>(EMPTY_STATE);
  const [experienceCompleted, setExperienceCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(hasPhases);

  // Hydrate from the server. Cancellation guard is the standard
  // unmount-during-fetch pattern.
  useEffect(() => {
    if (!hasPhases) return;
    // `PlayPageInner` seeds `sessionId` from `sessionStorage` inside an
    // effect, so the provider mounts with an empty string on the first
    // render. Skip the fetch until the real id lands; this effect re-runs
    // when `sessionId` changes.
    if (!sessionId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/workflow-phases/state', {
          method: 'GET',
          headers: {
            'x-experience-id': experienceId,
            'x-session-id': sessionId,
          },
        });
        if (!res.ok) {
          // Leave the seeded state in place; mark loading complete so
          // consumers can decide what to render.
          if (!cancelled) setIsLoading(false);
          return;
        }
        const body = (await res.json()) as StateResponse;
        if (cancelled) return;

        // The API response is the source of truth post-creation; the prop is
        // only used to seed before the fetch resolves.
        if (body.workflowPhases && body.workflowPhases.length > 0) {
          setPhases(body.workflowPhases);
        }
        setState(body.workflowPhaseState ?? EMPTY_STATE);
        setExperienceCompleted(body.experienceCompleted ?? false);
      } catch {
        // Fetch failure is non-fatal; consumers can still render based on the
        // seeded `phases` prop. The strip just won't have any state to act on.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPhases, experienceId, sessionId]);

  const postTransition = useCallback(
    async (
      op: TransitionOp,
      opts?: { trigger?: 'user' | 'agent' | 'system'; reason?: string },
    ): Promise<PostTransitionResult> => {
      // Guard: sessionId is seeded in a useEffect and arrives as "" on the
      // first render. Sending an empty header would get a 400 from the API
      // and silently leave the strip stuck. Bail early so callers can
      // surface { ok: false } to the agent/strip.
      if (!sessionId) {
        return { ok: false, message: 'transition failed: no active session' };
      }
      // TODO(A10): capture snapshot via useWorkflowPhaseSnapshot and pass as
      // currentSnapshot. For now the server tolerates an absent snapshot.
      let res: Response;
      try {
        res = await fetch('/api/workflow-phases/transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-experience-id': experienceId,
            'x-session-id': sessionId,
          },
          body: JSON.stringify({
            op,
            trigger: opts?.trigger ?? 'user',
            ...(opts?.reason ? { reason: opts.reason } : {}),
          }),
        });
      } catch (e) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : 'transition failed: network error',
        };
      }
      if (!res.ok) {
        // The route returns `{ error: <human-readable message> }` on 4xx/5xx.
        // We forward that message verbatim so the agent — and the strip —
        // can act on it. The transition manager builds richly actionable
        // strings (e.g. "Cannot advance: \"review\" is the last phase. Call
        // finishExperience instead.") and the agent can only self-correct
        // when the client surfaces them instead of swallowing into a
        // generic placeholder.
        let serverMessage: string | undefined;
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body?.error === 'string' && body.error.trim() !== '') {
            serverMessage = body.error;
          }
        } catch {
          // Non-JSON body (e.g. an HTML error page) — fall through to the
          // status-code fallback so callers still get *something* useful.
        }
        return {
          ok: false,
          message: serverMessage ?? `transition failed: HTTP ${res.status}`,
        };
      }
      const response = (await res.json()) as TransitionResponse;
      return { ok: true, response };
    },
    [experienceId, sessionId],
  );

  const dispatchPhaseChange = useCallback(
    (systemMessage: string | null, toAgent: string | undefined) => {
      if (typeof window === 'undefined') return;
      window.dispatchEvent(
        new CustomEvent('workflow-phase-change', {
          detail: { systemMessage, toAgent },
        }),
      );
    },
    [],
  );

  const applyResponse = useCallback(
    (response: TransitionResponse) => {
      setState(response.newState);
      setExperienceCompleted(response.experienceCompleted);
    },
    [],
  );

  const goToPhase = useCallback(
    async (id: string, opts?: { reason?: string }): Promise<void> => {
      if (!hasPhases) return;
      const result = await postTransition(
        { kind: 'goTo', targetPhase: id },
        { reason: opts?.reason },
      );
      if (!result.ok) return;
      const { response } = result;
      applyResponse(response);
      const targetPhaseConfig = phases.find((p) => p.id === id);
      const toAgent = resolveAgentForPhase(
        targetPhaseConfig,
        response.restoredSnapshot,
        'reentry',
      );
      dispatchPhaseChange(response.systemMessage, toAgent);
    },
    [hasPhases, postTransition, applyResponse, phases, dispatchPhaseChange],
  );

  const advance = useCallback(
    async (opts?: { trigger?: 'user' | 'agent' | 'system' }): Promise<void> => {
      if (!hasPhases) return;
      const result = await postTransition(
        { kind: 'advance' },
        { trigger: opts?.trigger },
      );
      if (!result.ok) return;
      const { response } = result;
      applyResponse(response);
      const newCurrentId = response.newState.currentPhase;
      const targetPhaseConfig = newCurrentId
        ? phases.find((p) => p.id === newCurrentId)
        : undefined;
      const toAgent = resolveAgentForPhase(
        targetPhaseConfig,
        response.restoredSnapshot,
        'initial',
      );
      dispatchPhaseChange(response.systemMessage, toAgent);
    },
    [hasPhases, postTransition, applyResponse, phases, dispatchPhaseChange],
  );

  const goBack = useCallback(async (): Promise<void> => {
    if (!hasPhases) return;
    const visited = state.visited;
    if (visited.length < 2) {
      return;
    }
    const prevId = findBackwardTarget(visited, phases);
    if (!prevId) {
      // Every predecessor is non-interactive — no valid Back target. The strip
      // should already be hiding the button via `backTargetId`, but guard the
      // path in case a programmatic caller reaches here.
      return;
    }
    const result = await postTransition({
      kind: 'goTo',
      targetPhase: prevId,
    });
    if (!result.ok) return;
    const { response } = result;
    applyResponse(response);
    const targetPhaseConfig = phases.find((p) => p.id === prevId);
    const toAgent = resolveAgentForPhase(
      targetPhaseConfig,
      response.restoredSnapshot,
      'reentry',
    );
    dispatchPhaseChange(response.systemMessage, toAgent);
  }, [
    hasPhases,
    state.visited,
    postTransition,
    applyResponse,
    phases,
    dispatchPhaseChange,
  ]);

  // Agent-driven non-navigation ops. Each calls postTransition (which already
  // posts the right session/experience headers and returns the parsed body),
  // then applies the response so consumers re-render. Without this, the
  // server's `completedPhases`, `nextPhaseOverride`, and `experienceCompleted`
  // updates never reach the strip and the user gets stuck (e.g. the Next
  // button remains disabled after `complete`).
  const complete = useCallback(async (): Promise<PhaseOperationResult> => {
    if (!hasPhases) return { ok: true };
    const result = await postTransition(
      { kind: 'complete' },
      { trigger: 'agent' },
    );
    if (!result.ok) return { ok: false, message: result.message };
    const { response } = result;
    applyResponse(response);
    dispatchPhaseChange(response.systemMessage, undefined);
    return {
      ok: true,
      currentPhase: response.newState.currentPhase,
      experienceCompleted: response.experienceCompleted,
    };
  }, [hasPhases, postTransition, applyResponse, dispatchPhaseChange]);

  const nextPhase = useCallback(async (): Promise<PhaseOperationResult> => {
    if (!hasPhases) return { ok: true };
    const result = await postTransition(
      { kind: 'nextPhase' },
      { trigger: 'agent' },
    );
    if (!result.ok) return { ok: false, message: result.message };
    const { response } = result;
    applyResponse(response);
    const newCurrentId = response.newState.currentPhase;
    const targetPhaseConfig = newCurrentId
      ? phases.find((p) => p.id === newCurrentId)
      : undefined;
    const toAgent = resolveAgentForPhase(
      targetPhaseConfig,
      response.restoredSnapshot,
      'initial',
    );
    dispatchPhaseChange(response.systemMessage, toAgent);
    return {
      ok: true,
      currentPhase: response.newState.currentPhase,
      experienceCompleted: response.experienceCompleted,
    };
  }, [hasPhases, postTransition, applyResponse, phases, dispatchPhaseChange]);

  const setPhase = useCallback(
    async (targetPhase: string): Promise<PhaseOperationResult> => {
      if (!hasPhases) return { ok: true };
      const result = await postTransition(
        { kind: 'set', targetPhase },
        { trigger: 'agent' },
      );
      if (!result.ok) return { ok: false, message: result.message };
      const { response } = result;
      applyResponse(response);
      const targetPhaseConfig = phases.find((p) => p.id === targetPhase);
      const toAgent = resolveAgentForPhase(
        targetPhaseConfig,
        response.restoredSnapshot,
        'initial',
      );
      dispatchPhaseChange(response.systemMessage, toAgent);
      return {
        ok: true,
        currentPhase: response.newState.currentPhase,
        experienceCompleted: response.experienceCompleted,
      };
    },
    [hasPhases, postTransition, applyResponse, phases, dispatchPhaseChange],
  );

  const setNext = useCallback(
    async (targetPhase: string): Promise<PhaseOperationResult> => {
      if (!hasPhases) return { ok: true };
      const result = await postTransition(
        { kind: 'setNext', targetPhase },
        { trigger: 'agent' },
      );
      if (!result.ok) return { ok: false, message: result.message };
      const { response } = result;
      applyResponse(response);
      dispatchPhaseChange(response.systemMessage, undefined);
      return {
        ok: true,
        nextPhaseOverride: response.newState.nextPhaseOverride,
      };
    },
    [hasPhases, postTransition, applyResponse, dispatchPhaseChange],
  );

  const markObjective = useCallback(
    async (
      id: string,
      opts?: { note?: string },
    ): Promise<PhaseOperationResult> => {
      if (!hasPhases) return { ok: true };
      const result = await postTransition(
        { kind: 'markObjective', id, ...(opts?.note ? { note: opts.note } : {}) },
        { trigger: 'agent' },
      );
      if (!result.ok) return { ok: false, message: result.message };
      applyResponse(result.response);
      return {
        ok: true,
        currentPhase: result.response.newState.currentPhase,
      };
    },
    [hasPhases, postTransition, applyResponse],
  );

  const finishExperience = useCallback(
    async (reason?: string): Promise<PhaseOperationResult> => {
      if (!hasPhases) return { ok: true };
      const result = await postTransition(
        { kind: 'finishExperience' },
        { trigger: 'agent', reason },
      );
      if (!result.ok) return { ok: false, message: result.message };
      const { response } = result;
      applyResponse(response);
      dispatchPhaseChange(response.systemMessage, undefined);
      return {
        ok: true,
        experienceCompleted: response.experienceCompleted,
      };
    },
    [hasPhases, postTransition, applyResponse, dispatchPhaseChange],
  );

  const refetchState = useCallback(async (): Promise<void> => {
    if (!hasPhases || !sessionId) return;
    try {
      const res = await fetch('/api/workflow-phases/state', {
        method: 'GET',
        headers: {
          'x-experience-id': experienceId,
          'x-session-id': sessionId,
        },
      });
      if (!res.ok) return;
      const body = (await res.json()) as StateResponse;
      if (body.workflowPhases && body.workflowPhases.length > 0) {
        setPhases(body.workflowPhases);
      }
      setState(body.workflowPhaseState ?? EMPTY_STATE);
      setExperienceCompleted(body.experienceCompleted ?? false);
    } catch {
      // Non-fatal: the strip will just keep showing the last-known state.
    }
  }, [hasPhases, experienceId, sessionId]);

  const value = useMemo<WorkflowPhaseContextValue>(() => {
    if (!hasPhases) {
      return emptyValueRef.current!;
    }

    const currentPhase = state.currentPhase
      ? phases.find((p) => p.id === state.currentPhase)
      : undefined;
    const furthestPhase = state.furthestPhase
      ? phases.find((p) => p.id === state.furthestPhase)
      : undefined;

    let resolvedNextPhaseId: string | undefined;
    if (state.nextPhaseOverride) {
      resolvedNextPhaseId = state.nextPhaseOverride;
    } else if (state.currentPhase) {
      const idx = phases.findIndex((p) => p.id === state.currentPhase);
      if (idx >= 0 && idx + 1 < phases.length) {
        resolvedNextPhaseId = phases[idx + 1].id;
      }
    }
    const resolvedNextPhase = resolvedNextPhaseId
      ? phases.find((p) => p.id === resolvedNextPhaseId)
      : undefined;

    const backTargetId = findBackwardTarget(state.visited, phases);

    return {
      phases,
      currentPhase,
      furthestPhase,
      visited: state.visited,
      completedPhases: state.completedPhases,
      completedObjectives: state.completedObjectives ?? {},
      nextPhaseOverride: state.nextPhaseOverride,
      experienceCompleted,
      isLoading,
      goToPhase,
      advance,
      goBack,
      complete,
      nextPhase,
      setPhase,
      setNext,
      markObjective,
      finishExperience,
      refetchState,
      resolvedNextPhaseId,
      resolvedNextPhase,
      backTargetId,
    };
  }, [
    hasPhases,
    phases,
    state,
    experienceCompleted,
    isLoading,
    goToPhase,
    advance,
    goBack,
    complete,
    nextPhase,
    setPhase,
    setNext,
    markObjective,
    finishExperience,
    refetchState,
  ]);

  return (
    <WorkflowPhaseContext.Provider value={value}>
      {children}
    </WorkflowPhaseContext.Provider>
  );
}
