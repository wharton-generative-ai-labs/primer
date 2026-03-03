# UI Elements System Architecture

**Last Updated:** 2026-01-17

## Overview

The UI Elements System provides a unified framework for managing all interactive UI elements (slides, components, notes, diagrams) in Primer. It consists of a shared interface, centralized manager, reusable container component, and window management UI.

## Core Components

### 1. PrimerUIElement Interface

**Location:** `src/app/lib/ui/types.ts`

The foundation interface that all UI elements implement:

```typescript
interface PrimerUIElement {
  id: string;           // Unique identifier
  kind: UIElementKind;  // Type: 'slide' | 'component' | 'note' | 'mermaid'
  title: string;        // Display title
  x: number;            // X position (center point)
  y: number;            // Y position (center point)
  w: number;            // Width in pixels
  h: number;            // Height in pixels
  visible: boolean;     // Visibility state
  zIndex: number;       // Z-index for layering
  maximized?: boolean;  // Maximized state
}
```

### 2. UIElementManager

**Location:** `src/app/lib/ui/UIElementManager.ts`

Singleton manager that maintains the registry of all active UI elements.

**Key Responsibilities:**
- Register/unregister elements
- Track element state (position, size, visibility)
- Manage z-index ordering
- Notify subscribers of state changes
- Provide query capabilities

**API Methods:**
```typescript
register(element: PrimerUIElement): void
unregister(id: string): void
get(id: string): PrimerUIElement | undefined
getAll(): PrimerUIElement[]
getVisible(): PrimerUIElement[]
getByKind(kind: UIElementKind): PrimerUIElement[]
update(id: string, updates: Partial<PrimerUIElement>): boolean
show(id: string): boolean
hide(id: string): boolean
hideAll(): void
move(id: string, x: number, y: number): boolean
resize(id: string, w: number, h: number): boolean
maximize(id: string, maximized: boolean): boolean
bringToFront(id: string): number
subscribe(callback: () => void): () => void
```

### 3. DraggableWindow Component

**Location:** `src/app/lib/ui/DraggableWindow.tsx`

Reusable container component that provides consistent window behavior.

**Features:**
- Draggable title bar (only header is draggable)
- Resizable via bottom-right corner handle
- Maximize/restore button in title bar
- Close button
- Z-index management (click to bring to front)
- Smooth animations
- Interactive content area

**Props:**
```typescript
interface DraggableWindowProps {
  element: PrimerUIElement;
  callbacks?: UIElementCallbacks;
  children: React.ReactNode;
  icon?: React.ReactNode;
}
```

**Maximize Behavior:**
- Calculates available space (below header, above toolbar)
- Saves pre-maximize state for restoration
- Disables dragging/resizing when maximized
- Centers element in available space

### 4. WindowManager Component

**Location:** `src/app/components/WindowManager.tsx`

Taskbar component for managing UI elements.

**Features:**
- Displays currently active element
- Dropdown menu lists all elements
- Click to switch between elements
- Visual indicators (icons, colors) by type
- Shows hidden elements with label

**Element Type Styling:**
- Slides: FileText icon (blue)
- Components: Box icon (purple)
- Notes: StickyNote icon (yellow)
- Mermaid: GitBranch icon (green)

### 5. Present Tool

**Location:** `src/app/lib/tools/ui/present.ts`

Agent-facing tool for programmatic UI element control.

**Actions:**
- `list` - List all elements (optional filter by kind)
- `show` - Show an element
- `hide` - Hide an element
- `hideAll` - Hide all elements
- `move` - Move element to coordinates
- `resize` - Resize element
- `maximize` - Maximize element
- `restore` - Restore from maximized

**Example Usage:**
```javascript
// List all slides
present({ action: 'list', kind: 'slide' })

// Maximize a slide
present({ action: 'maximize', id: 'slide-abc123' })

// Move and resize
present({ action: 'move', id: 'component-xyz', x: 500, y: 300 })
present({ action: 'resize', id: 'component-xyz', w: 800, h: 600 })
```

## Integration Pattern

### For UI Element Types

To integrate a new UI element type:

1. **Register with UIElementManager on mount:**
```typescript
const [element, setElement] = useState<PrimerUIElement>(() => {
  const uiManager = getUIElementManager();
  const existing = uiManager.get(id);
  
  if (existing) return existing;
  
  const newElement: PrimerUIElement = {
    id,
    kind: 'your-type',
    title: 'Your Title',
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    w: 600,
    h: 400,
    visible: true,
    zIndex: uiManager.getNextZIndex()
  };
  
  uiManager.register(newElement);
  return newElement;
});
```

2. **Subscribe to manager updates:**
```typescript
useEffect(() => {
  const uiManager = getUIElementManager();
  const unsubscribe = uiManager.subscribe(() => {
    const updated = uiManager.get(id);
    if (updated) setElement({ ...updated });
  });
  return () => unsubscribe();
}, [id]);
```

3. **Cleanup on unmount:**
```typescript
useEffect(() => {
  return () => {
    const uiManager = getUIElementManager();
    uiManager.unregister(id);
  };
}, [id]);
```

4. **Use DraggableWindow:**
```typescript
return (
  <DraggableWindow
    element={element}
    icon={<YourIcon className="w-4 h-4" />}
    callbacks={{
      onClose: handleClose,
      onMove: (id, x, y) => uiManager.move(id, x, y),
      onResize: (id, w, h) => uiManager.resize(id, w, h),
      onMaximize: (id, max) => uiManager.maximize(id, max),
      onBringToFront: (id) => uiManager.bringToFront(id)
    }}
  >
    {/* Your content */}
  </DraggableWindow>
);
```

## Current Implementations

### SlideComponent
- **Location:** `src/app/lib/tools/ui/slides/SlideComponent.tsx`
- **Kind:** `'slide'`
- **Icon:** FileText (blue)
- **Content:** Markdown rendering with syntax highlighting

### ComponentWrapper
- **Location:** `src/app/lib/tools/ui/components/ComponentWrapper.tsx`
- **Kind:** `'component'`
- **Icon:** Box (purple)
- **Content:** Custom React components

## State Flow

```
User Action (drag/resize/close)
        ↓
DraggableWindow (local state update)
        ↓
Callback to parent component
        ↓
UIElementManager.update()
        ↓
Notify all subscribers
        ↓
Components re-render with new state
        ↓
WindowManager updates display
```

## Z-Index Management

- Base z-index: 20
- Each new element gets next available z-index
- Clicking an element brings it to front (increments z-index)
- Manager tracks highest z-index globally
- Ensures proper layering of multiple elements

## Maximize Calculation

When maximizing, DraggableWindow calculates available space:

```typescript
const headerHeight = 72;      // PlayPage header
const toolbarHeight = 60;     // Bottom controls
const viewportWidth = window.innerWidth;
const viewportHeight = window.innerHeight;

const maxWidth = viewportWidth;
const maxHeight = viewportHeight - headerHeight - toolbarHeight;
const centerX = viewportWidth / 2;
const centerY = headerHeight + maxHeight / 2;
```

## Plugin Registration

To enable the `present` tool in an experience:

```json
{
  "tools": {
    "plugins": [
      "@primer/present-plugin"
    ]
  }
}
```

## Best Practices

1. **Always register elements** - Ensures visibility in WindowManager
2. **Always unregister on unmount** - Prevents memory leaks
3. **Use callbacks** - Let UIElementManager handle state updates
4. **Provide meaningful titles** - Shown in WindowManager
5. **Choose appropriate icons** - Visual differentiation in taskbar
6. **Test with multiple elements** - Ensure proper z-index behavior

## Performance Considerations

- UIElementManager uses Map for O(1) lookups
- Subscription pattern minimizes unnecessary re-renders
- Only visible elements render their content
- DraggableWindow uses local state for smooth dragging
- Batch updates through manager to trigger single notification

## Future Enhancements

1. **Minimize functionality** - Collapse to taskbar icon
2. **Snap to grid** - Optional grid-based positioning
3. **Keyboard shortcuts** - Alt+Tab style switching
4. **Persistence** - Save positions across sessions
5. **Multi-monitor** - Support for multiple display areas
6. **Window groups** - Organize related elements
7. **Custom layouts** - Predefined arrangements
