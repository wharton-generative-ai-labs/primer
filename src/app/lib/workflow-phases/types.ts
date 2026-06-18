/**
 * Workflow-phase types.
 *
 * These types describe the authored phase structure (see `WorkflowPhaseConfig`)
 * and the per-session runtime state (`WorkflowPhaseState`) that tracks which
 * phase a learner is in, how far they've progressed, and the per-phase view
 * snapshots used to restore layout when revisiting.
 */

import type { DocumentTab } from '@/app/contexts/LayoutContext';

export interface WorkflowPhaseObjective {
  id: string;
  description: string;
  /**
   * Optional declarative auto-mark trigger. When unset, the objective is
   * agent-marked (via `workflowPhase markObjective`). When set, the server
   * auto-marks this objective when the named condition fires during the
   * phase. Both classes write to `state.completedObjectives[phaseId]`.
   */
  satisfiedBy?: ObjectiveTrigger;
}

/**
 * Declarative auto-mark triggers for `WorkflowPhaseObjective.satisfiedBy`.
 *
 * - `delegateSuccess` — fires when an `agent.delegate` call resolving to the
 *   named `agentType` exits successfully during the current phase.
 *   "Successfully" means transport-level: the delegate finished via its
 *   normal completion path without throw / circuit-break. Use only when
 *   transport-level completion is sufficient evidence; for objectives that
 *   depend on the delegate's structured result, use `artifactPopulated`
 *   against the artifact the platform writes on a valid result.
 *
 * - `artifactPopulated` — fires when an artifact whose id matches `slug`
 *   transitions from absent/empty content to non-empty content during the
 *   current phase. Covers both newly-created artifacts AND pre-seeded
 *   artifacts that receive their first meaningful content. Re-population
 *   (overwrite of an already-populated artifact) does not re-fire.
 */
export type ObjectiveTrigger =
  | { kind: 'delegateSuccess'; agentType: string }
  | { kind: 'artifactPopulated'; slug: string };

/**
 * Top-level visual surface a phase renders.
 *
 * - `interactive` (default): the chat-driven workspace with optional scene/
 *   document panels, controlled by visibility toggles in {@link LayoutContext}.
 * - `build`: a fully automated phase with no chat or document. Renders a
 *   live checklist tied to a phase-public checklist artifact that the
 *   orchestrator updates as backend subagents complete. No user input.
 * - `result`: a non-interactive deliverable tile (image, title, description,
 *   primary CTA, share link). Used for handoff/done phases that show the
 *   educator the artifact they just produced.
 */
export type WorkflowPhaseMode = 'interactive' | 'build' | 'result';

export interface WorkflowPhaseConfig {
  /** Stable id, e.g. "design". */
  id: string;
  /** Shown in the navigation strip. Keep terse — fits inside `Phase N of M — {title}`. */
  title: string;
  /**
   * Shown as the central `PhaseHeading` above the play layout. When unset, the
   * central heading stays at the experience title — `title` is NOT used as a
   * fallback, since it's already shown in the navigation strip and would read
   * as redundant. Set `heading` only when you want phase-specific copy in the
   * big central heading (e.g. "Here's what works (and what doesn't).").
   */
  heading?: string;
  description?: string;
  /**
   * Optional surface override. Defaults to `'interactive'`. See
   * {@link WorkflowPhaseMode} for the meaning of each mode.
   */
  mode?: WorkflowPhaseMode;
  /**
   * Phase-mode-specific options. Keyed by mode so each surface owns its own
   * config shape without bleeding into the others.
   */
  buildConfig?: BuildModeConfig;
  /** Agent key used on the first entry into this phase. */
  initialAgent?: string;
  /**
   * If set, it is AUTHORITATIVE — the author is requiring this agent on every
   * return, overriding any snapshot. If unset, the user's last-active agent
   * (snapshot) is restored, falling back to initialAgent.
   */
  reentryAgent?: string;
  objectives?: WorkflowPhaseObjective[];
  promptFragments?: {
    coldStart?: string;
    reentry?: string;
    afterSkip?: string;
  };
  /**
   * When true, `workflowPhase nextPhase` only marks the phase complete
   * (unlocking the educator's Next button) and DOES NOT auto-advance.
   * Use for phases where the educator must explicitly press Next before
   * the workflow moves on. When unset/false, `nextPhase` completes and
   * advances atomically — the standard agent-driven path.
   */
  requireEducatorAdvance?: boolean;
  /**
   * When true, this phase's completion and objectives are cleared whenever
   * the user navigates backward past it (i.e. when `goTo` lands on an earlier
   * phase, leaving this one behind). Cascade: a single backward jump past
   * multiple phases resets all of them that carry this flag. Use for approval
   * gates that must be re-earned after any upstream change (e.g. a design-
   * review gate that should re-lock if the educator revises their goals).
   *
   * Does NOT affect artifacts, transcripts, or any other phase's state.
   */
  resetOnReentry?: boolean;
  /**
   * Allowlist of backend agent keys that may be invoked via the `agent`
   * tool's `delegate` action while this phase is current. When unset,
   * delegation is unrestricted (legacy behavior). When set, calls to
   * `agent({ action: 'delegate', agentType: ... })` with an agentType not
   * in this list are refused with a phase-scoped error.
   *
   * Use to prevent earlier-phase agents from triggering later-phase
   * subagents before the workflow has reached the right phase.
   */
  allowedDelegates?: string[];
  /**
   * Custom labels for the navigation strip buttons shown at the bottom of the
   * document panel while this phase is active.
   *
   * - `backLabel`: replaces the generic "Back" label on the left button. Use a
   *   destination-specific label (e.g. "Define Goals") to orient the educator.
   * - `nextLabel`: replaces the generic "Next" label on the right button. Use
   *   an action-specific label (e.g. "Build Experience", "Design Experience")
   *   so the button reads as a meaningful CTA rather than a generic step.
   *
   * When unset, the strip falls back to the default "Back" / "Next" labels.
   */
  navLabels?: {
    backLabel?: string;
    nextLabel?: string;
  };
}

/**
 * Options for `mode: 'build'`. The build surface reads its checklist items
 * from a shared (non-private) checklist artifact tagged with `phase:<id>`
 * (e.g. `phase:build`). The orchestrator agent ticks items via the
 * `checklist` tool as backend subagents return.
 */
export interface BuildModeConfig {
  /**
   * Heading rendered above the checklist tile. Falls back to the phase
   * `heading`, then to "Your experience is being built.".
   */
  title?: string;
  /**
   * Subtitle under the heading. Defaults to "Please don't close this tab.".
   */
  subtitle?: string;
}


/**
 * Narrow, typed surface for restoring view state on phase re-entry.
 * Anything not enumerated here is NOT restored. Active document content panel
 * restoration is deferred to Part B of the workflow-phases plan.
 */
export interface WorkflowPhaseSnapshot {
  isSceneVisible: boolean;
  isDocumentVisible: boolean;
  documentTab: DocumentTab;
  /** Restored only if the artifact still exists at re-entry time. */
  activeArtifactId?: string;
  selectedAgentKey?: string;
}

export interface WorkflowPhaseState {
  currentPhase?: string;
  furthestPhase?: string;
  /** Ordered list of phase ids ever entered. */
  visited: string[];
  /**
   * Ids marked ready-to-advance. Once added, stays added across re-entries
   * (i.e. revisiting a completed phase does not un-complete it).
   */
  completedPhases: string[];
  /**
   * When set, replaces the default `currentPhase + 1` for any forward motion.
   * Cleared when the transition that uses it fires.
   */
  nextPhaseOverride?: string;
  snapshots: Record<string, WorkflowPhaseSnapshot>;
  /**
   * Per-phase record of objective ids that have been recorded as met. Shape:
   * `{ [phaseId]: string[] }`.
   *
   * Two marking paths feed this field: (1) the agent's `markObjective` action,
   * which writes directly and emits `OBJECTIVE_MARKED`; and (2) declarative
   * `satisfiedBy` triggers on each objective, auto-evaluated at delegate-success
   * and artifact-populated hook points. On `nextPhase` / `complete`, any still-
   * unmarked objectives are written as a safety net and emit
   * `OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE`. The field is never consulted as a gate.
   */
  completedObjectives?: Record<string, string[]>;
}
