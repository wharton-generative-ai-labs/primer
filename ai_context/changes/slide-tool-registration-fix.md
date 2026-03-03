# Slide Tool Registration Fix

**Date:** 2026-01-21  
**Issue:** Frontend slide tool calls were failing with "Request manager not available in context"

## Problem

The slide tool was being registered TWICE:

1. **New backend-first registration** in `builtin/register-client.ts` (correct)
2. **Old frontend-first registration** in `ui/index.ts` (incorrect)

The old registration was overwriting the new one, causing the tool to use the OLD implementation which didn't go through the socket-based backend-first pattern.

## Root Cause

When we converted the `slide` tool to backend-first in Phase 3, we:
- ✅ Created new registration in `builtin/register.ts` (server-side)
- ✅ Created new stub registration in `builtin/register-client.ts` (client-side)
- ✅ Updated the tool implementation in `ui/slides.ts`
- ❌ **FORGOT** to remove the old registration in `ui/index.ts`

The `ToolProcessor.ts` was calling `registerSlideTools()` from `ui/index.ts`, which was registering the OLD tool definition that pointed to the OLD implementation.

## Symptom

When a frontend agent called `slide({ action: 'show', ... })`:
1. ToolRegistry found the OLD registration (from `ui/index.ts`)
2. Called the OLD tool implementation
3. OLD implementation expected `context.requestManager` (which doesn't exist on frontend)
4. Returned error: "Request manager not available in context"

**The socket message never reached the backend** because the tool wasn't using the stub!

## Solution

### Part 1: Remove Old Registration

**File:** `src/app/lib/tools/ui/index.ts`

1. **Removed slide import:**
   ```typescript
   // OLD:
   import { slide } from './slides';
   export { slide };
   
   // NEW:
   // (removed - now registered in builtin tools)
   ```

2. **Converted `registerSlideTools()` to no-op:**
   ```typescript
   // OLD: Registered the old slide tool
   export async function registerSlideTools(): Promise<void> {
     await registry.register({ ... }, slide);
   }
   
   // NEW: Does nothing, just logs
   export async function registerSlideTools(): Promise<void> {
     logger.debug({}, 'Slide tool registration skipped (now handled by builtin tools)');
     // No-op: slide tool is registered as a backend-first tool
   }
   ```

### Part 2: Add Socket Listener

**File:** `src/app/components/SocketController.tsx`

The `SocketController` component sets up all socket listeners. It was missing the listener for `ui.slide.create`.

**Added:**
```typescript
socket.on('ui.slide.create', (data: UISlideCreateEvent) => {
  handleServerEvent.current({ type: 'ui.slide.create', data });
});
```

**Also added type import:**
```typescript
import type {
  // ... other types ...
  UISlideCreateEvent,
  // ... more types ...
} from "@/app/types/socket";
```

This listener receives the `ui.slide.create` event from the backend and forwards it to `useHandleServerEvent`, which then creates the slide component and sends back the `tool_result`.

### Part 3: Fix tool_result Socket Emission

**File:** `src/app/hooks/useHandleServerEvent.ts`

The `ui.slide.create` handler was using `sendClientEvent()` to send the `tool_result` back to the backend. However, `sendClientEvent()` wraps all events in a `client:message` envelope, but the backend's `tool.result` handler expects a direct socket event.

**Problem:**
```typescript
// OLD - wrapped in client:message
sendClientEvent({
  type: 'tool_result',
  data: { ... }
});

// Backend receives:
socket.on('client:message', (data) => {
  // data.message.type === 'tool_result'
  // But handler expects direct tool.result event!
});
```

**Solution:**
```typescript
// Import getGlobalSocket
import { getGlobalSocket } from '@/app/lib/tools/client/tool-calling-shim';

// In ui.slide.create handler:
const socket = getGlobalSocket();
socket.emit('tool.result', {
  callId: data.callId,
  status: 'success',
  data: { slideId, title: data.title }
});
```

This matches the pattern used by other UI event handlers (`handleUIElementShow`, etc.) which also emit `tool.result` directly.

## Result

Now when a frontend agent calls `slide({ action: 'show', ... })`:
1. ToolRegistry finds the NEW stub registration (from `builtin/register-client.ts`)
2. Stub sends `tool.call` socket event to backend
3. Backend receives event, logs it at INFO level
4. Backend executes the NEW tool implementation
5. Tool sends `ui.slide.create` socket event to frontend
6. Frontend creates the slide component
7. Frontend sends `tool_result` back to backend
8. Backend sends `tool.response` to client stub
9. Stub returns result to agent

✅ **Full backend-first round trip working correctly!**

## Files Changed

- `src/app/lib/tools/ui/index.ts` - Removed old slide registration
- `src/app/components/SocketController.tsx` - Added `ui.slide.create` socket listener
- `src/app/hooks/useHandleServerEvent.ts` - Fixed `tool_result` to use direct socket.emit

## Testing

To verify the fix:
1. Ask a frontend agent to create a slide
2. Check backend logs for: `"Tool call received"` with `toolName: "slide"`
3. Check frontend for slide appearing
4. No errors should occur

## Related Documents

- `ai_context/changes/artifact-slide-refactor-phase3-complete.md` - Phase 3 conversion
- `ai_context/architecture/backend-first-tool-pattern.md` - Architecture overview
- `ai_context/quick-reference/slide-tool-usage.md` - Usage guide

## Lesson Learned

When converting a tool to backend-first:
- ✅ Create new registrations
- ✅ Update tool implementation
- ✅ **DELETE or disable old registrations** ← We missed this!
- ✅ Search codebase for ALL registrations of the tool name

**Checklist for future tool conversions:**
```bash
# Find all registrations of a tool
rg "name.*['\"]TOOLNAME['\"]" src/app/lib/tools --type ts

# Find all imports of the tool
rg "import.*TOOLNAME" src/app/lib/tools --type ts

# Find all exports of the tool
rg "export.*TOOLNAME" src/app/lib/tools --type ts
```
