# Custom Components - Changes from Original Plan

## Summary of Revisions (January 5, 2025)

Based on feedback, the Phase 1 plan has been significantly revised to focus on the MVP essentials and clarify the agent-component relationship.

## Key Changes

### 1. Clarified Core Concept

**Before**: Components were described as tools for students to interact with.

**After**: **Components are tools that agents control**. They're part of the agent's teaching arsenal, alongside slides, sounds, and scenes. The key innovation is that components are stateful and interactive, allowing:
- Agents to read/write component state
- Students to interact with components
- Bidirectional communication between agent and component

### 2. Added Bidirectional State Management

**New Feature**: Agents can now:
- **Initialize** component state when showing it
- **Update** component state to guide learning (show hints, reveal steps)
- **Read** component state to check student progress
- **React** to component events (student interactions)

**New Tool Actions**:
```javascript
customComponent({ action: 'updateState', instanceId, stateUpdates })
customComponent({ action: 'getState', instanceId })
```

**Component Interface**:
```typescript
interface PrimerComponentProps {
  initialState?: Record<string, any>;
  externalState?: Record<string, any>;  // NEW: Agent updates
  onStateChange?: (state) => void;      // NEW: Notify agent
  onEvent?: (type, data) => void;
  onSubmit?: (data) => void;
}
```

### 3. Simplified Library Scope

**Removed from Phase 1**:
- ❌ Three.js (3D graphics) - defer to Phase 2
- ❌ D3.js (complex visualization) - defer to Phase 2
- ❌ Plotly - defer to Phase 2
- ❌ Tone.js (audio synthesis) - defer to Phase 2
- ❌ TensorFlow.js - defer to Phase 2
- ❌ Papaparse, SheetJS - defer to Phase 2

**Kept for Phase 1**:
- ✅ React (all hooks)
- ✅ Tailwind CSS
- ✅ Lucide React (icons)
- ✅ **All shadcn/ui components** (NEW: explicitly added)
- ✅ MathJS (math/physics/chemistry)
- ✅ Recharts (simple charts)
- ✅ Lodash (utilities)

**Rationale**: Focus on math/science education without 3D complexity. shadcn/ui provides beautiful, consistent UI components out of the box.

### 4. Deferred Interface Designer Agent

**Before**: Interface Designer agent was part of Phase 1.

**After**: Deferred to Phase 2. Phase 1 focuses on:
- Component execution infrastructure
- Agent-component communication
- Manual component creation for testing

**Rationale**: Prove the execution and communication model first, then add AI generation.

### 5. Added shadcn/ui Components

**New**: All shadcn/ui components available in component scope:
- Button, Input, Label, Textarea
- Card, Dialog, Alert Dialog
- Select, Dropdown Menu, Context Menu
- Progress, Toggle, Tooltip
- Chart, Toast, Scroll Area
- Hover Card

**Rationale**: These are already in the project (`/src/components/ui/`), provide consistent styling, and enable rapid component development.

### 6. Enhanced Example Scenarios

**Added detailed examples**:

**Trigonometry Problem**:
- Agent shows triangle with initial state
- Student attempts answer
- Agent reveals hint by updating state
- Agent shows working steps progressively
- Component tracks attempts and progress

**Chemistry Molecule Builder**:
- Agent demonstrates by adding atoms (agent controls state)
- Agent switches to interactive mode (student controls state)
- Student builds molecule
- Agent can guide by highlighting correct bonds

**Math Problem with Scaffolding**:
- Component shows problem
- Student gets stuck
- Agent reads state to see attempts
- Agent updates state to show partial solution
- Student completes with guidance

### 7. Reorganized Documentation

**Before**: All documents in `roadmap/` folder.

**After**: Moved to `roadmap/custom-components/` subfolder with:
- `README.md` - Quick start and navigation
- `phase1-mvp-spec.md` - **Primary implementation document**
- `CHANGES.md` - This document
- Supporting documents (full plan, comparison, index)

## What Stayed the Same

### Execution Strategy
- Babel Standalone for MVP (Phase 1)
- Sandpack for production (Phase 3)
- Controlled scope injection
- Component factory pattern

### Security Model
- Multi-layer validation (AI + Human + Runtime + Monitoring)
- No localStorage/fetch/eval
- CSP enforcement
- Error boundaries

### Storage Structure
- Components in `resources/components/`
- Schema extension in `experience.json`
- Validation metadata included

### Integration Pattern
- Follows SlideManager pattern
- Tool-based interface
- Display component in PlayPage
- State management via listeners

## Impact on Implementation

### Reduced Scope = Faster MVP
- **Before**: 2-3 weeks with many libraries and Interface Designer
- **After**: 2-3 weeks focused on core functionality and state management

### Clearer Purpose
- **Before**: "Components for interactive experiences"
- **After**: "Stateful tools that agents control to guide learning"

### Better Agent Integration
- **Before**: Components were somewhat separate from agent workflow
- **After**: Components are active tools in agent's teaching arsenal

### More Practical Examples
- **Before**: Generic examples
- **After**: Specific math/science scenarios showing agent-student-component interaction

## Migration Notes

### If You Started with Original Plan

1. **Focus on `phase1-mvp-spec.md`** - This is now the primary document
2. **Implement state management** - Key new feature
3. **Skip 3D libraries** - Defer to Phase 2
4. **Add shadcn/ui to scope** - Import from `/src/components/ui/`
5. **Update tool actions** - Add `updateState` and `getState`
6. **Revise component interface** - Add `externalState` and `onStateChange`

### Testing the New Approach

1. Build trig triangle example from spec
2. Test agent showing component with initial state
3. Test agent updating state to show hint
4. Test agent reading state to check progress
5. Test student interaction triggering events
6. Verify agent can respond to events

## Questions Addressed

### "Can agents interact with components?"
**Yes!** This is now a core feature. Agents can read/write component state.

### "What about 3D simulations?"
**Phase 2**. Start with 2D math/science, add 3D later.

### "How do agents guide students?"
**State updates**. Agent updates component state to reveal hints, show steps, highlight areas, etc.

### "What UI components are available?"
**All shadcn/ui components** plus React, Tailwind, Lucide icons.

### "Is this just for students?"
**No!** Agents can demonstrate using components by controlling state, then hand over to students.

## Next Steps

1. Review `phase1-mvp-spec.md`
2. Understand bidirectional state management
3. Implement CustomComponentManager with state tracking
4. Build trig triangle example
5. Test agent-component communication
6. Iterate based on feedback

---

**Version**: 2.0  
**Date**: January 5, 2025  
**Status**: Revised for MVP Focus  
**Key Addition**: Bidirectional agent-component state management

