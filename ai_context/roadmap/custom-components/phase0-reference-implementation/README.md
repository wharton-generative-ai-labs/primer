# Phase 0 Reference Implementation

## Overview

This folder contains the complete reference implementation for Phase 0 testing. These files should be copied to the appropriate locations in your Primer installation to create the demo experience.

## Files

### 1. `trig-triangle.jsx`
**Purpose**: Hand-written test component  
**Copy to**: `storage/component-demo/resources/components/trig-triangle.jsx`

The trigonometry triangle component demonstrates:
- State synchronization (prevents circular updates)
- Event handling (onEvent, onSubmit)
- Loading states (agent processing)
- Agent-controlled guidance (hints, steps)
- shadcn/ui component usage

### 2. `demo-agent-instructions.md`
**Purpose**: Agent instructions for testing  
**Copy to**: `storage/component-demo/resources/instructions/agent/demo-agent.md`

Complete instructions for the demo agent including:
- Test sequence
- Event handling
- Response patterns based on attempts
- Example interactions

### 3. `experience.json`
**Purpose**: Experience configuration  
**Copy to**: `storage/component-demo/experience.json`

Defines:
- Agent configuration (demo-agent)
- Component metadata (trig-triangle)
- Tool groups (builtin, custom-component)
- AI configuration (OpenAI Realtime API)

## Installation

### Step 1: Create Directory Structure

```bash
mkdir -p storage/component-demo/resources/components
mkdir -p storage/component-demo/resources/instructions/agent
```

### Step 2: Copy Files

```bash
# Copy component
cp phase0-reference-implementation/trig-triangle.jsx \
   storage/component-demo/resources/components/

# Copy agent instructions
cp phase0-reference-implementation/demo-agent-instructions.md \
   storage/component-demo/resources/instructions/agent/demo-agent.md

# Copy experience config
cp phase0-reference-implementation/experience.json \
   storage/component-demo/
```

### Step 3: Verify Structure

Your directory should look like this:

```
storage/component-demo/
├── experience.json
└── resources/
    ├── components/
    │   └── trig-triangle.jsx
    └── instructions/
        └── agent/
            └── demo-agent.md
```

## Testing

### 1. Start Primer

```bash
npm run dev
```

### 2. Navigate to Demo Experience

Open browser to: `http://localhost:3000/play/component-demo`

### 3. Expected Behavior

1. **Agent greets you** and explains the task
2. **Component appears** showing a right triangle
3. **You type an answer** and click "Check Answer"
4. **Loading state appears** while agent processes
5. **Agent responds** with feedback
6. **After 2 attempts**, hint appears (if incorrect)
7. **After 4 attempts**, steps appear (if incorrect)
8. **On correct answer**, agent celebrates and hides component

### 4. What to Verify

- [ ] Component loads and displays correctly
- [ ] Triangle SVG renders
- [ ] Input field works
- [ ] Button is clickable
- [ ] Loading state appears during agent processing
- [ ] Agent receives events
- [ ] Agent responds appropriately
- [ ] Hint appears when agent updates state
- [ ] Steps appear when agent updates state
- [ ] No circular update loops (check console)
- [ ] No errors in console
- [ ] Performance is acceptable (< 500ms compilation)

## Troubleshooting

### Component Doesn't Load

**Check:**
- File exists at `storage/component-demo/resources/components/trig-triangle.jsx`
- experience.json has component in resources.components
- API endpoint is working (check Network tab)

### Events Don't Reach Agent

**Check:**
- context.onComponentEvent is implemented
- Agent is listening for events
- Event data is serializable

### State Updates Don't Work

**Check:**
- External key tracking is working
- Agent is calling updateState with correct instanceId
- Component is re-rendering on externalState changes

### Circular Updates

**Check:**
- External key tracking is implemented correctly
- setTimeout is clearing the tracking
- Only internal changes trigger onStateChange

## Component Code Highlights

### State Synchronization Pattern

```jsx
// Track externally-set keys
const externallySetKeys = useRef(new Set());
const previousState = useRef(state);

// Listen for agent updates
useEffect(() => {
  if (externalState) {
    Object.keys(externalState).forEach(key => 
      externallySetKeys.current.add(key)
    );
    setState(prev => ({ ...prev, ...externalState }));
    setTimeout(() => externallySetKeys.current.clear(), 0);
    setIsWaitingForAgent(false);
  }
}, [externalState]);

// Notify agent of student changes only
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

### Loading State Pattern

```jsx
const [isWaitingForAgent, setIsWaitingForAgent] = useState(false);

const handleCheck = async () => {
  setIsWaitingForAgent(true);
  await onEvent?.('answer-checked', { answer, correct, attempts });
};

useEffect(() => {
  if (externalState) {
    setIsWaitingForAgent(false);
    // ... update state
  }
}, [externalState]);
```

### Event Handling

```jsx
// Fire event to agent
await onEvent?.('answer-checked', { 
  answer, 
  correct, 
  attempts: newAttempts 
});

// If correct, also call onSubmit
if (correct) {
  await onSubmit?.({ 
    completed: true, 
    answer, 
    attempts: newAttempts 
  });
}
```

## Agent Prompt Highlights

### Test Sequence

1. Greet and explain
2. Show component with initialState
3. Monitor events
4. Respond based on attempts:
   - Attempt 1: Encourage
   - Attempt 2: Show hint
   - Attempt 4: Show steps
5. Celebrate on success
6. Hide component

### Event Response Pattern

```javascript
// Based on attempts
if (attempts === 1) {
  // Encourage
} else if (attempts === 2) {
  // Show hint
  customComponent({
    action: 'updateState',
    instanceId: instanceId,
    stateUpdates: { showHint: true }
  })
} else if (attempts === 4) {
  // Show steps
  customComponent({
    action: 'updateState',
    instanceId: instanceId,
    stateUpdates: { showSteps: true }
  })
}
```

## Success Criteria

Phase 0 is successful when:

- ✅ Component loads from API endpoint
- ✅ Babel compiles component (< 500ms)
- ✅ Component renders correctly
- ✅ Student can interact
- ✅ Events flow to agent
- ✅ Agent receives correct data
- ✅ Agent can update state
- ✅ Component re-renders with new state
- ✅ No circular update loops
- ✅ Loading states work
- ✅ Error boundaries work
- ✅ Complete interaction succeeds

## Next Steps

Once Phase 0 is validated:

1. Document any issues found
2. Update specifications based on learnings
3. Proceed to Phase 1 (Interface Designer)
4. Test AI-generated components
5. Implement session data workflow

---

**Document Purpose**: Installation and testing guide for Phase 0 reference implementation  
**Audience**: Developers implementing Phase 0  
**Status**: Ready for testing  
**Date**: January 5, 2025

