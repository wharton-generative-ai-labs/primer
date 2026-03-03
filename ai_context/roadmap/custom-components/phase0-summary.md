# Phase 0: Quick Start Guide

## What is Phase 0?

Phase 0 validates the core runtime system for custom React components using **hand-written components** before adding AI generation complexity.

**Think of it as**: Building a "walking skeleton" - the thinnest possible end-to-end slice that proves the architecture works.

---

## Why Phase 0?

### The Problem
If we build everything (runtime + AI generation) and it doesn't work, we won't know where the problem is:
- Is it the runtime system?
- Is it the Babel compilation?
- Is it the AI-generated code?
- Is it the event system?

### The Solution
**Validate the runtime first with known-good code**, then add AI generation.

### Benefits
- ✅ **De-risks critical path** - Proves foundation works
- ✅ **Faster feedback** - Test immediately, no waiting for AI
- ✅ **Cleaner debugging** - Known-good component code
- ✅ **Validates assumptions** - Does Babel work? Do events flow?
- ✅ **Builds confidence** - Foundation proven before adding layers

---

## What You'll Build

### Week 1: Core Runtime System
```
src/app/lib/tools/ui/components/
├── ComponentManager.tsx      ← Loads, compiles, executes components
├── types.ts                  ← TypeScript interfaces
└── custom-component.ts       ← Tool for agents

src/app/components/
└── CustomComponents.tsx      ← Displays components in UI

src/app/api/experiences/[experienceId]/components/[componentId]/
└── route.ts                  ← API endpoint to load components
```

### Week 2: Demo Experience
```
storage/component-demo/
├── experience.json           ← Experience configuration
└── resources/
    ├── components/
    │   └── trig-triangle.jsx ← Hand-written test component
    └── instructions/
        └── agent/
            └── demo-agent.md ← Agent that tests the component
```

---

## What You'll Test

### Manual Testing Flow

1. **Navigate to experience**: `/play/component-demo`
2. **Agent shows component**: Trigonometry triangle appears
3. **Student interacts**: Types answer, clicks "Check Answer"
4. **Component fires event**: `answer-checked` event sent to agent
5. **Agent responds**: "Not quite, try again!"
6. **Agent updates state**: Shows hint after 2 attempts
7. **Component re-renders**: Hint appears
8. **Student succeeds**: Agent celebrates!

### What This Proves

- ✅ Components load from API
- ✅ Babel compiles JSX in browser
- ✅ Import stripping works
- ✅ Scope injection provides dependencies
- ✅ Components render with shadcn/ui styling
- ✅ Events flow from component to agent
- ✅ State updates flow from agent to component
- ✅ No circular update loops
- ✅ Error boundaries isolate failures
- ✅ Performance is acceptable

---

## Success Criteria

Phase 0 is complete when you can:

1. Load the demo experience in browser
2. See the component display correctly
3. Interact with it (type, click)
4. See the agent respond to events
5. See the component update based on agent state changes
6. Complete a full interaction cycle without errors

**If all of this works**, the runtime is validated and you can confidently move to Phase 1 (AI generation).

---

## Timeline

### Week 1: Core Infrastructure (5 days)
- Day 1-2: ComponentManager
- Day 3: Type definitions
- Day 4: Custom component tool
- Day 5: Component display

### Week 2: Demo & Testing (5 days)
- Day 1: API endpoint
- Day 2: CDN scripts & CSP
- Day 3: Hand-written test component
- Day 4: Demo experience configuration
- Day 5: Testing & validation

**Total: 1-2 weeks**

---

## Key Files to Read

1. **`phase0-runtime-validation.md`** - Complete specification (read this!)
2. **`phase1-mvp-spec.md`** - Reference for technical details
3. **`DECISIONS.md`** - Understand design choices

---

## What Comes After Phase 0?

Once Phase 0 is validated:

### Phase 1: AI Component Generation (2-3 weeks)
- Add Interface Designer agent
- AI generates components from specifications
- Session data workflow
- Complete creation → deployment flow

### Phase 2: Advanced Features (Future)
- Component library
- 3D graphics (Three.js)
- Advanced visualization (D3)
- Component versioning

---

## Quick Reference: What's In vs Out

### ✅ Phase 0 (In Scope)
- Core runtime system
- Hand-written test component
- Demo experience
- Manual browser testing
- Validation of all core functionality

### ❌ Phase 1 (Out of Scope for Phase 0)
- Interface Designer agent
- AI component generation
- Meta-experience modifications
- Session data workflow
- Artifact tool enhancement

---

## Getting Started

1. **Read**: `phase0-runtime-validation.md` (complete spec)
2. **Build**: Follow Week 1 checklist (core runtime)
3. **Create**: Demo experience and test component (Week 2)
4. **Test**: Manual browser testing
5. **Validate**: Verify all success criteria
6. **Iterate**: Fix any issues found
7. **Move on**: Proceed to Phase 1 with confidence!

---

## Questions?

- **"Why not just build everything at once?"** - Too many variables. If something breaks, you won't know where.
- **"Is Phase 0 required?"** - Highly recommended. It de-risks the entire project.
- **"How long does it take?"** - 1-2 weeks for one developer.
- **"What if I find issues?"** - Perfect! That's the point. Fix them now while it's easy.
- **"Can I skip to Phase 1?"** - You could, but you'll likely regret it when debugging complex issues.

---

## The Bottom Line

**Phase 0 is about proving the foundation works.**

Once you can load, display, and interact with a hand-written component, you'll have:
- ✅ Validated the architecture
- ✅ Proven the technical approach
- ✅ Built confidence in the system
- ✅ Created a solid foundation for AI generation

**Then** you add the Interface Designer and let AI generate components, knowing the runtime is solid.

---

**Document Purpose**: Quick start guide for Phase 0  
**Audience**: Developers starting implementation  
**Status**: Ready to begin  
**Date**: January 5, 2025

