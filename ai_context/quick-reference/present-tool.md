# Present Tool Quick Reference

The `present` tool provides programmatic control over UI elements (slides, components, notes, diagrams).

## Enable in Experience

```json
{
  "tools": {
    "plugins": ["@primer/present-plugin"]
  }
}
```

## Actions

### List Elements

List all UI elements or filter by type:

```javascript
// List all elements
present({ action: 'list' })
// Returns: { elements: [...], count: N }

// List only slides
present({ action: 'list', kind: 'slide' })

// List only components
present({ action: 'list', kind: 'component' })
```

**Kinds:** `'slide'`, `'component'`, `'note'`, `'mermaid'`

### Show/Hide Elements

```javascript
// Show an element
present({ action: 'show', id: 'slide-123' })

// Hide an element
present({ action: 'hide', id: 'component-456' })

// Hide all elements
present({ action: 'hideAll' })
```

### Move Elements

Reposition an element (x, y are center coordinates):

```javascript
present({ 
  action: 'move', 
  id: 'slide-123', 
  x: 500,  // pixels from left
  y: 300   // pixels from top
})
```

### Resize Elements

Change element dimensions:

```javascript
present({ 
  action: 'resize', 
  id: 'component-456', 
  w: 800,  // width in pixels
  h: 600   // height in pixels
})
```

### Maximize/Restore

```javascript
// Maximize an element (fills available space)
present({ action: 'maximize', id: 'slide-123' })

// Restore to previous size
present({ action: 'restore', id: 'slide-123' })
```

## Common Patterns

### Clean Slate

Hide all elements before showing new content:

```javascript
present({ action: 'hideAll' })
// Then show your new content
```

### Focus on Element

Maximize an element for focused viewing:

```javascript
// Get the element ID from slide/component tool
const result = slide({ action: 'show', title: 'Important', content: '...' })
const slideId = result.data.result.id

// Maximize it
present({ action: 'maximize', id: slideId })
```

### Organize Layout

Position multiple elements in a grid:

```javascript
// Top-left
present({ action: 'move', id: 'slide-1', x: 300, y: 250 })
present({ action: 'resize', id: 'slide-1', w: 500, h: 400 })

// Top-right
present({ action: 'move', id: 'slide-2', x: 900, y: 250 })
present({ action: 'resize', id: 'slide-2', w: 500, h: 400 })
```

### Check What's Visible

```javascript
const result = present({ action: 'list' })
const visibleElements = result.data.elements.filter(el => el.visible)
console.log(`${visibleElements.length} elements are visible`)
```

## Element Properties

Each element in the list has:

```typescript
{
  id: string,        // Unique identifier
  kind: string,      // 'slide', 'component', 'note', 'mermaid'
  title: string,     // Display title
  visible: boolean,  // Is it currently shown?
  x: number,         // X position (center)
  y: number,         // Y position (center)
  w: number,         // Width in pixels
  h: number,         // Height in pixels
  maximized: boolean // Is it maximized?
}
```

## Error Handling

All actions return a status:

```javascript
const result = present({ action: 'show', id: 'nonexistent' })

if (result.status === 'error') {
  console.log(result.data.error)
  // "UI element with id 'nonexistent' not found"
}
```

## Tips

1. **Get IDs from creation tools** - When you create a slide/component, save the returned ID
2. **List before manipulating** - Use `list` to see what's available
3. **Maximize for focus** - Great for important content that needs attention
4. **hideAll for transitions** - Clean slate between sections
5. **Combine with other tools** - Use alongside `slide`, `customComponent`, etc.

## Window Manager

Users can also manage elements via the taskbar at the bottom of the screen:
- Shows currently active element
- Click to see dropdown of all elements
- Click an element to show/focus it
- Visual indicators by type (icons and colors)
