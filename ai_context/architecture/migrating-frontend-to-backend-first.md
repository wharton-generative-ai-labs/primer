# Migrating Frontend-First Tools to Backend-First

**Quick Reference Guide**  
**Last Updated:** 2026-01-21

## Overview

This guide documents the process of converting the `slide` tool from frontend-first to backend-first, including all the mistakes we made and had to fix. Use this as a checklist for migrating other tools.

## The Goal

Convert a tool from:
- **Frontend-first:** Tool logic runs in browser, only works with frontend agents
- **Backend-first:** Tool logic runs on server, works with ALL agents (frontend + backend), uses socket communication

## Migration Steps

### 1. Update Tool Implementation (Backend)

**File:** `src/app/lib/tools/ui/slides.ts`

**Changes:**
- ✅ Remove all frontend dependencies (React imports, DOM access, etc.)
- ✅ Remove dependency on `ToolContext` frontend methods
- ✅ Add socket communication via `context.sendClientEvent`
- ✅ Use `requestManager.createPendingRequest()` to await UI responses
- ✅ Return consistent `{ status, data }` shape

**Example:**
```typescript
export async function slide(args, context): Promise<ToolResponse> {
  // Check for socket
  if (!context.sendClientEvent) {
    return { status: 'error', data: { error: 'Socket not available' } };
  }

  const callId = `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create pending request
  const resultPromise = context.requestManager.createPendingRequest(
    callId, 
    'tool_result', 
    5000
  );
  
  // Send UI command to frontend
  context.sendClientEvent({
    type: 'ui.slide.create',
    data: { callId, title, content }
  });
  
  // Wait for response
  const result = await resultPromise;
  return result;
}
```

### 2. Register Tool on Server

**File:** `src/app/lib/tools/builtin/register.ts`

**Changes:**
- ✅ Import the tool
- ✅ Register with ToolRegistry

```typescript
import { slide } from '../ui/slides';

export async function registerBuiltinTools() {
  await registry.register({
    type: 'function',
    name: 'slide',
    description: '...',
    parameters: { ... }
  }, slide);
}
```

### 3. Register Tool Stub on Client

**File:** `src/app/lib/tools/builtin/register-client.ts`

**Changes:**
- ✅ Create tool definition
- ✅ Use `createToolStub()` to create client-side stub
- ✅ Register stub with ToolRegistry

```typescript
import { createToolStub } from '@/app/lib/tools/client/tool-calling-shim';

export async function registerClientBuiltinTools() {
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

### 4. Add Socket Listener (Frontend)

**File:** `src/app/components/SocketController.tsx`

**Changes:**
- ✅ Add socket event listener
- ✅ Forward to `handleServerEvent`

```typescript
socket.on('ui.slide.create', (data: UISlideCreateEvent) => {
  handleServerEvent.current({ type: 'ui.slide.create', data });
});
```

### 5. Add Event Handler (Frontend)

**File:** `src/app/hooks/useHandleServerEvent.ts`

**Changes:**
- ✅ Import `getGlobalSocket`
- ✅ Add case handler
- ✅ Create UI element
- ✅ **Use direct socket.emit() for response** (NOT sendClientEvent!)

```typescript
import { getGlobalSocket } from '@/app/lib/tools/client/tool-calling-shim';

case "ui.slide.create": {
  const data = (serverEvent as any).data;
  (async () => {
    const socket = getGlobalSocket();
    if (!socket) {
      logger.error('No socket available');
      return;
    }

    try {
      // Create UI element
      const slideId = createSlide(data.title, data.content);
      
      // Send response DIRECTLY via socket
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'success',
        data: { slideId, title: data.title }
      });
    } catch (error) {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'error',
        data: { error: error.message }
      });
    }
  })();
  break;
}
```

### 6. Add Socket Type Definitions

**File:** `src/app/types/socket.ts`

**Changes:**
- ✅ Create event interface
- ✅ Add to `ServerToClientEvents`

```typescript
export interface UISlideCreateEvent {
  callId: string;
  title: string;
  content: string;
}

export interface ServerToClientEvents {
  'ui.slide.create': (data: UISlideCreateEvent) => void;
  // ... other events
}
```

### 7. Add Server Socket Handler

**File:** `server.ts`

**Changes:**
- ✅ Import tool in `tool.call` handler
- ✅ Add to toolMap
- ✅ Add event type to `sendClientEvent` switch

```typescript
socket.on('tool.call', async (data) => {
  const { slide } = await import('./src/app/lib/tools/ui/slides');
  
  const toolMap = {
    observe,
    present,
    slide  // Add here
  };
  
  // ... later in sendClientEvent ...
  if (event.type === 'ui.slide.create') {
    socket.emit('ui.slide.create', event.data);
  }
});
```

### 8. Remove Old Registration

**File:** `src/app/lib/tools/ui/index.ts`

**Changes:**
- ✅ Remove tool import/export
- ✅ Convert `registerXxxTools()` to no-op or delete

```typescript
// REMOVE:
import { slide } from './slides';
export { slide };

// CONVERT TO NO-OP:
export async function registerSlideTools() {
  logger.debug({}, 'Slide tool registration skipped (now in builtin tools)');
  // No-op
}
```

### 9. Add to Builtin Tool Group

**File:** `src/app/lib/tools/groups.ts`

**Changes:**
- ✅ Add tool to `'builtin'` group in `TOOL_GROUPS`

```typescript
export const TOOL_GROUPS: Record<string, string[]> = {
  'builtin': [
    'scene',
    'information',
    // ... other tools ...
    'observe',
    'present',
    'slide'  // Add here!
  ],
  // ... other groups ...
};
```

**Why:** Backend agents default to `['builtin', 'experience', 'matter-compiler', 'image-generator']` groups. If your tool isn't in one of these groups, backend agents won't have access to it!

## Common Mistakes We Made

### ❌ Mistake 1: Forgot to Remove Old Registration

**Problem:** Old frontend-first registration in `ui/index.ts` was overwriting new backend-first registration.

**Symptom:** Tool called directly without going through socket.

**Fix:** Remove or disable old registration function.

### ❌ Mistake 2: Missing Socket Listener

**Problem:** Forgot to add `socket.on('ui.slide.create')` listener in `SocketController.tsx`.

**Symptom:** Backend sent event, frontend never received it, timeout.

**Fix:** Add socket listener that forwards to `handleServerEvent`.

### ❌ Mistake 3: Used sendClientEvent for Response

**Problem:** Used `sendClientEvent()` which wraps in `client:message`, but backend expects direct `tool.result` event.

**Symptom:** Backend received message but couldn't parse it, timeout.

**Fix:** Use `getGlobalSocket()` and `socket.emit('tool.result', ...)` directly.

**See:** `ai_context/architecture/socket-emission-pattern.md` for detailed explanation.

### ❌ Mistake 4: Missing Socket Type Definition

**Problem:** TypeScript error because `ui.slide.create` not in `ServerToClientEvents`.

**Fix:** Add event interface and register in socket types.

### ❌ Mistake 5: Tool Not in Builtin Group

**Problem:** Tool registered but not added to `'builtin'` group in `groups.ts`. Backend agents couldn't access it.

**Symptom:** Frontend agents work fine, but backend agents don't have the tool.

**Fix:** Add tool name to `TOOL_GROUPS['builtin']` array.

## Verification Checklist

After migration, verify:

**Frontend Agent:**
- [ ] Backend logs show "Tool call received" with tool name
- [ ] Backend logs show tool execution (no "Socket not available" errors)
- [ ] Frontend receives socket event (check browser console)
- [ ] UI element appears on screen
- [ ] Backend logs show "Received tool.result from client"
- [ ] Backend logs show tool response sent back
- [ ] Agent receives successful response (no timeout)

**Backend Agent (Delegated):**
- [ ] Tool appears in backend agent's tool list (check logs: `toolNames`)
- [ ] Backend agent can successfully call the tool
- [ ] Tool execution completes without errors

**General:**
- [ ] No TypeScript/linter errors
- [ ] Tool in `'builtin'` group in `groups.ts`

## Testing Commands

```bash
# Check for old registrations
rg "name.*['\"]TOOLNAME['\"]" src/app/lib/tools --type ts

# Check for old imports
rg "import.*TOOLNAME" src/app/lib/tools --type ts

# Check for old exports
rg "export.*TOOLNAME" src/app/lib/tools --type ts

# Check socket listeners
rg "socket\.on.*EVENTNAME" src/app --type ts

# Run linter
npm run lint

# Run tests
npm test
```

## Key Principles

1. **One code path:** Backend-first means ONE implementation for all contexts
2. **Socket communication:** All UI operations go through socket events
3. **Direct emission:** Responses use `socket.emit()` directly, NOT `sendClientEvent()`
4. **Request/response pattern:** Use `requestManager` to await UI responses
5. **Consistent structure:** Always return `{ status, data }` shape

## Related Documents

- `ai_context/architecture/backend-first-tool-pattern.md` - Overall architecture
- `ai_context/architecture/socket-emission-pattern.md` - Socket communication patterns
- `ai_context/changes/slide-tool-registration-fix.md` - Complete slide migration details
- `ai_context/quick-reference/slide-tool-usage.md` - Usage examples

## Tools Still To Migrate

Frontend-first tools that need migration:
- `celebrate` - Confetti animation
- `diagram` (mermaid) - Diagram display
- `note` - Sticky notes
- `customComponent` - Custom React components

Use this guide for each migration!
