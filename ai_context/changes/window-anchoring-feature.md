# Window Anchoring Feature

## Overview

Implemented a window anchoring system that allows PrimerUIElements (floating windows) to be anchored to screen edges. When anchored, windows take up layout space and push the scene/background image to accommodate their size, similar to how docked panels work in traditional IDEs.

## Key Features

### 1. Anchor Detection & Snapping
- Windows can be dragged off-screen to trigger anchor zones
- Visual feedback shows blue highlighted zones when dragging past edges
- Releasing the mouse while in an anchor zone snaps the window to that edge
- Currently supports anchoring to: **left and right edges only**
- Top/bottom anchoring temporarily disabled (code preserved in comments for future re-enabling)

### 2. Un-anchoring
- Pull a window away from its anchored edge (>100px) to un-anchor it
- Window restores to its pre-anchor position and size
- Smooth transitions when anchoring/un-anchoring

### 3. Layout Integration
- Scene component automatically adjusts to accommodate anchored windows
- Background image repositions and resizes to avoid being obscured
- Smooth CSS transitions (300ms) when layout changes
- **Maximize behavior respects anchored windows**: When a window is maximized, it only fills the remaining space not occupied by anchored windows

### 4. Resize Behavior
- Anchored windows can be resized along their anchor axis:
  - Left/Right anchored: resize width using inner edge handle
  - Top/Bottom anchored: resize height using inner edge handle
- Resize handle position adapts based on anchor state
- Full-area scene automatically adjusts to new window size

### 5. Constraints
- **Multiple anchored windows supported**: One window per edge (e.g., one on left, one on right simultaneously)
- If a window is anchored to an edge that already has an anchored window, the previous one is un-anchored
- Anchoring disabled on small screens (< 768px width) to prevent layout issues on mobile
- Cannot anchor when window is maximized

## Bug Fixes & Improvements (2026-01-19)

### Fixed Anchor Zone Positioning
- Changed anchor zone overlays from `position: absolute` to `position: fixed` 
- Rendered anchor zones using React Portal to document.body to ensure correct positioning
- **Dynamic viewport detection**: Instead of hardcoded header/footer heights, now queries the actual `.z-play-content` element (PlayPageContent) to determine the real available viewport area
- Added `z-play-content` class to PlayPageContent.tsx for reliable DOM querying
- This ensures anchor zones align perfectly with the content area between the header (logo/HAL/Agent) and footer (control icons)
- Zones now properly align with screen edges in all scenarios

### Fixed Anchor Detection
- Added missing dependencies to useEffect for mouse event handlers
- Included `anchorZone`, `anchoredTo`, `position`, and `element.preAnchorState` in dependency array
- This ensures the mouseUp handler sees the latest anchor zone state when releasing the mouse

### Improved Anchor Zone Activation (Major UX Enhancement)
**Problem**: Anchor zones were activating when windows were dragged *near* edges, preventing users from positioning windows at the edge without anchoring.

**Solution**: Changed activation logic to only trigger when window is dragged *off-screen*:
- Left anchor: activates when left edge of window goes past x=0
- Right anchor: activates when right edge goes past viewport width
- Top anchor: activates when top edge goes past header (64px)
- Bottom anchor: activates when bottom edge goes past viewport height - footer (64px)

This allows users to position windows anywhere on-screen without triggering anchoring, while still making anchoring easily accessible by dragging slightly off-screen.

### Debug Logging
- Added console logging for anchor zone changes and anchoring events
- Can be removed once feature is stable

### Default Anchored State (2026-01-20)
- Chat Transcript window now starts anchored to the right edge by default
- Initial state uses approximate dimensions for fast rendering
- `useEffect` recalculates proper anchored position after DOM is ready
- Uses `.z-play-content` dimensions via `requestAnimationFrame` for accurate sizing
- Sets `anchoredTo: 'right'` in initial state
- Scene automatically adjusts to accommodate the anchored transcript on load
- **Fixed**: Initial height now correctly matches available viewport area (no more too-short window on first load)

### Vertical Anchoring Feature Flag (2026-01-20)
- Top and bottom edge anchoring controlled by `VERTICAL_ANCHORING_ENABLED` flag
- Currently set to `false` - only left and right edge anchoring is active
- All vertical anchoring code is functional and ready to activate
- To enable: change `const VERTICAL_ANCHORING_ENABLED = false` to `true` in DraggableWindow.tsx

### Smart Maximize Behavior (2026-01-20)
- Maximize now respects space taken by anchored windows
- When maximizing, the window fills only the remaining available space
- **Supports multiple anchored windows**: Correctly accounts for windows anchored to different edges
- Example: If chat transcript is anchored right (450px) and events log is anchored left (400px), maximized window uses the middle space
- Prevents maximized windows from overlapping anchored windows
- Properly centers maximized window in the available space accounting for all insets
- **Dynamic recalculation**: Maximized windows automatically adjust position/size when other windows are anchored/un-anchored
- Uses state-based approach: tracks `anchoredInsets` separately from position/size
- Subscription updates insets state with change detection to prevent loops
- Separate effect recalculates position when insets change (only when maximized)
- Both effects use change detection (>0.5px) to prevent infinite update loops
- Scene component uses change detection (>0.5px) before updating state to prevent infinite loops
- Fixed: Initial transcript window height now matches the anchored position calculation exactly

### Multiple Anchored Windows Support (2026-01-20)
- `getAnchoredElements()`: Returns array of all anchored windows
- `getAnchoredInsets()`: Calculates combined insets from all anchored windows
- Allows one window per edge (left, right, top, bottom) to be anchored simultaneously
- Maximize behavior correctly accounts for multiple anchored windows
- Scene component respects all anchored windows when positioning content

## Implementation Details

### Type Changes (`src/app/lib/ui/types.ts`)
```typescript
export type AnchorEdge = 'left' | 'right' | 'top' | 'bottom';

export interface PrimerUIElement {
  // ... existing properties ...
  anchoredTo?: AnchorEdge | null;
  preAnchorState?: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
}

export interface UIElementCallbacks {
  // ... existing callbacks ...
  onAnchor?: (id: string, anchoredTo: AnchorEdge | null, preAnchorState?: { x: number; y: number; w: number; h: number }) => void;
}
```

### UIElementManager Updates (`src/app/lib/ui/UIElementManager.ts`)
- `getAnchoredElement()`: Returns currently anchored window
- `getAnchoredInsets()`: Returns layout insets (left, right, top, bottom) caused by anchored windows
- `anchor()`: Anchors a window to an edge (un-anchors any existing anchored window)
- `unanchor()`: Removes anchor from a window

### DraggableWindow Updates (`src/app/lib/ui/DraggableWindow.tsx`)
- Anchor zone detection during drag operations
- Visual feedback overlay showing anchor zones
- Snap-to-edge positioning calculations
- Un-anchor detection based on drag distance
- Adaptive resize handles for anchored state
- Separate resize logic for anchored vs floating windows

### Scene Component Updates (`src/app/components/Scene.tsx`)
- Subscribes to UIElementManager updates
- Calculates available space accounting for anchored windows
- Applies offset to center scene in remaining space
- Smooth CSS transitions for layout changes

### Window Component Updates
Both `TranscriptWindow.tsx` and `EventsWindow.tsx`:
- Added `handleAnchor` callback
- Properly manages anchor state through UIElementManager
- Passes pre-anchor state for restoration on un-anchor

## Usage

1. **Default state**: Chat Transcript window starts anchored to the right edge
2. **Anchor a window**: Drag any floating window off the left or right screen edge until you see the blue highlight, then release
3. **Resize anchored window**: Use the resize handle on the inner edge (opposite the anchor point) to adjust width
4. **Un-anchor a window**: Grab the title bar and pull the window away from its anchored edge (>100px)
5. **Scene adjustment**: The background scene automatically repositions to remain centered in available space

## Technical Considerations

### Constants
- `MIN_ANCHOR_WIDTH = 768`: Minimum screen width to allow anchoring
- `UNANCHOR_DISTANCE = 100`: Distance to drag to un-anchor
- `VERTICAL_ANCHORING_ENABLED = false`: Feature flag to enable/disable top/bottom anchoring

### Dynamic Viewport Detection
- `getAvailableViewportArea()`: Queries the DOM for `.z-play-content` element (PlayPageContent container) to get actual available space
- Falls back to `.z-content` if play content not found, then full viewport as last resort
- Returns `{ top, bottom, height }` offsets that account for the header and footer bars
- Eliminates hardcoded height assumptions and works across different page layouts
- Anchor zones are constrained to the area between PlayPageHeader and PlayPageControls

### Layout Calculations
- Header height: 72px
- Footer height: 60px
- Padding: 8px
- Scene dimensions calculated as: `viewport - header - footer - padding - anchoredInsets`

### Z-Index Management
- Anchor zone overlays: 9998
- Windows maintain their existing z-index system
- Anchored windows don't get special z-index treatment

## Future Enhancements (Not Implemented)

- Multiple anchored windows per edge (stacking/splitting)
- Keyboard shortcuts for anchoring/un-anchoring
- Snap-to-grid for more precise positioning
- Save/restore anchor preferences per user
- Anchor to specific percentages of screen width/height
