# Socket-Based Delegation Architecture

## Overview

Backend agents now execute via Socket.IO instead of HTTP, enabling them to use UI tools (`observe` and `present`) that require bidirectional socket communication.

## Architecture Flow

```
Client (Realtime Agent)
  ↓ calls delegate tool
  ↓ emit('agent.delegate', {...})
Socket.IO Server
  ↓ receives agent.delegate event
  ↓ executes backend agent with socket context
Backend Agent Execution
  ↓ can now call observe/present tools
  ↓ sends ui.observe.request via socket
  ↓ receives ui.observe.response via socket
  ↓ emits delegation:status updates
  ↓ emits delegation:tool updates
  ↓ emits tool.response (final result)
Client
  ↓ receives updates and final result
  ↓ resolves delegate tool promise
```

## Key Components

### 1. Delegate Tool (`/src/app/lib/tools/delegation/delegate.ts`)
- **Changed**: Now uses Socket.IO instead of HTTP
- Emits `agent.delegate` event with delegation parameters
- Listens for `tool.response` to get final result
- Uses promise-based async/await pattern

### 2. Socket Server Handler (`/server.ts`)
- **New**: `agent.delegate` event handler
- Imports and calls `executeBackendAgentViaSocket`
- Passes socket and requestManager to backend agent

### 3. Backend Agent Socket Executor (`/src/app/lib/backend-agent-socket.ts`)
- **New**: Executes backend agents in socket context
- Creates socket-aware tool context with:
  - `requestManager`: For awaiting UI responses
  - `sendClientEvent`: For sending UI commands
- Emits streaming updates:
  - `delegation:status`: Status messages ("Thinking", "Starting Agent", etc.)
  - `delegation:tool`: Tool execution notifications
  - `tool.response`: Final result

### 4. Socket-Aware Tool Context
- Extends base server tool context
- Adds socket capabilities:
  - `requestManager`: Manages pending UI requests
  - `sendClientEvent(event)`: Sends events to client via socket

### 5. Client Socket Listeners (`/src/app/components/SocketController.tsx`)
- **New**: Direct listeners for delegation events
- `delegation:status`: Updates delegation overlay
- `delegation:tool`: Shows tool execution progress
- Maintains backward compatibility with `server:message` format

## Socket Events

### Client → Server

#### `agent.delegate`
```typescript
{
  callId: string;
  agentType: string;
  artifactIds?: string[];
  taskDescription?: string;
  experienceId: string;
  sessionId: string;
  delegationId: string;
  imageNames?: string[];
}
```

### Server → Client

#### `delegation:status`
```typescript
{
  sessionId: string;
  delegationId: string;
  status: string; // "Thinking", "Starting Agent", etc.
  agentName?: string;
}
```

#### `delegation:tool`
```typescript
{
  sessionId: string;
  delegationId: string;
  toolName: string;
  agentName?: string;
  action?: string;
}
```

#### `tool.response`
```typescript
{
  callId: string;
  status: 'success' | 'error';
  data: any;
}
```

## Benefits

1. **UI Tool Access**: Backend agents can now use `observe` and `present` tools
2. **Unified Architecture**: All tools follow server-first pattern over sockets
3. **Real-time Updates**: Streaming status and progress updates
4. **Composability**: Tools can call other tools that need UI access
5. **Future-proof**: Foundation for all tools to work this way

## Testing

To test that a delegated agent can use UI tools:

```typescript
// In realtime agent conversation:
"Delegate to the Generic Agent. Ask it to observe the screen and tell me what it sees."
```

Expected flow:
1. Realtime agent calls `delegate` tool
2. `delegate` emits `agent.delegate` via socket
3. Server executes Generic Agent with socket context
4. Generic Agent calls `observe` tool
5. `observe` sends `ui.observe.request` to client
6. Client responds with `ui.observe.response`
7. Generic Agent receives UI state and processes it
8. Server sends final result via `tool.response`
9. Realtime agent receives result and responds to user

## Migration Notes

- HTTP-based delegation (`/api/backend-agent`) still exists for backward compatibility
- New socket-based delegation is the preferred method
- All new tools should assume socket-based execution context
- Tools that need UI access MUST use socket-based delegation

## Related Files

- `/server.ts` - Socket event handlers
- `/src/app/lib/backend-agent-socket.ts` - Backend agent socket execution
- `/src/app/lib/tools/delegation/delegate.ts` - Delegate tool (socket-based)
- `/src/app/lib/tools/builtin/observe-tool.ts` - Observe tool
- `/src/app/lib/tools/builtin/present-tool.ts` - Present tool
- `/src/app/types/socket.ts` - Socket event type definitions
- `/src/app/components/SocketController.tsx` - Client socket listeners
