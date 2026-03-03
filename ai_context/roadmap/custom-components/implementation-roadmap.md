# Custom Components: Implementation Roadmap

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PHASE 0                                 │
│                  Runtime Validation                             │
│                      (1-2 weeks)                                │
│                                                                 │
│  Goal: Prove the core runtime works with hand-written code     │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Week 1     │  │   Week 2     │  │   Result     │        │
│  │              │  │              │  │              │        │
│  │ • Manager    │  │ • API        │  │ ✅ Runtime   │        │
│  │ • Tool       │  │ • Demo exp   │  │    validated │        │
│  │ • Display    │  │ • Test comp  │  │ ✅ Manual    │        │
│  │ • Types      │  │ • Testing    │  │    testing   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│  Deliverable: Working runtime with hand-written component      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         PHASE 1                                 │
│                 AI Component Generation                         │
│                      (2-3 weeks)                                │
│                                                                 │
│  Goal: Add Interface Designer agent for AI-generated code      │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Week 1     │  │   Week 2     │  │   Week 3     │        │
│  │              │  │              │  │              │        │
│  │ • Interface  │  │ • Session    │  │ • Testing    │        │
│  │   Designer   │  │   data flow  │  │ • Polish     │        │
│  │ • Agent      │  │ • Experience │  │ • Docs       │        │
│  │   prompts    │  │   Builder    │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│  Deliverable: AI generates components during creation          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         PHASE 2                                 │
│                   Advanced Features                             │
│                       (Future)                                  │
│                                                                 │
│  • Component library (shared components)                        │
│  • 3D graphics (Three.js)                                      │
│  • Advanced visualization (D3, Plotly)                         │
│  • Component versioning                                         │
│  • Hot reloading                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase Comparison

| Aspect | Phase 0 | Phase 1 | Phase 2 |
|--------|---------|---------|---------|
| **Duration** | 1-2 weeks | 2-3 weeks | TBD |
| **Component Creation** | Hand-written | AI-generated | Enhanced |
| **Testing** | Manual browser | Automated + E2E | Comprehensive |
| **Scope** | Runtime only | Full workflow | Advanced features |
| **Risk** | Low (proven tech) | Medium (AI generation) | Low (enhancements) |
| **Deliverable** | Working runtime | Complete system | Production-ready |

---

## Decision Tree: Where to Start?

```
Are you starting from scratch?
│
├─ YES → Start with Phase 0
│         ├─ Build core runtime
│         ├─ Test with hand-written component
│         └─ Validate foundation
│
└─ NO → Do you have a working runtime?
          │
          ├─ YES → Start with Phase 1
          │         ├─ Add Interface Designer
          │         └─ Test AI generation
          │
          └─ NO → Start with Phase 0
                    (Don't skip validation!)
```

---

## Detailed Phase Breakdown

### Phase 0: Runtime Validation

#### Week 1: Core Infrastructure

**Day 1-2: ComponentManager**
- Load components from API
- Compile JSX with Babel
- Inject scope (React, shadcn/ui, etc.)
- Manage component instances

**Day 3: Type Definitions**
- PrimerComponentProps interface
- ComponentEvent types
- ToolContext extensions

**Day 4: Custom Component Tool**
- show, hide, updateState, getState actions
- Tool registration
- Event callbacks

**Day 5: Component Display**
- CustomComponents overlay
- Per-component error boundaries
- Error recovery UI

#### Week 2: Demo & Testing

**Day 1: API Endpoint**
- GET /api/experiences/{id}/components/{id}
- Return { code, metadata }

**Day 2: CDN Scripts**
- Load MathJS, Recharts, Lodash, Lucide
- Update CSP for unsafe-eval

**Day 3: Test Component**
- Hand-written trig-triangle.jsx
- State synchronization pattern
- Loading states

**Day 4: Demo Experience**
- experience.json configuration
- Demo agent instructions
- Component metadata

**Day 5: Testing**
- Manual browser testing
- Validate all functionality
- Fix any issues

#### Exit Criteria
- ✅ Component loads and displays
- ✅ Student can interact
- ✅ Events flow to agent
- ✅ Agent can update state
- ✅ No circular loops
- ✅ Performance acceptable

---

### Phase 1: AI Component Generation

#### Week 1: Interface Designer

**Day 1: Agent Configuration**
- Add to meta-experience
- Configure toolGroups
- Set up delegation

**Day 2: Agent Instructions**
- Comprehensive prompt
- Component requirements
- Available libraries
- Code patterns

**Day 3: Artifact Tool**
- Add jsx type support
- Handle .jsx files
- Store in session_data

**Day 4: Design Agent Integration**
- Update Design Agent prompt
- Add delegation logic
- Component specification format

**Day 5: Test Generation**
- Generate test component
- Verify code quality
- Test in runtime

#### Week 2: Session Data Workflow

**Day 1: Session Data Integration**
- Components in session_data
- Preview during creation
- Metadata tracking

**Day 2: Experience Builder**
- Copy components to target
- Update experience.json
- Validate deployment

**Day 3: E2E Testing**
- Full creation flow
- AI generation
- Deployment
- Runtime execution

**Day 4: Iteration**
- Fix issues found
- Improve AI prompts
- Optimize workflow

**Day 5: Documentation**
- Update specs
- Document learnings
- Create examples

#### Week 3: Testing & Polish

**Day 1-2: Automated Testing**
- Unit tests
- Integration tests
- E2E tests

**Day 3-4: Bug Fixes**
- Address test failures
- Performance optimization
- Edge case handling

**Day 5: Documentation**
- Final documentation
- Example components
- Troubleshooting guide

#### Exit Criteria
- ✅ AI generates working components
- ✅ Components deploy correctly
- ✅ Full workflow validated
- ✅ Tests passing
- ✅ Documentation complete

---

### Phase 2: Advanced Features (Future)

**Component Library**
- Shared components across experiences
- Version management
- Component marketplace

**3D Graphics**
- Three.js integration
- 3D molecule viewers
- Physics simulations

**Advanced Visualization**
- D3.js integration
- Plotly charts
- Custom data viz

**Developer Experience**
- Hot reloading
- Component preview
- Better debugging tools

**Production Features**
- Component analytics
- A/B testing
- Performance monitoring

---

## Risk Assessment

### Phase 0 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Babel doesn't work in browser | Low | High | Use proven @babel/standalone |
| Import stripping fails | Low | High | Use existing plugin |
| Scope injection issues | Medium | Medium | Test incrementally |
| Performance problems | Low | Medium | Monitor from day 1 |

### Phase 1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI generates bad code | Medium | Medium | Comprehensive prompts |
| Session data workflow complex | Low | Medium | Clear specification |
| Integration issues | Medium | Low | Incremental integration |

---

## Success Metrics

### Phase 0
- Component compiles < 500ms ✅
- State updates < 100ms ✅
- Zero circular update loops ✅
- Manual testing passes ✅

### Phase 1
- AI generates working components 90%+ ✅
- Full workflow completes successfully ✅
- All tests passing ✅
- Documentation complete ✅

### Phase 2
- Advanced features working ✅
- Production-ready ✅
- Performance optimized ✅
- User feedback positive ✅

---

## Resource Requirements

### Phase 0
- **Developer time**: 1-2 weeks (1 developer)
- **Dependencies**: @babel/standalone, babel-plugin-transform-remove-imports
- **Infrastructure**: None (uses existing Primer)

### Phase 1
- **Developer time**: 2-3 weeks (1 developer)
- **AI costs**: Minimal (Claude API for Interface Designer)
- **Infrastructure**: None (uses existing Primer)

### Phase 2
- **Developer time**: TBD
- **Dependencies**: Three.js, D3.js, etc.
- **Infrastructure**: Possible CDN for libraries

---

## Key Documents by Phase

### Phase 0
- `PHASE0-SUMMARY.md` - Quick overview
- `phase0-runtime-validation.md` - Complete spec
- `DECISIONS.md` - Design rationale

### Phase 1
- `phase1-mvp-spec.md` - Complete spec
- `IMPLEMENTATION-CHECKLIST.md` - Day-by-day guide
- `session-data-workflow.md` - Workflow details

### Phase 2
- TBD based on Phase 1 learnings

---

## Communication Plan

### During Phase 0
- Daily: Check in on progress
- Weekly: Review what's working/not working
- End of phase: Validate all success criteria

### During Phase 1
- Weekly: Review AI-generated components
- Mid-phase: Validate session data workflow
- End of phase: Complete E2E testing

### After Each Phase
- Document learnings
- Update specifications
- Plan next phase

---

## The Bottom Line

**Phase 0**: Prove it works (hand-written)  
**Phase 1**: Make it smart (AI-generated)  
**Phase 2**: Make it powerful (advanced features)

Start with Phase 0. Don't skip it. You'll thank yourself later.

---

**Document Purpose**: High-level roadmap for all phases  
**Audience**: Project stakeholders and developers  
**Status**: Ready to begin  
**Date**: January 5, 2025

