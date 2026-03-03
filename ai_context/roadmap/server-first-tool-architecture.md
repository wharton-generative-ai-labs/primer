# Server-First Tool Architecture

## Overview

This document describes the migration to a server-first tool calling architecture where all tools execute their primary logic on the backend and communicate with the frontend via Socket.IO for UI effects.

## Motivation

- **Unified execution model**: All tools (backend and realtime agents) can call the same tool implementations
- **Server-side logging**: All tool invocations are logged centrally
- **Consistent behavior**: Tool logic runs in one place regardless of which agent calls it
- **Security**: Sensitive operations execute on the server
- **Future-proof**: Enables backend agents to control UI elements

## Architecture

### Scenario A: Realtime AI (Client) calls tool

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT - Realtime AI calls "present"                        │
├─────────────────────────────────────────────────────────────┤
│ 1. AI → tool stub (client)                                  │
│ 2. Stub → socket.emit("tool.call", {callId, name, args})   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ SERVER - Receives tool.call                                 │
├─────────────────────────────────────────────────────────────┤
│ 3. Execute present() server function                        │
│ 4. Emit ui.element.show (or other UI command)              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ CLIENT - UI Handler                                         │
├─────────────────────────────────────────────────────────────┤
│ 5. Receive ui.element.show                                  │
│ 6. Call UIElementManager.show(id)                          │
│ 7. Emit socket "tool.result" with success/error            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ SERVER - Receives tool.result                               │
├─────────────────────────────────────────────────────────────┤
│ 8. Process result                                           │
│ 9. Emit tool.response back to client                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ CLIENT - Tool stub receives result                          │
├─────────────────────────────────────────────────────────────┤
│ 10. Return result to AI                                     │
└─────────────────────────────────────────────────────────────┘
```

### Scenario B: Backend AI calls tool

```
┌─────────────────────────────────────────────────────────────┐
│ SERVER - Backend AI calls "present"                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Execute present() server function directly               │
│ 2. Emit ui.element.show (or other UI command)              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ CLIENT - UI Handler                                         │
├─────────────────────────────────────────────────────────────┤
│ 3. Receive ui.element.show                                  │
│ 4. Call UIElementManager.show(id)                          │
│ 5. Emit socket "tool.result" with success/error            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ SERVER - Receives tool.result                               │
├─────────────────────────────────────────────────────────────┤
│ 6. Return result to backend AI                              │
└─────────────────────────────────────────────────────────────┘
```

**Key insight**: The server-side tool function is the "source of truth" - it always runs first, emits UI commands if needed, and waits for the client to report success/failure.

## Socket Events

### Client → Server
- `tool.call` - Generic tool invocation from client
  ```typescript
  { callId: string, toolName: string, args: any, sessionId: string }
  ```

### Server → Client (UI Commands)
- `ui.element.show` - Show a UI element
  ```typescript
  { callId: string, id: string }
  ```
- `ui.element.hide` - Hide a UI element
  ```typescript
  { callId: string, id: string }
  ```
- `ui.element.move` - Move a UI element
  ```typescript
  { callId: string, id: string, x: number, y: number }
  ```
- `ui.element.resize` - Resize a UI element
  ```typescript
  { callId: string, id: string, w: number, h: number }
  ```
- `ui.element.maximize` - Maximize/restore a UI element
  ```typescript
  { callId: string, id: string, maximized: boolean }
  ```
- `ui.observe.request` - Request UI state from client
  ```typescript
  { callId: string }
  ```

### Client → Server (Responses)
- `tool.result` - Result from UI operation
  ```typescript
  { callId: string, status: "success"|"error", data: any }
  ```
- `ui.observe.response` - UI state data
  ```typescript
  { 
    callId: string, 
    elements: PrimerUIElement[], 
    viewport: { width: number, height: number },
    insets: { left: number, right: number, top: number, bottom: number }
  }
  ```

### Server → Client (Final Response)
- `tool.response` - Final result for client-initiated tool calls
  ```typescript
  { callId: string, status: "success"|"error", data: any }
  ```

## Test Case Tools: `observe` and `present`

These two tools serve as the initial implementation and test case for the server-first architecture.

### `observe` Tool

**Purpose**: Allow AI to "see" the current UI state

**Flow**:
1. Server tool function emits `ui.observe.request`
2. Client gathers all UI state:
   - All PrimerUIElement data (visible and hidden)
   - Viewport dimensions
   - Anchored element insets (available rendering space)
3. Client emits `ui.observe.response` with raw data
4. Server receives data and computes:
   - Spatial relationships (left of, right of, above, below)
   - Grouping by visibility
   - Overlapping elements (z-index analysis)
5. Server returns enriched result to AI

**Use Cases**:
- User asks "where's the transcript window?"
- AI can discover hidden elements and show them
- AI can understand spatial layout for better UI manipulation

### `present` Tool

**Purpose**: Allow AI to manipulate UI elements

**Actions**:
- `show` - Make element visible
- `hide` - Hide element
- `hideAll` - Hide all elements
- `move` - Reposition element
- `resize` - Change element size
- `maximize` - Maximize element
- `restore` - Restore from maximized state

**Flow** (example: show action):
1. Server tool function validates args
2. Server emits `ui.element.show` with element ID
3. Client receives event, calls `UIElementManager.show(id)`
4. Client emits `tool.result` with success/error
5. Server returns result to AI

**Note**: The `list` action is removed as it's redundant with the `observe` tool.

## Implementation Components

### Server-Side
1. **Tool implementations** (`/src/app/lib/tools/builtin/observe-tool.ts`, `present-tool.ts`)
   - Core tool logic
   - Socket event emission
   - Result processing
   
2. **Socket handlers** (in `server.ts`)
   - `tool.call` handler - Routes to appropriate tool
   - `tool.result` handler - Processes client responses
   - `ui.observe.response` handler - Processes UI state data

3. **Tool context** (`/src/app/api/backend-agent/utils/context.ts`)
   - Add socket emission helpers
   - Add promise-based waiting for client responses

### Client-Side
1. **Tool stubs** (`/src/app/lib/tools/client/tool-calling-shim.ts`)
   - Generic stub that emits `tool.call`
   - Waits for `tool.response`
   - Returns result to AI

2. **UI event handlers** (`/src/app/lib/tools/client/ui-event-handlers.ts`)
   - Handle `ui.element.*` events
   - Call UIElementManager methods
   - Emit `tool.result` responses
   - Handle `ui.observe.request` events
   - Gather and emit UI state

3. **Socket event integration** (`/src/app/hooks/useHandleServerEvent.ts`)
   - Wire up UI event handlers
   - Handle `tool.response` events

### Type Definitions
1. **Socket events** (`/src/app/types/socket.ts`)
   - Add all new event types
   - Type-safe event payloads

## Error Handling

- **Timeouts**: If client doesn't respond within timeout (e.g., 5s), return error to AI
- **Element not found**: Client reports error via `tool.result`, server passes to AI
- **Network issues**: Socket disconnection handled gracefully with error responses
- **Correlation**: All events use `callId` to match requests with responses

## Migration Path

1. **Phase 1**: Implement infrastructure (socket events, handlers, stubs)
2. **Phase 2**: Implement `observe` tool as proof of concept
3. **Phase 3**: Implement `present` tool
4. **Phase 4**: Test with both realtime and backend agents
5. **Future**: Migrate other tools to this pattern

## Future Considerations

- **State synchronization**: May add server-side UI state mirror for faster queries
- **Batching**: Multiple UI operations could be batched into single round-trip
- **Optimistic updates**: Client could update UI immediately while waiting for server confirmation
- **Tool discovery**: Auto-generate client stubs from server tool definitions

## Status

- **Current**: Design phase complete
- **Next**: Begin implementation
- **Target**: `observe` and `present` tools as working examples
