---
id: workflow-phases
title: Workflow Phases
sidebar_position: 6
---

# Authoring Workflow Phases

Workflow phases let you split an experience into ordered beats — orientation, activity, debrief — each with its own agent, heading, and instructions. Primer renders a navigation strip across the top, a Next button gated on agent confirmation, and a Back button for the user.

If your experience is one continuous conversation, skip this page — leave `workflowPhases` out and the experience runs in single-screen mode.

## Minimal phased experience

```json
{
  "title": "Elevator Pitching",
  "agents": {
    "narrator": { "name": "Narrator", "voice": "ballad", "publicDescription": "..." },
    "mentor":   { "name": "Mentor",   "voice": "marin",  "publicDescription": "..." },
    "feedback": { "name": "Feedback", "voice": "echo",   "publicDescription": "..." }
  },
  "workflowPhases": [
    {
      "id": "warmup",
      "title": "Get oriented",
      "heading": "Let's get you ready to pitch.",
      "initialAgent": "narrator"
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
      "heading": "Here's what works (and what doesn't).",
      "initialAgent": "feedback"
    }
  ]
}
```

That's it. The agents listed in `initialAgent` switch in automatically as the user advances. Each phase shows its `heading` as the central headline above the play layout.

## Phase fields

| Field | Required | Notes |
|-------|----------|-------|
| `id` | Yes | Stable identifier. Used in events and resume logic — don't rename casually. |
| `title` | Yes | Shown in the navigation strip. Keep it short — fits inside `Phase 2 of 5 — {title}`. |
| `heading` | No | Phase-specific headline above the layout. Leave it off when the experience title is fine. |
| `description` | No | Surfaced to the agent in its system message. Not shown to the user. |
| `initialAgent` | No | Agent that takes over on the first entry into this phase. |
| `reentryAgent` | No | Authoritative override on every return — useful when a feedback agent should always pick up where it left off. |
| `objectives` | No | List of `{ id, description, satisfiedBy? }`. See [Objectives](#objectives). |
| `promptFragments` | No | Inline copy injected into the agent's system message at specific transitions: `coldStart`, `reentry`, `afterSkip`. |
| `mode` | No | Top-level surface for the phase: `'interactive'` (default — chat + document workspace), `'build'` (automated checklist), or `'result'` (deliverable tile). See [Phase modes](#phase-modes). |
| `buildConfig` | No | Options for `mode: 'build'`: `title`, `subtitle`. |

### `heading` vs `title`

- `title` is the strip label. Always shown.
- `heading` is the big central headline. Optional.

If you set `heading` to the same value as `title`, the user sees the same string twice. Prefer atmospheric copy in `heading` ("Time to make your case.") and a terse label in `title` ("Pitch a VC").

### `initialAgent` vs `reentryAgent`

- **First entry** into a phase → `initialAgent`.
- **Return** to a phase → the user's last-active agent in that phase (snapshot), falling back to `initialAgent`.
- **`reentryAgent`** overrides the snapshot every time, including the first re-entry. Use only when revisits should always start with the same agent.

### Prompt fragments

Inject phase-specific instructions into the agent's system message:

```json
{
  "id": "feedback",
  "title": "Receive feedback",
  "initialAgent": "feedbackCoach",
  "promptFragments": {
    "coldStart": "Open with a warm acknowledgment that the user just finished pitching.",
    "reentry":   "The user is revisiting feedback. Briefly recap your last point before continuing.",
    "afterSkip": "The user jumped here without doing the pitch. Acknowledge that and ask if they'd like to go back."
  }
}
```

Each fragment is included only at the matching transition. Keep them direct — they ship as plain lines, no markdown.

### Objectives

Objectives are the per-phase success criteria the agent uses to decide when the phase is genuinely done. They have two purposes:

1. **Skip context** — if a forward jump skips past a phase, the next agent sees a list of objectives the user didn't cover.
2. **Advance gating signal** — when the user clicks Next, the agent gets a `[SYSTEM/USER_ADVANCE_REQUEST]` message listing each objective as `MARKED` or `UNMARKED`. The agent uses that to decide whether to fire `nextPhase` immediately or veto with a specific unmet objective.

```json
{
  "id": "pitch",
  "title": "Pitch a VC",
  "initialAgent": "mentor",
  "objectives": [
    { "id": "pitch-delivered", "description": "Student delivered at least one full pitch end-to-end." },
    { "id": "applied-feedback", "description": "Student incorporated mentor advice on a second attempt." }
  ]
}
```

#### Write objectives as discrete observable moments

An objective is a **single moment the agent can recognize in conversation** — a specific utterance, a counted behavior, a named action. Not a conjunction of other objectives, and not "ready to move on" — `nextPhase` already represents that.

| Style | Example | Notes |
|-------|---------|-------|
| ✅ Good | `student-named-BATNA` — "Student names BATNA at least once during the negotiation." | A single observable moment. |
| ✅ Good | `surface-evidence` — "Cite at least two specific moments from the practice transcript." | Countable; the agent can recognize when the count is reached. |
| ❌ Bad | `student-prepared` — describes overall readiness, not a discrete moment. | Aggregate of other objectives — use them instead. |
| ❌ Bad | `ready-for-feedback` — `nextPhase` represents this. | Don't write objectives for the meta-decision to advance. |

#### Two marking paths

Both write to the same `state.completedObjectives` ledger. Neither blocks `nextPhase` — when the agent advances, any still-unmarked objectives get auto-marked as a safety net.

**Agent-marked (default).** The in-experience agent calls `workflowPhase markObjective { id }` in the same response turn where it observes the objective satisfied. The platform supplemental teaches this; you don't need to mention it in `promptFragments`. Just write objectives whose satisfaction the agent can recognize from conversation, and the agent marks them in passing.

**System-marked.** When an objective's satisfaction signal is structural rather than conversational — a sub-agent completed, an artifact got populated — declare a `satisfiedBy` trigger and the server marks the objective automatically:

```json
{
  "id": "build",
  "title": "Building your experience",
  "mode": "build",
  "objectives": [
    { "id": "characters-cast",  "description": "Casting Director produced character prompts.",   "satisfiedBy": { "kind": "delegateSuccess", "agentType": "casting-director" } },
    { "id": "experience-built", "description": "Experience Builder wrote a valid experienceId.", "satisfiedBy": { "kind": "artifactPopulated", "slug": "built_experience" } }
  ]
}
```

| Trigger | Fires when | When to use |
|---------|------------|-------------|
| `{ kind: "delegateSuccess", agentType }` | A backend sub-agent delegate to the named `agentType` returns successfully (transport-level — no throw or circuit-break). | The objective is "the sub-agent ran." Sufficient when transport-level completion implies the work happened. |
| `{ kind: "artifactPopulated", slug }` | The artifact whose id matches `slug` transitions from absent/empty to non-empty during the phase. | The objective depends on the delegate's *output* being valid — e.g. the platform writing an `experienceId` into an artifact only on a valid build result. Prefer this over `delegateSuccess` when the delegate could "succeed" with an empty/invalid result. |

Both signals fire on every successful event during the current phase. Re-population (overwriting an already-populated artifact, or re-running a sub-agent that's already satisfied the objective) does not re-fire.

`satisfiedBy` is validated at config-load time and at MatterCompiler patch-time. A malformed trigger fails fast with a message naming the phase, objective id, and what's wrong.

## Phase modes

By default a phase renders the chat-driven workspace (chat panel + optional scene/document). Some phases need a different surface entirely — fully-automated phases that have no user input, or handoff phases that show a finished deliverable. Set `mode` on the phase to swap the top-level surface.

| Mode | When to use | What renders |
|------|-------------|--------------|
| `interactive` (default) | Anything chat-driven. | Chat panel + scene/document toggles. |
| `build` | A phase where the agent orchestrates backend subagents with no user input. | A checklist tile sourced from a phase-public checklist artifact. No chat, no document. |
| `result` | A phase that hands the user a finished artifact (e.g. "here is the experience you just built"). | A deliverable tile with image + title + description + primary CTA + share link. No chat, no document. |

### `mode: 'build'`

Renders a heading + checklist tile. Items come from any **shared** (non-private) artifact of `type: "checklist"` whose `metadata.tags` contains `phase:<phaseId>`. The orchestrator agent updates the artifact via the `checklist` tool as backend subagents return; the UI re-renders automatically because artifact mutations stream through `ArtifactContext`.

```json
{
  "id": "build",
  "title": "Build",
  "mode": "build",
  "buildConfig": {
    "title": "Your experience is being built.",
    "subtitle": "Please don't close this tab."
  }
}
```

Authoring steps:

1. Add a checklist artifact tagged `phase:<phaseId>` with the items pre-populated as `- [ ]` lines:

   ```json
   {
     "name": "Build Progress",
     "type": "checklist",
     "file": "resources/artifacts/build-checklist.md",
     "metadata": {
       "tags": ["phase:build"],
       "presentation": { "type": "checklist", "options": {} }
     }
   }
   ```

2. In the phase's `coldStart` prompt fragment, instruct the orchestrator to call `checklist({ action: 'check', itemText: '<exact item text>', tags: ['phase:<phaseId>'] })` after each meaningful step. Tell it explicitly that this phase is silent — there's no chat panel, so don't narrate progress.

`buildConfig` fields (all optional):

- `title` — heading shown above the checklist. Falls back to phase `heading`, then `"Your experience is being built."`.
- `subtitle` — shown under the heading. Defaults to `"Please don't close this tab."`.

### `mode: 'result'`

Renders a deliverable tile. Reads the deliverable's experience id from any artifact whose `metadata.tags` contains `result:experience-id` (the artifact's content is the id, trimmed). Then fetches `/api/storage/<id>/experience.json` to populate the tile's title, description, and preview image. The CTA links to `/play/<built-id>`.

```json
{
  "id": "handoff",
  "title": "Try it out",
  "mode": "result"
}
```

Authoring steps:

1. Add a markdown artifact tagged `result:experience-id` with empty content:

   ```json
   {
     "name": "Built Experience",
     "type": "markdown",
     "file": "resources/artifacts/built-experience-id.md",
     "metadata": { "tags": ["result:experience-id"] }
   }
   ```

2. After the deliverable id is available (e.g. once `createExperience` returns), instruct the agent to write it via `artifact({ action: 'edit', id: <artifact id>, content: <experienceId> })`.

Tile content (title, description, preview image) is sourced from the built experience's own `experience.json`, so author it there rather than on the result phase. Until the id artifact has content, the tile renders a `Waiting for build…` placeholder and the CTA is disabled.

## Experience-level options

```json
{
  "workflowPhases": [...],
  "initialWorkflowPhase": "pitch",
  "showPhaseCount": false
}
```

| Option | Default | Use when |
|--------|---------|----------|
| `initialWorkflowPhase` | first phase | Resuming sessions or branching demos that start mid-flow. |
| `showPhaseCount` | `true` | Set `false` when the count would feel mechanical or you plan to add side-quest phases that would make a fixed `N of M` misleading. |

## How agents drive phases

When an experience has phases, each agent has access to two tools:

- **`workflowPhase`** — actions: `discover` (list), `current`, `nextPhase`, `set`, `setNext`, `suggestReturn`.
- **`finishExperience`** — ends the experience and shows the closing dialog.

The `agent` tool also becomes phase-aware: `transfer` is restricted to agents in the current phase. To switch to an agent that anchors a different phase, agents must call `workflowPhase.nextPhase` or `workflowPhase.set` — the phase change drives the agent switch as a side effect. This means experience authors don't need to teach agents the rule via prompt; the wrong call is structurally unavailable, and the tool's error message points at the right one.

On top of that, every agent in a phased experience gets a phase-aware `{{agent}}` supplemental baked into its system prompt by Primer. It explains `nextPhase` as the combined mark-complete-and-advance op, the difference between in-phase `agent.transfer` and cross-phase `workflowPhase.nextPhase`/`set`, the `suggestReturn` pattern for backward hints, and the `finishExperience` boundary. You don't need to repeat any of this in your per-agent instructions — focus your prompts on what the agent should *do* in this phase.

Authoring guidance for agent prompts:

- The tool's built-in description tells the LLM to verbally check the user is ready before moving forward. You don't need to repeat that — but if your experience has a particular cadence ("always summarize before advancing"), say so in the agent prompt.
- `nextPhase` marks the current phase complete and advances atomically. When the phase declares `requireEducatorAdvance: true`, the server collapses the call to "mark complete only" — the user-facing Next button drives the actual advance, so the agent can safely call `nextPhase` as soon as the user has met the phase's purpose.
- The agent **cannot** navigate backward. Tell the agent to use `suggestReturn` if it thinks the user should revisit something — that surfaces a UI prompt the user accepts or dismisses.
- Call `finishExperience` only after the user explicitly agrees the whole experience is done. It's not the same as completing the last phase.

## How users drive phases

- The **Next** button is disabled until the agent calls `nextPhase` (which, under `requireEducatorAdvance: true`, marks the phase ready without auto-advancing). Once enabled, pressing it advances to the next phase.
- The **Back** button always works — users own backward navigation. Going back saves a snapshot of the leaving phase (scene/document state, active artifact, last agent) and restores the destination snapshot.
- After `finishExperience`, a closing dialog appears and forward navigation hides. The user can still press Back to rewind, which clears the completed flag.

## Authoring checklist

- Every `initialAgent` and `reentryAgent` matches a key in `agents`.
- Phase `id`s are unique and stable.
- `title` strings are short enough to fit in the strip.
- `heading` is set only when you want phase-specific central copy.
- Agent prompts mention `workflowPhase` and `finishExperience` if the agent is expected to drive transitions.
- For at least one phase, walk through the experience end-to-end and confirm the strip, headings, and agent handoffs feel right.

## Reference

- Working example: `storage/elevator-pitching-with-phases/experience.json`
- Architecture detail and event log: see [Workflow Phases](/developer/architecture/workflow-phases) under Architecture.
- Schema fields: see [Experience Format](/developer/architecture/experience-format).
