# Custom React Components Documentation

## Quick Start

**New to this feature?** Start here:
1. Read `PHASE0-SUMMARY.md` - Quick overview of Phase 0 approach ⭐
2. Read `phase0-runtime-validation.md` - Complete Phase 0 specification
3. Understand the agent-component communication model

**Implementing Phase 0?** (START HERE)
1. Read `PHASE0-SUMMARY.md` for quick overview
2. Use `phase0-runtime-validation.md` for complete specification
3. Build core runtime with hand-written test component
4. Validate the foundation before adding AI generation

**Implementing Phase 1?** (After Phase 0 complete)
1. Use `phase1-mvp-spec.md` for Interface Designer specification
2. Reference `IMPLEMENTATION-CHECKLIST.md` for day-by-day tasks

## Key Concept

Custom components are **interactive tools that agents control**, just like slides or sounds. The key difference:
- **Agents can read and write component state** to guide learning
- **Students interact with components** to practice skills
- **Components maintain state** throughout the interaction

### Example: Trigonometry Problem

```javascript
// Agent shows triangle
customComponent({
  action: 'show',
  componentId: 'trig-triangle',
  initialState: { sideA: 5, angleC: 30, showHint: false }
})

// Student struggles, agent helps
customComponent({
  action: 'updateState',
  instanceId: 'component-123',
  stateUpdates: { showHint: true }
})

// Agent checks progress
customComponent({
  action: 'getState',
  instanceId: 'component-123'
})
// Returns: { sideA: 5, angleC: 30, studentAnswer: 8.5, attempts: 2, ... }
```

## Documents in This Folder

### Implementation Documents

**`phase1-mvp-spec.md`** ⭐ **START HERE**
- Complete MVP implementation specification
- Agent-controlled components with bidirectional state
- Interface Designer agent for component generation
- Includes shadcn/ui components
- Math/science focused (MathJS, Recharts)
- Complete code examples
- 4-week timeline

**`session-data-workflow.md`** 📋 **WORKFLOW GUIDE**
- How components flow from creation to deployment
- Meta-experience vs target experience
- Session data usage during creation
- Complete end-to-end workflow
- API endpoints and error handling

### Planning Documents

**`custom-react-components-plan.md`**
- Original comprehensive plan (all 3 phases)
- Full architecture details
- Security model
- Risk mitigation
- Reference for future phases

**`custom-react-components-summary.md`**
- High-level overview
- Quick reference
- Use cases

**`custom-components-comparison.md`**
- Evolution from original exploration
- What changed and why
- Design decisions

**`custom-components-index.md`**
- Navigation guide for all documents
- Reading order by role
- FAQ

**`custom-components-phase1-spec.md`** (DEPRECATED - see phase1-mvp-spec.md)
- Original Phase 1 spec before revision
- Kept for reference

## What's in Phase 1 MVP?

### Core Features
- ✅ Runtime component system (Babel compilation, scope injection)
- ✅ Agent-controlled state management (bidirectional)
- ✅ Component event system (triggers agent turns)
- ✅ Interface Designer agent (generates components)
- ✅ Session data workflow (creation → deployment)
- ✅ All shadcn/ui components available
- ✅ Math/science libraries (MathJS, Recharts)

### Deferred to Phase 2
- ❌ 3D graphics (Three.js)
- ❌ Advanced visualization (D3, Plotly)
- ❌ Component library (shared components)
- ❌ Component versioning
- ❌ Hot reloading

### Key Addition: Bidirectional State Management

Components expose state that agents can:
- **Read**: Check student progress
- **Write**: Provide hints, reveal steps, guide learning
- **React to**: Respond to student interactions

This makes components **active tools** in the agent's teaching arsenal, not just passive displays.

## Available Libraries (Phase 1)

### UI & Styling
- React (all hooks)
- Tailwind CSS
- Lucide React (icons)
- **All shadcn/ui components** (Button, Input, Card, Dialog, Select, etc.)

### Math & Science
- MathJS (calculations, units, expressions)
- Recharts (charts and graphs)

### Utilities
- Lodash

## Use Cases

### Math
- Geometry problems (triangles, circles)
- Trigonometry exercises
- Algebra equation solving
- Graphing functions
- Statistics visualization

### Science
- Chemistry molecule building
- Physics simulations (kinematics, forces)
- Data analysis and graphing
- Unit conversions

### General
- Interactive exercises
- Step-by-step problem solving
- Visual demonstrations
- Progress tracking

## Implementation Timeline

### **Phase 0: Runtime Validation** (1-2 weeks) ⭐ START HERE

**Goal**: Validate core runtime with hand-written components

**Week 1**: Core infrastructure
- CustomComponentManager with state management
- Tool with all actions (show, hide, updateState, getState)
- Display component with per-component error boundaries
- Component event system
- API endpoint for component loading

**Week 2**: Demo experience & testing
- shadcn/ui components in scope (import stripping strategy)
- Hand-written trig triangle component
- Demo experience with test agent
- Manual browser testing
- Validate all functionality works

### **Phase 1: AI Component Generation** (2-3 weeks)

**Goal**: Add Interface Designer agent for AI-generated components

**Week 1**: Interface Designer agent
- Agent configuration in meta-experience
- Comprehensive agent instructions
- Artifact tool enhancement (jsx type)
- Integration with Design Agent

**Week 2**: Session data workflow
- Component generation in session_data
- Experience Builder integration
- Test AI-generated components
- Validate creation → deployment flow

**Week 3**: Testing & polish
- Unit, integration, E2E tests
- Documentation updates
- Bug fixes
- Performance optimization

### **Phase 2: Advanced Features** (Future)

- Component library (shared components)
- 3D graphics (Three.js)
- Advanced visualization (D3)
- Component versioning
- Hot reloading

## Next Steps

1. **Review** `phase1-mvp-spec.md`
2. **Understand** the agent-component communication model
3. **Implement** following the spec checklist
4. **Test** with the trig triangle example
5. **Iterate** based on feedback

## Questions?

- **What is this?** Interactive components that agents can control
- **Why?** Enables rich, interactive learning experiences beyond slides/sounds
- **How?** Components maintain state that agents can read/write
- **When?** Use for interactive exercises, simulations, visualizations
- **Who controls them?** Agents control, students interact

## Related Primer Documentation

- `../../architecture/tools-system.md` - How tools work in Primer
- `../../architecture/delegation.md` - Agent delegation system
- `../educational-ui-architecture.md` - Original exploration document

---

**Status**: Phase 1 MVP Ready for Implementation  
**Last Updated**: January 5, 2025  
**Focus**: Agent-controlled interactive components with state management

