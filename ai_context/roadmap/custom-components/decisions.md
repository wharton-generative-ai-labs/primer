# Custom Components: Design Decisions

## Overview

This document records all major design decisions made during the specification process, including the rationale and alternatives considered.

**Date**: January 5, 2025  
**Status**: Finalized for Phase 1 MVP Implementation

---

## Decision 1: State Synchronization Loop Prevention

### Problem
The bidirectional state flow between agents and components could create circular updates:
- Agent updates `externalState`
- Component updates internal state
- Component calls `onStateChange`
- Agent receives change it just made
- Potential infinite loop

### Decision: Track External Keys ✅

**Implementation:**
```typescript
const externallySetKeys = useRef(new Set());
const previousState = useRef(state);

// Mark external updates
useEffect(() => {
  if (externalState) {
    Object.keys(externalState).forEach(key => 
      externallySetKeys.current.add(key)
    );
    setState(prev => ({ ...prev, ...externalState }));
    setTimeout(() => externallySetKeys.current.clear(), 0);
  }
}, [externalState]);

// Only notify of student-initiated changes
useEffect(() => {
  const internalChanges = {};
  for (const [key, value] of Object.entries(state)) {
    if (!externallySetKeys.current.has(key) && 
        previousState.current[key] !== value) {
      internalChanges[key] = value;
    }
  }
  previousState.current = state;
  if (Object.keys(internalChanges).length > 0) {
    onStateChange?.(internalChanges);
  }
}, [state]);
```

**Rationale:**
- Prevents circular updates by tracking which keys came from external sources
- Allows flexible bidirectional state flow
- Components can still update any state, but only notify agent of student-initiated changes
- Simple timeout clears tracking after render cycle

**Alternatives Considered:**
- **Explicit State Ownership**: Split state into `guidance` and `student` sections
  - ❌ Too rigid, limits flexibility
  - ❌ Requires more structure in component design
- **User Actions Only**: Only fire `onStateChange` on explicit user interactions
  - ❌ Agent can't see computed/derived state changes
  - ❌ Less flexible for complex components

---

## Decision 2: shadcn/ui Component Bundling

### Problem
Components need to import shadcn/ui components, but:
- Code is stored as text files in storage
- Compiled at runtime in browser using Babel
- Browser can't resolve `@/components/ui/button` imports
- `require()` doesn't work in browser context

### Decision: Import Stripping with Scope Injection (Option B.5) ✅

**Implementation:**
```typescript
// Interface Designer writes natural imports
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Babel strips imports during compilation
const compiled = Babel.transform(code, {
  presets: ['react'],
  plugins: [['transform-remove-imports']]
});

// Scope injected via Function constructor
const scope = buildScope(); // { React, Button, Input, ... }
const Component = new Function(
  ...Object.keys(scope),
  `${compiled.code}\nreturn ComponentName;`
)(...Object.values(scope));
```

**Rationale:**
- ✅ Interface Designer (AI) writes natural, readable import statements
- ✅ Imports serve as documentation of dependencies
- ✅ Components follow standard React patterns
- ✅ Simple compilation: strip imports, inject scope
- ✅ No custom Babel plugins needed (use existing `transform-remove-imports`)
- ✅ Easy to validate and debug

**Alternatives Considered:**
- **Global Object Pattern**: Pre-bundle into `window.PrimerUI`
  - ❌ AI must learn not to use imports
  - ❌ Less readable component code
  - ❌ Global namespace pollution
- **Custom Babel Transform**: Transform imports to scope lookups
  - ❌ Requires custom Babel plugin
  - ❌ More complex compilation
  - ✅ Would allow natural imports (but B.5 achieves this simpler)

---

## Decision 3: Component Creation in Phase 1

### Problem
Original spec deferred Interface Designer to Phase 2, but:
- Experience creation flow expects component generation
- Hand-written components only would limit testing
- Need to validate full creation → deployment workflow

### Decision: Include Interface Designer in Phase 1 ✅

**Implementation:**
- Interface Designer is a backend agent in meta-experiences
- Runs during experience creation (Intake Agent → Design Agent → Interface Designer)
- Generates components and stores in session_data
- Experience Builder copies to target experience
- 4-week timeline (was 3 weeks)

**Rationale:**
- ✅ Validates complete workflow from creation to execution
- ✅ Tests AI's ability to generate working components
- ✅ Allows preview during creation (components in session_data)
- ✅ More realistic testing of the full system
- ✅ Only adds 1 week to timeline (Week 3)
- ✅ Interface Designer is "just another agent" - not complex infrastructure

**Workflow:**
```
Meta-Experience (intake-agent):
  Educator → Intake Agent → Design Agent → Interface Designer
  Component stored in session_data
  Experience Builder copies to target experience

Target Experience:
  Student → Agent → customComponent tool
  Component loaded from resources/components/
```

**Alternatives Considered:**
- **Developer-Created Library**: Pre-built components
  - ❌ Doesn't test AI generation
  - ❌ Limited flexibility
  - ✅ Could be Phase 2 enhancement (shared library)
- **Manual Request Workflow**: Developers create on request
  - ❌ Slow (1-3 days per component)
  - ❌ Doesn't scale
  - ❌ Doesn't validate AI capabilities

---

## Decision 4: Tool Invocation from Components

### Problem
Should components be able to call other Primer tools (e.g., `playSound`, `showSlide`)?

### Decision: No Tool Invocation (Option A) ✅

**Implementation:**
Components can only call:
- `onEvent(type, data)` - Fire events
- `onStateChange(state)` - Notify of state changes
- `onSubmit(data)` - Submit completion data

Agents handle all tool orchestration.

**Rationale:**
- ✅ Components are "dumb" UI - simple, predictable
- ✅ Agents are "smart" orchestrators - handle all logic
- ✅ Simpler Interface Designer instructions (no tool orchestration)
- ✅ Clear separation of concerns
- ✅ Easier to reason about component behavior
- ✅ Agents can coordinate multiple tools based on component events

**Example Flow:**
```
Component fires: onEvent('answer-correct', { answer: 8.66 })
  ↓
Agent receives event
  ↓
Agent decides to celebrate
  ↓
Agent calls: playSound('success-chime')
Agent calls: customComponent({ action: 'updateState', showCelebration: true })
Agent says: "Excellent work! You got it right!"
```

**Alternatives Considered:**
- **Limited Allowlist**: Components can call safe tools (playSound, showSlide)
  - ❌ Adds complexity to component interface
  - ❌ Need to define and enforce allowlist
  - ❌ Components become more complex
- **Full Tool Access**: Components can call any tool
  - ❌ Very complex security model
  - ❌ Components become mini-agents
  - ❌ Interface Designer must generate tool orchestration code

---

## Decision 5: State Persistence

### Problem
What happens if a student closes the browser and returns later?

### Decision: Agent-Managed via Prompts (Option B) ✅

**Implementation:**
- No automatic persistence in Phase 1
- Agent prompts can include instructions to save/restore state
- Uses existing `information` tool
- Optional behavior - agents can choose

**Example Agent Prompt:**
```markdown
## Component State Persistence (Optional)

If you want component state to persist across sessions:

1. Save state when significant progress is made:
   information({ 
     action: 'save', 
     key: 'component-{instanceId}-state', 
     value: currentState 
   })

2. Check for saved state when resuming:
   information({ 
     action: 'get', 
     key: 'component-{instanceId}-state' 
   })

3. Restore state when showing component:
   customComponent({ 
     action: 'show', 
     initialState: savedState 
   })
```

**Rationale:**
- ✅ No new infrastructure needed
- ✅ Uses existing `information` tool
- ✅ Flexible - agents decide when to persist
- ✅ Can be added to prompts without code changes
- ✅ Different persistence strategies for different use cases
- ✅ Simplifies Phase 1 implementation

**Default Behavior:**
- Component state lives in browser memory only
- Page refresh loses state
- Acceptable for Phase 1 MVP
- Can be enhanced via prompts without code changes

**Alternatives Considered:**
- **No Persistence**: State lost on page refresh
  - ✅ Simplest for MVP
  - ❌ Poor UX for long experiences
  - ✅ Can be enhanced later (so this is effectively the default)
- **Automatic Persistence**: Auto-save to session storage
  - ❌ Requires serialization protocol
  - ❌ Security concerns (session storage access)
  - ❌ Not flexible (all or nothing)

---

## Decision 6: Component Event Handling

### Problem
How should component events integrate with agent conversation flow?

### Decision: Event Callbacks Trigger Agent Turns ✅

**Implementation:**
```typescript
interface ToolContext {
  // New callback methods
  onComponentEvent?: (event: ComponentEvent) => void;
  onComponentStateChange?: (event: ComponentStateChangeEvent) => void;
}

// Component fires event
onEvent('answer-submitted', { answer: 8.5, correct: false });

// Triggers agent turn with event data
context.onComponentEvent({
  source: 'component',
  instanceId: 'component-123',
  componentId: 'trig-triangle',
  eventType: 'answer-submitted',
  eventData: { answer: 8.5, correct: false },
  timestamp: Date.now()
});
```

**Rationale:**
- ✅ Events trigger new agent turns (like voice input)
- ✅ Events are structured data, not user messages
- ✅ Don't appear in chat transcript
- ✅ Agent prompt determines response behavior
- ✅ Flexible - agents can respond immediately or ignore
- ✅ Consistent with OpenAI Realtime API event model

**Agent Prompt Controls Behavior:**

**Proactive Style:**
```markdown
When you receive 'answer-checked' events:
- If correct=false, immediately provide encouragement and hints
- Update component state to show progressive guidance
```

**Reactive Style:**
```markdown
When you receive 'answer-checked' events:
- Store the attempt in context
- Wait for student to ask for help
- Reference attempts when they ask questions
```

**Rationale for Prompt-Based Control:**
- ✅ Same technical implementation supports different pedagogical approaches
- ✅ Same component can be used with different teaching styles
- ✅ No code changes needed to adjust agent behavior
- ✅ Demonstrates elegance of the design

**Alternatives Considered:**
- **Auto-Response**: Events always trigger agent responses
  - ❌ Not flexible
  - ❌ May interrupt student thinking
  - ❌ One-size-fits-all approach
- **Purely Informational**: Events logged but don't trigger turns
  - ❌ Delayed feedback
  - ❌ Less interactive
  - ✅ Could be achieved via prompt (ignore events)

---

## Additional Design Decisions

### Decision 7: Per-Component Error Boundaries

**Problem**: Single error boundary means one crash affects all components.

**Decision**: Each component instance has its own error boundary ✅

**Rationale:**
- ✅ Isolation - one crash doesn't affect others
- ✅ Better error context (know which component failed)
- ✅ Recovery UI per component (retry/dismiss)
- ✅ Detailed error logging

---

### Decision 8: Performance Monitoring

**Decision**: Include performance targets and monitoring from Phase 1 ✅

**Targets:**
- Compilation: < 500ms (warn at 300ms)
- State updates: < 100ms (warn at 50ms)
- Render: < 100ms (warn at 50ms)
- Memory: < 50MB per component, < 200MB total

**Rationale:**
- ✅ Catch performance issues early
- ✅ Inform optimization decisions
- ✅ Set expectations for component complexity

---

### Decision 9: Rate Limiting

**Decision**: Throttle state updates to 100ms (max 10 updates/sec per component) ✅

**Rationale:**
- ✅ Prevents agents from overwhelming components
- ✅ Merges rapid updates
- ✅ Improves performance
- ✅ Better UX (fewer flickers)

---

### Decision 10: Loading States

**Decision**: Components should show loading states during agent processing ✅

**Pattern:**
```jsx
const [isWaitingForAgent, setIsWaitingForAgent] = useState(false);

const handleSubmit = async () => {
  setIsWaitingForAgent(true);
  await onEvent?.('answer-submitted', { answer });
};

useEffect(() => {
  if (externalState) {
    setIsWaitingForAgent(false);
    // ... update state
  }
}, [externalState]);
```

**Rationale:**
- ✅ Better UX during 1-3 second agent processing
- ✅ Clear visual feedback
- ✅ Prevents duplicate submissions
- ✅ Standard pattern for all components

---

## Summary of Key Architectural Choices

1. **Bidirectional State Flow**: Agents and students both control component state
2. **Event-Driven Communication**: Components fire events, agents respond
3. **Import Stripping**: Natural imports in code, stripped during compilation
4. **Session Data Workflow**: Components created in meta-experiences, deployed to target
5. **Interface Designer**: AI generates components during experience creation
6. **Prompt-Based Behavior**: Agent prompts control response to events
7. **No Tool Invocation**: Components are pure UI, agents orchestrate tools
8. **Optional Persistence**: Agent-managed via existing information tool

These decisions create an elegant, flexible system that:
- ✅ Supports rich interactive learning experiences
- ✅ Allows AI to generate components
- ✅ Keeps components simple and predictable
- ✅ Gives agents full control over orchestration
- ✅ Enables different pedagogical approaches
- ✅ Scales to complex multi-component experiences

---

**Document Purpose**: Record all major design decisions and rationale  
**Audience**: Development team and future maintainers  
**Status**: Complete - ready for implementation  
**Date**: January 5, 2025

