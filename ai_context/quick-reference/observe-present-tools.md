# Observe and Present Tools - Quick Reference

## Overview

The `observe` and `present` tools are the first implementation of Primer's server-first tool architecture. They allow AI agents (both realtime and backend) to inspect and manipulate UI elements through a unified socket-based protocol.

## Tool Descriptions

### `observe` Tool

**Purpose**: Allow AI to "see" the current UI state

**Parameters**: None

**Returns**:
- `elements`: Array of all PrimerUIElement objects (visible and hidden)
- `viewport`: Current viewport dimensions (`{width, height}`)
- `insets`: Space occupied by anchored elements (`{left, right, top, bottom}`)
- `availableSpace`: Calculated rendering area after accounting for insets
- `summary`: Quick stats (total, visible, hidden counts and IDs)
- `spatial`: Spatial relationship analysis for each visible element

**Example Usage**:
```typescript
// AI calls observe
const result = await observe({}, context);

// Result includes:
{
  elements: [
    { id: "slide-1", kind: "slide", title: "Welcome", visible: true, x: 400, y: 300, ... },
    { id: "note-1", kind: "note", title: "Notes", visible: false, ... }
  ],
  viewport: { width: 1920, height: 1080 },
  insets: { left: 0, right: 300, top: 0, bottom: 0 },
  availableSpace: { x: 0, y: 0, width: 1620, height: 1080 },
  summary: {
    total: 2,
    visible: 1,
    hidden: 1,
    visibleIds: ["slide-1"],
    hiddenIds: ["note-1"]
  },
  spatial: [
    {
      id: "slide-1",
      title: "Welcome",
      position: "middle center",
      neighbors: { left: [], right: [], above: [], below: [] }
    }
  ]
}
```

**Use Cases**:
- User asks "where's the transcript window?"
- AI needs to understand current layout before adding new elements
- AI wants to discover hidden elements to show them

### `present` Tool

**Purpose**: Manipulate UI elements (show, hide, move, resize, maximize)

**Parameters**:
- `action`: Required. One of: `show`, `hide`, `hideAll`, `move`, `resize`, `maximize`, `restore`
- `id`: Required for most actions. UI element ID
- `x`, `y`: Required for `move` action. Position in pixels
- `w`, `h`: Required for `resize` action. Dimensions in pixels

**Returns**:
- `status`: `'success'` or `'error'`
- `data`: Result data or error message

**Example Usage**:
```typescript
// Show an element
await present({ action: 'show', id: 'slide-1' }, context);

// Hide an element
await present({ action: 'hide', id: 'note-1' }, context);

// Hide all elements
await present({ action: 'hideAll' }, context);

// Move an element
await present({ action: 'move', id: 'slide-1', x: 500, y: 400 }, context);

// Resize an element
await present({ action: 'resize', id: 'slide-1', w: 800, h: 600 }, context);

// Maximize an element
await present({ action: 'maximize', id: 'slide-1' }, context);

// Restore from maximized
await present({ action: 'restore', id: 'slide-1' }, context);
```

## Architecture

### Server-First Pattern

Both tools follow the server-first architecture:

1. **Client AI calls tool** → Client stub sends `tool.call` socket message
2. **Server receives** → Executes actual tool implementation
3. **Server sends UI commands** → Emits `ui.element.*` or `ui.observe.request` events
4. **Client handles UI** → Executes UIElementManager operations
5. **Client responds** → Sends `tool.result` or `ui.observe.response` back
6. **Server processes** → Returns final result to AI

### Socket Events

**Client → Server**:
- `tool.call` - Generic tool invocation
- `tool.result` - Result from UI operation
- `ui.observe.response` - UI state data

**Server → Client**:
- `ui.element.show` - Show element
- `ui.element.hide` - Hide element
- `ui.element.move` - Move element
- `ui.element.resize` - Resize element
- `ui.element.maximize` - Maximize/restore element
- `ui.observe.request` - Request UI state
- `tool.response` - Final result for client-initiated calls

### File Locations

**Server-Side**:
- `/src/app/lib/tools/builtin/observe-tool.ts` - Observe implementation
- `/src/app/lib/tools/builtin/present-tool.ts` - Present implementation
- `/src/app/lib/tools/server/ToolRequestManager.ts` - Request/response manager
- `/server.ts` - Socket event handlers

**Client-Side**:
- `/src/app/lib/tools/client/ui-event-handlers.ts` - UI manipulation handlers
- `/src/app/lib/tools/client/tool-calling-shim.ts` - Generic tool stub
- `/src/app/hooks/useHandleServerEvent.ts` - Event integration

**Registration**:
- `/src/app/lib/tools/builtin/register.ts` - Server registration
- `/src/app/lib/tools/builtin/register-client.ts` - Client stub registration

## Testing

### Manual Testing

1. **Start the server**: `npm run dev`
2. **Open a play session**: Navigate to `/play`
3. **Test observe**:
   - Say: "What UI elements are currently visible?"
   - AI should call `observe` and describe the layout
4. **Test present - show/hide**:
   - Create a slide or note
   - Say: "Hide the [element name]"
   - AI should call `present` with `hide` action
   - Say: "Show it again"
   - AI should call `present` with `show` action
5. **Test present - move**:
   - Say: "Move the [element name] to the top left"
   - AI should call `present` with `move` action
6. **Test present - resize**:
   - Say: "Make the [element name] bigger"
   - AI should call `present` with `resize` action

### Debugging

Check browser console and server logs for:
- Socket event emissions
- Tool call/response flow
- UI operation results
- Any errors or timeouts

## Limitations & Future Work

**Current Limitations**:
- No server-side state caching (always queries client)
- 5-second timeout for UI operations
- No batching of multiple operations
- Spatial relationships use simple distance calculations

**Future Enhancements**:
- Server-side UI state mirror for faster queries
- Batch operations (e.g., move multiple elements at once)
- More sophisticated spatial analysis
- Optimistic updates on client
- Tool call analytics and logging

## Related Documentation

- [Server-First Tool Architecture](/ai_context/roadmap/server-first-tool-architecture.md) - Full architecture design
- [UI Elements System](/ai_context/architecture/ui-elements-system.md) - UIElementManager details
- [Tools System](/ai_context/architecture/tools-system.md) - General tools architecture
