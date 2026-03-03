# Phase 0: Runtime Validation Specification

## Overview

Phase 0 validates the core runtime system for custom React components using hand-written components before adding AI generation complexity. This "walking skeleton" approach proves the foundation works before building on it.

**Duration**: 1-2 weeks  
**Goal**: Validate that components can be loaded, compiled, displayed, and communicate with agents

---

## Scope

### ✅ In Scope

**Core Runtime System:**
- CustomComponentManager (load, compile, execute)
- Babel compilation with import stripping
- Scope injection (React, shadcn/ui, MathJS, Recharts, Lodash)
- Component display with per-component error boundaries
- customComponent tool (show, hide, updateState, getState, list)
- Component event system (onEvent, onStateChange, onSubmit)
- State synchronization (prevent circular updates)
- API endpoint for component loading
- Performance monitoring
- Rate limiting

**Demo Experience:**
- Simple test experience with one agent
- Hand-written trigonometry component
- Agent instructions for testing component features
- Manual testing in browser

### ❌ Out of Scope (Moved to Phase 1)

- Interface Designer agent
- Meta-experience modifications (intake-agent, etc.)
- Artifact tool enhancement for jsx type
- Component generation workflow
- Session data integration for component creation
- Experience Builder integration

---

## Why Phase 0?

### Benefits

1. **De-risks Critical Path**: Validates core architecture before adding complexity
2. **Faster Feedback**: Test immediately without waiting for AI generation
3. **Cleaner Testing**: Known-good component code eliminates AI as variable
4. **Validates Assumptions**: Does Babel work? Does scope injection work? Do events flow?
5. **Better Debugging**: Easier to isolate issues in runtime vs AI-generated code

### What We Learn

- ✅ Babel standalone compiles JSX in browser
- ✅ Import stripping works correctly
- ✅ Scope injection provides all dependencies
- ✅ Components render with shadcn/ui styling
- ✅ Events flow from component to agent
- ✅ State updates flow from agent to component
- ✅ Circular updates are prevented
- ✅ Error boundaries isolate failures
- ✅ Performance is acceptable

---

## Implementation Checklist

### Week 1: Core Infrastructure

#### Day 1-2: CustomComponentManager

**File**: `src/app/lib/tools/ui/components/ComponentManager.tsx`

- [ ] Create ComponentManager class
- [ ] Implement `loadComponent(experienceId, componentId)`
  - [ ] Fetch from API endpoint
  - [ ] Handle 404 errors
  - [ ] Cache loaded components
- [ ] Implement `compileComponent(jsxCode, componentId)`
  - [ ] Use Babel.transform with 'react' preset
  - [ ] Add 'transform-remove-imports' plugin
  - [ ] Measure compilation time
  - [ ] Log performance warnings (> 300ms)
- [ ] Implement `buildScope()`
  - [ ] Import all shadcn/ui components at top of file
  - [ ] Import React and all hooks
  - [ ] Return scope object with all dependencies
  - [ ] Block dangerous APIs (fetch, localStorage, eval)
- [ ] Implement `showComponent(componentId, props)`
  - [ ] Generate unique instanceId
  - [ ] Create component instance with props
  - [ ] Store in active instances map
  - [ ] Trigger UI update
  - [ ] Return instanceId
- [ ] Implement `updateComponentState(instanceId, stateUpdates)`
  - [ ] Apply rate limiting (100ms throttle)
  - [ ] Merge rapid updates
  - [ ] Update component props with externalState
  - [ ] Trigger re-render
- [ ] Implement `getComponentState(instanceId)`
  - [ ] Return current state from state map
- [ ] Implement `hideComponent(instanceId)`
  - [ ] Remove from active instances
  - [ ] Clean up state
  - [ ] Trigger UI update
- [ ] Implement `listComponents()`
  - [ ] Return array of loaded component metadata
- [ ] Add error handling for all methods

**Dependencies:**
- [ ] Add `@babel/standalone` to package.json
- [ ] Add `babel-plugin-transform-remove-imports` to package.json
- [ ] Run: `npm install @babel/standalone babel-plugin-transform-remove-imports`

#### Day 3: Type Definitions

**File**: `src/app/lib/tools/ui/components/types.ts`

- [ ] Define `PrimerComponentProps` interface
  - [ ] initialState?: Record<string, any>
  - [ ] externalState?: Record<string, any>
  - [ ] onStateChange?: (state: Record<string, any>) => void
  - [ ] onEvent?: (eventType: string, data: any) => void
  - [ ] onSubmit?: (data: Record<string, any>) => void
  - [ ] experienceId: string
  - [ ] sessionId: string
  - [ ] instanceId: string
- [ ] Define `ComponentInfo` interface
- [ ] Define `CompiledComponent` interface
- [ ] Define `ComponentScope` interface
- [ ] Define `ComponentEvent` interface
- [ ] Define `ComponentStateChangeEvent` interface

**File**: `src/app/lib/tools/types.ts`

- [ ] Add `onComponentEvent?: (event: ComponentEvent) => void` to ToolContext
- [ ] Add `onComponentStateChange?: (event: ComponentStateChangeEvent) => void` to ToolContext

**File**: `src/app/lib/types.ts` (or appropriate config types file)

- [ ] Add `ComponentConfig` interface
- [ ] Add `components?: ComponentConfig[]` to ExperienceConfig.resources

#### Day 4: Custom Component Tool

**File**: `src/app/lib/tools/ui/custom-component.ts`

- [ ] Create `customComponent` tool function
- [ ] Implement `show` action
  - [ ] Load component if not loaded
  - [ ] Create instance with initialState
  - [ ] Set up onEvent callback (calls context.onComponentEvent)
  - [ ] Set up onStateChange callback
  - [ ] Return instanceId
- [ ] Implement `updateState` action
  - [ ] Call manager.updateComponentState()
  - [ ] Return new state
- [ ] Implement `getState` action
  - [ ] Call manager.getComponentState()
  - [ ] Return current state
- [ ] Implement `hide` action
  - [ ] Call manager.hideComponent()
- [ ] Implement `list` action
  - [ ] Call manager.listComponents()
- [ ] Add comprehensive JSDoc comments
- [ ] Add error handling for all actions

**File**: `src/app/lib/tools/ui/index.ts`

- [ ] Create `registerCustomComponentTools()` function
- [ ] Register customComponent tool with ToolRegistry
- [ ] Add detailed description for agents
- [ ] Define all parameters (action, componentId, instanceId, initialState, stateUpdates)
- [ ] Export registration function

**File**: `src/app/lib/tools/groups.ts`

- [ ] Add `'custom-component': ['customComponent']` to TOOL_GROUPS

#### Day 5: Component Display

**File**: `src/app/components/CustomComponents.tsx`

- [ ] Create CustomComponents display component
- [ ] Import getActiveComponentInstances from manager
- [ ] Render active component instances
- [ ] Add per-component ErrorBoundary wrappers
- [ ] Create ComponentError fallback UI
  - [ ] Show error icon and message
  - [ ] Add "Try Again" button (calls handleRetry)
  - [ ] Add "Dismiss" button (calls handleDismiss)
- [ ] Implement handleRetry function
  - [ ] Attempt to reload component
  - [ ] Clear error state
- [ ] Implement handleDismiss function
  - [ ] Hide component
  - [ ] Clean up state
- [ ] Add error logging in onError callback
- [ ] Add proper z-index and positioning (z-50, fixed overlay)

**File**: `src/app/play/[id]/page.tsx` (or appropriate PlayPage file)

- [ ] Import CustomComponents
- [ ] Add `<CustomComponents />` to render tree
- [ ] Ensure it renders alongside Scene, Slides, etc.

### Week 2: Demo Experience & Testing

#### Day 1: API Endpoint

**File**: `src/app/api/experiences/[experienceId]/components/[componentId]/route.ts`

- [ ] Create API route for component loading
- [ ] Implement GET handler
  - [ ] Extract experienceId and componentId from params
  - [ ] Build path: `storage/{experienceId}/resources/components/{componentId}.jsx`
  - [ ] Check if file exists (return 404 if not)
  - [ ] Read component code from file
  - [ ] Read metadata from experience.json (if exists)
  - [ ] Return JSON: { code, metadata }
- [ ] Add error handling
  - [ ] 404 for missing components
  - [ ] 500 for server errors
  - [ ] Log all errors
- [ ] Add CORS headers if needed

#### Day 2: CDN Scripts

**File**: `src/app/play/[id]/page.tsx` or layout

- [ ] Add conditional CDN script loading
- [ ] Load MathJS: `https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.11.0/math.min.js`
- [ ] Load Recharts: `https://cdnjs.cloudflare.com/ajax/libs/recharts/2.5.0/Recharts.js`
- [ ] Load Lodash: `https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js`
- [ ] Load Lucide: `https://cdnjs.cloudflare.com/ajax/libs/lucide/0.263.1/lucide.min.js`
- [ ] Only load when experience has custom components
- [ ] Add loading error handling

**File**: `next.config.ts`

- [ ] Update CSP to allow `'unsafe-eval'` for Babel (required)
- [ ] Update CSP to allow cdnjs.cloudflare.com scripts
- [ ] Document why unsafe-eval is needed and mitigation strategy

#### Day 3: Hand-Written Test Component

**Reference Implementation**: See `phase0-reference-implementation/trig-triangle.jsx` for complete code

**File**: `storage/component-demo/resources/components/trig-triangle.jsx`

- [ ] Create TrigTriangle component
- [ ] Import React hooks (useState, useEffect, useRef)
- [ ] Import shadcn/ui components (Button, Input, Card, Label, Progress)
- [ ] Accept PrimerComponentProps
- [ ] Initialize state from initialState
- [ ] Implement external key tracking (useRef for externallySetKeys)
- [ ] Listen for externalState updates
  - [ ] Mark keys as external
  - [ ] Update state
  - [ ] Clear tracking after timeout
- [ ] Notify agent of student changes only
  - [ ] Filter out externally-set keys
  - [ ] Only call onStateChange for internal changes
- [ ] Add loading state (isWaitingForAgent)
- [ ] Implement handleCheck function
  - [ ] Calculate if answer is correct
  - [ ] Increment attempts
  - [ ] Set loading state
  - [ ] Fire onEvent('answer-checked', data)
  - [ ] Call onSubmit if correct
- [ ] Render triangle SVG
- [ ] Show hint when state.showHint is true
- [ ] Show steps when state.showSteps is true
- [ ] Handle student input (controlled Input)
- [ ] Show loading overlay when waiting
- [ ] Disable button during loading
- [ ] Use shadcn/ui components for consistent styling

#### Day 4: Demo Experience Configuration

**Reference Implementation**: See `phase0-reference-implementation/experience.json` for complete configuration

**File**: `storage/component-demo/experience.json`

- [ ] Create experience configuration
- [ ] Set metadata (title, description, version)
- [ ] Configure aiConfigurations (default OpenAI)
- [ ] Add demo-agent to agents
  - [ ] name: "Component Demo Agent"
  - [ ] type: "frontend"
  - [ ] voice: "nova" (or preferred)
  - [ ] toolGroups: ["builtin", "custom-component"]
- [ ] Set initialAgent: "demo-agent"
- [ ] Add resources.components array
  - [ ] id: "trig-triangle"
  - [ ] name: "Trigonometry Triangle"
  - [ ] file: "resources/components/trig-triangle.jsx"
  - [ ] description: "Practice calculating triangle sides"
- [ ] Add resources.instructions.agent mapping
  - [ ] "demo-agent": "resources/instructions/agent/demo-agent.md"

**Directory Structure:**
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

#### Day 5: Demo Agent Instructions

**Reference Implementation**: See `phase0-reference-implementation/demo-agent-instructions.md` for complete instructions

**File**: `storage/component-demo/resources/instructions/agent/demo-agent.md`

- [ ] Create agent instructions
- [ ] Explain agent's purpose (test custom components)
- [ ] Document customComponent tool usage
- [ ] Provide test sequence:
  1. Greet student
  2. Show component with initialState
  3. Monitor events
  4. Update state based on attempts
  5. Show hint after 2 attempts
  6. Show steps after 4 attempts
  7. Celebrate on completion
- [ ] Document event handling
- [ ] Provide example tool calls
- [ ] Add personality (friendly, encouraging)

### Week 2: Testing & Validation

#### Manual Testing Checklist

**Component Loading:**
- [ ] Navigate to `/play/component-demo`
- [ ] Verify experience loads
- [ ] Check browser console for errors
- [ ] Verify CDN scripts loaded (MathJS, Recharts, Lodash, Lucide)

**Component Display:**
- [ ] Agent shows component
- [ ] Component appears as overlay
- [ ] Triangle SVG renders correctly
- [ ] Input field is functional
- [ ] Button is clickable
- [ ] Styling looks correct (shadcn/ui theme)

**Student Interaction:**
- [ ] Type answer in input field
- [ ] Click "Check Answer" button
- [ ] Loading state appears
- [ ] Button disables during loading
- [ ] Attempts counter increments

**Agent Response:**
- [ ] Agent receives event (check logs)
- [ ] Agent responds with message
- [ ] Loading state clears
- [ ] Component remains interactive

**State Updates:**
- [ ] After 2 attempts, hint appears
- [ ] Hint displays correct formula
- [ ] After 4 attempts, steps appear
- [ ] Steps show correct calculations
- [ ] State updates don't cause circular loops

**Correct Answer:**
- [ ] Enter correct answer (2.5 for default values)
- [ ] Agent celebrates
- [ ] onSubmit fires
- [ ] Component can be hidden

**Error Handling:**
- [ ] Modify component to throw error
- [ ] Verify error boundary catches it
- [ ] Error UI displays
- [ ] "Try Again" button works
- [ ] "Dismiss" button works
- [ ] Other components unaffected

**Performance:**
- [ ] Component compiles < 500ms (check logs)
- [ ] State updates < 100ms
- [ ] No visible lag or jank
- [ ] Memory usage reasonable

**Multiple Cycles:**
- [ ] Hide component
- [ ] Show component again
- [ ] Verify fresh state
- [ ] Repeat interaction
- [ ] No memory leaks

#### Browser Testing

- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test on mobile (responsive)
- [ ] Check console for warnings/errors
- [ ] Verify no CSP violations

#### Edge Cases

- [ ] Show multiple components simultaneously
- [ ] Rapid state updates (test rate limiting)
- [ ] Very long input values
- [ ] Invalid input (non-numeric)
- [ ] Network error during component load
- [ ] Malformed component code
- [ ] Missing dependencies in scope

---

## Success Criteria

Phase 0 is complete when all of these are verified:

### Functional Requirements
- [x] Component loads from API endpoint
- [x] Babel compiles component successfully (< 500ms)
- [x] Import stripping works (no import errors)
- [x] Scope injection works (all dependencies available)
- [x] Component renders in browser with correct styling
- [x] Student can interact with component
- [x] Events flow from component to agent
- [x] Agent receives events with correct data
- [x] Agent can update component state
- [x] Component re-renders with new state
- [x] State synchronization prevents circular updates
- [x] Loading states work correctly
- [x] Error boundaries catch and isolate errors
- [x] Multiple show/hide cycles work
- [x] getState returns correct current state

### Performance Requirements
- [x] Component compilation < 500ms
- [x] State updates < 100ms
- [x] No memory leaks
- [x] Rate limiting prevents state thrashing

### Integration Requirements
- [x] Works with existing tool system
- [x] No breaking changes to existing experiences
- [x] Tool registration works correctly
- [x] CDN scripts load correctly

### Security Requirements
- [x] Components cannot access localStorage
- [x] Components cannot make fetch requests
- [x] Components cannot access dangerous globals
- [x] CSP allows Babel but mitigates risks

---

## Known Limitations (Acceptable for Phase 0)

These are intentionally deferred to Phase 1:

- ❌ No AI component generation (hand-written only)
- ❌ No Interface Designer agent
- ❌ No session data workflow
- ❌ No component preview during creation
- ❌ No meta-experience integration
- ❌ Only one test component (trig-triangle)

---

## Troubleshooting Guide

### Issue: Component doesn't load

**Check:**
- [ ] File exists at `storage/component-demo/resources/components/trig-triangle.jsx`
- [ ] API endpoint returns 200 (check Network tab)
- [ ] experience.json has component in resources.components
- [ ] componentId matches in tool call and file name

### Issue: Compilation fails

**Check:**
- [ ] Babel standalone loaded (check window.Babel)
- [ ] babel-plugin-transform-remove-imports installed
- [ ] Component has valid JSX syntax
- [ ] No syntax errors in console

### Issue: Component renders but imports fail

**Check:**
- [ ] Import stripping plugin is active
- [ ] Scope includes all imported components
- [ ] shadcn/ui components imported at top of ComponentManager
- [ ] No typos in component names

### Issue: Events don't reach agent

**Check:**
- [ ] onEvent callback is passed to component
- [ ] context.onComponentEvent is defined
- [ ] Event data is serializable (no functions)
- [ ] Agent is listening for events

### Issue: State updates cause loops

**Check:**
- [ ] External key tracking is implemented
- [ ] setTimeout clears tracking
- [ ] previousState ref is updated
- [ ] Only internal changes trigger onStateChange

### Issue: Styling doesn't work

**Check:**
- [ ] Tailwind CSS is loaded
- [ ] shadcn/ui components are correctly imported
- [ ] className props are passed through
- [ ] No CSS conflicts with existing styles

---

## Next Steps After Phase 0

Once Phase 0 is validated:

1. **Document Learnings**: What worked? What needs adjustment?
2. **Update Phase 1 Spec**: Incorporate any changes needed
3. **Begin Phase 1**: Add Interface Designer agent
4. **Test AI Generation**: Validate AI can generate working components
5. **Integrate Session Data**: Complete creation → deployment workflow

---

## Files Created in Phase 0

### Core Runtime System
- `src/app/lib/tools/ui/components/ComponentManager.tsx`
- `src/app/lib/tools/ui/components/types.ts`
- `src/app/lib/tools/ui/custom-component.ts`
- `src/app/components/CustomComponents.tsx`
- `src/app/api/experiences/[experienceId]/components/[componentId]/route.ts`

### Demo Experience
- `storage/component-demo/experience.json`
- `storage/component-demo/resources/components/trig-triangle.jsx`
- `storage/component-demo/resources/instructions/agent/demo-agent.md`

### Updates to Existing Files
- `src/app/lib/tools/ui/index.ts` (add registerCustomComponentTools)
- `src/app/lib/tools/groups.ts` (add custom-component group)
- `src/app/lib/tools/types.ts` (add ToolContext methods)
- `src/app/play/[id]/page.tsx` (add CustomComponents, CDN scripts)
- `next.config.ts` (update CSP)
- `package.json` (add dependencies)

---

**Document Purpose**: Complete specification for Phase 0 runtime validation  
**Audience**: Development team  
**Status**: Ready for implementation  
**Date**: January 5, 2025  
**Duration**: 1-2 weeks

