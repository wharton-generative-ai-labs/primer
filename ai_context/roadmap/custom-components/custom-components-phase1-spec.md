# Custom React Components - Phase 1 Technical Specification

## Overview

This document provides detailed technical specifications for Phase 1 (MVP) implementation of the custom React component system. Use this as a checklist for development.

## Goals

- Prove the concept works end-to-end
- Minimal but functional implementation
- Foundation for Phase 2 enhancements

## Timeline

**Estimated**: 2-3 weeks

## Components to Build

### 1. CustomComponentManager

**File**: `src/app/lib/tools/ui/components/ComponentManager.tsx`

**Responsibilities**:
- Load component JSX from experience resources
- Compile JSX to executable React components using Babel
- Manage component instances (show/hide)
- Provide controlled scope for component execution
- Notify listeners of state changes

**Key Methods**:
```typescript
class CustomComponentManager {
  // Load and compile a component from storage
  async loadComponent(experienceId: string, componentId: string): Promise<void>
  
  // Compile JSX to React component
  compileComponent(jsxCode: string, componentId: string): CompiledComponent
  
  // Build execution scope with libraries and Primer integration
  buildScope(): ComponentScope
  
  // Show a component instance
  showComponent(componentId: string, props: PrimerComponentProps): string
  
  // Hide a component instance
  hideComponent(instanceId: string): void
  
  // List available components
  listComponents(): ComponentInfo[]
  
  // List active instances
  listActiveInstances(): string[]
  
  // Check if component is loaded
  isLoaded(componentId: string): boolean
}
```

**Dependencies**:
- `@babel/standalone` (add to package.json)
- React (already available)
- Primer's existing logger

**Error Handling**:
- Wrap compilation in try/catch
- Log compilation errors
- Return meaningful error messages
- Don't crash on bad component code

### 2. Component Display Component

**File**: `src/app/components/CustomComponents.tsx`

**Responsibilities**:
- Render active component instances
- Integrate with PlayPage layout
- Handle component errors with Error Boundary

**Implementation**:
```typescript
export default function CustomComponents() {
  const instances = getActiveComponentInstances();
  
  if (!instances || instances.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 z-custom-component pointer-events-none">
      <ErrorBoundary fallback={<ComponentError />}>
        <div className="pointer-events-auto">
          {instances.map((instance, index) => (
            <React.Fragment key={`component-${index}`}>
              {instance}
            </React.Fragment>
          ))}
        </div>
      </ErrorBoundary>
    </div>
  );
}
```

**Integration Point**:
- Add to `src/app/components/PlayPage/PlayPageContent.tsx`
- Render alongside Scene, Slides, MermaidViewer, etc.

### 3. Custom Component Tool

**File**: `src/app/lib/tools/ui/custom-component.ts`

**Tool Definition**:
```typescript
export async function customComponent(
  args: {
    action: 'show' | 'hide' | 'list' | 'listActive';
    componentId?: string;
    instanceId?: string;
    props?: Record<string, any>;
  },
  context: ToolContext
): Promise<ToolResponse>
```

**Actions**:
- `show`: Load (if needed) and display a component
- `hide`: Remove a component instance
- `list`: List available components in experience
- `listActive`: List currently displayed instances

**Tool Registration**:
- Add to `src/app/lib/tools/ui/index.ts`
- Create `registerCustomComponentTools()` function
- Register in tool groups as `custom-component`

### 4. Interface Designer Agent

**File**: `storage/intake-agent/resources/instructions/agent/interface-designer.md`

**Agent Configuration** (in `storage/intake-agent/experience.json`):
```json
{
  "agents": {
    "interface-designer": {
      "name": "Interface Designer",
      "publicDescription": "An AI that creates custom React components for interactive educational experiences",
      "type": "backend",
      "temperature": 0.7,
      "downstreamAgents": [],
      "aiConfiguration": "instruction-follow",
      "toolGroups": ["builtin", "experience"]
    }
  }
}
```

**Prompt Content** (see full plan for complete prompt):
- Role and responsibilities
- Available libraries
- Component requirements
- Data contract pattern
- Validation process
- When NOT to create components
- Example component

### 5. Experience Builder Updates

**File**: `storage/intake-agent/resources/instructions/agent/experience-builder.md`

**New Sections to Add**:

```markdown
## Handling Custom Components

When the design includes custom components:

1. **Component Deployment**
   - Use deployArtifact to copy component files to resources/components/
   - Ensure .jsx extension
   - Use kebab-case naming (e.g., orbital-simulator.jsx)

2. **Configuration Update**
   - Add component entries to experience.json resources.components array
   - Include all metadata: id, name, file, type, libraries, validated, validatedAt, validator
   - Include data contract if specified

3. **Agent Instructions**
   - Update relevant agent prompts to mention custom components
   - Provide instructions on using customComponent tool
   - Include component IDs and when to use them

Example configuration:
[include example from plan]
```

### 6. Type Definitions

**File**: `src/app/lib/tools/ui/components/types.ts`

```typescript
export interface PrimerComponentProps {
  initialData?: Record<string, any>;
  onSubmit?: (data: Record<string, any>) => void;
  onProgress?: (progress: number) => void;
  onEvent?: (eventType: string, data: any) => void;
  experienceId: string;
  sessionId: string;
  agentKey?: string;
}

export interface ComponentInfo {
  id: string;
  name: string;
  file: string;
  type: string;
  libraries: string[];
  validated: boolean;
  validatedAt?: string;
  validator?: string;
  metadata?: {
    description?: string;
    dataContract?: {
      inputs?: string[];
      outputs?: string[];
    };
  };
}

export interface CompiledComponent {
  id: string;
  Component: React.ComponentType<PrimerComponentProps>;
  metadata: ComponentInfo;
}

export interface ComponentScope {
  // React
  React: typeof React;
  useState: typeof React.useState;
  useEffect: typeof React.useEffect;
  useReducer: typeof React.useReducer;
  useMemo: typeof React.useMemo;
  useCallback: typeof React.useCallback;
  
  // Libraries (add as needed)
  THREE?: any;
  Recharts?: any;
  d3?: any;
  
  // Primer integration
  usePrimerContext: () => PrimerContextValue;
  
  // Blocked for security
  fetch: undefined;
  XMLHttpRequest: undefined;
  localStorage: undefined;
  sessionStorage: undefined;
}

export interface PrimerContextValue {
  experienceId: string;
  sessionId: string;
  initialData?: Record<string, any>;
  submit: (data: Record<string, any>) => void;
  trackEvent: (eventType: string, data: any) => void;
  showSlide?: (title: string, content: string) => void;
  playSound?: (soundId: string) => void;
}
```

### 7. Schema Extension

**File**: `src/app/lib/types.ts`

Add to `ExperienceConfig` interface:

```typescript
export interface ExperienceConfig {
  // ... existing fields ...
  resources: {
    scenes: Resource[];
    sounds: Resource[];
    artifacts?: ArtifactConfig[];
    components?: ComponentConfig[];  // NEW
    instructions: {
      agent: Record<string, Resource>;
      supplemental: Record<string, Resource>;
    };
  };
  // ... rest of interface ...
}

export interface ComponentConfig {
  id: string;
  name: string;
  file: string;
  type: 'interactive-component';
  libraries: string[];
  validated: boolean;
  validatedAt?: string;
  validator?: string;
  metadata?: {
    description?: string;
    dataContract?: {
      inputs?: string[];
      outputs?: string[];
    };
  };
}
```

## Dependencies to Add

**package.json**:
```json
{
  "dependencies": {
    "@babel/standalone": "^7.23.0"
  }
}
```

**CDN Scripts** (add to experience loader or app layout):
```html
<!-- Load in document head or before component execution -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/recharts/2.5.0/Recharts.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.11.0/math.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>
```

**Note**: Only load these when experience has custom components (lazy loading).

## Configuration Updates

### CSP Headers

**File**: `next.config.ts`

Update Content Security Policy:
```typescript
const csp = `
  script-src 'self' 'unsafe-eval' https://cdnjs.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self';
  default-src 'self';
`;
```

**Note**: `'unsafe-eval'` required for Babel's `new Function()`. Mitigated by validation layers.

### Tool Groups

**File**: `src/app/lib/tools/groups.ts`

Add new tool group:
```typescript
export const TOOL_GROUPS: Record<string, string[]> = {
  // ... existing groups ...
  'custom-component': ['customComponent'],
};
```

## Example Component for Testing

**File**: `test-components/simple-counter.jsx`

```jsx
import React, { useState } from 'react';

export default function SimpleCounter({ 
  initialData, 
  onSubmit, 
  onEvent 
}) {
  const [count, setCount] = useState(initialData?.startCount || 0);
  
  const handleIncrement = () => {
    const newCount = count + 1;
    setCount(newCount);
    onEvent?.('count-changed', { count: newCount });
  };
  
  const handleComplete = () => {
    onSubmit?.({ finalCount: count });
  };
  
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <div className="bg-white rounded-lg p-8 shadow-2xl">
        <h2 className="text-2xl font-bold mb-4">Counter Test</h2>
        <p className="text-4xl font-mono mb-4">{count}</p>
        <div className="flex gap-4">
          <button 
            onClick={handleIncrement}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Increment
          </button>
          <button 
            onClick={handleComplete}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Testing Checklist

### Unit Tests

- [ ] CustomComponentManager.compileComponent() with valid JSX
- [ ] CustomComponentManager.compileComponent() with invalid JSX
- [ ] CustomComponentManager.buildScope() includes all required libraries
- [ ] CustomComponentManager.showComponent() creates instance
- [ ] CustomComponentManager.hideComponent() removes instance
- [ ] Tool execution (show, hide, list actions)

### Integration Tests

- [ ] Load component from experience resources
- [ ] Compile and display component
- [ ] Component receives correct props
- [ ] usePrimerContext hook works
- [ ] Component can call onSubmit
- [ ] Component can call onEvent
- [ ] Multiple components can be shown simultaneously
- [ ] Error boundary catches component errors

### E2E Tests

- [ ] Intake Agent delegates to Interface Designer
- [ ] Interface Designer creates component artifact
- [ ] Educator approves component
- [ ] Experience Builder deploys component
- [ ] Component appears in experience.json
- [ ] Component file exists in resources/components/
- [ ] Student can execute component
- [ ] Component interactions are tracked

### Manual Testing

- [ ] Create simple test component (counter)
- [ ] Deploy to test experience
- [ ] Load experience in play page
- [ ] Use customComponent tool to show component
- [ ] Interact with component
- [ ] Verify data submission works
- [ ] Verify event tracking works
- [ ] Test error handling (bad component code)
- [ ] Test multiple component instances

## Success Criteria

### Functional
- [ ] Components load and compile successfully
- [ ] Components render in play page
- [ ] Components can interact with Primer (submit data, track events)
- [ ] Multiple components can be shown simultaneously
- [ ] Components can be hidden
- [ ] Errors are handled gracefully

### Performance
- [ ] Component compilation < 500ms
- [ ] Component load time < 500ms
- [ ] No memory leaks from component instances
- [ ] No performance degradation with multiple components

### Security
- [ ] Components cannot access localStorage
- [ ] Components cannot make fetch requests
- [ ] Components cannot access dangerous globals
- [ ] Scope injection prevents code injection attacks

### Integration
- [ ] Works with existing tool system
- [ ] Works with existing agent workflow
- [ ] No breaking changes to existing experiences
- [ ] Backward compatible schema

## Known Limitations (MVP)

These are acceptable for Phase 1:

1. **No Sandpack**: Using Babel + new Function() (Phase 3 will add Sandpack)
2. **Limited Libraries**: Only core set (can expand in Phase 2)
3. **No Versioning**: Components are immutable once deployed (Phase 3)
4. **No Hot Reload**: Requires page refresh to update (Phase 3)
5. **Basic Validation**: AI validation only (Phase 2 adds enhanced validation)
6. **No Component Library**: Each experience has its own components (Phase 3)

## Documentation to Create

- [ ] Component development guide for Interface Designer
- [ ] Tool usage guide for agents
- [ ] Educator guide for reviewing components
- [ ] Developer guide for debugging components
- [ ] API documentation for usePrimerContext hook

## Rollout Plan

### Week 1: Core Infrastructure
- Day 1-2: CustomComponentManager implementation
- Day 3-4: Tool definition and registration
- Day 5: Display component and PlayPage integration

### Week 2: Agent Integration
- Day 1-2: Interface Designer agent prompt
- Day 3-4: Experience Builder updates
- Day 5: Integration testing

### Week 3: Testing & Polish
- Day 1-2: Unit and integration tests
- Day 3: E2E testing with full workflow
- Day 4: Documentation
- Day 5: Bug fixes and polish

## Next Steps After Phase 1

Once Phase 1 is complete and validated:

1. **Phase 2 Planning**: Enhanced validation, testing interface, analytics
2. **Gather Feedback**: Use with real educators, collect issues
3. **Performance Monitoring**: Track metrics, identify bottlenecks
4. **Library Requests**: Track which libraries educators need
5. **Security Review**: Audit for any security issues

## Questions to Resolve During Implementation

1. Should components be lazy-loaded or always loaded?
   - **Recommendation**: Lazy load only when experience has components

2. Should Babel be bundled or CDN-loaded?
   - **Recommendation**: Bundle with app (more reliable)

3. Should we cache compiled components?
   - **Recommendation**: Yes, in memory (clear on experience change)

4. How to handle component updates during development?
   - **Recommendation**: Require page refresh (hot reload in Phase 3)

5. Should we support TypeScript in components?
   - **Recommendation**: No for MVP (JSX only, add TS in Phase 2)

---

**Version**: 1.0  
**Date**: January 5, 2025  
**Status**: Ready for Implementation  
**Estimated Effort**: 2-3 weeks (1 developer)

