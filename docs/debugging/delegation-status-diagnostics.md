# Delegation Status Diagnostics

## Overview

This document explains how to diagnose delegation status issues using the enhanced logging and diagnostic endpoints.

## Quick Test

### 1. Test Internal Fetch Capability

```bash
curl https://your-app.onrender.com/api/diagnostic/internal-fetch | jq
```

**Expected Result:** All tests should pass (status 200, ok: true)

**If tests fail:** The backend cannot reach itself via the public URL. See "Solutions" below.

### 2. Test Actual Delegation

1. Log into the app in staging/production
2. Open browser DevTools Console
3. Trigger a delegation (use the delegate tool)
4. Watch for log messages

## Log Messages to Look For

### Backend Logs (Server-side)

When a delegation status update is sent, you should see:

```
[backend-agent-delegation-status] Attempting to send delegation status message
  sessionId: "abc123..."
  delegationId: "def456..."
  message: "Thinking..."
  baseUrl: "https://your-app.onrender.com"
  url: "https://your-app.onrender.com/api/socket-delegation-status"
  env: {
    NODE_ENV: "production",
    NEXT_PUBLIC_SOCKET_SERVER_URL: "https://your-app.onrender.com",
    PORT: "10000"
  }
```

**Success:**
```
[backend-agent-delegation-status] Delegation status message sent successfully
  message: "Thinking..."
  baseUrl: "https://your-app.onrender.com"
  fetchDuration: 45
```

**Failure:**
```
[backend-agent-delegation-status] Failed to send delegation status message - non-OK response
  status: 500
  statusText: "Internal Server Error"
  responseText: "..."
  fetchDuration: 2000
```

**Network Error:**
```
[backend-agent-delegation-status] Error sending delegation status message - fetch threw exception
  errorMessage: "fetch failed"
  errorName: "TypeError"
  baseUrl: "https://your-app.onrender.com"
```

### Socket Server Logs (server.ts)

When the socket server receives a delegation status update:

```
[socket-server] Received delegation status update
  sessionId: "abc123..."
  delegationId: "def456..."
  status: "Thinking..."
  agentName: "Test Agent"
  totalSockets: 2
```

```
[socket-server] Emitting delegation status to socket
  socketId: "xyz789..."
  sessionId: "abc123..."
```

```
[socket-server] Total delegation status updates sent
  updatesSent: 1
```

**If updatesSent is 0:** No socket with matching session ID was found!

### Client Logs (Browser Console)

When the client connects:

```
[SocketController] Connecting to socket server
  socketUrl: "https://your-app.onrender.com"
  sessionId: "abc123..."
  existingSessionId: "abc123..."
  hasSessionId: true
```

```
[SocketController] Socket connected successfully
  socketId: "xyz789..."
  sessionId: "abc123..."
  transport: "websocket"
```

When a delegation status message is received:

```
[SocketController] Received server:message
  messageType: "delegation.status"
  data: {
    delegationId: "def456...",
    status: "Thinking...",
    agentName: "Test Agent"
  }
  sessionId: "abc123..."
  socketId: "xyz789..."
```

```
[SocketController] Processing delegation.status message
  delegationId: "def456..."
  status: "Thinking..."
  agentName: "Test Agent"
  sessionId: "abc123..."
```

```
[SocketController] Delegation status updated in manager
  delegationId: "def456..."
```

```
[DelegationManager] Updated delegation status
  id: "def456..."
  status: "Thinking..."
  agentName: "Test Agent"
```

## Common Issues and Solutions

### Issue 1: Session ID Mismatch

**Symptoms:**
- Backend logs show delegation status sent successfully
- Socket server logs show `updatesSent: 0`
- Client never receives messages

**Cause:** The backend is using a different session ID than the client socket connection.

**Debug:**
1. Check backend logs for the `sessionId` being used
2. Check client logs for the `sessionId` in the socket connection
3. Check socket server logs to see what session IDs are connected

**Solution:** Ensure the backend agent is receiving the correct session ID from the request.

### Issue 2: Socket Not Connected

**Symptoms:**
- Client logs don't show "Socket connected successfully"
- May show connection errors

**Cause:** WebSocket connection is failing

**Debug:**
1. Check browser console for connection errors
2. Check Network tab for failed WebSocket connections
3. Verify CORS configuration in `server.ts`
4. Check `ALLOWED_ORIGINS` environment variable

**Solution:** Fix CORS or WebSocket configuration.

### Issue 3: Internal Fetch Fails

**Symptoms:**
- `/api/diagnostic/internal-fetch` shows failed tests
- Backend logs show fetch errors or timeouts

**Cause:** Backend cannot reach itself via public URL

**Solutions:**

#### Option A: Use Internal URL for Backend Communication

Add a new environment variable:

```bash
INTERNAL_SOCKET_SERVER_URL=http://localhost:10000
```

Update `DelegationStatusManager.ts` and `toast.ts`:

```typescript
private static getSocketServerUrl(): string {
  // Use internal URL for backend-to-socket communication
  const internalUrl = env.INTERNAL_SOCKET_SERVER_URL;
  if (internalUrl) {
    return internalUrl;
  }
  
  // Fall back to public URL
  const publicSocketUrl = env.NEXT_PUBLIC_SOCKET_SERVER_URL;
  if (publicSocketUrl) {
    return publicSocketUrl;
  }
  
  // Local development fallback
  const port = env.PORT || '3000';
  return `http://localhost:${port}`;
}
```

#### Option B: Fix Network Routing

Work with your hosting provider to ensure the server can reach its own public URL.

### Issue 4: Messages Sent Before Socket Connected

**Symptoms:**
- Backend logs show messages sent successfully
- Socket server logs show `updatesSent: 0` initially
- Client connects later and misses early messages

**Cause:** Timing issue - delegation starts before socket connection is established

**Solution:** The `SocketController` already has `autoConnect: true` for the delegation controller. Ensure the socket is connected before triggering delegations, or implement a message queue.

## Testing Checklist

- [ ] Run `/api/diagnostic/internal-fetch` - all tests pass
- [ ] Trigger delegation in UI
- [ ] Backend logs show "Attempting to send delegation status message"
- [ ] Backend logs show "Delegation status message sent successfully"
- [ ] Socket server logs show "Received delegation status update"
- [ ] Socket server logs show "updatesSent: 1" (or more)
- [ ] Client logs show "Received server:message" with type "delegation.status"
- [ ] Client logs show "Processing delegation.status message"
- [ ] Client logs show "Delegation status updated in manager"
- [ ] UI shows delegation status widget with updates

## Additional Debugging

### Enable Debug Logging

Set the log level to debug in your environment:

```bash
LOG_LEVEL=debug
```

### Check Socket Connections

In the browser console:

```javascript
// Check if socket is connected
window.socket?.connected

// Check socket ID
window.socket?.id

// Check session ID
sessionStorage.getItem('primer:session-id')
```

### Monitor Socket Events

In the browser console:

```javascript
// Listen to all socket events
if (window.socket) {
  window.socket.onAny((eventName, ...args) => {
    console.log('Socket event:', eventName, args);
  });
}
```

## Contact

If you're still having issues after following this guide, collect:
1. Backend logs (with timestamps)
2. Socket server logs (with timestamps)
3. Browser console logs (with timestamps)
4. Output from `/api/diagnostic/internal-fetch`
5. Session ID from both backend and client

This will help identify the exact point of failure.
