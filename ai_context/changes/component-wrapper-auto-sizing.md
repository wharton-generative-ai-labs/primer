# Component Wrapper Auto-Sizing Enhancement

**Date:** 2025-01-07  
**Status:** Complete

## Overview

Enhanced the `ComponentWrapper` to intelligently auto-size based on actual content dimensions, providing a better initial display for custom components without requiring scrollbars or manual resizing.

## Problem

Custom components were initially displayed with a hardcoded size of 600×500px, which was often too small for the actual content:

- **Trigonometry component**: SVG triangle diagram was squeezed
- **Chemistry molecule**: 500px height 3D canvas was partially hidden
- **Cell biology**: 800×600px SVG diagram required scrolling
- **Physics simulation**: 500px 3D canvas + controls didn't fit well

Users had to either scroll within the component or manually resize the wrapper to see all content.

## Solution

Implemented a two-phase sizing approach with smooth animations:

### Phase 1: Initial Display (70% viewport)
```typescript
const targetWidth = Math.min(Math.round(viewportWidth * 0.7), 1200);
const targetHeight = Math.min(Math.round(viewportHeight * 0.7), 900);
```

- Components start at 70% of viewport dimensions
- Max initial size: 1200×900px
- Min initial size: 600×500px
- Provides immediate visual feedback

### Phase 2: Auto-Size to Content (after 300ms)
```typescript
// Measure actual content dimensions
const scrollWidth = contentElement.scrollWidth;
const scrollHeight = contentElement.scrollHeight;

// Calculate target with padding
const contentWidth = scrollWidth + PADDING;
const contentHeight = scrollHeight + HEADER_HEIGHT + PADDING;

// Respect viewport limits (up to 85%)
const targetWidth = Math.min(Math.max(contentWidth, 400), maxWidth);
const targetHeight = Math.min(Math.max(contentHeight, 300), maxHeight);
```

After content renders:
1. Measures actual `scrollWidth` and `scrollHeight` of content
2. Adds padding (32px) for breathing room and header (40px)
3. Respects viewport limits (up to 85% to avoid covering entire screen)
4. Only resizes if change is significant (>50px difference)
5. **Smoothly animates** to new size using framer-motion

## Key Features

### Smart Sizing Algorithm
- **Content-aware**: Measures actual rendered content dimensions
- **Viewport-aware**: Never exceeds 85% of viewport
- **Minimum sizes**: At least 400×300px for usability
- **Threshold-based**: Only resizes if difference is meaningful (>50px)

### Smooth Animation
```typescript
transition={{ 
  duration: 0.2,
  width: { duration: 0.3, ease: 'easeInOut' },
  height: { duration: 0.3, ease: 'easeInOut' },
  left: { duration: 0.3, ease: 'easeInOut' },
  top: { duration: 0.3, ease: 'easeInOut' },
}}
```

- 300ms smooth easing for size changes
- Component stays centered during resize
- No jarring jumps or flashes

### Timing
- **300ms delay** before measuring content
- Allows async content (Three.js canvases, etc.) to fully render
- Prevents premature measurements of empty content

## Technical Implementation

### New State & Refs
```typescript
const [hasAutoSized, setHasAutoSized] = useState(false);
const contentRef = useRef<HTMLDivElement>(null);
```

### Auto-Sizing Effect
```typescript
useEffect(() => {
  if (hasAutoSized || !contentRef.current) return;
  
  const timer = setTimeout(() => {
    // Measure content, calculate target, animate resize
    setSize({ width: targetWidth, height: targetHeight });
    setHasAutoSized(true);
  }, 300);
  
  return () => clearTimeout(timer);
}, [hasAutoSized, size.width, size.height]);
```

### Animated Positioning
Moved size and position into framer-motion's `animate` prop so changes are smoothly animated:
```typescript
animate={{ 
  opacity: 1, 
  scale: 1,
  width: size.width,
  height: size.height,
  left: position.x - size.width / 2,
  top: position.y - size.height / 2,
}}
```

## Benefits

1. **Better UX**: Components display at optimal size without user intervention
2. **No scrollbars**: Content visible without scrolling (unless truly needed)
3. **Polished feel**: Smooth animation feels intentional and refined
4. **Respects viewport**: Never creates unusably large windows
5. **Works for all components**: Generic solution that benefits all custom components

## User Experience Flow

1. User triggers custom component display
2. Component appears instantly at 70% viewport size (fast feedback)
3. Content renders (including async elements like Three.js)
4. After 300ms, wrapper smoothly animates to fit content
5. User sees optimally-sized component without manual adjustment

## Canvas Component Handling

**Date:** 2026-01-12  
**Update:** Added special handling for THREE.js and canvas-based components

### Problem
Canvas-based components (THREE.js, etc.) were showing "two copies":
1. Initial render at 70% viewport size
2. Auto-sized version after 300ms delay

This created a visual glitch where the canvas would appear to duplicate briefly.

### Solution
Auto-sizing is now disabled for components containing `<canvas>` elements:

```typescript
// Check if content contains a canvas element (THREE.js, etc.)
// These components should always fill their container, not trigger auto-sizing
const hasCanvas = contentRef.current.querySelector('canvas');
if (hasCanvas) {
  setHasAutoSized(true); // Skip auto-sizing for canvas components
  return;
}
```

### Canvas Component Best Practices

For THREE.js and canvas components, **always make them fill their container**:

```javascript
// ✅ CORRECT: Fill container dimensions
useEffect(() => {
  if (!mountRef.current) return;
  
  const width = mountRef.current.clientWidth;
  const height = mountRef.current.clientHeight;
  
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(width, height);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  
  mountRef.current.appendChild(renderer.domElement);
}, []);

return <div ref={mountRef} className="w-full h-full" />;
```

```javascript
// ❌ WRONG: Fixed dimensions or window size
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight); // Don't use window size!
renderer.setSize(800, 600); // Don't use fixed size!
```

The wrapper provides a container at 70% viewport size (min 600×500px, max 1200×900px). Canvas components should fill this space completely.

## Future Enhancements

Possible improvements:
- Per-component size hints (allow components to suggest initial size)
- Remember user's manual resizes per component ID
- Handle dynamic content changes (re-measure if content updates)
- Add "maximize" and "restore" buttons to header
- Handle canvas resize events when wrapper is manually resized

## Files Modified

- `src/app/lib/tools/ui/components/ComponentWrapper.tsx` (major changes)
  - Added `calculateInitialSize()` function
  - Added auto-sizing effect with content measurement
  - Updated framer-motion animation to include size/position
  - Added `contentRef` to measure rendered content dimensions
  - Added canvas detection to skip auto-sizing for THREE.js components (2026-01-12)

