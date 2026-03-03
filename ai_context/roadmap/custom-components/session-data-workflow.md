# Custom Components: Session Data Workflow

## Overview

This document explains how custom components flow through the experience creation process, from generation in meta-experiences to deployment in target experiences.

## The Two-Experience Model

### Meta-Experience (e.g., `intake-agent`)
- Where educators create new experiences
- Contains agents: Intake Agent, Design Agent, Interface Designer, Experience Builder
- Uses `session_data` for temporary artifacts during creation
- **Components are generated here**

### Target Experience (e.g., `math-tutoring-experience`)
- Where students learn
- Contains student-facing agents (tutors, mentors, etc.)
- Uses `resources/components/` for deployed components
- **Components are executed here**

## Complete Workflow

### Phase 1: Component Generation (Meta-Experience)

```
1. Educator talks to Intake Agent
   "I want to help students learn trigonometry with interactive triangles"
   
2. Intake Agent delegates to Design Agent
   Design Agent creates comprehensive design document
   
3. Design Agent identifies need for custom component
   Creates component specification:
   - Purpose: SOH CAH TOA practice
   - Visual: Right triangle with labeled sides
   - Interactions: Student calculates missing side
   - Agent controls: Hints, steps, encouragement
   
4. Design Agent delegates to Interface Designer
   delegate({
     destination: 'Interface Designer',
     rationale: 'Need custom React component for trig practice',
     conversationContext: `${componentSpecification}`
   })
   
5. Interface Designer generates component code
   artifact({
     action: 'create',
     name: 'trig-triangle',
     type: 'jsx',
     content: `/* Complete React component */`
   })
   
6. Component stored in session_data
   storage/intake-agent/session_data/{sessionId}/artifacts/trig-triangle.jsx
```

### Phase 2: Component Preview (Optional - Meta-Experience)

```
7. Intake Agent can optionally preview the component
   - Load component from session_data
   - Instantiate using CustomComponentManager
   - Show to educator in the intake UI
   - Educator can request modifications
   
8. If modifications needed:
   - Design Agent delegates back to Interface Designer
   - Interface Designer updates the artifact
   - Updated component replaces previous version
   - Preview refreshes
```

### Phase 3: Experience Compilation (Meta-Experience → Target Experience)

```
9. Design Agent delegates to Experience Builder
   Experience Builder receives:
   - Design document
   - All artifacts (including component JSX files)
   - Configuration requirements
   
10. Experience Builder creates target experience
    createExperience() → returns targetExperienceId
    
11. Experience Builder copies component to target
    createFile({
      experienceId: targetExperienceId,
      path: 'resources/components/trig-triangle.jsx',
      content: componentCode  // Read from session_data artifact
    })
    
12. Experience Builder updates target experience.json
    matterCompiler({
      action: 'addResource',
      experienceId: targetExperienceId,
      updates: {
        resources: {
          components: [{
            id: 'trig-triangle',
            name: 'Trigonometry Triangle',
            description: 'Practice calculating triangle sides',
            file: 'resources/components/trig-triangle.jsx',
            requiredState: ['sideA', 'angleC']
          }]
        }
      }
    })
    
13. Target experience ready
    storage/{targetExperienceId}/
    ├── experience.json (includes component reference)
    └── resources/
        └── components/
            └── trig-triangle.jsx
```

### Phase 4: Component Execution (Target Experience)

```
14. Student loads target experience
    Navigate to /play/{targetExperienceId}
    
15. Agent decides to show component
    customComponent({
      action: 'show',
      componentId: 'trig-triangle',
      initialState: {
        sideA: 5,
        angleC: 30,
        showHint: false
      }
    })
    
16. CustomComponentManager loads component
    - Fetch from /api/experiences/{experienceId}/components/trig-triangle
    - Returns { code, metadata }
    - Compile with Babel (strip imports, inject scope)
    - Store compiled component
    
17. Component displayed to student
    - Rendered in CustomComponents overlay
    - Student can interact
    - Component fires events
    
18. Agent receives events and responds
    - onComponentEvent triggered
    - Agent processes event
    - Agent updates component state
    - Component re-renders with new state
    
19. Student completes task
    - Component calls onSubmit
    - Agent celebrates success
    - Agent may hide component or show next one
```

## Directory Structure

### Meta-Experience (during creation)

```
storage/intake-agent/
├── experience.json
├── resources/
│   └── instructions/
│       └── agent/
│           ├── intake-agent.md
│           ├── design-agent.md
│           ├── interface-designer.md
│           └── experience-builder.md
└── session_data/
    └── {sessionId}/
        └── artifacts/
            ├── design-document.md
            ├── trig-triangle.jsx          ← Generated component
            ├── molecule-builder.jsx       ← Another component
            └── experience-config.json     ← Draft config
```

### Target Experience (after compilation)

```
storage/math-tutoring-experience/
├── experience.json                         ← Includes component references
├── resources/
│   ├── components/
│   │   ├── trig-triangle.jsx              ← Copied from session_data
│   │   └── molecule-builder.jsx           ← Copied from session_data
│   ├── scenes/
│   │   └── classroom.png
│   └── instructions/
│       └── agent/
│           └── tutor.md
└── session_data/
    └── {studentSessionId}/
        └── artifacts/
            └── student-work.md
```

## Key Benefits of This Workflow

### 1. Separation of Concerns
- **Creation** happens in meta-experiences
- **Execution** happens in target experiences
- Clean separation between authoring and runtime

### 2. Preview Capability
- Components stored in session_data can be previewed
- Educators see what students will see
- Iteration without affecting target experience

### 3. Version Control
- Each session_data is isolated
- Multiple educators can create simultaneously
- No conflicts between creation sessions

### 4. Reusability
- Components in session_data can be copied to multiple target experiences
- Future: Shared component library
- Experience Builder handles copying

### 5. Clean Deployment
- Target experiences only contain final, approved components
- No draft/temporary files in target
- Clear audit trail from creation to deployment

## API Endpoints

### Component Loading (Runtime)

```typescript
// GET /api/experiences/{experienceId}/components/{componentId}
// Used by CustomComponentManager.loadComponent()
// Returns: { code: string, metadata: object }

// Example:
GET /api/experiences/math-tutoring-experience/components/trig-triangle
Response:
{
  "code": "import React from 'react'...",
  "metadata": {
    "id": "trig-triangle",
    "name": "Trigonometry Triangle",
    "description": "Practice calculating triangle sides"
  }
}
```

### Artifact Management (Creation)

```typescript
// POST /api/artifacts (via artifact tool)
// Used by Interface Designer to create components
// Stores in session_data

artifact({
  action: 'create',
  name: 'trig-triangle',
  type: 'jsx',
  content: componentCode
})

// Stored at:
// storage/intake-agent/session_data/{sessionId}/artifacts/trig-triangle.jsx
```

### Experience File Operations (Compilation)

```typescript
// POST /api/experience-tools (via experience tool)
// Used by Experience Builder to copy components

createFile({
  experienceId: 'math-tutoring-experience',
  path: 'resources/components/trig-triangle.jsx',
  content: componentCode  // Read from session_data artifact
})
```

## Error Handling

### Component Not Found in Session Data
```
Interface Designer hasn't created the component yet
→ Design Agent should delegate to Interface Designer first
```

### Component Not Found in Target Experience
```
Experience Builder didn't copy the component
→ Check experience.json resources.components
→ Verify file exists at resources/components/{componentId}.jsx
```

### Component Compilation Error
```
Component code has syntax errors
→ Interface Designer needs to fix the code
→ Update artifact in session_data
→ Experience Builder re-copies to target
```

### Component Runtime Error
```
Component crashes during execution
→ Error boundary catches it
→ Shows error UI to student
→ Logs error for debugging
→ Agent can retry or dismiss
```

## Future Enhancements

### Phase 2: Component Library
```
storage/component-library/
├── trig-triangle.jsx
├── molecule-builder.jsx
└── periodic-table.jsx

Interface Designer can:
- Check if component exists in library
- Reuse existing components
- Customize from templates
```

### Phase 3: Component Versioning
```
resources/components/
├── trig-triangle-v1.jsx
├── trig-triangle-v2.jsx
└── trig-triangle.jsx → symlink to v2

Allows:
- Safe updates
- Rollback capability
- A/B testing
```

### Phase 4: Hot Reloading
```
During development:
- Watch session_data for changes
- Auto-recompile components
- Live preview updates
- Faster iteration
```

---

**Document Purpose**: Explain component workflow through meta and target experiences  
**Audience**: Developers implementing the system  
**Status**: Complete specification  
**Date**: January 5, 2025

