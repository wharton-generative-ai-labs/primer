# Component Validation Improvements

**Status**: ✅ IMPLEMENTED (2026-01-12)

See [component-validation-enhancement.md](./component-validation-enhancement.md) for full implementation details.

## Quick Summary

Enhanced validation now catches 20+ runtime issues before deployment:
- ✅ External library imports (THREE, math, _, Recharts)
- ✅ Direct state mutations
- ✅ Missing animation frame cleanup
- ✅ Three.js resource disposal
- ✅ Library availability checks
- ✅ Memory leaks (event listeners)
- ✅ Performance anti-patterns
- ✅ Security violations
- ✅ Syntax errors
- ✅ React hook typos

## Original Issues Found

### BouncingBall3D Component

### 1. **Import Statement Error**
**Problem**: Component used `import * as THREE from 'three'` which doesn't work in the CDN-based runtime environment.

**Fix**: Access Three.js via `window.THREE` instead.

**Validation Check Needed**:
- Detect ES6 imports of external libraries (THREE, math, _, Recharts)
- Warn that these should be accessed via global window object
- Check for: `import.*from ['"]three['"]`, `import.*from ['"]mathjs['"]`, etc.

### 2. **State Mutation in Render Loop**
**Problem**: The animation loop directly mutated the state object instead of using local variables.

**Fix**: Use local variables within the animation loop for physics calculations.

**Validation Check Needed**:
- Detect direct property assignments to `state` object outside of `setState`
- Look for patterns like `state.property =` in code
- This is a common React anti-pattern

### 3. **Infinite Re-render Loop**
**Problem**: `useEffect` dependency array included `[state]`, causing the entire Three.js scene to be recreated on every state change.

**Fix**: Use empty dependency array `[]` for Three.js initialization and manage animation state locally.

**Validation Check Needed**:
- Detect expensive operations (THREE, canvas, WebGL) in useEffect with state dependencies
- Warn about potential re-render performance issues
- Suggest using refs for animation state

### 4. **Memory Leaks**
**Problem**: Multiple animation loops and renderer instances could be created without proper cleanup.

**Fix**: Store animation frame ID in a ref and properly cancel it in cleanup.

**Validation Check Needed**:
- Ensure `requestAnimationFrame` calls are paired with `cancelAnimationFrame` in cleanup
- Verify Three.js resources are disposed (geometries, materials, renderer)
- Check that DOM elements are properly removed

### 5. **Missing Error Handling**
**Problem**: No check for `window.THREE` existence before usage.

**Fix**: Add early return if `window.THREE` is not available.

**Validation Check Needed**:
- Verify external library availability checks (window.THREE, window._, etc.)
- Ensure graceful degradation or error messages

## Recommended Validation Enhancements

### Pre-Deployment Static Analysis

Add these checks to `validateComponent` tool:

```javascript
// 1. External Library Import Detection
const importRegex = /import\s+.*\s+from\s+['"](?:three|mathjs|lodash|recharts)['"]/gi;
if (importRegex.test(code)) {
  errors.push({
    type: 'import-error',
    message: 'External libraries (THREE, math, _, Recharts) should be accessed via window object, not imported',
    suggestion: 'Use window.THREE instead of importing three'
  });
}

// 2. State Mutation Detection
const stateMutationRegex = /state\.\w+\s*=/g;
if (stateMutationRegex.test(code)) {
  warnings.push({
    type: 'state-mutation',
    message: 'Direct state mutation detected. Use setState instead',
    suggestion: 'Replace state.property = value with setState(prev => ({ ...prev, property: value }))'
  });
}

// 3. Animation Frame Cleanup
if (code.includes('requestAnimationFrame') && !code.includes('cancelAnimationFrame')) {
  warnings.push({
    type: 'missing-cleanup',
    message: 'requestAnimationFrame used without cancelAnimationFrame in cleanup',
    suggestion: 'Store animation ID in ref and cancel in useEffect cleanup'
  });
}

// 4. Three.js Resource Disposal
if (code.includes('THREE.') || code.includes('window.THREE')) {
  const hasDispose = code.includes('.dispose()');
  if (!hasDispose) {
    warnings.push({
      type: 'memory-leak',
      message: 'Three.js resources should be disposed in cleanup',
      suggestion: 'Call dispose() on geometries, materials, and renderer in useEffect cleanup'
    });
  }
}

// 5. External Library Availability Check
const externalLibs = ['THREE', 'math', '_', 'Recharts'];
externalLibs.forEach(lib => {
  if (code.includes(`window.${lib}`) || code.includes(`${lib}.`)) {
    const hasCheck = code.includes(`window.${lib}`) && code.includes('if') || code.includes('return');
    if (!hasCheck) {
      warnings.push({
        type: 'missing-library-check',
        message: `No check for window.${lib} availability`,
        suggestion: `Add: if (!window.${lib}) return;`
      });
    }
  }
});
```

### Runtime Validation

Add these checks for actual rendering tests:

```javascript
// 1. Console Error Detection
const originalError = console.error;
const errors = [];
console.error = (...args) => {
  errors.push(args.join(' '));
  originalError(...args);
};

// Render component...

// Check for React errors
if (errors.some(e => e.includes('Warning:') || e.includes('Error:'))) {
  return {
    valid: false,
    errors: errors
  };
}

// 2. DOM Exception Detection
try {
  // Render component in test container
  // Wait for effects to run
  await new Promise(resolve => setTimeout(resolve, 100));
} catch (error) {
  return {
    valid: false,
    error: error.message
  };
}

// 3. Memory Leak Detection
const before = performance.memory?.usedJSHeapSize;
// Render and unmount multiple times
for (let i = 0; i < 10; i++) {
  // Render and unmount
}
const after = performance.memory?.usedJSHeapSize;
if (after - before > 10_000_000) { // 10MB threshold
  warnings.push({
    type: 'memory-leak',
    message: 'Potential memory leak detected in repeated mount/unmount cycles'
  });
}
```

## Validation Workflow Update

Current flow:
1. Validate syntax ✓
2. Deploy component

Improved flow:
1. Validate syntax ✓
2. **Static analysis checks** (new)
3. **Runtime rendering test** (new)
4. **Check for console errors** (new)
5. Deploy component

## Interface Designer Agent Updates

Add to the validation section:

```markdown
### Enhanced Validation

Before deploying, the validation checks for:

**Static Analysis**:
- ✓ No ES6 imports of external libraries (use window.X instead)
- ✓ No direct state mutations (use setState)
- ✓ Animation frames properly cleaned up
- ✓ Three.js resources disposed
- ✓ External library availability checks

**Runtime Tests**:
- ✓ Component renders without errors
- ✓ No console warnings or errors
- ✓ No memory leaks in mount/unmount cycles
- ✓ Props correctly handled

If validation fails with warnings, you can:
- Fix critical errors (imports, state mutations)
- Document warnings in deployment message
- Proceed if warnings are acceptable
```

## Common Patterns to Watch

### ❌ Bad: External Library Imports
```jsx
import * as THREE from 'three';
```

### ✅ Good: Window Object Access
```jsx
// Check availability
if (!window.THREE) return null;
const THREE = window.THREE;
```

### ❌ Bad: State Mutation
```jsx
state.position.y = 10;
```

### ✅ Good: setState Usage
```jsx
setState(prev => ({
  ...prev,
  position: { ...prev.position, y: 10 }
}));
```

### ❌ Bad: No Animation Cleanup
```jsx
requestAnimationFrame(animate);
```

### ✅ Good: Proper Cleanup
```jsx
const animationId = useRef(null);
animationId.current = requestAnimationFrame(animate);
return () => cancelAnimationFrame(animationId.current);
```

### ❌ Bad: State in Animation Dependencies
```jsx
useEffect(() => {
  // Three.js setup
  animate();
}, [state]); // Will recreate scene on every state change!
```

### ✅ Good: Empty Dependencies
```jsx
useEffect(() => {
  // Three.js setup - only once
  let localPosition = { x: 0, y: 10, z: 0 };
  animate();
}, []); // Only run once
```

## Testing Recommendations

Create a test suite that validates components against these patterns:

1. **Import Test**: Ensure no CDN library imports
2. **State Mutation Test**: Detect direct state assignments
3. **Cleanup Test**: Verify cleanup functions cancel animations
4. **Memory Test**: Mount/unmount 10 times, check heap size
5. **Error Test**: Render and check for console errors
6. **Library Test**: Verify external library checks exist

## Implementation Priority

1. **High Priority** (breaks component):
   - External library import detection
   - State mutation detection
   - Missing library availability checks

2. **Medium Priority** (causes issues):
   - Animation frame cleanup
   - Memory leak detection
   - Re-render loop detection

3. **Low Priority** (best practices):
   - Three.js resource disposal
   - Performance optimization suggestions
   - Accessibility checks
