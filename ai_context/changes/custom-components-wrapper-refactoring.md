# Custom Components Wrapper Refactoring

**Date:** 2025-01-06  
**Status:** Complete

## Overview

Refactored the custom components system to give `CustomComponents.tsx` authority over component presentation, making them behave like slides/scenes with draggable and resizable containers.

## Problem

Previously, custom components (like `trig-triangle.jsx`) were responsible for their own positioning:
- Components used `fixed inset-0` positioning and centering
- Each component had to manage its own layout
- No consistent way to move or resize components
- Components couldn't be easily repositioned by users

## Solution

Implemented a wrapper-based architecture similar to the existing `SlideComponent`:

### 1. Created ComponentWrapper (`src/app/lib/tools/ui/components/ComponentWrapper.tsx`)

A new wrapper component that provides:
- **Draggable positioning** - Click and drag to move anywhere on screen
- **Resizable dimensions** - Drag bottom-right corner to resize
- **Z-index management** - Click to bring to front
- **Header bar** - Shows component ID and close button
- **Animation** - Fade in/scale on mount/unmount
- **Smart drag handling** - Doesn't interfere with component's interactive elements (buttons, inputs, etc.)

Key features:
```typescript
- Initial size: 600x500px (configurable)
- Min size: 300x200px
- Centered on screen by default
- Smooth animations via framer-motion
- Semi-transparent backdrop (bg-white/95)
```

### 2. Updated CustomComponents.tsx

Changed from rendering components directly to wrapping them:

**Before:**
```tsx
<ComponentErrorBoundary>
  <Component {...instance.props} />
</ComponentErrorBoundary>
```

**After:**
```tsx
<ComponentWrapper instance={instance} onClose={...}>
  <ComponentErrorBoundary>
    <Component {...instance.props} />
  </ComponentErrorBoundary>
</ComponentWrapper>
```

Benefits:
- Consistent presentation across all custom components
- Error UI now appears within the wrapper (not as full-screen overlay)
- Close button moved to wrapper header

### 3. Updated trig-triangle.jsx

Removed component's self-positioning:

**Before:**
```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
  <div className="pointer-events-auto">
    <Card className="w-[500px] max-h-[600px] overflow-auto shadow-2xl">
```

**After:**
```jsx
<div className="w-full h-full flex items-center justify-center p-4">
  <Card className="w-full max-w-[500px] max-h-full overflow-auto">
```

Changes:
- Removed fixed positioning - now fills wrapper
- Uses full width/height of wrapper container
- Maintains max-width constraint for readability
- Adapts to wrapper's resizing

## Architecture

### Component Hierarchy

```
PlayPageContent
  └─ CustomComponents (manages instances)
      └─ ComponentWrapper (provides container, drag, resize)
          └─ ComponentErrorBoundary (catches errors)
              └─ UserComponent (e.g., TrigTriangle)
```

### Positioning Strategy

Like slides and other overlays:
- Uses `position: fixed` in wrapper
- Centers on screen initially
- User can drag to any position
- User can resize to any dimensions (with min constraints)
- Z-index increments when clicked

### Pattern Consistency

Now matches existing UI patterns:
- **Slides** - Draggable/resizable markdown content
- **Notes** - Draggable/resizable sticky notes  
- **Mermaid** - Draggable diagrams
- **Custom Components** - Draggable/resizable interactive components ✅

## User Experience

### Before
- Components appeared at fixed positions
- No way to move or resize
- Could overlap with other content
- Each component controlled its own appearance

### After
- Components appear centered and movable
- Click and drag header to reposition
- Drag corner handle to resize
- Click anywhere to bring to front
- Consistent header with component ID and close button
- Components adapt to available space
- Better integration with other overlays (slides, scenes, notes)

## Technical Details

### Event Handling
- Wrapper prevents drag from starting on interactive elements (inputs, buttons)
- Component content has `pointer-events: none` during drag
- Resize handle has higher z-index to stay clickable

### Animation
```typescript
initial={{ opacity: 0, scale: 0.95 }}
animate={{ opacity: 1, scale: 1 }}
exit={{ opacity: 0, scale: 0.95 }}
transition={{ duration: 0.2 }}
```

### Styling
- Semi-transparent white background: `bg-white/95 backdrop-blur-sm`
- Subtle shadow: `shadow-2xl`
- Rounded corners: `rounded-lg`
- Header separator: `border-b border-gray-200`

## Files Changed

1. **Created:** `src/app/lib/tools/ui/components/ComponentWrapper.tsx`
   - New wrapper component with drag/resize/z-index logic

2. **Modified:** `src/app/components/CustomComponents.tsx`
   - Import ComponentWrapper
   - Wrap instances in ComponentWrapper
   - Update error UI to work within wrapper

3. **Modified:** `storage/component-demo/resources/components/trig-triangle.jsx`
   - Remove fixed positioning
   - Use full wrapper space
   - Adapt to container dimensions

## Testing

To test:
1. Load the component-demo experience
2. Agent should show the trig-triangle component
3. Verify:
   - Component appears centered
   - Can drag by clicking header or non-interactive areas
   - Can resize by dragging bottom-right corner
   - Can close with X button in header
   - Component content remains interactive
   - Multiple instances stack properly (z-index)

## Future Enhancements

Possible improvements:
- **Persistence** - Remember position/size across sessions
- **Minimize/Maximize** - Allow collapsing to header only
- **Snap to edges** - Magnetic alignment with screen edges
- **Fullscreen mode** - Double-click header to maximize
- **Component-controlled sizing** - Allow components to suggest initial size
- **Layout presets** - Tile, cascade, or arrange multiple components

## Impact

- ✅ Better user control over component layout
- ✅ Consistent with existing slide/note patterns
- ✅ Cleaner component code (no positioning concerns)
- ✅ More professional appearance
- ✅ Easier to work with multiple components
- ✅ No breaking changes to component API

## Related Documentation

- See `context/roadmap/custom-components/` for overall custom components roadmap
- See `src/app/lib/tools/ui/slides/SlideComponent.tsx` for original pattern
- See `context/architecture/tools-system.md` for tool architecture

