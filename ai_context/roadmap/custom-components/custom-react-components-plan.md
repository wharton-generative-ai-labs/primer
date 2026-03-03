# Custom React Component System - Implementation Plan

## Executive Summary

This document outlines a plan to extend Primer's UI capabilities by allowing AI agents to generate and execute custom React components during experience creation. This enables experiences to include interactive visualizations, simulations, and custom UI elements beyond the current fixed set of tools (slides, notes, scenes, etc.).

## Current System Analysis

### How Experiences Work Today

1. **Experience Structure**: Self-contained folders with `experience.json` + resources
2. **Agent Workflow**: Intake → Design → Casting Director → Image Gen → Experience Builder
3. **UI Tools**: Fixed set (slides, notes, scenes, diagrams, checklists) via tool system
4. **Artifacts**: Session-scoped content stored in `session_data/{sessionId}/artifacts/`
5. **Templates**: Reusable experience structures (Roleplay, Teachback) discovered dynamically

### Current UI Component Pattern (Slides Example)

The slide system demonstrates the existing pattern for dynamic UI:

1. **Tool Definition**: `slide` tool with actions (show, hide, list, etc.)
2. **Manager Singleton**: `SlideManager` maintains state and creates React components
3. **Component Registration**: Components stored in memory, rendered via manager
4. **Display Layer**: `<Slides />` component in PlayPage renders active slides
5. **State Management**: Listeners notify components of state changes

**Key Insight**: Slides are created dynamically by AI but use a **fixed component template** (`SlideComponent`). We need to extend this to allow **custom component code**.

## Proposed Architecture

### Overview

Add a new "Interface Designer" agent that can generate custom React components when standard UI tools are insufficient. Components are:
- Generated as JSX code during experience design
- Stored as files in the experience's resources
- Executed safely using a runtime transpiler
- Provided with a standard scope for Primer integration

### When to Use Custom Components

**Use Standard Tools When:**
- Displaying text/markdown (slides)
- Showing images (scenes)
- Playing audio (sounds)
- Simple data visualization (existing tools)

**Use Custom Components When:**
- Complex interactive simulations (e.g., physics, chemistry)
- Custom data visualizations beyond charts
- Interactive exercises with custom logic
- Domain-specific UI (e.g., music notation, circuit diagrams)
- Game-like interactions

### Component Execution Strategy

After evaluating options from the original conversation document, here's the recommended approach:

#### Option: Sandpack (Recommended for Production)

**Why Sandpack:**
1. **True Sandboxing**: iframe isolation with CSP enforcement
2. **Battle-Tested**: Used by CodeSandbox, proven security model
3. **NPM Support**: Can install packages dynamically if needed later
4. **Hot Reloading**: Good developer experience during testing
5. **Educational Context**: Already designed for code execution environments

**Trade-offs:**
- Heavier bundle (~300KB+) but acceptable for educational platform
- More complex setup but better long-term maintainability
- Overkill for simple components but provides growth path

**Alternative for MVP**: Custom Babel Standalone + new Function()
- Lighter weight (~800KB Babel)
- Faster to implement
- Adequate given AI validation + human approval
- Can migrate to Sandpack later if needed

**Recommendation**: Start with **Babel Standalone** for MVP (faster iteration), plan migration to **Sandpack** for production release.

### Storage Structure

Extend the experience format to include custom components:

```
storage/{experienceId}/
├── experience.json              # References custom components
├── resources/
│   ├── scenes/
│   ├── sounds/
│   ├── instructions/
│   └── components/              # NEW: Custom React components
│       ├── orbital-simulator.jsx
│       ├── molecule-builder.jsx
│       └── pitch-practice.jsx
```

### experience.json Schema Extension

Add new `components` section to resources:

```json
{
  "version": "1.0.0",
  "resources": {
    "scenes": [...],
    "sounds": [...],
    "components": [
      {
        "id": "orbital-simulator",
        "name": "Orbital Mechanics Simulator",
        "file": "resources/components/orbital-simulator.jsx",
        "type": "interactive-component",
        "libraries": ["react", "three", "mathjs"],
        "validated": true,
        "validatedAt": "2025-01-05T10:30:00Z",
        "validator": "claude-sonnet-4.5",
        "metadata": {
          "description": "Interactive 3D simulation of planetary orbits",
          "dataContract": {
            "inputs": ["planetData", "simulationSpeed"],
            "outputs": ["userInteractions", "completionStatus"]
          }
        }
      }
    ],
    "instructions": {...}
  }
}
```

### Data Contract Pattern

Components must follow a standard interface for Primer integration:

```typescript
// Standard props provided to all custom components
interface PrimerComponentProps {
  // Data from experience configuration
  initialData?: Record<string, any>;
  
  // Callbacks for Primer integration
  onSubmit?: (data: Record<string, any>) => void;
  onProgress?: (progress: number) => void;
  onEvent?: (eventType: string, data: any) => void;
  
  // Context information
  experienceId: string;
  sessionId: string;
  agentKey: string;
}

// Custom hook provided in scope
const usePrimerContext = () => ({
  initialData: /* from config */,
  submit: (data) => /* save to backend */,
  trackEvent: (event, data) => /* analytics */,
  showSlide: (title, content) => /* integrate with existing tools */,
  playSound: (soundId) => /* integrate with existing tools */
});
```

### Component Execution Implementation

#### 1. Component Manager (Similar to SlideManager)

```typescript
// src/app/lib/tools/ui/components/ComponentManager.tsx
class CustomComponentManager {
  private components: Map<string, CompiledComponent> = new Map();
  private activeInstances: Map<string, React.ReactNode> = new Map();
  
  async loadComponent(experienceId: string, componentId: string): Promise<void> {
    // Fetch component code from experience resources
    const code = await fetchComponentCode(experienceId, componentId);
    
    // Compile with Babel Standalone
    const compiled = this.compileComponent(code);
    
    // Store compiled component
    this.components.set(componentId, compiled);
  }
  
  compileComponent(jsxCode: string): CompiledComponent {
    // Transform JSX to JS using Babel
    const transformed = Babel.transform(jsxCode, {
      presets: ['react'],
      plugins: []
    }).code;
    
    // Create component factory with controlled scope
    const scope = this.buildScope();
    const scopeKeys = Object.keys(scope);
    const scopeValues = Object.values(scope);
    
    const componentFactory = new Function(
      ...scopeKeys,
      `${transformed}; return Component;`
    );
    
    return componentFactory(...scopeValues);
  }
  
  buildScope() {
    return {
      React,
      useState,
      useEffect,
      useReducer,
      useMemo,
      useCallback,
      // Pre-loaded libraries (matching Claude Artifacts)
      THREE: window.THREE,
      Recharts: window.Recharts,
      d3: window.d3,
      // ... other approved libraries
      
      // Custom Primer hook
      usePrimerContext: this.createPrimerContextHook(),
      
      // Prevent dangerous operations
      fetch: undefined,
      XMLHttpRequest: undefined,
      localStorage: undefined,
      sessionStorage: undefined
    };
  }
  
  showComponent(componentId: string, props: PrimerComponentProps): string {
    const Component = this.components.get(componentId);
    if (!Component) throw new Error(`Component ${componentId} not loaded`);
    
    const instanceId = `component-${generateUUID()}`;
    const instance = <Component {...props} />;
    
    this.activeInstances.set(instanceId, instance);
    this.notifyStateUpdate();
    
    return instanceId;
  }
  
  hideComponent(instanceId: string): void {
    this.activeInstances.delete(instanceId);
    this.notifyStateUpdate();
  }
}
```

#### 2. Display Component

```typescript
// src/app/components/CustomComponents.tsx
export default function CustomComponents() {
  const instances = getActiveComponentInstances();
  
  if (!instances || instances.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 z-custom-component pointer-events-none">
      <div className="pointer-events-auto">
        {instances.map((instance, index) => (
          <React.Fragment key={`component-${index}`}>
            {instance}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
```

#### 3. Tool Definition

```typescript
// src/app/lib/tools/ui/custom-component.ts
export async function customComponent(
  args: {
    action: 'show' | 'hide' | 'list';
    componentId?: string;
    instanceId?: string;
    props?: Record<string, any>;
  },
  context: ToolContext
): Promise<ToolResponse> {
  const manager = getCustomComponentManager();
  
  switch (args.action) {
    case 'show':
      // Load component if not already loaded
      if (!manager.isLoaded(args.componentId)) {
        await manager.loadComponent(context.experienceId, args.componentId);
      }
      
      // Show component with provided props
      const instanceId = manager.showComponent(args.componentId, {
        ...args.props,
        experienceId: context.experienceId,
        sessionId: context.sessionId
      });
      
      return { status: 'success', data: { instanceId } };
      
    case 'hide':
      manager.hideComponent(args.instanceId);
      return { status: 'success' };
      
    case 'list':
      const components = manager.listComponents();
      return { status: 'success', data: { components } };
  }
}
```

### Library Management

#### Pre-loaded Libraries (CDN)

Match Claude Artifacts available libraries:

```html
<!-- In app layout or experience loader -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/recharts/2.5.0/Recharts.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.11.0/math.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>
<!-- Add others as needed -->
```

**Library Constraints:**
- Only CDN-loaded libraries (no npm installs)
- Version-locked for consistency
- Documented in component metadata
- Validated during component creation

### Security & Validation

#### Multi-Layer Validation

**Layer 1: AI Static Analysis**
When Interface Designer creates a component, it's immediately validated by Claude:

```typescript
const validationPrompt = `
Analyze this React component for educational use:

${generatedJSX}

Validation checklist:
1. Security:
   - No network requests (fetch, axios, XHR)
   - No localStorage/sessionStorage
   - No eval() or Function() calls
   - No dangerous DOM manipulation
   
2. Libraries:
   - Only uses approved libraries: ${approvedLibraries.join(', ')}
   - No external script loading
   
3. Performance:
   - No infinite loops
   - Reasonable computational complexity
   - Proper cleanup in useEffect
   
4. Data Contract:
   - Uses usePrimerContext hook correctly
   - Provides required outputs
   - Handles inputs properly
   
5. Educational Appropriateness:
   - Age-appropriate for grade ${gradeLevel}
   - Clear learning objectives
   - Accessible UI

Return JSON:
{
  "safe": boolean,
  "issues": string[],
  "suggestions": string[],
  "approved": boolean
}
`;
```

**Layer 2: Human Review**
Educator approves component during design review (same as current workflow)

**Layer 3: Runtime Sandboxing**
- Controlled scope (no dangerous globals)
- CSP headers prevent external resources
- Error boundaries catch runtime issues

**Layer 4: Monitoring**
- Log component execution errors
- Track performance metrics
- Alert on suspicious behavior

#### Content Security Policy

Update CSP to allow component execution:

```typescript
// next.config.ts - Update CSP
const csp = `
  script-src 'self' 'unsafe-eval' https://cdnjs.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self';
  default-src 'self';
`;
```

Note: `'unsafe-eval'` required for Babel/Sandpack but mitigated by:
- Only executing AI-generated + human-approved code
- No user-supplied code execution
- Controlled scope injection

## Agent Workflow Integration

### Updated Experience Creation Flow

```
1. Intake Agent → interviews educator
   ↓
2. Intake Agent → determines if custom UI needed
   ↓ (if yes)
3. Intake Agent → delegates to Interface Designer
   ↓
4. Interface Designer → generates custom component(s)
   ↓
5. Interface Designer → validates components (AI)
   ↓
6. Interface Designer → returns to Intake Agent
   ↓
7. Intake Agent → shows components to educator for approval
   ↓ (if approved)
8. [Continue existing flow: Design Agent → Casting Director → etc.]
   ↓
9. Experience Builder → includes component references in experience.json
   ↓
10. Experience Builder → deploys component files to resources/components/
```

### Interface Designer Agent

**New Agent Configuration:**

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

**Agent Prompt Structure:**

```markdown
# Interface Designer Agent

## Role
You create custom React components for educational experiences when standard UI tools (slides, notes, scenes) are insufficient.

## Available Libraries
- React (hooks: useState, useEffect, useReducer, useMemo, useCallback)
- Tailwind CSS (utility classes)
- Lucide React (icons)
- Recharts (charts)
- D3.js (data visualization)
- Three.js r128 (3D graphics)
- MathJS (mathematics)
- Tone.js (audio synthesis)

## Component Requirements

### 1. Standard Interface
All components must:
- Export a default component
- Accept PrimerComponentProps
- Use usePrimerContext() hook for Primer integration
- Be self-contained (no external dependencies)

### 2. Data Contract
Define clear inputs and outputs:
- initialData: What data does the component need?
- outputs: What data does it produce?
- events: What interactions should be tracked?

### 3. Educational Focus
- Clear learning objectives
- Appropriate for target grade level
- Accessible and inclusive design
- Helpful feedback and guidance

## Example Component

```jsx
import React, { useState, useEffect } from 'react';

export default function OrbitalSimulator({ 
  initialData, 
  onSubmit, 
  onProgress,
  onEvent 
}) {
  const [planets, setPlanets] = useState(initialData?.planets || []);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  
  useEffect(() => {
    // Simulation logic
    const interval = setInterval(() => {
      // Update planet positions
      onEvent?.('simulation-step', { speed: simulationSpeed });
    }, 16);
    
    return () => clearInterval(interval);
  }, [simulationSpeed]);
  
  const handleComplete = () => {
    onSubmit?.({
      completedSteps: 5,
      finalPositions: planets
    });
  };
  
  return (
    <div className="w-full h-full bg-black">
      {/* 3D canvas or visualization */}
    </div>
  );
}
```

## Validation Process
After creating a component:
1. Use artifact tool to create component code
2. Use artifact tool to create validation report
3. Return to Intake Agent for educator approval

## When NOT to Create Components
- Simple text/markdown → use slides
- Static images → use scenes
- Basic charts → use existing tools
- Audio playback → use sounds

Only create custom components for truly interactive, complex UI needs.
```

### Experience Builder Integration

Update Experience Builder to handle custom components:

```markdown
## New Responsibilities

When building experiences with custom components:

1. **Component Deployment**
   - Use deployArtifact to copy component files to resources/components/
   - Ensure proper file naming (kebab-case, .jsx extension)

2. **Configuration Update**
   - Add component entries to experience.json resources.components array
   - Include all required metadata (libraries, validation status, data contract)

3. **Agent Instructions**
   - Update agent prompts to reference custom components
   - Provide instructions on when/how to use customComponent tool

Example:
```json
{
  "resources": {
    "components": [
      {
        "id": "orbital-simulator",
        "name": "Orbital Mechanics Simulator",
        "file": "resources/components/orbital-simulator.jsx",
        "type": "interactive-component",
        "libraries": ["react", "three", "mathjs"],
        "validated": true,
        "validatedAt": "2025-01-05T10:30:00Z",
        "validator": "claude-sonnet-4.5"
      }
    ]
  }
}
```
```

## Template Extensions

### New Template Type: Interactive Simulation

For experiences that heavily rely on custom components:

```json
{
  "kind": "template",
  "title": "Interactive Simulation Template",
  "description": "Template for experiences with custom interactive components",
  "agents": {
    "mentor": {
      "name": "Mentor",
      "toolGroups": ["builtin", "slide", "sound", "custom-component"]
    },
    "practice": {
      "name": "Practice Guide",
      "toolGroups": ["builtin", "custom-component"]
    }
  }
}
```

### Updating Existing Templates

Add `custom-component` tool group to agents that might use it:

```json
{
  "agents": {
    "mentor": {
      "toolGroups": ["builtin", "slide", "sound", "custom-component"]
    }
  }
}
```

## Implementation Phases

### Phase 1: MVP (Core Functionality)
**Goal**: Prove the concept with minimal features

**Tasks:**
1. Create CustomComponentManager with Babel Standalone
2. Implement basic component loading and execution
3. Add customComponent tool with show/hide actions
4. Create CustomComponents display component
5. Add Interface Designer agent to intake-agent experience
6. Update Experience Builder to handle component deployment
7. Create one example component (simple interactive viz)

**Deliverables:**
- Working component execution system
- Interface Designer can create simple components
- Components can be included in experiences
- Basic validation (AI only)

**Timeline**: 2-3 weeks

### Phase 2: Enhanced Validation & Integration
**Goal**: Production-ready security and workflow integration

**Tasks:**
1. Implement comprehensive AI validation
2. Add runtime error boundaries
3. Create component testing interface for educators
4. Enhance data contract system
5. Add component analytics tracking
6. Create component library documentation
7. Update all templates with custom-component tool group

**Deliverables:**
- Robust validation pipeline
- Educator preview/testing tools
- Analytics integration
- Documentation

**Timeline**: 2-3 weeks

### Phase 3: Advanced Features
**Goal**: Expand capabilities and improve DX

**Tasks:**
1. Migrate to Sandpack for better sandboxing
2. Add component versioning
3. Create component marketplace/library
4. Add hot reloading for development
5. Implement component composition (components using components)
6. Add more pre-loaded libraries based on educator needs
7. Create visual component builder (optional)

**Deliverables:**
- Sandpack integration
- Component versioning system
- Reusable component library
- Enhanced developer experience

**Timeline**: 3-4 weeks

## Technical Considerations

### Performance

**Bundle Size:**
- Babel Standalone: ~800KB (MVP)
- Sandpack: ~300KB (Phase 3)
- Pre-loaded libraries: ~2-3MB total (cached)

**Optimization Strategies:**
- Lazy load Babel/Sandpack only when custom components present
- Cache compiled components in memory
- Pre-compile components after validation (store compiled version)
- Use service workers for offline component caching

### Browser Compatibility

**Requirements:**
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ support
- No IE11 support needed

**Fallbacks:**
- Detect component support on load
- Show message if browser incompatible
- Gracefully degrade to standard tools

### Error Handling

**Component Errors:**
- Wrap in React Error Boundary
- Show friendly error message to student
- Log error details for debugging
- Provide fallback UI

**Compilation Errors:**
- Catch during validation phase
- Prevent deployment of broken components
- Show clear error messages to educator

### Testing Strategy

**Unit Tests:**
- ComponentManager methods
- Scope building
- Component compilation
- Tool execution

**Integration Tests:**
- Full component lifecycle (load → show → interact → hide)
- Data contract validation
- Error handling

**E2E Tests:**
- Complete workflow (Interface Designer → Experience Builder → Student View)
- Multiple components in one experience
- Component interaction with other tools

## Migration Path

### For Existing Experiences

No changes required - custom components are opt-in:
- Existing experiences continue working
- No breaking changes to experience.json schema
- Custom components only loaded when present

### For New Experiences

Intake Agent determines if custom components needed:
- Default to standard tools when possible
- Suggest custom components for complex interactions
- Educator can request custom components explicitly

## Open Questions & Decisions Needed

### 1. Component Naming Convention
**Options:**
- kebab-case (orbital-simulator.jsx) ✓ Recommended
- PascalCase (OrbitalSimulator.jsx)
- snake_case (orbital_simulator.jsx)

**Decision**: kebab-case for consistency with other resource files

### 2. Component Scope Restrictions
**Question**: Should components be able to:
- Call other Primer tools (showSlide, playSound)? **YES** - via usePrimerContext
- Access session data? **LIMITED** - only via initialData prop
- Make HTTP requests? **NO** - security risk
- Use localStorage? **NO** - use Primer's information tool instead

### 3. Library Expansion Process
**Question**: How do we add new libraries?
**Process**:
1. Educator requests library
2. Security review (no XSS, no tracking, etc.)
3. Add to CDN imports
4. Update Interface Designer documentation
5. Version-lock for stability

### 4. Component Reusability
**Question**: Can components be shared across experiences?
**Options:**
- A) Experience-scoped only (simpler) ✓ Phase 1
- B) Global component library (more complex) - Phase 3
- C) Template-level components (middle ground) - Phase 2

**Decision**: Start with A, evolve to C, consider B later

### 5. Component Updates
**Question**: What happens when a component needs updates?
**Strategy:**
- Versioning in metadata
- Copy-on-update (don't modify original)
- Educator approval required for updates
- Keep old version for historical sessions

## Success Metrics

### Technical Metrics
- Component load time < 500ms
- Compilation time < 200ms
- Zero security incidents
- Error rate < 1%

### Educational Metrics
- Educator satisfaction with custom components
- Student engagement with interactive components
- Learning outcomes vs standard tools
- Time to create custom component (target: < 30 min)

### Adoption Metrics
- % of experiences using custom components
- Number of unique components created
- Component reuse rate
- Educator requests for new libraries

## Risk Mitigation

### Security Risks
**Risk**: Malicious code execution
**Mitigation**: 
- AI validation before human review
- Controlled scope (no dangerous globals)
- CSP enforcement
- Runtime monitoring

### Performance Risks
**Risk**: Slow/crashing components
**Mitigation**:
- Timeout limits on compilation
- Memory usage monitoring
- Error boundaries
- Performance budgets

### Maintenance Risks
**Risk**: Library version conflicts
**Mitigation**:
- Version locking
- Documented upgrade process
- Backward compatibility testing
- Deprecation warnings

### Educational Risks
**Risk**: Components distract from learning
**Mitigation**:
- Clear learning objective validation
- Educator preview/testing
- Student feedback collection
- Analytics on engagement vs outcomes

## Conclusion

This plan provides a comprehensive path to extend Primer's UI capabilities with custom React components while maintaining security, educational focus, and system integrity. The phased approach allows for iterative development and validation before committing to more complex features.

**Key Principles:**
1. **Security First**: Multiple validation layers, controlled execution
2. **Educational Focus**: Components serve learning objectives
3. **Gradual Adoption**: Opt-in, backward compatible
4. **Maintainable**: Clear patterns, good documentation
5. **Scalable**: Can grow with educator needs

**Next Steps:**
1. Review and approve this plan
2. Create detailed technical specifications for Phase 1
3. Set up development environment with Babel Standalone
4. Implement CustomComponentManager
5. Create Interface Designer agent
6. Build first example component
7. Test with real educator workflow

---

**Document Version**: 1.0  
**Date**: January 5, 2025  
**Author**: AI Assistant (Claude Sonnet 4.5)  
**Status**: Draft - Awaiting Review

