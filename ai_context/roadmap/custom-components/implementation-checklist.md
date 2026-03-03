# Phase 1 MVP - Implementation Checklist

Quick reference checklist for implementing custom components. See `phase1-mvp-spec.md` for full details.

**Timeline:** 4 weeks
- Week 1: Core runtime infrastructure
- Week 2: Integration & hand-written test components
- Week 3: Interface Designer agent
- Week 4: Testing, polish, documentation

## Week 1: Core Infrastructure

### Day 1-2: CustomComponentManager

**File**: `src/app/lib/tools/ui/components/ComponentManager.tsx`

- [ ] Create ComponentManager class
- [ ] Implement `loadComponent(experienceId, componentId)`
- [ ] Implement `compileComponent(jsxCode, componentId)` using Babel
- [ ] Implement `buildScope()` with React, shadcn/ui, MathJS, Recharts, Lodash
- [ ] Add state tracking: `componentStates: Map<string, Record<string, any>>`
- [ ] Implement `showComponent(componentId, props)` → returns instanceId
- [ ] Implement `updateComponentState(instanceId, stateUpdates)` with rate limiting
- [ ] Implement `getComponentState(instanceId)` → returns state
- [ ] Implement `hideComponent(instanceId)`
- [ ] Implement `listComponents()`
- [ ] Add state update notification system
- [ ] Add rate limiting (100ms throttle, max 10 updates/sec per component)
- [ ] Add performance monitoring for compilation
- [ ] Add error handling for compilation failures
- [ ] Log performance warnings when compilation > 300ms

**Dependencies**:
- [ ] Add `@babel/standalone` to package.json
- [ ] Add `babel-plugin-transform-remove-imports` to package.json
- [ ] Install: `npm install @babel/standalone babel-plugin-transform-remove-imports`

### Day 3: Tool Definition

**File**: `src/app/lib/tools/ui/custom-component.ts`

- [ ] Create `customComponent` tool function
- [ ] Implement `show` action
  - [ ] Load component if not loaded
  - [ ] Create instance with initialState
  - [ ] Set up onEvent callback
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

### Day 4: Tool Registration

**File**: `src/app/lib/tools/ui/index.ts`

- [ ] Create `registerCustomComponentTools()` function
- [ ] Register customComponent tool with ToolRegistry
- [ ] Add detailed description for agents
- [ ] Define all parameters (action, componentId, instanceId, initialState, stateUpdates)
- [ ] Export registration function

**File**: `src/app/lib/tools/groups.ts`

- [ ] Add `'custom-component': ['customComponent']` to TOOL_GROUPS

### Day 5: Display Component

**File**: `src/app/components/CustomComponents.tsx`

- [ ] Create CustomComponents display component
- [ ] Import getActiveComponentInstances from manager
- [ ] Add per-component ErrorBoundary wrappers (one per instance)
- [ ] Create ComponentError fallback UI with retry/dismiss
- [ ] Add error logging in onError callback
- [ ] Render active component instances
- [ ] Add proper z-index and positioning
- [ ] Implement handleRetry and handleDismiss functions

**File**: `src/app/components/PlayPage/PlayPageContent.tsx`

- [ ] Import CustomComponents
- [ ] Add `<CustomComponents />` to render tree (alongside Scene, Slides, etc.)

## Week 2: Integration & Example

### Day 1: Component API Endpoint

**File**: `src/app/api/experiences/[experienceId]/components/[componentId]/route.ts`

- [ ] Create API route for component loading
- [ ] Implement GET handler
- [ ] Read component file from storage/{experienceId}/resources/components/
- [ ] Read metadata from experience.json
- [ ] Return { code, metadata } as JSON
- [ ] Handle 404 for missing components
- [ ] Handle 500 for errors
- [ ] Add proper error logging

### Day 2: Type Definitions

**File**: `src/app/lib/tools/ui/components/types.ts`

- [ ] Define `PrimerComponentProps` interface
  - [ ] initialState?: Record<string, any>
  - [ ] externalState?: Record<string, any>
  - [ ] onStateChange?: (state) => void
  - [ ] onEvent?: (type, data) => void
  - [ ] onSubmit?: (data) => void
  - [ ] experienceId, sessionId, instanceId
- [ ] Define `ComponentInfo` interface
- [ ] Define `CompiledComponent` interface
- [ ] Define `ComponentScope` interface
- [ ] Define `ComponentEvent` interface
- [ ] Define `ComponentStateChangeEvent` interface

**File**: `src/app/lib/tools/types.ts`

- [ ] Add `ComponentConfig` interface
- [ ] Add `components?: ComponentConfig[]` to ExperienceConfig.resources
- [ ] Add `onComponentEvent?: (event: ComponentEvent) => void` to ToolContext
- [ ] Add `onComponentStateChange?: (event: ComponentStateChangeEvent) => void` to ToolContext

### Day 3: Scope Builder & Compilation

**File**: `src/app/lib/tools/ui/components/ComponentManager.tsx`

- [ ] Import all shadcn/ui components at top of file
- [ ] Import React and all hooks
- [ ] Implement buildScope() method
  - [ ] Add React and hooks to scope
  - [ ] Add all shadcn/ui components to scope
  - [ ] Add MathJS to scope (window.math)
  - [ ] Add Recharts to scope (window.Recharts)
  - [ ] Add Lodash to scope (window._)
  - [ ] Add Lucide icons to scope (window.LucideReact)
  - [ ] Block dangerous APIs (fetch, localStorage, eval, etc.)
- [ ] Update compileComponent() to use new strategy
  - [ ] Add babel-plugin-transform-remove-imports
  - [ ] Strip import statements during compilation
  - [ ] Inject scope via Function constructor
  - [ ] Extract scope keys and values
  - [ ] Pass scope values as function arguments

### Day 4: CDN Scripts

**File**: `src/app/play/[id]/page.tsx` or layout

- [ ] Add conditional CDN script loading
- [ ] Load MathJS from CDN
- [ ] Load Recharts from CDN
- [ ] Load Lodash from CDN
- [ ] Load Lucide from CDN
- [ ] Only load when experience has custom components

### Day 5: Example Component

**File**: `test-components/trig-triangle.jsx`

- [ ] Create TrigTriangle component
- [ ] Accept PrimerComponentProps
- [ ] Initialize state from initialState
- [ ] Listen for externalState updates
- [ ] Call onStateChange when state changes
- [ ] Add loading state (isWaitingForAgent)
- [ ] Show loading overlay during agent processing
- [ ] Clear loading state when externalState updates
- [ ] Render triangle SVG
- [ ] Show hint when state.showHint is true
- [ ] Show steps when state.showSteps is true
- [ ] Handle student input
- [ ] Call onEvent for answer checks
- [ ] Call onSubmit when complete
- [ ] Use shadcn/ui components (Card, Button, Input, etc.)
- [ ] Disable submit button during loading

## Week 3: Interface Designer Agent

### Day 1: Agent Configuration

**File**: `storage/intake-agent/experience.json` (or appropriate meta-experience)

- [ ] Add interface-designer agent configuration
  - [ ] name: "Interface Designer"
  - [ ] type: "backend"
  - [ ] aiConfiguration: "claude-agent"
  - [ ] toolGroups: ["builtin", "artifact"]
- [ ] Add to Design Agent's downstreamAgents

### Day 2: Agent Instructions

**File**: `storage/intake-agent/resources/instructions/agent/interface-designer.md`

- [ ] Create comprehensive Interface Designer prompt
- [ ] Document PrimerComponentProps interface requirements
- [ ] Document state synchronization pattern
- [ ] Document loading state pattern
- [ ] List all available libraries (React, shadcn/ui, MathJS, etc.)
- [ ] Provide component structure templates
- [ ] Define event types and patterns
- [ ] Add Do's and Don'ts section
- [ ] Include example component

### Day 3: Artifact Tool Enhancement

**File**: `src/app/lib/tools/builtin/artifact-tool.ts`

- [ ] Add 'jsx' to supported artifact types
- [ ] Handle .jsx file extension
- [ ] Set appropriate MIME type for JSX
- [ ] Test creating JSX artifacts in session_data

### Day 4: Design Agent Integration

**File**: `storage/intake-agent/resources/instructions/agent/design-agent.md`

- [ ] Update Design Agent prompt to know about Interface Designer
- [ ] Add guidance on when to delegate for component creation
- [ ] Document component specification format
- [ ] Add examples of delegation to Interface Designer

### Day 5: Test Component Generation

- [ ] Create test meta-experience session
- [ ] Design Agent creates component specification
- [ ] Design Agent delegates to Interface Designer
- [ ] Interface Designer generates component code
- [ ] Verify component stored in session_data
- [ ] Manually test generated component in target experience

## Week 4: Testing & Documentation

### Day 1: Test Experience & E2E Flow

**File**: `storage/test-components-experience/experience.json`

- [ ] Create test experience
- [ ] Add component to resources.components array
- [ ] Configure test agent with custom-component tool group
- [ ] Add trig-triangle.jsx to resources/components/

**File**: `storage/test-components-experience/resources/components/trig-triangle.jsx`

- [ ] Copy example component from spec

**Complete E2E Flow Test:**

- [ ] Start with meta-experience (intake-agent)
- [ ] Educator describes need for component
- [ ] Design Agent creates specification
- [ ] Design Agent delegates to Interface Designer
- [ ] Interface Designer generates component
- [ ] Component stored in session_data
- [ ] Experience Builder copies to target experience
- [ ] Target experience loads and runs
- [ ] Student interacts with component
- [ ] Agent receives events and updates component state
- [ ] Verify complete flow works end-to-end

### Day 2: Unit Tests

**File**: `src/app/lib/tools/ui/components/__tests__/ComponentManager.test.ts`

- [ ] Test compileComponent with valid JSX
- [ ] Test compileComponent with invalid JSX
- [ ] Test buildScope includes all required libraries
- [ ] Test showComponent creates instance
- [ ] Test updateComponentState updates state
- [ ] Test getComponentState returns state
- [ ] Test hideComponent removes instance
- [ ] Test multiple instances maintain separate states

**File**: `src/app/lib/tools/ui/__tests__/custom-component.test.ts`

- [ ] Test show action
- [ ] Test updateState action
- [ ] Test getState action
- [ ] Test hide action
- [ ] Test list action
- [ ] Test error handling

### Day 3: Integration Tests

**File**: `src/app/lib/tools/ui/components/__tests__/integration.test.tsx`

- [ ] Test full component lifecycle (load → show → interact → hide)
- [ ] Test state updates propagate to component
- [ ] Test component state changes notify manager
- [ ] Test component events reach tool context
- [ ] Test multiple components simultaneously
- [ ] Test error boundary catches component errors

### Day 4: E2E Testing

**Manual Testing Checklist**:
- [ ] Load test experience in play page
- [ ] Agent shows trig triangle component
- [ ] Verify component renders with shadcn/ui styling
- [ ] Student enters answer
- [ ] Verify onEvent fires
- [ ] Agent updates state to show hint
- [ ] Verify hint appears in component
- [ ] Agent updates state to show steps
- [ ] Verify steps appear in component
- [ ] Student enters correct answer
- [ ] Verify onSubmit fires
- [ ] Agent hides component
- [ ] Verify component disappears

### Day 5: Agent Prompt Updates & Documentation

**File**: Agent instruction files (e.g., mentor agents)

- [ ] Add section on custom components
- [ ] Explain when to use components
- [ ] Provide examples of show action
- [ ] Provide examples of updateState action
- [ ] Provide examples of getState action
- [ ] Explain best practices
- [ ] Add example interaction flow

- [ ] Update tool documentation
- [ ] Document component development guide (already in spec)
- [ ] Document available libraries (already in spec)
- [ ] Document component interface requirements (already in spec)
- [ ] Document loading state pattern (already in spec)
- [ ] Document performance targets (already in spec)
- [ ] Add troubleshooting guide
- [ ] Create example scenarios
- [ ] Update architecture documentation

## Configuration Updates

### CSP Headers

**File**: `next.config.ts`

- [ ] Update CSP to allow `'unsafe-eval'` for Babel
- [ ] Update CSP to allow cdnjs.cloudflare.com scripts
- [ ] Document why unsafe-eval is needed and how it's mitigated

### Package.json

- [ ] Add `@babel/standalone: ^7.23.0`
- [ ] Run `npm install`
- [ ] Verify no dependency conflicts

## Verification Checklist

### Functional Requirements
- [ ] ✅ Components load and compile successfully
- [ ] ✅ Components render with shadcn/ui styling
- [ ] ✅ Agent can show component with initial state
- [ ] ✅ Agent can update component state
- [ ] ✅ Agent can read component state
- [ ] ✅ Agent can hide component
- [ ] ✅ Students can interact with components
- [ ] ✅ Component events reach agents
- [ ] ✅ Multiple instances work correctly
- [ ] ✅ Error boundaries catch component errors

### Performance Requirements
- [ ] ✅ Component compilation < 500ms
- [ ] ✅ State updates < 50ms
- [ ] ✅ No memory leaks from component instances
- [ ] ✅ No performance degradation with multiple components

### Integration Requirements
- [ ] ✅ Works with existing tool system
- [ ] ✅ No breaking changes to existing experiences
- [ ] ✅ Agents can use alongside other tools (slides, sounds, etc.)
- [ ] ✅ Tool registration works correctly
- [ ] ✅ Tool groups assignment works

### Security Requirements
- [ ] ✅ Components cannot access localStorage
- [ ] ✅ Components cannot make fetch requests
- [ ] ✅ Components cannot access dangerous globals
- [ ] ✅ Scope injection prevents code injection
- [ ] ✅ Error boundaries prevent crashes

## Common Issues & Solutions

### Issue: Babel compilation fails
**Solution**: Check JSX syntax, ensure all imports are in scope

### Issue: shadcn/ui components not rendering
**Solution**: Verify components are imported in buildScope(), check Tailwind CSS is loaded

### Issue: State updates not propagating
**Solution**: Check externalState useEffect dependency, verify manager.updateComponentState() is called

### Issue: Component events not reaching agent
**Solution**: Verify onEvent callback is passed to component, check event forwarding in tool

### Issue: Multiple instances interfere
**Solution**: Ensure each instance has unique instanceId, verify state map uses instanceId as key

## Success Criteria

When all items are checked:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E manual testing successful
- [ ] Documentation complete
- [ ] Example component works end-to-end
- [ ] Agent can control component state
- [ ] Performance targets met
- [ ] Security requirements met

## Phase 1 Complete! 🎉

Next steps:
1. Gather feedback from real usage
2. Create more example components
3. Plan Phase 2 (Interface Designer agent)

---

**Estimated Effort**: 2-3 weeks (1 developer)  
**Last Updated**: January 5, 2025  
**Status**: Ready for Implementation

