# Educational AI-Generated UI Component System - Architecture Summary

## Project Overview
Building an educational platform where AI (Claude Sonnet 4.5) generates interactive React components for students, based on educator specifications. Components demonstrate concepts through visualizations, simulations, and interactive exercises.

## Core Workflow
```
Educator Interview with AI → 
Generate JSX Component + Config → 
Static AI Validation → 
Educator Approval → 
Store as "Experience" → 
Students Execute Pre-Vetted Component
```

## Available Libraries (from Claude Artifacts System)
The AI has access to these pre-loaded libraries when generating components:

**UI & Icons:**
- React (with hooks: useState, useEffect, useReducer, etc.)
- Tailwind CSS (core utility classes only, no JIT)
- shadcn/ui components
- Lucide React icons

**Visualization:**
- Recharts (charting)
- D3.js (data visualization)
- Plotly (interactive graphs)
- Chart.js (charting)

**3D Graphics:**
- Three.js (r128) - Note: newer features like CapsuleGeometry unavailable

**Data Processing:**
- Papaparse (CSV)
- SheetJS/XLSX (Excel)
- Mammoth (Word docs)

**Utilities:**
- Lodash
- MathJS
- TensorFlow.js
- Tone.js (audio)

**Critical Constraints:**
- No localStorage/sessionStorage (must use React state)
- No npm installs beyond pre-loaded libraries
- External scripts only from cdnjs.cloudflare.com
- Single-file, self-contained components

## Component Execution Strategy Options

### Option 1: react-runner
**Description:** Lightweight transpiler using Sucrase

**Pros:**
- Fast (~50KB)
- Simple API
- Good for trusted code sources

**Cons:**
- Less feature-complete than Babel
- No built-in sandboxing
- Less actively maintained

**Best for:** Quick MVP, when speed matters

---

### Option 2: react-live
**Description:** Live editing focused, uses Bublé transpiler

**Pros:**
- Built-in editor UI
- Good error boundaries
- Popular in docs sites

**Cons:**
- Limited ES6+ support
- Opinionated about UI
- Not true sandboxing

**Best for:** If students will edit/modify generated code

---

### Option 3: Babel Standalone + new Function()
**Description:** Full Babel in browser

**Pros:**
- Complete JavaScript support
- Maximum flexibility
- Can add custom validation plugins

**Cons:**
- Large bundle (800KB - 1.5MB)
- Slower transpilation
- Requires separate sandboxing

**Best for:** Need full ES6+ features or code transformation

---

### Option 4: Sandpack (by CodeSandbox)
**Description:** Full in-browser bundler with iframe isolation

**Pros:**
- TRUE sandboxing with CSP
- Can install npm packages dynamically
- Battle-tested security
- Hot module reloading

**Cons:**
- Heavy (~300KB+)
- Complex setup
- Overkill for single components

**Best for:** Maximum security, expanding beyond fixed libraries

---

### Option 5: Custom Lightweight Runner (RECOMMENDED)
**Description:** Custom solution using Babel Standalone with controlled scope injection

**Why Recommended:**
- Full control over scope/data contracts
- Smaller bundle than full solutions
- Extensible for educational features
- You understand the execution flow
- Security adequate given validation pipeline

**Implementation sketch:**
```javascript
import * as Babel from '@babel/standalone';

class ExperienceRunner {
  constructor(jsxCode, config) {
    this.jsxCode = jsxCode;
    this.config = config;
    this.scope = this.buildScope();
  }

  buildScope() {
    return {
      React, useState, useEffect,
      THREE, Recharts, // ... libraries
      // Custom hooks for data transfer
      useExperienceData: () => ({
        initialState: this.config.initialData,
        submitAnswer: this.handleSubmit.bind(this),
        trackProgress: this.trackProgress.bind(this)
      })
    };
  }

  compile() {
    const transformed = Babel.transform(this.jsxCode, {
      presets: ['react']
    }).code;

    const scopeKeys = Object.keys(this.scope);
    const scopeValues = Object.values(this.scope);
    
    const componentFactory = new Function(
      ...scopeKeys,
      `${transformed}; return Component;`
    );

    return componentFactory(...scopeValues);
  }
}
```

## Data Transfer Patterns

### Pattern A: Props-Based (Cleanest)
```javascript
<DynamicComponent 
  initialState={config.initialData}
  onSubmit={(data) => saveToGradebook(data)}
/>
```

### Pattern B: Context-Based (More Flexible)
```javascript
<ExperienceContext.Provider value={{ initialData, submitData }}>
  <DynamicComponent />
</ExperienceContext.Provider>
```

### Pattern C: Custom Hooks (Most Elegant) ⭐
```javascript
// Provided in scope to generated components
const useExperienceData = () => ({
  initialState: /* from config */,
  submit: (data) => /* save to backend */,
  trackEvent: (event) => /* analytics */
});

// AI generates components using it:
const Component = () => {
  const { initialState, submit } = useExperienceData();
  // component implementation
};
```

## Security & Validation

### Why Security is Less Critical Here:
1. Trusted source (Claude API)
2. Human-in-the-loop (educator approval)
3. Static analysis pass before student access
4. No arbitrary user code execution
5. Pre-vetted component library

### Static Analysis Pipeline
```javascript
const validationPrompt = `
Analyze this React component for educational use:
${generatedJSX}

Check for:
1. No network requests (fetch, axios, XHR)
2. No localStorage/sessionStorage
3. No dangerous eval() or Function() calls
4. Only approved libraries: ${approvedLibs}
5. Age-appropriate content for ${gradeLevel}
6. No infinite loops or excessive computation
7. Proper use of data contracts

Return JSON: {
  safe: boolean,
  issues: string[],
  suggestions: string[]
}
`;

const validation = await claudeAPI(validationPrompt);
```

## Experience Data Schema

```javascript
{
  id: "experience-uuid",
  title: "Solar System Orbital Mechanics",
  subject: "physics",
  gradeLevel: 6,
  
  component: {
    jsx: "/* AI-generated JSX code */",
    libraries: ["react", "three", "mathjs"],
    validated: true,
    validatedAt: "2024-01-04T10:30:00Z",
    validator: "claude-sonnet-4.5"
  },
  
  configuration: {
    initialData: {
      // Data passed to component
      planetData: [...],
      simulationSpeed: 1
    },
    dataContract: {
      inputs: ["planetData", "simulationSpeed"],
      outputs: ["userAnswers", "simulationEvents"]
    }
  },
  
  assessment: {
    rubric: {...},
    questions: [...],
    gradingCriteria: {...}
  },
  
  metadata: {
    createdBy: "educator-id",
    approvedBy: "educator-id",
    estimatedDuration: "20min",
    version: "1.0.0"
  }
}
```

## Example AI Generation Prompts

### For Educator Interview:
```
You are helping an educator create an interactive educational component.
Available libraries: React, Three.js, Recharts, MathJS, [full list]

Generate a self-contained React component that:
- Uses only the available libraries listed above
- Exports a default component with no required props
- Uses useState/useEffect for state management (NO localStorage)
- Includes the useExperienceData() hook for data transfer:
  const { initialState, submit, trackEvent } = useExperienceData();

The component should teach: [educator's topic]
Target grade level: [grade]
Learning objectives: [objectives]
```

### For Static Validation:
```
Analyze this educational React component for safety and appropriateness:

[generated JSX code]

Validation checklist:
- Security: no network calls, no storage APIs, no eval
- Libraries: only uses approved set
- Performance: no infinite loops, reasonable computation
- Content: age-appropriate for grade [X]
- Data contract: properly uses useExperienceData hook

Return structured analysis with pass/fail and specific issues.
```

## Additional Considerations

### Versioning & Iteration
- Store multiple versions of experiences
- Track which versions perform better educationally
- Allow educators to fork/remix experiences

### Caching & Performance
- Pre-compile components after validation
- Store compiled versions for faster student loading
- Consider service worker caching for offline use

### Progressive Enhancement Tiers
- Tier 1: Simple HTML/CSS (fallback)
- Tier 2: React interactive components
- Tier 3: Advanced 3D/simulations (device-dependent)

### Analytics Integration
- Track student interaction events
- Measure time-on-task
- Identify where students struggle
- A/B test different component approaches

## Implementation Phases

### Phase 1: MVP
- Custom lightweight runner with Babel Standalone
- Basic prop-based data transfer
- Manual educator approval (no AI validation yet)
- Core library set (React, Recharts, MathJS)

### Phase 2: Enhanced
- Add AI validation pipeline
- Implement useExperienceData hook pattern
- Expand library set (Three.js, Plotly)
- Version control for experiences

### Phase 3: Production
- Consider iframe sandboxing if needed
- Full analytics integration
- Experience marketplace for educators
- Offline support

## Key Decision Points

1. **Execution Strategy**: Custom lightweight runner recommended for balance of control, performance, and simplicity

2. **Data Transfer**: Custom hooks pattern (useExperienceData) provides cleanest API for generated components

3. **Validation**: Two-stage (AI + human) adequate given trusted source; full sandboxing optional

4. **Storage**: Experience-as-config approach enables versioning, sharing, and offline use

5. **Library Set**: Start with core set, expand based on educator needs