# Experimental Intake Agent Architecture

## Pipeline Overview

The experimental-intake-agent follows the same orchestration pattern as the original intake-agent, with two additions: an Interface Designer agent for building components, and a component preview loop with the educator.

```
1. Intake Agent interviews educator
   - Gathers learning objectives, student level, prior knowledge
   - NEW: Discusses interactivity requirements (what to visualize/manipulate)
   - Selects template type (Tutor or Lab)

2. Design Agent creates design document
   - Character context blocks (same as original)
   - NEW: Component Specifications section (purpose, state, events, agent responses)

3. Intake Agent shows design to educator → approval

4. NEW: Interface Designer builds components
   - Reads Component Specifications from design document
   - Creates, validates, deploys React JSX components
   - Returns component metadata (IDs, state fields, events)

5. NEW: Intake Agent previews components with educator
   - Shows each component using customComponent tool
   - Educator can interact and request changes
   - Iterates with Interface Designer until satisfied

6. Casting Director creates agent prompts
   - Same CHARACTER CONTEXT insertion as original
   - NEW: Also inserts COMPONENT INSTRUCTIONS into agent prompts
   - Agents know which components exist, their state fields, events, and how to use them

7. Image Generation Agent creates scene images

8. Experience Builder assembles final experience
   - Same template copy + artifact deployment as original
   - NEW: Also deploys component JSX files to resources/components/
   - NEW: Generates Tailwind CSS for each component
   - NEW: Updates experience.json with resources.components metadata
   - NEW: Ensures toolSets include customComponent
```

## New Templates

### Tutor Template

Single-agent template for focused interactive tutoring.

- **Agents**: tutor (+ studentReport, classAnalytics)
- **Flow**: tutor teaches using components throughout
- **Component usage**: Tutor has full control -- shows, updates, responds to all events
- **Template placeholders**: `[CASTING DIRECTOR, INSERT APPROPRIATE CHARACTER CONTEXT]` and `[CASTING DIRECTOR, INSERT COMPONENT INSTRUCTIONS]`

### Lab Template

Multi-agent template following the 5E instructional model.

- **Agents**: guide → lab → debrief (+ studentReport, classAnalytics)
- **Flow**: guide introduces and demos → lab facilitates exploration → debrief reflects
- **Component usage**: All agents have access, but lab agent is the primary driver
- **Template placeholders**: Same two placeholders in each agent prompt

## Component Communication Protocol

The bidirectional communication between agents and components is critical. Template agent prompts include a `component-guide.md` supplemental that teaches the protocol.

### Agent to Component

```
Agent calls: customComponent({ action: 'updateState', instanceId, stateUpdates })
Server emits: ui.component.updateState
Component receives: externalState prop → useEffect([externalState]) merges into state
```

### Component to Agent

```
Component calls: onEvent('event-type', data)
Socket.IO: component.event → component.event.forward
RealtimeController injects system message:
  "[Component Event] User interaction with {componentId}: {eventType} - Data: {eventData}"
Agent sees message and responds
```

### Passive State Sync

```
Component calls: onStateChange(newState)
Socket.IO: component.stateChange → component.stateChange.forward
Logged but NOT injected into conversation (use getState to check)
```

### Completion

```
Component calls: onSubmit(data)
Received as an event by the agent
Agent can transition to next phase or celebrate
```

## Design Document Additions

The design document produced by the Design Agent includes a new **Component Specifications** section for each component:

- **Purpose**: Pedagogical role
- **Visual Description**: Layout and elements
- **Interaction Model**: What students can do
- **State Fields**: What the agent controls
- **Events Fired**: What the component reports
- **Agent Response Patterns**: How the agent should react to each event
- **Initial State**: Starting configuration
- **Difficulty Progression**: How state changes adjust difficulty

## Key Files

### Meta-Experience (`storage/experimental-intake-agent/`)

| File | Purpose |
|------|---------|
| `experience.json` | Meta-experience config (kind: "meta", requires tutor/lab templates) |
| `resources/instructions/agent/intake.md` | Orchestrator with interactivity discussion and component preview loop |
| `resources/instructions/agent/design-agent.md` | Design doc creator with Component Specifications |
| `resources/instructions/agent/interface-designer.md` | Component builder (adapted from hal) |
| `resources/instructions/agent/casting-director.md` | Prompt creator with component instruction insertion |
| `resources/instructions/agent/experience-builder.md` | Builder with component deployment |
| `resources/instructions/supplemental/templates.md` | Tutor/Lab template descriptions |
| `resources/instructions/supplemental/components.md` | Component design guidance for intake |
| `resources/instructions/supplemental/component-guide.md` | Component protocol reference |

### Tutor Template (`storage/tutor-template/`)

| File | Purpose |
|------|---------|
| `experience.json` | Template config with components array and customComponent in toolSets |
| `resources/instructions/agent/tutor.md` | Tutor prompt with both placeholder patterns |
| `resources/instructions/supplemental/component-guide.md` | Component protocol for the tutor agent |

### Lab Template (`storage/lab-template/`)

| File | Purpose |
|------|---------|
| `experience.json` | Template config with guide → lab → debrief flow |
| `resources/instructions/agent/guide.md` | Guide prompt (brief component demos) |
| `resources/instructions/agent/lab.md` | Lab facilitator prompt (primary component driver) |
| `resources/instructions/agent/debrief.md` | Debrief prompt (optional component use) |
| `resources/instructions/supplemental/component-guide.md` | Component protocol for all agents |
