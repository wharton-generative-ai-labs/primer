# Socket Emission Pattern for Backend-First Tools

**Last Updated:** 2026-01-21

## Overview

All backend-first tools follow a consistent pattern for socket communication: **direct socket.emit()** for responses, NOT wrapped in `client:message`.

## The Pattern

### ❌ WRONG - Using sendClientEvent

```typescript
// DON'T DO THIS - wraps in client:message
sendClientEvent({
  type: 'tool_result',
  data: { ... }
});

// Backend receives:
socket.on('client:message', (data) => {
  // data = { type: 'tool_result', data: { ... } }
  // But handler expects direct tool.result event!
});
```

### ✅ CORRECT - Direct Socket Emission

```typescript
import { getGlobalSocket } from '@/app/lib/tools/client/tool-calling-shim';

const socket = getGlobalSocket();
socket.emit('tool.result', {
  callId: data.callId,
  status: 'success',
  data: { ... }
});

// Backend receives:
socket.on('tool.result', (data) => {
  // data = { callId, status, data }
  // Direct access to the data!
});
```

## Why This Matters

### sendClientEvent() Wraps Everything

`sendClientEvent()` is defined in `SocketController.tsx`:

```typescript
sendClientEvent: (eventObj: any) => {
  socketRef.current.emit('client:message', eventObj);  // Wraps it!
}
```

This wrapping is useful for general application messages, but backend-first tools have **dedicated socket event handlers** that expect direct events.

### Backend Handlers Expect Direct Events

The backend has specific handlers for each event type:

```typescript
// server.ts
socket.on('tool.result', (data) => { ... });
socket.on('ui.observe.response', (data) => { ... });
socket.on('tool.response', (data) => { ... });
```

These handlers expect the data structure directly, not wrapped in `client:message`.

## Verified Tools Using Correct Pattern

### 1. Present Tool (UI Element Management)

**File:** `src/app/lib/tools/client/ui-event-handlers.ts`

All present tool handlers use direct socket.emit:

```typescript
export function handleUIElementShow(data: UIElementShowEvent) {
  const socket = getGlobalSocket();
  socket.emit('tool.result', {
    callId: data.callId,
    status: 'success',
    data: { result: true, id: data.id }
  });
}

export function handleUIElementHide(data: UIElementHideEvent) {
  const socket = getGlobalSocket();
  socket.emit('tool.result', { ... });
}

export function handleUIElementMove(data: UIElementMoveEvent) {
  const socket = getGlobalSocket();
  socket.emit('tool.result', { ... });
}

export function handleUIElementResize(data: UIElementResizeEvent) {
  const socket = getGlobalSocket();
  socket.emit('tool.result', { ... });
}

export function handleUIElementMaximize(data: UIElementMaximizeEvent) {
  const socket = getGlobalSocket();
  socket.emit('tool.result', { ... });
}
```

**Socket Events:**
- Receives: `ui.element.show`, `ui.element.hide`, `ui.element.move`, `ui.element.resize`, `ui.element.maximize`
- Sends: `tool.result`

### 2. Observe Tool (UI State Query)

**File:** `src/app/lib/tools/client/ui-event-handlers.ts`

```typescript
export function handleUIObserveRequest(data: UIObserveRequestEvent) {
  const socket = getGlobalSocket();
  socket.emit('ui.observe.response', {
    callId: data.callId,
    elements,
    viewport,
    insets
  });
}
```

**Socket Events:**
- Receives: `ui.observe.request`
- Sends: `ui.observe.response`

### 3. Delegate Tool (Agent Delegation)

**File:** `src/app/lib/backend-agent-socket.ts`

```typescript
export async function executeBackendAgentViaSocket(...) {
  // Status updates
  socket.emit('delegation:status', { ... });
  socket.emit('delegation:tool', { ... });
  
  // Final response
  socket.emit('tool.response', {
    callId,
    status: 'success',
    data: { message, agentType, artifactIds }
  });
}
```

**Socket Events:**
- Receives: (triggered by `agent.delegate` tool call)
- Sends: `delegation:status`, `delegation:tool`, `tool.response`

### 4. Slide Tool (Content Display)

**File:** `src/app/hooks/useHandleServerEvent.ts`

```typescript
case "ui.slide.create": {
  const socket = getGlobalSocket();
  socket.emit('tool.result', {
    callId: data.callId,
    status: 'success',
    data: { slideId, title: data.title }
  });
}
```

**Socket Events:**
- Receives: `ui.slide.create`
- Sends: `tool.result`

## Implementation Checklist

When creating a new backend-first tool:

- [ ] Import `getGlobalSocket` from `@/app/lib/tools/client/tool-calling-shim`
- [ ] Get socket reference: `const socket = getGlobalSocket()`
- [ ] Check socket availability: `if (!socket) { logger.error(...); return; }`
- [ ] Use **direct** `socket.emit()` for responses
- [ ] Choose appropriate event type:
  - `tool.result` - For UI operation results
  - `tool.response` - For final tool execution results
  - Custom event - For specific tool needs (e.g., `ui.observe.response`)
- [ ] Include `callId` in all responses for request/response matching
- [ ] Follow consistent data structure: `{ callId, status, data }`

## Common Mistakes

### ❌ Using sendClientEvent for tool responses

```typescript
// WRONG
sendClientEvent({
  type: 'tool_result',
  data: { callId, result: { ... } }
});
```

### ❌ Forgetting to get global socket

```typescript
// WRONG - socket is undefined
socket.emit('tool.result', { ... });
```

### ❌ Wrong data structure

```typescript
// WRONG - nested result
socket.emit('tool.result', {
  callId: data.callId,
  result: {  // Don't nest in 'result'
    status: 'success',
    data: { ... }
  }
});

// CORRECT - flat structure
socket.emit('tool.result', {
  callId: data.callId,
  status: 'success',
  data: { ... }
});
```

## Related Documents

- `ai_context/architecture/backend-first-tool-pattern.md` - Overall architecture
- `ai_context/changes/slide-tool-registration-fix.md` - Slide tool migration
- `ai_context/quick-reference/socket-based-delegation.md` - Delegation pattern
