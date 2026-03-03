# Custom React Components - Documentation Index

## Overview

This index provides a guide to all documentation related to the Custom React Components feature for Primer.

## ⭐ Start Here for Implementation

### Phase 0: Runtime Validation (START HERE)
1. **`phase0-runtime-validation.md`** - Validate core runtime with hand-written components
2. Test in browser, iterate on runtime system
3. Prove the foundation works

### Phase 1: AI Component Generation (After Phase 0)
1. **`phase1-mvp-spec.md`** - Complete technical specification
2. **`IMPLEMENTATION-CHECKLIST.md`** - Day-by-day implementation guide
3. **`DECISIONS.md`** - All design decisions with rationale
4. **`session-data-workflow.md`** - Component creation to deployment flow

## Core Implementation Documents

### 0. Phase 0 Runtime Validation ⭐ START HERE
**File**: `phase0-runtime-validation.md`  
**Purpose**: Validate core runtime with hand-written components  
**Status**: ✅ Ready for Implementation  
**Duration**: 1-2 weeks

**Key Sections**:
- Core runtime system (ComponentManager, tool, display)
- Hand-written test component (trig-triangle.jsx)
- Demo experience configuration
- Manual testing procedures
- Success criteria and troubleshooting

**Why Phase 0?**
- De-risks critical path
- Validates assumptions early
- Faster feedback loop
- Eliminates AI as variable
- Proves foundation before adding complexity

### 1. Phase 1 MVP Specification
**File**: `phase1-mvp-spec.md`  
**Purpose**: Complete technical specification for Phase 1 MVP  
**Status**: ✅ Finalized - Ready for Implementation

**Key Sections**:
- Component execution system (Babel, scope injection)
- Agent-component communication (bidirectional state, events)
- Interface Designer agent (generates components)
- Component deployment API
- Tool registration and integration
- Performance monitoring and rate limiting
- Testing checklist and success criteria

### 2. Implementation Checklist
**File**: `IMPLEMENTATION-CHECKLIST.md`  
**Purpose**: Day-by-day implementation guide (4 weeks)  
**Status**: ✅ Complete

**Structure**:
- Week 1: Core infrastructure (runtime system)
- Week 2: Integration (shadcn/ui, test components)
- Week 3: Interface Designer (AI component generation)
- Week 4: Testing, polish, documentation

### 3. Design Decisions
**File**: `DECISIONS.md`  
**Purpose**: Record of all major design decisions  
**Status**: ✅ Complete

**Key Decisions**:
- State synchronization (prevent circular updates)
- Component bundling (import stripping + scope injection)
- Interface Designer in Phase 1
- No tool invocation from components
- Agent-managed state persistence
- Event-driven communication

### 4. Session Data Workflow
**File**: `session-data-workflow.md`  
**Purpose**: Component creation to deployment flow  
**Status**: ✅ Complete

**Key Topics**:
- Meta-experience vs target experience
- Component generation in session_data
- Preview during creation
- Experience Builder compilation
- Runtime execution
- API endpoints

## Planning Documents

### 1. Full Implementation Plan
**File**: `custom-react-components-plan.md`  
**Purpose**: Comprehensive plan covering architecture, security, workflow, and all implementation phases  
**Read this if**: You want the complete picture of the feature

**Key Sections**:
- Current system analysis
- Proposed architecture
- Component execution strategy
- Storage structure and schema
- Security & validation
- Agent workflow integration
- Implementation phases (1-3)
- Technical considerations
- Risk mitigation

### 2. Quick Reference Summary
**File**: `custom-react-components-summary.md`  
**Purpose**: High-level overview and quick reference  
**Read this if**: You need a quick refresher or overview

**Key Sections**:
- What this adds
- Use cases
- Architecture overview
- Key technical decisions
- Implementation phases
- Success metrics

### 3. Original vs Final Comparison
**File**: `custom-components-comparison.md`  
**Purpose**: Compares original exploratory conversation with final plan  
**Read this if**: You want to understand how the plan evolved

**Key Sections**:
- What changed and why
- What was kept from original
- Key insights gained
- Recommendations validated

### 4. Phase 1 Technical Specification
**File**: `custom-components-phase1-spec.md`  
**Purpose**: Detailed implementation checklist for MVP  
**Read this if**: You're implementing Phase 1

**Key Sections**:
- Components to build
- Dependencies to add
- Testing checklist
- Success criteria
- Rollout plan

### 5. Original Exploration Document
**File**: `educational-ui-architecture.md`  
**Purpose**: Original conversation exploring component execution strategies  
**Read this if**: You want background on technical options evaluated

**Key Sections**:
- Component execution options (react-runner, react-live, Babel, Sandpack, Custom)
- Data transfer patterns
- Security considerations
- Library management

## Reading Order

### For Project Managers / Stakeholders
1. `custom-react-components-summary.md` - Get the overview
2. `custom-react-components-plan.md` (Phases section) - Understand timeline
3. `custom-react-components-plan.md` (Success Metrics) - Understand goals

### For Architects / Tech Leads
1. `custom-react-components-summary.md` - Get oriented
2. `custom-react-components-plan.md` - Full architecture
3. `custom-components-comparison.md` - Understand decisions
4. `custom-components-phase1-spec.md` - Implementation details

### For Developers
1. `custom-react-components-summary.md` - Quick overview
2. `custom-components-phase1-spec.md` - What to build
3. `custom-react-components-plan.md` (Technical Considerations) - Deep dive
4. `educational-ui-architecture.md` - Background on options

### For Educators / Content Creators
1. `custom-react-components-summary.md` (Use Cases) - When to use
2. `custom-react-components-plan.md` (Agent Workflow) - How it works
3. Wait for user documentation (coming in Phase 2)

## Key Concepts

### Custom Components
React components generated by AI (Interface Designer agent) for interactive educational experiences when standard UI tools are insufficient.

### Interface Designer
New backend agent that creates custom React components based on educator requirements.

### Component Execution
Components are compiled at runtime using Babel Standalone (MVP) or Sandpack (production), with controlled scope for security.

### Data Contract
Standard interface (`PrimerComponentProps`) that all custom components must follow for integration with Primer.

### Validation Pipeline
Multi-layer security: AI validation → Human approval → Runtime sandboxing → Monitoring

## Implementation Status

**Current Phase**: Planning Complete  
**Next Phase**: Phase 1 Implementation (MVP)  
**Estimated Start**: TBD  
**Estimated Duration**: 2-3 weeks

## Related Primer Documentation

### Architecture
- `../architecture/overview.md` - Primer system overview
- `../architecture/tools-system.md` - How tools work
- `../architecture/delegation.md` - Agent delegation system
- `../architecture/experience-format.md` - Experience structure

### Guides
- `../guides/adding-tools.md` - How to add new tools
- `../guides/experience-workflow.md` - Experience creation workflow

### Reference
- `../reference/tool-groups.md` - Available tool groups
- `../reference/api-routes.md` - API endpoints

## External References

### Libraries Used
- **Babel Standalone**: https://babeljs.io/docs/en/babel-standalone
- **Sandpack**: https://sandpack.codesandbox.io/
- **React**: https://react.dev/
- **Three.js**: https://threejs.org/
- **Recharts**: https://recharts.org/
- **D3.js**: https://d3js.org/

### Inspiration
- **Claude Artifacts**: Component execution model
- **CodeSandbox**: Sandpack security model
- **Observable**: Notebook-style execution

## FAQ

### When should I use custom components vs standard tools?

**Use standard tools for**:
- Text/markdown content (slides)
- Static images (scenes)
- Audio playback (sounds)
- Simple charts (existing tools)
- Sticky notes (notes)

**Use custom components for**:
- Interactive simulations (physics, chemistry)
- Complex data visualizations
- Domain-specific UI (music notation, circuits)
- Custom learning interactions
- Game-like exercises

### Is this secure?

Yes, through multiple layers:
1. AI validates code before human sees it
2. Educator approves before deployment
3. Runtime sandboxing prevents dangerous operations
4. Monitoring tracks execution
5. Only pre-approved libraries available

### Will this slow down experiences?

No significant impact:
- Components lazy-loaded only when needed
- Compilation cached in memory
- Pre-compiled versions stored after validation
- Target: < 500ms load time

### Can components break existing experiences?

No:
- Opt-in feature (only used when specified)
- Backward compatible schema
- No changes to existing tools or workflows
- Isolated execution environment

### What libraries are available?

Phase 1 includes:
- React (hooks)
- Tailwind CSS
- Lucide React (icons)
- Recharts (charts)
- D3.js (visualization)
- Three.js r128 (3D)
- MathJS
- Tone.js (audio)
- Lodash

More can be added in Phase 2 based on educator needs.

### Can students write code?

No. This is for AI-generated components only. Students interact with the components but don't write code.

### What if a component has a bug?

Multiple safeguards:
- AI validation catches most issues
- Educator testing before deployment
- Error boundaries prevent crashes
- Fallback UI shows friendly error
- Logs capture details for debugging

### How do I request a new library?

Process (Phase 2):
1. Request through Interface Designer
2. Security review
3. Add to CDN imports
4. Update documentation
5. Version-lock for stability

## Change Log

### Version 1.0 (January 5, 2025)
- Initial planning documents created
- Architecture designed
- Phase 1 specification completed
- Ready for implementation

## Contact & Feedback

**Questions about the plan?**
- Review documents in order listed above
- Check FAQ section
- Consult related Primer documentation

**Ready to implement?**
- Start with `custom-components-phase1-spec.md`
- Follow checklist
- Refer to full plan for context

**Found an issue?**
- Document in `../bugs-and-todo-items/`
- Update this index if structure changes

---

**Last Updated**: January 5, 2025  
**Status**: Planning Complete  
**Next Review**: After Phase 1 Implementation

