# Custom React Components - Technical Review & Questions

## Overview

This document provides technical feedback on the Phase 1 MVP specification for custom React components in Primer. It identifies potential issues, asks clarifying questions, and proposes solutions. The goal is to refine the implementation plan before development begins.

## Overall Assessment

The plan is **solid and achievable**. The architecture is well-designed, the phasing is appropriate, and the use case (trigonometry practice with AI guidance) is clear and compelling. The agent-component bidirectional state management is an elegant solution.

**Main risks to address:**
1. Import/bundling mechanics for shadcn/ui components
2. State synchronization and circular updates
3. Agent response latency and UX
4. Component deployment mechanism

All of these are solvable - they just need explicit design decisions before implementation.

---

## Critical Issues Requiring Resolution

### Issue 1: Component State Synchronization Loop

**Problem**: The current state management pattern may create circular updates.

**Current code from spec:**
```typescript
// Listen for external state updates from agent
useEffect(() => {
  if (externalState) {
    setState(prev => ({ ...prev, ...externalState }));
  }
}, [externalState]);

// Notify agent when state changes
useEffect(() => {
  onStateChange?.(state);
}, [state]);
```

**Risk**: When agent updates `externalState`, component updates internal state, which triggers `onStateChange`, potentially notifying the agent of a change it just made. This could cause:
- Infinite loops
- Unnecessary network calls
- State thrashing
- Performance degradation

**Questions:**
1. How do you plan to prevent these circular updates?
2. Should the component track which state came from external vs internal sources?
3. Does the manager need to debounce or deduplicate state updates?
4. Should `onStateChange` only fire for student-initiated changes?

**Proposed Solution:**

```typescript
// Track externally-set keys to avoid echoing back
const externallySetKeys = useRef(new Set());
const previousState = useRef(state);

// Handle external state updates from agent
useEffect(() => {
  if (externalState) {
    // Mark these keys as externally set
    Object.keys(externalState).forEach(key => 
      externallySetKeys.current.add(key)
    );
    
    setState(prev => ({ ...prev, ...externalState }));
    
    // Clear tracking after render cycle
    setTimeout(() => externallySetKeys.current.clear(), 0);
  }
}, [externalState]);

// Notify agent only of student-initiated changes
useEffect(() => {
  // Filter out keys that were just set externally
  const internalChanges = {};
  for (const [key, value] of Object.entries(state)) {
    if (!externallySetKeys.current.has(key) && 
        previousState.current[key] !== value) {
      internalChanges[key] = value;
    }
  }
  
  previousState.current = state;
  
  // Only notify if there are actual internal changes
  if (Object.keys(internalChanges).length > 0) {
    onStateChange?.(internalChanges);
  }
}, [state]);
```

**Alternative approach**: Make state ownership explicit in the data model:
```typescript
interface ComponentState {
  // Agent-controlled state (agent writes, component reads)
  guidance: {
    showHint: boolean;
    showSteps: boolean;
    step1?: string;
  };
  
  // Student-controlled state (component writes, agent reads)
  student: {
    answer: string;
    attempts: number;
  };
  
  // Shared/computed state
  computed: {
    isCorrect: boolean;
    progress: number;
  };
}
```

**Decision needed**: Which approach do you prefer? Or another solution?

---

### Issue 2: shadcn/ui Component Bundling Strategy

**Problem**: The spec shows importing shadcn/ui components into scope, but the mechanics aren't clear.

**Current spec shows:**
```typescript
buildScope(): ComponentScope {
  return {
    Button: require('@/components/ui/button').Button,
    Input: require('@/components/ui/input').Input,
    // ... all other shadcn/ui components
  };
}
```

**Issues with this approach:**
1. `require()` doesn't work in browser context
2. The AI-generated component code shows: `import { Button } from '@/components/ui/button'` 
3. These imports won't resolve in Babel-compiled code running in browser
4. Need a way to make components available without module resolution

**Questions:**
1. What's your current webpack/bundling setup for Primer?
2. Do you use Next.js's built-in bundling?
3. Can you pre-bundle shadcn components into a global object?
4. What should the AI-generated code look like to access these components?

**Proposed Solution A: Global Object Pattern**

Pre-bundle all shadcn components:
```typescript
// In app initialization (once)
window.PrimerUI = {
  Button: ButtonComponent,
  Input: InputComponent,
  Card: CardComponent,
  CardHeader: CardHeaderComponent,
  CardContent: CardContentComponent,
  Label: LabelComponent,
  // ... all shadcn components
};

// In ComponentManager.buildScope()
buildScope(): ComponentScope {
  return {
    React,
    useState: React.useState,
    useEffect: React.useEffect,
    // ... other React hooks
    
    // Spread all UI components
    ...window.PrimerUI,
    
    // Math & Science
    math: window.math,
    Recharts: window.Recharts,
    _: window._,
    
    // Block dangerous APIs
    fetch: undefined,
    localStorage: undefined,
    // ...
  };
}
```

AI-generated component code (no imports):
```jsx
// AI must generate code that destructures from scope
export default function TrigTriangle({ 
  initialState,
  externalState,
  onStateChange,
  onEvent 
}) {
  // Access components from scope (passed as function arguments)
  const { Button, Input, Card, CardHeader, CardContent, Label } = arguments[0].scope;
  // OR they're just available globally after Babel transform
  
  const [state, setState] = useState({ ...initialState });
  
  return (
    <Card>
      <CardHeader>Title</CardHeader>
      <CardContent>
        <Input />
        <Button>Submit</Button>
      </CardContent>
    </Card>
  );
}
```

**Proposed Solution B: Babel Transform Plugin**

Create a custom Babel plugin that transforms imports:
```javascript
// AI generates this:
import { Button } from '@/components/ui/button';

// Babel plugin transforms to:
const Button = scope.Button;
```

Then pass scope object as first argument to compiled function.

**Decision needed**: Which bundling strategy works with your current Primer architecture?

---

### Issue 3: Agent Response Latency & Component UX

**Problem**: The agent-component interaction has inherent latency.

**Interaction flow:**
```
Student submits answer (0ms)
  â†" onEvent fires
Agent receives event (50-100ms network)
  â†" Agent processes with Claude API
Agent decides action (1-3 seconds Claude API)
  â†" Agent calls customComponent tool
Tool updates component state (50-100ms network)
  â†" Component re-renders
Student sees hint (total: 1.5-3.5 seconds)
```

**Questions:**
1. What's acceptable latency for your use case?
2. Should components show loading states during agent processing?
3. Can agents send optimistic updates before full processing?
4. Should students be prevented from interacting during agent processing?

**UX Considerations:**

```jsx
export default function TrigTriangle({ 
  initialState,
  externalState,
  onStateChange,
  onEvent 
}) {
  const [state, setState] = useState({ ...initialState });
  const [isWaitingForAgent, setIsWaitingForAgent] = useState(false);
  
  const handleCheck = async () => {
    const answer = parseFloat(state.studentAnswer);
    const correct = Math.abs(answer - correctAnswer) < 0.1;
    
    // Show loading state
    setIsWaitingForAgent(true);
    
    // Fire event
    await onEvent?.('answer-checked', { answer, correct });
    
    // Agent will update state, which will clear loading
  };
  
  // Clear loading when agent responds
  useEffect(() => {
    if (externalState) {
      setIsWaitingForAgent(false);
      setState(prev => ({ ...prev, ...externalState }));
    }
  }, [externalState]);
  
  return (
    <Card>
      {/* Show loading overlay when waiting */}
      {isWaitingForAgent && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <Spinner />
          <p>Checking your answer...</p>
        </div>
      )}
      
      <Button 
        onClick={handleCheck}
        disabled={isWaitingForAgent}
      >
        Check Answer
      </Button>
    </Card>
  );
}
```

**Decision needed**: Should components include loading state patterns by default? Should this be in the template AI uses?

---

### Issue 4: Component File Deployment Mechanism

**Problem**: The path from component creation to runtime execution isn't fully specified.

**Current spec mentions:**
```typescript
await manager.loadComponent(context.experienceId, args.componentId);
```

**Questions:**
1. Where does `loadComponent` fetch the component code from?
   - Filesystem? (e.g., `storage/{experienceId}/resources/components/{componentId}.jsx`)
   - API endpoint? (e.g., `/api/experiences/{experienceId}/components/{componentId}`)
   - Database?
2. Is this a server-side or client-side operation?
3. How does component code get from Interface Designer (Phase 2) into storage?
4. In Phase 1 (no Interface Designer), how do test components get deployed?

**Proposed Implementation:**

```typescript
// In CustomComponentManager
async loadComponent(
  experienceId: string, 
  componentId: string
): Promise<void> {
  try {
    // Fetch component code from API
    const response = await fetch(
      `/api/experiences/${experienceId}/components/${componentId}`
    );
    
    if (!response.ok) {
      throw new Error(`Component ${componentId} not found`);
    }
    
    const { code, metadata } = await response.json();
    
    // Compile component
    const compiled = this.compileComponent(code, componentId);
    
    // Store compiled component
    this.components.set(componentId, {
      Component: compiled,
      metadata
    });
    
    logger.info('Component loaded', { experienceId, componentId });
    
  } catch (error) {
    logger.error('Failed to load component', { 
      experienceId, 
      componentId, 
      error 
    });
    throw error;
  }
}
```

API endpoint implementation:
```typescript
// app/api/experiences/[experienceId]/components/[componentId]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { experienceId: string; componentId: string } }
) {
  const { experienceId, componentId } = params;
  
  // Read component file from storage
  const componentPath = path.join(
    process.cwd(),
    'storage',
    experienceId,
    'resources',
    'components',
    `${componentId}.jsx`
  );
  
  if (!fs.existsSync(componentPath)) {
    return NextResponse.json(
      { error: 'Component not found' },
      { status: 404 }
    );
  }
  
  const code = fs.readFileSync(componentPath, 'utf-8');
  
  // Get metadata from experience.json
  const experienceConfigPath = path.join(
    process.cwd(),
    'storage',
    experienceId,
    'experience.json'
  );
  const config = JSON.parse(fs.readFileSync(experienceConfigPath, 'utf-8'));
  const metadata = config.resources.components?.find(
    c => c.id === componentId
  );
  
  return NextResponse.json({ code, metadata });
}
```

**Decision needed**: Does this API approach work with your architecture? Or should it be handled differently?

---

### Issue 5: Error Boundaries - Isolation Level

**Problem**: Current spec has single error boundary for all components.

**Current spec:**
```typescript
<ErrorBoundary fallback={<ComponentError />}>
  <div className="pointer-events-auto">
    {instances.map((instance, index) => (
      <React.Fragment key={`component-${index}`}>
        {instance}
      </React.Fragment>
    ))}
  </div>
</ErrorBoundary>
```

**Risk**: If one component crashes, all components disappear.

**Questions:**
1. Should each component instance have its own error boundary?
2. What should happen when a component crashes?
   - Show error UI in place of component?
   - Log to monitoring service?
   - Notify agent?
3. Should crashed components be recoverable (retry button)?

**Proposed Solution:**

```typescript
export default function CustomComponents() {
  const instances = getActiveComponentInstances();
  
  if (!instances || instances.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 z-custom-component pointer-events-none">
      <div className="pointer-events-auto">
        {instances.map((instance, index) => (
          <ErrorBoundary
            key={`component-${instance.id}-${index}`}
            fallback={
              <ComponentError 
                componentId={instance.componentId}
                instanceId={instance.id}
                onRetry={() => handleRetry(instance.id)}
                onDismiss={() => handleDismiss(instance.id)}
              />
            }
            onError={(error, errorInfo) => {
              // Log error
              logger.error('Component crashed', {
                componentId: instance.componentId,
                instanceId: instance.id,
                error: error.message,
                stack: error.stack,
                errorInfo
              });
              
              // Optionally notify agent
              notifyAgent?.('component-error', {
                instanceId: instance.id,
                error: error.message
              });
            }}
          >
            {instance.element}
          </ErrorBoundary>
        ))}
      </div>
    </div>
  );
}

function ComponentError({ 
  componentId, 
  instanceId, 
  onRetry, 
  onDismiss 
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <Card className="max-w-md p-6">
        <div className="text-red-600 mb-4">
          <AlertCircle size={48} />
        </div>
        <h2 className="text-xl font-bold mb-2">Component Error</h2>
        <p className="text-gray-600 mb-4">
          This interactive component encountered an error and couldn't be displayed.
        </p>
        <div className="flex gap-2">
          <Button onClick={onRetry} variant="outline">
            Try Again
          </Button>
          <Button onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

**Decision needed**: Is this level of error isolation appropriate?

---

## Medium Priority Questions

### Question 6: Component Creation in Phase 1

**Issue**: Phase 1 MVP defers Interface Designer agent to Phase 2, but the use case describes educators talking to AI to generate experiences.

**Questions:**
1. In Phase 1, who creates the component files?
   - Are they hand-written by developers?
   - Is there a manual process for educators to request them?
   - Are you only testing with pre-made examples?
2. How do test components get deployed to `storage/{experienceId}/resources/components/`?
3. Is there a CLI tool or admin interface for adding components manually?

**Possible Phase 1 Approaches:**

**Option A**: Developer-created component library
- Developers pre-create common components (trig-triangle, molecule-builder, etc.)
- Store in global library: `storage/component-library/`
- Educators select from available components during experience creation
- Intake Agent delegates to Experience Builder, which copies component to experience

**Option B**: Manual component request workflow
- Educator describes need during Intake Agent conversation
- Intake Agent creates ticket/request for developer
- Developer manually creates component and deploys
- Educator reviews and approves
- Experience Builder includes component reference

**Option C**: Simple component generation tool (Phase 1.5)
- Basic tool that generates components from templates
- Not full Interface Designer, but better than manual
- Template-based: "Create trig triangle with sides A, B, angle C"
- Generated code is simpler, more constrained

**Decision needed**: Which approach for Phase 1? Or another option?

---

### Question 7: Tool Invocation from Components

**Issue**: The spec mentions components calling other Primer tools via `usePrimerContext()`.

**Example from spec:**
```typescript
usePrimerContext: () => ({
  showSlide: (title, content) => /* integrate with existing tools */,
  playSound: (soundId) => /* integrate with existing tools */
})
```

**Questions:**
1. Should components be able to invoke other tools?
2. If yes, how do these calls get routed back to the agent context?
3. What's the security/permission model?
4. Could this create unexpected behavior?

**Use Case Example:**
```jsx
// Component celebrates correct answer
const { playSound, showSlide } = usePrimerContext();

const handleCorrect = () => {
  playSound('success-chime');
  showSlide('Great Job!', 'You got it right!');
  onSubmit({ completed: true });
};
```

**Potential Issues:**
- Components bypassing agent control
- Tool calls from multiple components conflicting
- Permission/authorization complexity

**Possible Approaches:**

**Option A**: No tool invocation from components (simpler)
- Components only call: `onEvent`, `onSubmit`, `onStateChange`
- Agent handles all tool orchestration
- Components are pure display/interaction

**Option B**: Limited tool allowlist (middle ground)
- Components can call safe, display-only tools
- Allowed: `playSound`, maybe `showSlide`
- Blocked: `customComponent`, `information`, `delegate`
- Enforced in `usePrimerContext` implementation

**Option C**: Full tool access with logging (most flexible)
- Components can call any tool in their toolGroups
- All calls logged and attributed to component
- Could enable powerful component behaviors
- More complex to implement and secure

**Decision needed**: Which approach? Or different design?

---

### Question 8: State Persistence Across Sessions

**Issue**: What happens if a student leaves and returns later?

**Questions:**
1. Should component state persist across sessions?
2. If yes, how is state serialized/deserialized?
3. Where is state stored?
   - Session database?
   - Browser localStorage? (probably not, given security model)
   - Agent's information tool?
4. Should components be designed with persistence in mind?

**Scenarios:**

**Scenario A**: Student closes browser mid-problem
```
1. Student working on trig problem
2. Browser closes
3. Student returns next day
4. What should happen?
   - Option 1: Fresh start (state lost)
   - Option 2: Resume from where they left off (state restored)
```

**Scenario B**: Multi-day experiences
```
1. Day 1: Student completes molecule-building exercise
2. Day 2: Returns for next lesson
3. Should previous work be visible/accessible?
```

**Possible Approaches:**

**Option 1**: No persistence in Phase 1 (simplest)
- State is session-only
- Fresh start on each page load/session
- Document this limitation

**Option 2**: Agent-managed persistence
- Agent saves important state to information tool
- On session resume, agent reconstructs component state
- Agent calls `customComponent` with saved state

**Option 3**: Automatic state persistence
- Component state auto-saved to session storage
- Restored on component load
- Requires serialization protocol

**Decision needed**: What level of persistence do you need? Is "none for Phase 1" acceptable?

---

### Question 9: Component Event Handling & Agent Awareness

**Issue**: How should agents be notified of component events?

**Current design:**
```typescript
onEvent: (type, data) => {
  context.sendEvent?.('component-event', { 
    instanceId, 
    type, 
    data 
  });
}
```

**Questions:**
1. Is `context.sendEvent` a real method in your ToolContext?
2. How do events reach the agent conversation?
3. Should events appear in chat as system messages?
4. Should agent automatically respond to certain events?

**Example Flow:**
```
[Component fires: answer-checked, { answer: 8.5, correct: false }]
  â†"
[Event appears in agent context]
  â†"
[Should agent auto-respond? Or wait for next message?]
  â†"
Option A: Auto-respond based on event
  Agent: "That's not quite right. Let me show you a hint."
  [Calls customComponent to update state]

Option B: Event stored, agent references in next turn
  Student: "I don't get it"
  Agent: "I see you tried 8.5. The issue is..."

Option C: Event purely informational, no auto-response
  [Agent records event but doesn't interrupt]
```

**Decision needed**: How should component events integrate with agent conversation flow?

---

## Additional Recommendations

### Recommendation 1: Component Development Documentation

Even though Interface Designer isn't in Phase 1, you'll need documentation for:
- Developers creating test components
- AI prompt engineering for Interface Designer (Phase 2)
- Component patterns and best practices

**Suggested documentation:**

```markdown
# Component Development Guide

## Component Interface

Every custom component must:
1. Export a default function component
2. Accept PrimerComponentProps interface
3. Handle `externalState` updates from agent
4. Call `onStateChange` for student interactions
5. Use `onEvent` for significant events
6. Call `onSubmit` when complete

## Available Libraries

- React hooks: useState, useEffect, useReducer, useMemo, useCallback, useRef
- UI components: [list all shadcn components]
- Math: MathJS (window.math)
- Charts: Recharts
- Utilities: Lodash (_)
- Icons: Lucide React

## State Management Pattern

```typescript
const [state, setState] = useState({ ...initialState });

// Listen for agent updates
useEffect(() => {
  if (externalState) {
    setState(prev => ({ ...prev, ...externalState }));
  }
}, [externalState]);

// Notify agent of changes
useEffect(() => {
  onStateChange?.(state);
}, [state]);
```

## Do's and Don'ts

âœ… Do: Use shadcn/ui components for consistent styling
âœ… Do: Provide clear visual feedback
âœ… Do: Handle loading states
âœ… Do: Test with various screen sizes

❌ Don't: Use fetch or network requests
❌ Don't: Access localStorage or sessionStorage
❌ Don't: Use external scripts or CDN resources
❌ Don't: Create infinite loops or expensive computations
```

---

### Recommendation 2: Performance Budget

Define acceptable performance limits:

```typescript
interface PerformanceTargets {
  compilation: {
    max: 500, // ms
    warn: 300  // ms
  },
  stateUpdate: {
    max: 100,  // ms
    warn: 50   // ms
  },
  render: {
    max: 100,  // ms
    warn: 50   // ms
  },
  memory: {
    maxPerComponent: 50,  // MB
    maxTotal: 200         // MB
  }
}
```

Implement monitoring:
```typescript
const startTime = performance.now();
const compiled = this.compileComponent(code, componentId);
const compileTime = performance.now() - startTime;

if (compileTime > PERFORMANCE_TARGETS.compilation.warn) {
  logger.warn('Slow component compilation', { 
    componentId, 
    compileTime 
  });
}
```

---

### Recommendation 3: Rate Limiting

Prevent agent from overwhelming component with updates:

```typescript
class CustomComponentManager {
  private updateQueue: Map<string, {
    pending: Record<string, any>[];
    lastUpdate: number;
  }> = new Map();
  
  private readonly UPDATE_THROTTLE_MS = 100; // Max 10 updates/sec
  
  updateComponentState(
    instanceId: string, 
    updates: Record<string, any>
  ): void {
    const now = Date.now();
    const queue = this.updateQueue.get(instanceId) || {
      pending: [],
      lastUpdate: 0
    };
    
    // Merge updates
    const merged = Object.assign({}, ...queue.pending, updates);
    
    // Check if throttle period has passed
    if (now - queue.lastUpdate >= this.UPDATE_THROTTLE_MS) {
      // Apply immediately
      this.applyStateUpdate(instanceId, merged);
      queue.pending = [];
      queue.lastUpdate = now;
    } else {
      // Queue for next cycle
      queue.pending = [merged];
      
      // Schedule delayed update
      setTimeout(() => {
        const latest = this.updateQueue.get(instanceId);
        if (latest && latest.pending.length > 0) {
          const finalUpdate = Object.assign({}, ...latest.pending);
          this.applyStateUpdate(instanceId, finalUpdate);
          latest.pending = [];
          latest.lastUpdate = Date.now();
        }
      }, this.UPDATE_THROTTLE_MS - (now - queue.lastUpdate));
    }
    
    this.updateQueue.set(instanceId, queue);
  }
}
```

---

## Summary of Decisions Needed

Please provide answers/decisions for:

### Critical (Blockers for Phase 1)
1. **State synchronization**: How to prevent circular updates? Prefer proposed solution or alternative?
2. **shadcn/ui bundling**: How are components made available? Global object? Babel transform? Something else?
3. **Component deployment**: API endpoint approach acceptable? Or different mechanism?
4. **Component creation in Phase 1**: Hand-written? Template-based tool? Other approach?

### Important (Affects architecture)
5. **Error boundaries**: Per-component isolation acceptable?
6. **Agent response latency**: Should components show loading states? Include in template?
7. **Tool invocation from components**: Allow? If yes, which tools?
8. **Component events**: How should they integrate with agent conversation?

### Nice to Have (Can defer)
9. **State persistence**: Needed in Phase 1? Or acceptable limitation?
10. **Performance monitoring**: Should this be in Phase 1 or Phase 2?

---

## Next Steps

1. **Interview session**: Answer questions above to finalize design decisions
2. **Update specifications**: Revise phase1-mvp-spec.md with decisions
3. **Create updated checklist**: Reflect finalized architecture
4. **Begin implementation**: With confidence in the design

---

**Document Purpose**: Technical review and decision-making guide  
**Intended Audience**: Development team and technical stakeholders  
**Status**: Awaiting design decisions  
**Date**: January 5, 2025