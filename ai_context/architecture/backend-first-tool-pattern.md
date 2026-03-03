# Backend-First Tool Pattern

**Last Updated:** 2026-01-22

## Overview

All tools in Primer follow a "backend-first" pattern where tool calls are routed through the server via socket communication, regardless of whether they're called from frontend or backend agents. This ensures universal compatibility, centralized logging, and consistent behavior.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND AGENT                           │
│  (Realtime API, running in browser)                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ ToolRegistry.execute('slide', args)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              CLIENT-SIDE TOOL STUB                          │
│  (register-client.ts)                                       │
│  createToolStub('slide', definition)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ socket.emit('tool.call', { toolName, args })
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND SERVER                            │
│  (Receives tool.call via Socket.IO)                         │
│  - Validates parameters                                     │
│  - Logs tool invocation                                     │
│  - Executes actual tool code                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Tool execution (slide.ts)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              TOOL IMPLEMENTATION                            │
│  (slides.ts)                                                │
│  - Uses context.sendClientEvent                             │
│  - Sends ui.slide.create event                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ socket.emit('ui.slide.create', { title, content })
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND EVENT HANDLER                         │
│  (useHandleServerEvent.ts)                                  │
│  - Receives ui.slide.create                                 │
│  - Creates React component                                  │
│  - Registers with UIElementManager                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ sendClientEvent('tool_result', { slideId })
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND SERVER                            │
│  - Receives tool_result                                     │
│  - Returns to tool implementation                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ socket.emit('tool.response', { status, data })
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              CLIENT-SIDE TOOL STUB                          │
│  - Receives tool.response                                   │
│  - Resolves promise                                         │
│  - Returns to agent                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ { status: 'success', data: { slideId } }
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND AGENT                           │
│  - Receives slideId                                         │
│  - Can now control slide with present tool                  │
└─────────────────────────────────────────────────────────────┘
```

## The "Round Trip" for Frontend Agents

When a frontend agent calls a tool, the flow is:

1. **Frontend Agent** → ToolRegistry.execute()
2. **Client Stub** → socket.emit('tool.call')
3. **Backend** → Executes tool code
4. **Backend** → socket.emit('ui.slide.create')
5. **Frontend Handler** → Creates UI element
6. **Frontend Handler** → socket.emit('tool_result')
7. **Backend** → socket.emit('tool.response')
8. **Client Stub** → Resolves promise
9. **Frontend Agent** → Receives result

Yes, this means frontend agents send a message to the backend which then sends it back to the frontend. This is intentional!

## Why This Pattern?

### ✅ Universal Compatibility
- Same code path for frontend AND backend agents
- No "if frontend do X, if backend do Y" logic
- Backend agents automatically work with all tools
- One implementation, works everywhere

### ✅ Centralized Backend Control
- **Logging**: All tool calls logged at INFO level with full parameters (smart truncation for readability)
- **Authorization**: Can check permissions on backend
- **Rate Limiting**: Can throttle tool usage
- **Auditing**: Complete audit trail
- **Validation**: Backend validates all parameters
- **Business Logic**: Any tool-specific logic runs for ALL callers

**Example log output:**
```json
{
  "level": "info",
  "msg": "Tool call received",
  "callId": "tool_slide_1737489234567_abc123",
  "toolName": "slide",
  "args": {
    "action": "show",
    "title": "My Slide",
    "content": "# Long Content\n\nLorem ipsum dolor sit amet...",
    "content_truncated": true,
    "content_original_length": 5000
  }
}
```

### ✅ Consistency
- All tools follow same pattern
- Easier to reason about
- Easier to debug
- Easier to add features
- Predictable behavior

## Implementation Components

### 1. Tool Implementation (Backend-First)

**File:** `src/app/lib/tools/ui/slides.ts`

```typescript
export async function slide(args, context): Promise<ToolResponse> {
  // Check for socket communication (available in ALL contexts)
  if (!context.sendClientEvent) {
    return { status: 'error', data: { error: 'Socket not available' } };
  }

  // Generate unique call ID
  const callId = `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create pending request
  const resultPromise = requestManager.createPendingRequest(callId, 'tool_result', 5000);
  
  // Send socket event to frontend
  context.sendClientEvent({
    type: 'ui.slide.create',
    data: { callId, title, content }
  });
  
  // Wait for response
  const result = await resultPromise;
  return result;
}
```

**Key points:**
- Uses `context.sendClientEvent` (available in frontend AND backend contexts)
- Sends socket event to frontend
- Waits for response via promise
- Returns consistent `{ status, data }` shape

### 2. Server-Side Registration

**File:** `src/app/lib/tools/builtin/register.ts`

```typescript
import { slide } from '../ui/slides';

export async function registerBuiltinTools() {
  const registry = ToolRegistry.getInstance();
  
  await registry.register({
    type: 'function',
    name: 'slide',
    description: '...',
    parameters: { ... }
  }, slide);
}
```

**Key points:**
- Registers the actual tool implementation
- Used by backend agents directly
- Used by frontend agents via tool stub

### 3. Client-Side Stub Registration

**File:** `src/app/lib/tools/builtin/register-client.ts`

```typescript
import { createToolStub } from '@/app/lib/tools/client/tool-calling-shim';

export async function registerBuiltinToolsClient() {
  const registry = ToolRegistry.getInstance();
  
  const slideDefinition = {
    type: 'function' as const,
    name: 'slide',
    description: '...',
    parameters: { ... },
    handler: async () => ({ status: 'error', data: { error: 'Not implemented' } })
  };
  
  const slideStub = createToolStub('slide', slideDefinition);
  await registry.register(slideDefinition, slideStub.handler);
}
```

**Key points:**
- Creates a stub that forwards to server
- Stub sends `tool.call` socket event
- Waits for `tool.response` socket event
- Returns result to agent

### 4. Generic Tool Stub

**File:** `src/app/lib/tools/client/tool-calling-shim.ts`

```typescript
export function createToolStub(toolName: string, toolDefinition: ToolDefinition) {
  return {
    ...toolDefinition,
    handler: async (args: any, context: ToolContext): Promise<ToolResponse> => {
      // Generate unique call ID
      const callId = `tool_${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create promise that resolves when we receive response
      const resultPromise = new Promise<ToolResponse>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingToolCalls.delete(callId);
          reject(new Error(`Timeout waiting for tool response: ${toolName}`));
        }, 30000);
        
        pendingToolCalls.set(callId, { resolve, reject, timeout });
      });
      
      // Send tool call to server via Socket.IO
      // Include experienceId from context for tools that need artifact access
      globalSocket.emit('tool.call', {
        callId,
        toolName,
        args,
        sessionId: 'current-session',
        experienceId: context.experienceId  // CRITICAL for artifact-aware tools
      });
      
      // Wait for server response
      const result = await resultPromise;
      return result;
    }
  };
}
```

**Key points:**
- Generic stub works for ANY tool
- Sends `tool.call` socket event with `experienceId` from context
- Waits for `tool.response` socket event
- Handles timeouts and errors
- **IMPORTANT**: The `experienceId` enables artifact-aware tools on the server

### 5. Frontend Event Handler

**File:** `src/app/hooks/useHandleServerEvent.ts`

```typescript
case "ui.slide.create": {
  const data = (serverEvent as any).data;
  (async () => {
    try {
      // Import utilities
      const { setSlideComponent } = await import('@/app/lib/tools/ui/slides/SlideManager');
      const { generateUUID } = await import('@/app/lib/uuid');
      const React = await import('react');
      const { SlideComponent } = await import('@/app/lib/tools/ui/slides/SlideComponent');
      
      // Generate slide ID
      const slideId = `slide-${generateUUID()}`;
      
      // Create React component
      const component = React.createElement(SlideComponent, {
        id: slideId,
        title: data.title,
        content: data.content
      });
      
      // Register component
      setSlideComponent(slideId, component);
      
      // Send success response back to backend
      sendClientEvent({
        type: 'tool_result',
        data: {
          callId: data.callId,
          result: {
            status: 'success',
            data: { slideId, title: data.title }
          }
        }
      });
    } catch (error) {
      // Send error response
      sendClientEvent({
        type: 'tool_result',
        data: {
          callId: data.callId,
          result: {
            status: 'error',
            data: { error: error.message }
          }
        }
      });
    }
  })();
  break;
}
```

**Key points:**
- Receives `ui.slide.create` event
- Creates UI element
- Sends `tool_result` back to backend
- Handles errors gracefully

## Tools Using This Pattern

| Tool | Purpose | Socket Events |
|------|---------|---------------|
| `observe` | Query UI state | `ui.observe.request` → `tool_result` |
| `present` | Control UI windows | `ui.element.*` → `tool_result` |
| `slide` | Create slides | `ui.slide.create` → `tool_result` |

## CRITICAL: Tool Context Requirements

### Two Categories of Backend-First Tools

Not all backend-first tools have the same context requirements:

| Category | Examples | Context Needs |
|----------|----------|---------------|
| **UI-Only** | `observe`, `present`, `slide.show` | `sendClientEvent`, `requestManager` |
| **Artifact-Aware** | `slide.showArtifact` | `sendClientEvent`, `requestManager`, **`getArtifact`** |

### The experienceId Problem

**UI-Only tools** only need socket communication - they send commands to the client and wait for responses. They don't need file system access.

**Artifact-Aware tools** need to read files from disk. The `getArtifact` function requires knowing WHERE to look for files:

```
storage/{experienceId}/session_data/{sessionId}/artifacts/
```

Without `experienceId`, the tool cannot construct the correct file path.

### How Context is Created (server.ts)

When the server receives a `tool.call` event, it creates context based on what's available:

```typescript
if (experienceId && sessionId) {
  // Full context with artifact support
  const baseContext = await createServerToolContext(experienceId, sessionId);
  context = {
    ...baseContext,  // Includes getArtifact, listArtifacts, etc.
    requestManager,
    sendClientEvent: (event) => { ... }
  };
} else {
  // Minimal context for UI-only tools
  context = {
    sessionId,
    requestManager,
    sendClientEvent: (event) => { ... }
    // NO getArtifact - tools that need it will fail gracefully
  };
}
```

### Client Must Pass experienceId

The client-side stub (`tool-calling-shim.ts`) must include `experienceId` from context:

```typescript
globalSocket.emit('tool.call', {
  callId,
  toolName,
  args,
  sessionId: 'current-session',
  experienceId: context.experienceId  // CRITICAL for artifact-aware tools!
});
```

### Migration Note for New Tools

When converting a tool to backend-first:

1. **Determine if your tool needs file/artifact access**
2. **If YES (artifact-aware)**: Your tool will receive full context with `getArtifact` when client passes `experienceId`
3. **If NO (UI-only)**: Your tool only needs `sendClientEvent` and `requestManager`
4. **Always check** for required context functions before using them:

```typescript
if (!context.getArtifact) {
  return {
    status: 'error',
    data: { error: 'getArtifact not available in context' }
  };
}
```

## Benefits Summary

1. **One Code Path**: Same implementation for all contexts
2. **Backend Visibility**: All tool calls go through server
3. **Centralized Logic**: Logging, validation, authorization in one place
4. **Future-Proof**: Easy to add features that apply to all callers
5. **Debuggable**: Clear flow through socket events
6. **Testable**: Can test tool calls independently of context

## Migration Checklist

To convert a tool to backend-first pattern:

- [ ] **Determine context requirements**: Does your tool need artifact/file access?
- [ ] Rewrite tool to use `context.sendClientEvent`
- [ ] **If artifact-aware**: Add graceful check for `context.getArtifact`
- [ ] Add server-side registration in `register.ts`
- [ ] Add client-side stub in `register-client.ts` (uses `createToolStub`)
- [ ] Add frontend event handler in `useHandleServerEvent.ts`
- [ ] Remove old direct context functions
- [ ] Update tool context type definitions
- [ ] Test from frontend agent
- [ ] Test from backend agent
- [ ] **Test artifact-aware actions** (if applicable)
- [ ] Update documentation

## Related Documents

- `ai_context/changes/artifact-slide-refactor-phase3-complete.md` - Slide tool conversion
- `ai_context/quick-reference/socket-based-delegation.md` - Socket delegation pattern
- `ai_context/quick-reference/slide-tool-usage.md` - Slide tool usage guide
