# Slide Component Draggable Title Bar Refactoring

**Date:** 2026-01-17  
**Status:** Complete

## Overview

Refactored the `SlideComponent` to match the interaction pattern of `ComponentWrapper`, where only the title bar is draggable and the content area remains fully interactive and selectable.

## Problem

Previously, the entire slide was draggable:
- The `onMouseDown` handler was attached to the main container
- Content inside slides couldn't be selected or interacted with
- Users couldn't highlight text, click links, or interact with embedded content
- The cursor showed `grab`/`grabbing` over the entire slide

## Solution

Restructured the slide to have a distinct title bar and content area, matching the `ComponentWrapper` pattern:

### Key Changes

1. **Separated Title Bar from Content**
   - Created a dedicated header bar with `bg-gray-50/80` background
   - Only the header bar has the `onMouseDown={handleMouseDown}` handler
   - Title bar shows `grab`/`grabbing` cursor

2. **Made Content Area Interactive**
   - Content area now has `pointerEvents: dragging ? 'none' : 'auto'`
   - Text selection enabled with `userSelect: dragging ? 'none' : 'auto'`
   - Content can be scrolled, selected, and interacted with normally
   - Links, code blocks, and other interactive elements work as expected

3. **Improved Visual Structure**
   - Added border around the entire slide container
   - Header bar has subtle border-bottom separator
   - Consistent styling with `ComponentWrapper` (white/95 background, backdrop blur)
   - Better visual hierarchy between title bar and content

4. **Enhanced Animation**
   - Added scale animation on mount/unmount (0.95 to 1.0)
   - Smoother appearance/disappearance transitions

### Implementation Details

```typescript
// Header bar - only this is draggable
<div 
  className="flex justify-between items-center px-4 py-2 bg-gray-50/80 border-b"
  style={{ 
    cursor: dragging ? 'grabbing' : 'grab',
    borderColor: 'rgba(100, 100, 100, 0.4)',
    userSelect: 'none'
  }}
  onMouseDown={handleMouseDown}
>
  {/* Title and close button */}
</div>

// Content area - fully interactive
<div 
  className="w-full overflow-auto px-4 py-3"
  style={{ 
    height: 'calc(100% - 44px)', // Account for header
    pointerEvents: dragging ? 'none' : 'auto',
    userSelect: dragging ? 'none' : 'auto'
  }}
>
  {/* Markdown content */}
</div>
```

## Benefits

1. **Better UX** - Users can now select and copy text from slides
2. **Consistent Pattern** - Slides and components now behave the same way
3. **More Professional** - Matches standard windowing system behavior
4. **Improved Accessibility** - Content is now fully accessible and selectable

## Files Modified

- `src/app/lib/tools/ui/slides/SlideComponent.tsx` - Complete restructuring of the component layout

## Related Work

This change aligns with the earlier `ComponentWrapper` refactoring (see `custom-components-wrapper-refactoring.md`) which established this interaction pattern for custom components.
