# API Routes Reference

All API routes are located in `src/app/api/`.

## Core Routes

### Backend Agent Execution
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/backend-agent` | POST | Execute a backend agent with delegation |

**Request Body:**
```typescript
{
  agentType: string;       // Friendly name of agent
  artifactIds: string[];   // Artifact IDs to pass
  taskDescription?: string;
  experienceId: string;
  imageNames?: string[];
  delegationId?: string;   // For status tracking
}
```

**Headers:**
- `x-session-id`: Current session ID

---

### Session Management
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/session` | GET | Get session information |
| `/api/session-metadata` | GET/POST | Get/update session metadata |
| `/api/sessions/user` | GET | Get user's most recent session for an experience |

**Session Recovery (`/api/sessions/user`):**

Used to check if a user has a previous session for an experience, enabling session recovery.

```
GET /api/sessions/user?experienceId={id}
```

**Response:**
```json
{
  "session": {
    "sessionId": "sess_xxx",
    "experienceId": "my-experience",
    "startTime": "2025-01-01T00:00:00Z",
    "lastActivity": "2025-01-01T01:00:00Z",
    "userName": "John Doe",
    "userEmail": "john@example.com"
  },
  "hasArtifacts": true
}
```

Returns `{ "session": null }` if no previous session exists.

---

## Experience Management

### Experiences
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/experiences` | GET | List all experiences |
| `/api/experiences/[id]` | GET | Get specific experience |
| `/api/experience` | GET | Get experience config by URL param |

---

### Resources
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/resources` | GET | List experience resources |
| `/api/resources/tools` | GET | Get tool definitions |
| `/api/resource-content` | GET | Get resource file content |
| `/api/save-resource` | POST | Save resource to experience |

---

### Storage
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/storage/[...path]` | GET | Get file from storage path |
| `/api/download` | GET | Download file or ZIP |

---

## Artifacts

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/artifacts/list` | GET | List artifacts for session |
| `/api/artifacts/create` | POST | Create new artifact |
| `/api/artifacts/[id]` | GET/DELETE | Get or delete artifact |
| `/api/artifacts/[id]/update` | POST | Update artifact content |

**Query Parameters:**
- `experienceId`: Experience ID
- `sessionId`: Session ID

---

## File Uploads

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/upload` | POST | Upload file (general) |
| `/api/user-upload` | POST | Upload user file |
| `/api/user-upload/list` | GET | List user uploads |
| `/api/file-info/[...path]` | GET | Get file info and content |

---

## Classes & Access Control

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/classes` | GET/POST | List/create classes |
| `/api/classes/[classId]` | GET/PUT/DELETE | Class CRUD |
| `/api/classes/check-access` | GET | Check user's class access |

---

## Analytics

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/analytics/run` | POST | Run analytics agent |
| `/api/analytics/sessions-index` | GET/POST | Get/refresh sessions index |

---

## OpenAI Proxy Routes

These routes proxy requests to OpenAI APIs:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/openai/text` | POST | Text completion |
| `/api/openai/multi` | POST | Multi-modal completion |
| `/api/openai/vision` | POST | Vision analysis |
| `/api/openai/generate-image` | POST | DALL-E image generation |
| `/api/openai/websearch` | POST | Web search via OpenAI |

---

## Authentication

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | * | NextAuth.js handlers |

---

## Admin

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/users` | GET | List users (admin only) |

---

## Utility

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/proxy` | GET/POST | Generic proxy for external URLs |

---

## Socket.IO Endpoints (via server.ts)

These are handled by the custom server, not Next.js API routes:

| Path | Purpose |
|------|---------|
| `/api/socketio` | Socket.IO WebSocket connection |
| `/api/toast` | Send toast notification to session |
| `/api/socket-delegation-status` | Send delegation status update |

---

## Common Response Patterns

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

### Artifact Response
```json
{
  "id": "uuid",
  "name": "Artifact Name",
  "type": "markdown",
  "content": "...",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

---

## Authentication

Most routes require authentication via NextAuth.js. The session token is automatically included in requests from the frontend.

For backend-to-backend calls (like delegation), use the `x-session-id` header to identify the session.

---

## CORS

The Socket.IO server allows all origins (`*`). API routes follow Next.js defaults.
