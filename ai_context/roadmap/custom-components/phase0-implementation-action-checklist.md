# Phase 0: Implementation Action Checklist

## Core Technology (Code to Write)

### 1. CustomComponentManager
**Location**: `src/app/lib/tools/ui/components/ComponentManager.tsx`
- [ ] Create class with methods: `loadComponent`, `compileComponent`, `buildScope`, `showComponent`, `updateComponentState`, `getComponentState`, `hideComponent`
- [ ] Import all shadcn/ui components at top of file
- [ ] Implement Babel compilation with import stripping
- [ ] Add performance monitoring and rate limiting
- **Reference**: `phase0-runtime-validation.md` - Day 1-2 section

### 2. Type Definitions
**Location**: `src/app/lib/tools/ui/components/types.ts`
- [ ] Define `PrimerComponentProps`, `ComponentEvent`, `ComponentStateChangeEvent` interfaces

**Location**: `src/app/lib/tools/types.ts`
- [ ] Add `onComponentEvent` and `onComponentStateChange` to `ToolContext`

**Reference**: `phase0-runtime-validation.md` - Day 3 section

### 3. Custom Component Tool
**Location**: `src/app/lib/tools/ui/custom-component.ts`
- [ ] Implement tool function with actions: show, hide, updateState, getState, list

**Location**: `src/app/lib/tools/ui/index.ts`
- [ ] Create `registerCustomComponentTools()` and export

**Location**: `src/app/lib/tools/groups.ts`
- [ ] Add `'custom-component': ['customComponent']` to TOOL_GROUPS

**Reference**: `phase0-runtime-validation.md` - Day 4 section

### 4. Component Display
**Location**: `src/app/components/CustomComponents.tsx`
- [ ] Create display component with per-component error boundaries
- [ ] Add ComponentError fallback UI with retry/dismiss

**Location**: `src/app/play/[id]/page.tsx` (or appropriate PlayPage file)
- [ ] Import and add `<CustomComponents />` to render tree

**Reference**: `phase0-runtime-validation.md` - Day 5 section

### 5. API Endpoint
**Location**: `src/app/api/experiences/[experienceId]/components/[componentId]/route.ts`
- [ ] Create GET handler that reads `.jsx` files from `storage/{experienceId}/resources/components/`
- [ ] Return `{ code, metadata }` as JSON

**Reference**: `phase0-runtime-validation.md` - Day 1 (Week 2) section

### 6. CDN Scripts & CSP
**Location**: `src/app/play/[id]/page.tsx` or layout
- [ ] Add conditional loading for MathJS, Recharts, Lodash, Lucide CDN scripts

**Location**: `next.config.ts`
- [ ] Update CSP to allow `'unsafe-eval'` and cdnjs.cloudflare.com

**Reference**: `phase0-runtime-validation.md` - Day 2 (Week 2) section

### 7. Dependencies
**Location**: `package.json`
- [ ] Add `@babel/standalone` and `babel-plugin-transform-remove-imports`
- [ ] Run `npm install`

**Reference**: `phase0-runtime-validation.md` - Day 1 dependencies section

---

## Demo Experience Setup (Files to Create)

### 8. Create Demo Experience Directory
```bash
mkdir -p storage/component-demo/resources/components
mkdir -p storage/component-demo/resources/instructions/agent
```

### 9. Copy Component Code
**Source**: `phase0-reference-implementation/trig-triangle.jsx`  
**Destination**: `storage/component-demo/resources/components/trig-triangle.jsx`
- [ ] Copy complete component file as-is

### 10. Copy Agent Instructions
**Source**: `phase0-reference-implementation/demo-agent-instructions.md`  
**Destination**: `storage/component-demo/resources/instructions/agent/demo-agent.md`
- [ ] Copy complete agent prompt as-is

### 11. Copy Experience Configuration
**Source**: `phase0-reference-implementation/experience.json`  
**Destination**: `storage/component-demo/experience.json`
- [ ] Copy complete configuration as-is

---

## Testing & Validation

### 12. Manual Testing
- [ ] Start Primer: `npm run dev`
- [ ] Navigate to: `http://localhost:3000/play/component-demo`
- [ ] Follow test sequence in `phase0-reference-implementation/README.md`
- [ ] Verify all items in "Testing Checklist" section of `phase0-runtime-validation.md`

**Reference**: `phase0-runtime-validation.md` - Week 2, Day 5 section

### 13. Success Criteria
- [ ] Validate all items in "Success Criteria" section

**Reference**: `phase0-runtime-validation.md` - Success Criteria section

---

## Quick Reference Documents

- **Complete Spec**: `phase0-runtime-validation.md`
- **Quick Overview**: `PHASE0-SUMMARY.md`
- **Reference Code**: `phase0-reference-implementation/` folder
- **Installation Guide**: `phase0-reference-implementation/README.md`

---

**Total Estimated Time**: 1-2 weeks (1 developer)

