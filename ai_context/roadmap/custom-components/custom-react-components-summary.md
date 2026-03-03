# Custom React Components - Quick Reference

## What This Adds

Allows AI agents to create custom interactive React components for educational experiences when standard UI tools (slides, notes, scenes) are insufficient.

## Use Cases

- **Complex Simulations**: Physics, chemistry, biology simulations
- **Interactive Visualizations**: Custom data viz beyond standard charts
- **Domain-Specific UI**: Music notation, circuit diagrams, molecular structures
- **Game-Like Interactions**: Drag-and-drop exercises, interactive puzzles
- **Custom Learning Tools**: Specialized educational interfaces

## Architecture Overview

```
Educator Interview (Intake Agent)
    ↓
Determines Need for Custom UI
    ↓
Delegates to Interface Designer Agent
    ↓
Generates React Component (JSX)
    ↓
AI Validation (Security, Libraries, Performance)
    ↓
Educator Approval
    ↓
[Continue Normal Flow: Design → Casting → Image Gen]
    ↓
Experience Builder Deploys Component
    ↓
Component Stored in Experience
    ↓
Student Executes Pre-Vetted Component
```

## Key Technical Decisions

### Execution Strategy
- **MVP**: Babel Standalone + controlled scope (~800KB)
- **Production**: Migrate to Sandpack for better sandboxing (~300KB)
- **Rationale**: Faster MVP iteration, proven production path

### Storage Location
```
storage/{experienceId}/
└── resources/
    └── components/          # NEW
        ├── component-1.jsx
        └── component-2.jsx
```

### Data Contract
All components receive standard props:
```typescript
interface PrimerComponentProps {
  initialData?: Record<string, any>;
  onSubmit?: (data: any) => void;
  onProgress?: (progress: number) => void;
  onEvent?: (eventType: string, data: any) => void;
  experienceId: string;
  sessionId: string;
}
```

Components use `usePrimerContext()` hook to interact with Primer:
```typescript
const { initialData, submit, trackEvent, showSlide, playSound } = usePrimerContext();
```

### Available Libraries
Match Claude Artifacts system:
- React (hooks)
- Tailwind CSS
- Lucide React (icons)
- Recharts (charts)
- D3.js (visualization)
- Three.js r128 (3D)
- MathJS
- Tone.js (audio)
- Lodash
- Papaparse (CSV)
- SheetJS (Excel)

**Constraints**:
- No localStorage/sessionStorage
- No fetch/network requests
- No npm installs beyond pre-loaded
- Only CDN scripts from cdnjs.cloudflare.com

## Security Model

### Multi-Layer Validation

1. **AI Static Analysis**: Claude validates code before human review
   - No network requests
   - No dangerous APIs
   - Only approved libraries
   - Age-appropriate content
   - Performance checks

2. **Human Review**: Educator approves during design phase

3. **Runtime Sandboxing**: Controlled scope injection
   - No dangerous globals
   - Error boundaries
   - CSP enforcement

4. **Monitoring**: Track execution errors and performance

### Why This Is Safe
- Trusted source (Claude API)
- Human-in-the-loop approval
- Pre-vetted library set
- No arbitrary user code
- Controlled execution environment

## Implementation Phases

### Phase 1: MVP (2-3 weeks)
- CustomComponentManager with Babel
- Basic component loading/execution
- customComponent tool (show/hide)
- Interface Designer agent
- Experience Builder integration
- One example component

### Phase 2: Production Ready (2-3 weeks)
- Enhanced AI validation
- Error boundaries
- Component testing interface
- Analytics integration
- Template updates
- Documentation

### Phase 3: Advanced (3-4 weeks)
- Migrate to Sandpack
- Component versioning
- Component library/marketplace
- Hot reloading
- Component composition
- Additional libraries

## New Agent: Interface Designer

**Role**: Creates custom React components when needed

**Configuration**:
```json
{
  "interface-designer": {
    "name": "Interface Designer",
    "type": "backend",
    "temperature": 0.7,
    "aiConfiguration": "instruction-follow",
    "toolGroups": ["builtin", "experience"]
  }
}
```

**Responsibilities**:
1. Receive requirements from Intake Agent
2. Generate JSX component code
3. Validate component (AI)
4. Create validation report
5. Return to Intake Agent for educator approval

## New Tool: customComponent

```typescript
customComponent({
  action: 'show',
  componentId: 'orbital-simulator',
  props: {
    initialData: { planets: [...] },
    onSubmit: (data) => { /* save results */ }
  }
})
```

**Actions**:
- `show`: Display a custom component
- `hide`: Remove a component instance
- `list`: List available components

## Experience Schema Extension

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
        "validator": "claude-sonnet-4.5",
        "metadata": {
          "description": "Interactive 3D simulation",
          "dataContract": {
            "inputs": ["planetData", "simulationSpeed"],
            "outputs": ["userInteractions", "completionStatus"]
          }
        }
      }
    ]
  }
}
```

## When to Use Custom Components

### Use Standard Tools For:
- Text/markdown content → slides
- Static images → scenes
- Audio playback → sounds
- Simple charts → existing tools
- Sticky notes → notes
- Diagrams → mermaid

### Use Custom Components For:
- Interactive simulations (physics, chemistry)
- Complex data visualizations
- Domain-specific UI (music notation, circuits)
- Custom learning interactions
- Game-like exercises

## Integration with Existing System

### No Breaking Changes
- Existing experiences work unchanged
- Custom components are opt-in
- Backward compatible schema
- Standard tools remain primary

### Component Manager Pattern
Follows existing pattern (like SlideManager):
1. Singleton manager maintains state
2. Creates React components dynamically
3. Provides tool interface for agents
4. Display component in PlayPage
5. State updates via listeners

### Tool Groups
Add `custom-component` to agent tool groups:
```json
{
  "agents": {
    "mentor": {
      "toolGroups": ["builtin", "slide", "sound", "custom-component"]
    }
  }
}
```

## Example Component

```jsx
import React, { useState, useEffect } from 'react';

export default function OrbitalSimulator({ 
  initialData, 
  onSubmit, 
  onEvent 
}) {
  const [planets, setPlanets] = useState(initialData?.planets || []);
  const [speed, setSpeed] = useState(1);
  
  useEffect(() => {
    // Simulation loop
    const interval = setInterval(() => {
      // Update planet positions
      onEvent?.('simulation-step', { speed });
    }, 16);
    
    return () => clearInterval(interval);
  }, [speed]);
  
  const handleComplete = () => {
    onSubmit?.({
      completedSteps: 5,
      finalPositions: planets
    });
  };
  
  return (
    <div className="w-full h-full bg-black">
      {/* 3D visualization */}
    </div>
  );
}
```

## Performance Considerations

### Bundle Sizes
- Babel Standalone: ~800KB (MVP)
- Sandpack: ~300KB (production)
- Pre-loaded libraries: ~2-3MB (cached)

### Optimizations
- Lazy load transpiler only when needed
- Cache compiled components
- Pre-compile after validation
- Service worker for offline caching

### Targets
- Component load: < 500ms
- Compilation: < 200ms
- Error rate: < 1%

## Success Metrics

### Technical
- Load/compilation times
- Error rates
- Security incidents (target: 0)

### Educational
- Educator satisfaction
- Student engagement
- Learning outcomes vs standard tools
- Time to create component (target: < 30 min)

### Adoption
- % experiences using custom components
- Unique components created
- Component reuse rate
- Library requests

## Next Steps

1. Review and approve plan
2. Create Phase 1 technical specs
3. Set up Babel Standalone environment
4. Implement CustomComponentManager
5. Create Interface Designer agent
6. Build example component
7. Test with educator workflow

## Related Documents

- **Full Plan**: `custom-react-components-plan.md`
- **Original Discussion**: `educational-ui-architecture.md`
- **Tools System**: `../architecture/tools-system.md`
- **Experience Format**: `../architecture/experience-format.md`
- **Template Discovery**: `../template-discovery-implementation/`

---

**Version**: 1.0  
**Date**: January 5, 2025  
**Status**: Planning Phase

