# THREE.js Component Sizing Fix

**Date:** 2026-01-12  
**Issue:** THREE.js components showing duplicate renders (two copies)  
**Status:** Fixed

## Problem

THREE.js components were appearing to render twice - one static copy and one animated copy directly below it. This was caused by a mismatch between component sizing and the ComponentWrapper's auto-sizing logic.

### Root Cause

1. **ComponentWrapper** displays components at 70% viewport size initially
2. After 300ms, it measures content and auto-resizes to fit
3. THREE.js components using `window.innerWidth/innerHeight` or fixed dimensions created a size mismatch
4. This triggered the auto-sizing animation, creating a visual "duplicate" effect

## Solution

### 1. ComponentWrapper: Skip Auto-Sizing for Canvas Components

Updated `ComponentWrapper.tsx` to detect canvas elements and skip auto-sizing:

```typescript
// Check if content contains a canvas element (THREE.js, etc.)
// These components should always fill their container, not trigger auto-sizing
const hasCanvas = contentRef.current.querySelector('canvas');
if (hasCanvas) {
  setHasAutoSized(true); // Skip auto-sizing for canvas components
  return;
}
```

**Why:** Canvas-based components (THREE.js, HTML5 Canvas, etc.) should always fill their available container space. Auto-sizing creates visual glitches as the canvas appears to duplicate during the resize animation.

### 2. Component Best Practices: Use Container Dimensions

Updated all THREE.js components to use container dimensions instead of window or fixed sizes:

**Before (❌ Wrong):**
```javascript
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
```

**After (✅ Correct):**
```javascript
// Wait for container to have dimensions
if (!mountRef.current) return;
const width = mountRef.current.clientWidth;
const height = mountRef.current.clientHeight;
if (width === 0 || height === 0) return;

const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

// Size renderer to container, not window
renderer.setSize(width, height);
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
```

### 3. Documentation Updates

Updated multiple documentation files with sizing best practices:

#### `docs/threejs-addons-implementation.md`
- Added "Key Sizing Rules for THREE.js Components" section
- Updated all examples to use container dimensions
- Added DO/DON'T guidelines

#### `ai_context/changes/component-wrapper-auto-sizing.md`
- Added "Canvas Component Handling" section
- Documented the canvas detection logic
- Added best practices for canvas components

#### `storage/deckard/resources/instructions/agent/interface-designer.md`
- Added "THREE.js Sizing Best Practices" section
- Provided correct and incorrect examples
- Explained wrapper sizing constraints

## Files Modified

1. ✅ `src/app/lib/tools/ui/components/ComponentWrapper.tsx`
   - Added canvas detection in auto-sizing effect
   - Prevents auto-sizing for canvas-based components

2. ✅ `storage/deckard/resources/components/solar-system.jsx`
   - Changed from `window.innerWidth/innerHeight` to container dimensions
   - Added dimension validation before initialization
   - Added canvas styling to fill container

3. ✅ `docs/threejs-addons-implementation.md`
   - Added sizing best practices section
   - Updated all code examples

4. ✅ `ai_context/changes/component-wrapper-auto-sizing.md`
   - Documented canvas handling behavior
   - Added best practices

5. ✅ `storage/deckard/resources/instructions/agent/interface-designer.md`
   - Added THREE.js sizing guidelines for agent

6. ✅ `docs/threejs-component-sizing.md` (this file)
   - Comprehensive documentation of the fix

## Component Sizing Rules

### For THREE.js and Canvas Components

**✅ DO:**
- Use `mountRef.current.clientWidth` and `clientHeight` for dimensions
- Set canvas to fill container: `style.width = '100%'` and `style.height = '100%'`
- Use `className="w-full h-full"` on the mount div
- Wait for container to have dimensions before initializing (check for 0)
- Handle async loading of THREE.js library

**❌ DON'T:**
- Use `window.innerWidth` or `window.innerHeight`
- Use fixed dimensions like `800x600`
- Initialize before container has dimensions
- Assume THREE.js is immediately available

### Container Sizing

The ComponentWrapper provides:
- **Initial size:** 70% of viewport
- **Minimum:** 600×500px
- **Maximum:** 1200×900px
- **User resizable:** Yes, via drag handle

Canvas components should adapt to whatever size the wrapper provides.

## Testing

To verify the fix works:

1. Load an experience with a THREE.js component (e.g., solar-system)
2. Component should appear once at initial size
3. No "duplicate" or "ghost" copy should appear
4. Canvas should fill the entire wrapper container
5. Resizing the wrapper should work smoothly

## Impact

**Before:**
- ❌ Visual duplication of THREE.js components
- ❌ Confusing user experience
- ❌ Canvas sizing mismatch with wrapper
- ❌ Unnecessary auto-sizing animations

**After:**
- ✅ Single, clean render of THREE.js components
- ✅ Canvas fills available space
- ✅ No auto-sizing for canvas components
- ✅ Smooth, professional appearance
- ✅ Clear documentation for future components

## Future Considerations

1. **Resize handling:** Consider adding resize observer to update THREE.js camera/renderer when wrapper is manually resized
2. **Other canvas libraries:** The canvas detection will work for any canvas-based library (Chart.js, p5.js, etc.)
3. **Component hints:** Could add metadata to components to indicate they should skip auto-sizing
4. **Performance:** Canvas detection is fast (single querySelector) and only runs once per component

## Related Issues

This fix addresses the user's concern: "for THREE components there are still two copies - one that never animates, and one direct below that does."

The root cause was the interaction between:
1. ComponentWrapper's auto-sizing logic (designed for static content)
2. THREE.js components using incorrect dimensions (window size instead of container)

Both issues needed to be addressed for a complete fix.
