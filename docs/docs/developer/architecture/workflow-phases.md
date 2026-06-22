---
id: workflow-phases
title: Workflow Phases
sidebar_position: 6
---

# Workflow Phases

Workflow phases turn an experience into an ordered, multi-screen journey. The author declares a list of phases in `experience.json`; Primer renders a navigation strip, threads the active phase through every agent message, and gives agents tools to advance the journey.

When an experience declares no `workflowPhases`, everything below is inert — the experience runs in **single-screen mode** exactly as before.

## When to use phases

- The experience has natural beats (warm-up → activity → reflection) and you want each beat scoped to its own agent or context.
- You want a visible "where am I" indicator and a Next button that gates forward motion on the agent agreeing the user is ready.
- You want skipping/jumping/rewinding semantics with a proper event log instead of ad-hoc agent transfers.

If the experience is a single conversation with one agent, skip phases.

## Author surface

Add a `workflowPhases` array to `experience.json`:

```json
{
  "workflowPhases": [
    {
      "id": "warmup",
      "title": "Get oriented",
      "heading": "Let's get you ready to pitch.",
      "description": "Quick orientation with the narrator before pitching.",
      "initialAgent": "narratorStart"
    },
    {
      "id": "pitch",
      "title": "Pitch a VC",
      "heading": "Time to make your case.",
      "initialAgent": "mentor"
    },
    {
      "id": "feedback",
      "title": "Receive feedback",
      "initialAgent": "feedback"
    }
  ],
  "initialWorkflowPhase": "warmup",
  "showPhaseCount": true
}
```

### Phase fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | Yes | Stable, unique within the experience. Used in events, snapshots, transitions. |
| `title` | string | Yes | Short label shown in the navigation strip. Fits inside `Phase N of M — {title}`. |
| `heading` | string | No | Phase-specific copy for the central `PhaseHeading`. When unset, the heading stays at the experience title. `title` is **not** used as a fallback (would read as redundant with the strip). |
| `description` | string | No | Surface to the agent in its system message; not shown to the user. |
| `initialAgent` | string | No | Agent key used on the first entry into this phase. Must exist in `agents`. |
| `reentryAgent` | string | No | Authoritative override on every return — bypasses snapshot. Use sparingly. |
| `objectives` | array | No | `{ id, description, satisfiedBy? }` items. Listed to the agent on phase entry and on user-advance requests. See [Objective marking](#objective-marking). |
| `allowedDelegates` | string[] | No | Allowlist of agent keys that may be delegated to from this phase. Each entry must exist in `agents` (validated at load). Gates `agent.delegate` at runtime. |
| `promptFragments` | object | No | `coldStart` / `reentry` / `afterSkip` strings injected into the system message at the matching transition. |
| `mode` | `'interactive' \| 'build' \| 'result'` | No | Top-level surface for the phase. Defaults to `'interactive'`. See [Phase modes](#phase-modes). |
| `buildConfig` | object | No | Options for `mode: 'build'` — `title`, `subtitle`. |

### Experience-level fields

| Field | Default | Behavior |
|-------|---------|----------|
| `workflowPhases` | absent | Absent or empty → single-screen mode. No strip. |
| `initialWorkflowPhase` | first phase | Override which phase the session starts in. Must match a declared id. |
| `showPhaseCount` | `true` | When `false`, the strip drops `Phase N of M` and shows just the phase title. |

Validation runs at config load. The author sees an error on load for any of:

- duplicate phase ids;
- an `initialWorkflowPhase` that doesn't match a declared phase;
- an `initialAgent`, `reentryAgent`, or `allowedDelegates` entry that names an agent not present in `agents`;
- a frontend phase-anchor agent (`initialAgent` / `reentryAgent`) whose resolved tool allowlist is missing `workflowPhase` or `finishExperience` — without those, the platform cannot drive the phase's navigation.

The anchor-tool check is the structural guarantee that backs [Platform-enforced navigation](#platform-enforced-navigation): the platform can inject phase mechanics only if the anchor agent is actually permitted to call them.

## Runtime model

Phase state lives in session metadata as `workflowPhaseState`:

```ts
interface WorkflowPhaseState {
  currentPhase?: string;
  furthestPhase?: string;
  visited: string[];                            // ordered, every phase ever entered
  completedPhases: string[];                    // ready-to-advance, sticky
  completedObjectives?: Record<string, string[]>; // per-phase per-objective ledger; see Objective marking
  nextPhaseOverride?: string;                   // pending forward redirect
  snapshots: Record<string, WorkflowPhaseSnapshot>;
}
```

Snapshots restore narrow view-state on re-entry: scene/document visibility, the active document tab, the active artifact (if it still exists), and the last-active agent for that phase.

### Transition ops

All state changes route through `transition()` in `WorkflowPhaseManager.ts` — a pure function from `(config, state, experienceCompleted, request)` to `{ newState, eventsToAppend, systemMessage, restoredSnapshot }`. It performs no I/O. Persistence and lock acquisition happen in `mutateSessionMetadata` and the `/api/workflow-phases/transition` route.

| Op | Source | Effect |
|----|--------|--------|
| `init` | session create | Seeds initial phase + `WORKFLOW_PHASE_ENTERED` event. |
| `complete` | agent | Marks current phase ready-to-advance. Does **not** navigate. Idempotent. Unlocks the user-facing Next button. |
| `advance` | agent or user | Forward by one. Consumes any `nextPhaseOverride`. Errors at last phase with no override (agent should call `finishExperience`). |
| `set` | agent | Forward jump to a named phase. Backward jumps refused. Emits `WORKFLOW_PHASE_SKIPPED` for intermediates. |
| `setNext` | agent | Records a forward override; next `advance` consumes it. Forward-only. |
| `goTo` | user | Free navigation including backward. Saves the leaving snapshot, restores the destination snapshot. Backward from a finished experience emits `EXPERIENCE_REWOUND` and clears the completion flag. |
| `finishExperience` | agent (separate tool) | Marks the experience completed. The closing dialog is shown; only the user can rewind. |
| `rewind` | user | Sugar for `goTo` to the previous visited phase, with `experienceCompleted` cleared. |
| `markObjective` | agent | Appends the named objective id to `completedObjectives[currentPhase]`. Idempotent. Never gates. See [Objective marking](#objective-marking). |

### Events

Appended to `session.events`:

- `workflow_phase_entered` — direction is `initial` / `forward` / `backward`.
- `workflow_phase_left` — paired with the next entered.
- `workflow_phase_skipped` — one per intermediate skipped on a jump.
- `workflow_phase_revisited` — emitted on backward `goTo`.
- `workflow_next_overridden` — `setNext` recorded.
- `phase_completed` — `complete` was called or implicit on forward motion.
- `objective_marked` — an objective was marked via `markObjective` (agent) or a `satisfiedBy` hook (system). `data.trigger` distinguishes; `data.via` describes the firing signal for system marks.
- `objective_auto_marked_on_next_phase` — one per objective the server auto-marked when `nextPhase` was called without all objectives explicitly marked. Pure telemetry — no consumer gates on it.
- `experience_completed` — `finishExperience` was called.
- `experience_rewound` — backward navigation cleared completion.

## Agent integration

### Platform-enforced navigation

Phase navigation is the platform's responsibility, not the experience author's. The vocabulary the LLM needs (`workflowPhase`, `finishExperience`, the "handoffs vs phase changes" framing) is auto-injected through the [phase-aware platform supplemental](#phase-aware-platform-supplemental) and the [workflow-phase tools](#workflow-phase-tools). Authors must **not** reimplement phase mechanics inside `promptFragments` or per-agent prompts — duplicating the vocabulary diverges from the engine and silently breaks when transition semantics change.

For that injection to actually work the anchor agent has to be permitted to call the navigation tools. The trim path is easy to miss: an author restricts an anchor's `availableTools` / `toolSets` / `toolGroups`, accidentally drops `workflowPhase` or `finishExperience`, and the experience loads fine but strands the learner in the phase. The load-time anchor-tool validation listed above closes that gap.

To keep the validator and the runtime in lockstep, agent tool resolution lives in a single helper — `resolveAgentToolNames` in `src/app/lib/tools/groups.ts` — used by both `AgentConfigBuilder` (which assembles the runtime allowlist) and `loadWorkflowPhases` (which validates anchors). The precedence is `availableTools` → `toolSets` → `toolGroups` → `undefined` (no restriction, anchor inherits the full registry and is exempt from the check). Backend anchors are also exempt; they never drive an interactive phase. An unresolvable `toolSet` is treated as unrestricted at validation time so the misconfiguration surfaces through the config loader's own error path rather than as a phase-load crash.

The boundary is deliberate: the platform validates the *structural shape* every experience config must satisfy — phase ids, agent references, anchor-tool availability, `allowedDelegates` correctness — and applies the same rules to every experience. It does **not** lint the *contents* of any specific experience. Which voices an author allows, which prompt copy they ship, which exact tools they bundle into a custom `toolSet` — these are author-discretionary and live in `storage/<id>/`, not in the platform's invariants.

### Phase-scoped agent transfers

When phases are configured, the `agent` tool's `transfer` action is restricted to agents in the **current phase**. Phase membership is computed at request time by `computePhaseMemberships`: each phase's anchor (`initialAgent` plus `reentryAgent`) seeds a BFS over `downstreamAgents`, halting at any agent that anchors a *different* phase. The result is a closed agent set per phase.

A `transfer` to a destination outside the current phase's set is refused with a structured error pointing at `workflowPhase.nextPhase` (or `workflowPhase.set` with the destination's anchoring phase id). `discover` mirrors the gate: cross-phase downstream agents lose `transfer` from their `available_actions` and gain `outside_current_phase: true` plus a `transfer_blocked_reason` string. The `agent` tool's description also gains a one-line suffix telling the LLM about the gate.

The gate is purely additive — when no phases are declared, `transfer` behaves exactly as it did pre-phases.

### Phase-aware platform supplemental

`getPlatformSupplemental(config)` resolves the `{{agent}}` baseline that ships with every experience. When `config.workflowPhases` has entries, it swaps in a phased variant that teaches the LLM the full vocabulary up front: `nextPhase` as the combined mark-complete-and-advance op (collapsed to mark-complete-only under `requireEducatorAdvance: true`, so the user's Next button drives the actual advance), `set` to jump to a named phase, `setNext` to redirect, `suggestReturn` for backward hints, and `finishExperience` for the final wrap-up. The "Transferring" section is replaced with "Handoffs vs phase changes" — explicit guidance that in-phase moves use `agent.transfer` and cross-phase moves go through `workflowPhase`. The non-phased variant is byte-identical to the pre-phases baseline.

The split lives in `src/app/lib/instructions/platform/agent.ts` (exports `agent` and `agentPhased`); selection happens in `getPlatformSupplemental`. `InstructionProcessor.loadInstructions` passes the experience config through so the right variant is seeded before any per-experience supplementals merge on top.

### Workflow-phase tools

Two tools register **only** when the experience declares phases (saves prompt tokens on phase-less experiences):

### `workflowPhase`

Actions: `discover`, `current`, `nextPhase`, `set`, `setNext`, `suggestReturn`, `markObjective`.

Guardrail (snapshot-tested verbatim): the tool's description tells the LLM to verbally check the user is ready before calling `nextPhase` or `set`. Under `requireEducatorAdvance: true` the server collapses `nextPhase` to mark-complete-only, so the user-facing Next button still gates the actual advance. Backward navigation is refused; the agent uses `suggestReturn` to surface a UI prompt instead. `markObjective` is non-gating — see [Objective marking](#objective-marking).

### `finishExperience`

Single action. Distinct registration so the LLM cannot conflate phase-level `complete` with ending the experience. Only call after the user has explicitly agreed.

### System messages

Every navigation transition produces a system-role message (formatter: `formatWorkflowPhaseChangeMessage`). It always starts with `[SYSTEM/workflow_phase_change]` and ends with a fixed directive line. The body lists `direction`, `from`, `to`, `trigger`, optional `skipped` ids, optional skipped-objective bullets, the destination phase title and description, and either `EXPERIENCE_COMPLETED` or `EXPERIENCE_REWOUND` when those apply. Author-supplied `promptFragments.coldStart` / `reentry` / `afterSkip` are inlined at the matching transition.

The user-initiated advance produces a separate system message (formatter: `buildAdvanceRequestMessage`) when the user clicks Next on a phase that isn't yet in `completedPhases`. It starts with `[SYSTEM/USER_ADVANCE_REQUEST]`, names the current phase, and lists each objective as `MARKED` or `UNMARKED` so the agent can either advance immediately, retro-mark and advance, or veto with a specific unmet objective. See [Objective marking](#objective-marking).

Both messages are injected into the agent's conversation via the same channel used for component events. Realtime agents receive it through `RealtimeController`; backend agents through `api/backend-agent/utils/context.ts`.

## Objective marking

Each phase's `objectives` feed `state.completedObjectives` — a `Record<phaseId, objectiveId[]>` ledger that survives across the session and surfaces to the agent at decision-time. Two paths write to the ledger; neither one gates `nextPhase`.

### Agent path

The agent calls `workflowPhase markObjective { id, note? }` in the same response turn where it observes an objective satisfied. The tool routes through `setWorkflowPhase` → `transition({ kind: 'markObjective', id })` → `handleMarkObjective` in `WorkflowPhaseManager.ts`. The handler appends to `state.completedObjectives[currentPhase]` (idempotent — re-marking is a no-op success) and emits one `OBJECTIVE_MARKED` session event with `data.trigger: 'agent'`.

The platform supplemental (`agentPhased` in `src/app/lib/instructions/platform/agent.ts`) teaches this — authors don't need to repeat it in `promptFragments`.

### System path

When an objective declares a `satisfiedBy` trigger, the server marks it automatically when the trigger condition fires during the phase. Two trigger kinds exist:

```ts
type ObjectiveTrigger =
  | { kind: 'delegateSuccess'; agentType: string }
  | { kind: 'artifactPopulated'; slug: string };
```

Runtime signals are emitted by callers as an `ObjectiveSignal`:

```ts
type ObjectiveSignal =
  | { kind: 'delegateSuccess'; resolvedAgentKey: string }
  | { kind: 'artifactWrite'; slug: string; newlyPopulated: boolean };
```

`evaluateSatisfiedBy(state, phase, signal)` in `WorkflowPhaseManager.ts` is a pure function that returns the list of objective ids to mark — skipping already-marked objectives, matching `delegateSuccess` on resolved agent key, matching `artifactPopulated` only when `newlyPopulated === true`. The shared wrapper `fireObjectiveSignal` in `src/app/lib/workflow-phases/objectiveSignals.ts` does the load-config + load-state + evaluate + mutate + emit-event flow. **It is best-effort**: a broad try/catch wraps the whole flow and swallows everything at warn-level logging, so a hook glitch never breaks the caller path.

Hook points:

| Site | File | Signal |
|------|------|--------|
| Artifact storage write boundary | `src/app/lib/artifacts/storage.ts` (`createArtifact`, `updateArtifact` — actual-write paths only, not no-op early returns) | `{ kind: 'artifactWrite', slug, newlyPopulated }` |
| Backend-agent core delegate exit | `src/app/lib/backend-agent-core.ts` (`executeBackendAgent`, before successful return — covers socket path transitively) | `{ kind: 'delegateSuccess', resolvedAgentKey }` |
| HTTP delegate route exit | `src/app/api/backend-agent/route.ts` (before the `success: true` `NextResponse.json` — error paths skipped) | `{ kind: 'delegateSuccess', resolvedAgentKey }` |

Every call site uses `void fireObjectiveSignal(...)` so the hook fires fire-and-forget without blocking the caller's return.

### Validation

`satisfiedBy` is validated at two points:

1. **`loadWorkflowPhases`** at session/config load — symmetric checks for unknown `kind` and missing required fields (`agentType` / `slug`), throws `InvalidPhaseError` with phase id + objective id + actionable message.
2. **`assertValidWorkflowPhasesPatch`** in `MatterCompiler.modifyExperience` — same validation runs before the build-agent's patches hit disk, preventing a malformed `satisfiedBy` from being persisted and only blowing up at next load.

`loadWorkflowPhases` also runs the structural phase-navigation checks documented above: each phase's `allowedDelegates` must reference declared agents, and frontend phase-anchor agents (`initialAgent` / `reentryAgent`) must keep `workflowPhase` and `finishExperience` in their resolved tool allowlist. Backend anchors and anchors with no explicit tool restriction are exempt; an unresolvable `toolSet` reference is treated as unrestricted so the misconfiguration surfaces through the config loader's own error path. Tool resolution shares `resolveAgentToolNames` with the runtime config loader so the two cannot diverge.

### Safety net

When the agent calls `nextPhase` while some objectives are still unmarked, the server auto-marks them and emits one `objective_auto_marked_on_next_phase` event per. The agent's advance is never refused on missing marks — the marking system is a soft signal, not a gate. This was a deliberate choice: an earlier `markObjective` design that **did** gate `nextPhase` produced a recover-after-rejection failure mode that prompt engineering couldn't eliminate.

### Advance-request rendering

`buildAdvanceRequestMessage(phase, completedObjectiveIds)` in `src/app/lib/workflow-phases/buildAdvanceRequestMessage.ts` is a pure formatter that runs in the strip at click time. It reads `currentPhase.objectives` + `state.completedObjectives[currentPhase.id]` from `WorkflowPhaseContextValue` (the context exposes `completedObjectives` as a public field) and produces the `[SYSTEM/USER_ADVANCE_REQUEST]` system message that lists each objective as `MARKED` or `UNMARKED`. The strip dispatches it on the existing `workflow-phase-change` window event; `useAgentSwitching` injects it into the realtime conversation as a system-role item.

Mark provenance (agent vs system) is not surfaced in the message — the agent doesn't need it to decide, and storing it would require widening the state shape. Provenance lives in the `OBJECTIVE_MARKED` event log for replay and debugging.

## UI

`WorkflowPhaseStrip` (~40px) renders above the play layout when phases exist:

```
[<- Back]   Phase 2 of 5 - Pitch a VC   [Next -> Feedback ->]
```

- Next is disabled until the current phase is in `completedPhases`.
- When `nextPhaseOverride` is set, Next shows a redirect glyph and the override's title.
- When `showPhaseCount` is `false`, the position indicator drops to just the phase title.
- `PhaseHeading` shows the phase's `heading` (when set) or the experience title.
- On `experience_completed`, the `ExperienceCompletedDialog` shows; forward navigation hides until the user rewinds.

## Phase modes

Most phases render the chat-driven workspace: chat panel on the left, optional scene/document on the right, both controlled by visibility toggles in `LayoutContext`. Some phases need a different surface entirely — fully-automated phases that have no user input, or handoff phases that show a finished deliverable. `WorkflowPhaseConfig.mode` swaps the top-level surface.

`PhaseSurfaceSwitch` (`src/app/components/PlayPage/PhaseSurfaceSwitch.tsx`) reads `currentPhase.mode` from `WorkflowPhaseContext` and dispatches:

| Mode | Component | What renders |
|------|-----------|--------------|
| `interactive` (default) | `PlayPageSplitContent` | Chat + scene/document split. Visibility toggles apply here. |
| `build` | `BuildPhaseSurface` | Centered checklist tile. No chat, no document. |
| `result` | `ResultPhaseSurface` | Centered deliverable tile (image + title + description + primary CTA + share link). No chat, no document. |

Visibility toggles in `LayoutContext` (`isSceneVisible`, `isDocumentVisible`) and the document panel itself only have meaning inside `interactive`. The `WorkflowPhaseSnapshot` fields that restore them on re-entry are still written through transitions, but `build` and `result` modes ignore them on render.

### `mode: 'build'`

`BuildPhaseSurface` reads any artifact whose `metadata.tags` contains `phase:<phaseId>` and parses its content with `parseChecklistItems` (`src/app/components/PlayPage/parseChecklist.ts`) — a tolerant `- [ ]` / `- [x]` parser that ignores headings and prose. The orchestrator agent updates the artifact with the `checklist` tool; mutations stream through `ArtifactContext`'s socket subscription, so the UI re-renders without any extra wiring.

`buildConfig` is optional — heading and subtitle fall back to `phase.heading` and sensible defaults.

### `mode: 'result'`

`ResultPhaseSurface` reads the deliverable's experience id from any artifact whose `metadata.tags` contains `result:experience-id` (the artifact's content is the id, trimmed). Once present, it fetches `/api/storage/<id>/experience.json` to render the tile's title, description, and preview image (first scene). The CTA links to `/play/<id>` when `ctaTarget === 'play-built'` (the default); set `ctaTarget: 'none'` to disable the CTA. Until the id is recorded, the tile renders a placeholder and the CTA is disabled.

This split lets the orchestrator decide *when* the deliverable is ready (by writing the artifact) without the engine needing a special tool or session metadata field. Any phase, in any experience, can become a result phase by adding the artifact and setting `mode: 'result'`.

## Files

| Concern | File |
|---------|------|
| Types | `src/app/lib/workflow-phases/types.ts` |
| Loader / validator | `src/app/lib/workflow-phases/loadWorkflowPhases.ts` |
| Phase-membership computation | `src/app/lib/workflow-phases/phaseMemberships.ts` |
| Platform supplemental (phased + default variants) | `src/app/lib/instructions/platform/agent.ts`, `src/app/lib/instructions/platform/index.ts` |
| Pure transition logic | `src/app/lib/workflow-phases/WorkflowPhaseManager.ts` |
| System-message formatter | `src/app/lib/agent-context/workflowPhaseChangeMessage.ts` |
| Agent tool | `src/app/lib/tools/builtin/workflow-phase-tool.ts` |
| Finish tool | `src/app/lib/tools/builtin/finish-experience-tool.ts` |
| Transition route | `src/app/api/workflow-phases/transition/route.ts` |
| State route | `src/app/api/workflow-phases/state/route.ts` |
| Client provider | `src/app/contexts/WorkflowPhaseContext.tsx` |
| Strip component | `src/app/components/WorkflowPhaseStrip/WorkflowPhaseStrip.tsx` |
| Mode dispatch | `src/app/components/PlayPage/PhaseSurfaceSwitch.tsx` |
| `mode: 'build'` surface | `src/app/components/PlayPage/BuildPhaseSurface.tsx`, `src/app/components/PlayPage/parseChecklist.ts` |
| `mode: 'result'` surface | `src/app/components/PlayPage/ResultPhaseSurface.tsx` |
| Completion dialog | `src/app/components/ExperienceCompletedDialog/ExperienceCompletedDialog.tsx` |
| Per-session lock | `src/app/lib/sessions/mutateSessionMetadata.ts` |
| Event constants | `src/app/lib/file-utils.ts` (`SESSION_EVENTS`) |

## Reference experience

`storage/elevator-pitching-with-phases/` is the canonical example — a three-phase variant of the elevator-pitching experience used to smoke-test the feature.
