# WebSocket Security - AI Review

- **Review Date:** 2026-01-27
- **Reviewer:** Claude (AI)
- [x] **Status:** Complete

---

## Scope

### Files Reviewed

| File                      | Lines        | Purpose                 |
| ------------------------- | ------------ | ----------------------- |
| `server.ts`               | 552          | Main Socket.IO server   |
| `src/app/types/socket.ts` | (referenced) | Socket type definitions |

### Areas Examined

1. CORS configuration
2. Origin validation
3. Session-socket binding
4. Message validation/sanitization
5. Event namespace security
6. Rate limiting / DoS protection
7. Authentication on socket connections

---

## Findings

### [HIGH] No Authentication on WebSocket Connections

**Location:** `server.ts:243-269`

**Description:** Socket connections are accepted without any authentication verification. The server only checks for an optional `sessionId` in the handshake auth, but does not verify that the connecting client is an authenticated user.

**Evidence:**

```typescript
// server.ts:243-269
io.on("connection", async (socket) => {
  logger.info({ socketId: socket.id }, "Client connected");

  // Handle session restoration - sessions should only be created through the /play/ route
  const existingSessionId = socket.handshake.auth.sessionId;
  if (existingSessionId) {
    const existingSession = sessionStore.get(existingSessionId);
    if (existingSession) {
      socket.data.sessionId = existingSessionId;
      // ...
    } else {
      // Adopt the client's session ID - no validation!
      socket.data.sessionId = existingSessionId;
      createNewSession(existingSessionId);
    }
  } else {
    // Client connected without session ID - still allowed!
    logger.debug(
      "Client connected without session ID - operating in session-less mode",
    );
    socket.data.sessionId = undefined;
  }
  // No JWT/token verification anywhere
});
```

**Impact:**

1. Unauthenticated clients can connect to the WebSocket server
2. Attackers can listen to socket events
3. Session IDs can be guessed/brute-forced to hijack sessions
4. No way to associate socket connections with authenticated users

**Recommendation:**

1. Verify JWT token in socket handshake before accepting connection
2. Associate socket connections with authenticated user identity
3. Reject connections without valid authentication

---

### [HIGH] Session ID Adoption Without Validation - Session Probing Attack

**Location:** `server.ts:256-261`

**Description:** When a client provides a session ID that doesn't exist in the session store, the server simply adopts it and creates a new session entry. When a session ID DOES exist, the client joins that session. This allows attackers to probe for active sessions.

**Evidence:**

```typescript
// server.ts:256-261
} else {
    // Session not in socket store, but client has one
    // Adopt the client's session ID and create a socket session entry for it
    socket.data.sessionId = existingSessionId;
    createNewSession(existingSessionId);
    logger.debug({ sessionId: existingSessionId }, 'Adopted client session ID');
}
```

**Attack Scenario - Session Probing:**

1. Attacker collects or guesses potential session IDs (sequential, common patterns, previously observed)
2. Attacker connects with each candidate ID
3. If session exists → attacker joins victim's session and receives their events
4. If session doesn't exist → new session created (can be ignored)
5. No rate limiting on connection attempts makes brute-forcing viable

**Session ID Predictability:**

- If session IDs are UUIDs, brute-forcing is infeasible (128-bit)
- If session IDs are user-provided or short, attack is trivial
- Code shows client can provide ANY string as session ID

**Impact:**

1. Session hijacking if IDs are predictable or leaked
2. Attackers can join arbitrary sessions and receive real-time events
3. No binding between session ID and user identity allows cross-user access

**Recommendation:**

1. **Never adopt client-provided session IDs** - Always generate server-side
2. Use cryptographically random session IDs (UUID v4 or similar)
3. Bind session IDs to authenticated user identity
4. Rate limit connection attempts per IP
5. Log and alert on session adoption patterns

---

### [HIGH] In-Memory Session Store - Resource Exhaustion Vulnerability

**Location:** `server.ts:33-71`

**Description:** The session store is a simple in-memory Map with no security controls. This is vulnerable to a "Slowloris-style" attack where an attacker opens thousands of connections and keeps them alive without activity, exhausting server memory.

**Evidence:**

```typescript
// server.ts:41-71
class InMemorySessionStore {
  private sessions: Map<string, Session> = new Map();

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  set(id: string, session: Session): void {
    this.sessions.set(id, session);
  }
  // No cleanup, no expiration, no limits, no TTL
}
```

**Attack Scenario:**

1. Attacker opens connections from multiple IPs (or uses a botnet)
2. Each connection creates/adopts a session (no auth required)
3. Connections are kept alive but idle (minimal bandwidth)
4. Server memory grows until OOM crash
5. No authentication means attack is trivial to execute

**Impact:**

1. **Server crash** - Memory exhaustion causes OOM kill
2. **Service degradation** - Memory pressure slows all users
3. **No recovery** - Sessions persist until server restart
4. Sessions cannot be invalidated without server restart

**Recommendation:**

1. **Hard connection limit** - Maximum concurrent connections (e.g., 1000)
2. Implement session TTL (e.g., 1 hour idle timeout)
3. Add per-IP connection limits
4. Implement session eviction for idle connections
5. Add memory usage monitoring and alerts

---

### [HIGH] No Rate Limiting on Socket Events - Financial DoS Vector

**Location:** `server.ts:283-341`, `server.ts:349-467`

**Description:** There is no rate limiting on any socket event handlers. Clients can send unlimited events, including events that trigger LLM API calls.

**Evidence:**

```typescript
// server.ts:283-341 - client:message handler
socket.on("client:message", async (data: { message: string | object }) => {
  // No rate limiting
  // Processes every message immediately
});

// server.ts:349-467 - tool.call handler
socket.on("tool.call", async (data) => {
  // No rate limiting
  // Executes tools for every call - many tools trigger LLM calls
});
```

**Impact:**

1. **Financial DoS** - Unbounded events triggering LLM calls (OpenAI, Anthropic, Google AI) can exhaust API quotas and incur significant costs. A single malicious client could rack up thousands of dollars in API fees.
2. **Service DoS** - Event flooding exhausts server CPU/memory
3. **Quota exhaustion** - Legitimate users blocked when API limits hit

**Cost Analysis:**

- GPT-4 Turbo: ~$0.01-0.03 per request
- 1000 requests/second = $600-1800/minute potential damage
- No authentication required to connect

**Recommendation:**

1. **Budget-aware rate limiting** - Track estimated API cost per session and enforce limits
2. Implement per-connection rate limiting (e.g., 10 messages/second)
3. Add global rate limiting for LLM-triggering operations
4. Implement connection-level quotas
5. Add alerting on unusual usage patterns

---

### [MEDIUM] Internal HTTP Endpoints Without Authentication

**Location:** `server.ts:81-117`, `server.ts:119-159`

**Description:** The `/api/toast` and `/api/socket-delegation-status` endpoints are raw HTTP handlers that bypass Next.js middleware and have no authentication.

**Evidence:**

```typescript
// server.ts:81-117
if (parsedUrl.pathname === "/api/toast" && req.method === "POST") {
  // No authentication check
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", () => {
    const { sessionId, message, type = "default" } = JSON.parse(body);
    // Broadcasts to session without auth verification
  });
}
```

**Impact:**

1. Anyone can send toast notifications to any session
2. Anyone can send delegation status updates
3. Potential for spoofing attacks against users

**Recommendation:**

1. Add authentication to these endpoints (API key, JWT, etc.)
2. Or route them through Next.js middleware
3. Validate that the caller has permission to send to the target session

---

### [MEDIUM] CORS Allows No-Origin Requests in Development

**Location:** `server.ts:209-211`

**Description:** In development mode, requests without an origin header are allowed, which could permit attacks from non-browser clients.

**Evidence:**

```typescript
// server.ts:209-211
cors: {
  origin: (origin, callback) => {
    // Allow requests with no origin in development only
    if (!origin && dev) {
      return callback(null, true);
    }
    // ...
  };
}
```

**Impact:** In development, tools like curl, Postman, or malicious scripts can connect without origin restrictions.

**Assessment:** This is acceptable for development but should be verified it's disabled in production.

**Recommendation:** Ensure `dev` flag is properly set in production environments.

---

### [LOW] No Input Validation on Socket Event Data

**Location:** `server.ts:283-295`

**Description:** The `client:message` handler attempts to parse JSON but has minimal validation of the message structure.

**Evidence:**

```typescript
// server.ts:283-295
socket.on("client:message", async (data: { message: string | object }) => {
  let parsed: any;
  try {
    parsed =
      typeof data.message === "string"
        ? JSON.parse(data.message)
        : data.message;
  } catch (err) {
    logger.error({ err, message: data.message }, "Failed to parse message");
    return;
  }

  if (parsed.type === "session.update") {
    // Updates session with arbitrary data from client
    sessionStore.update(socket.data.sessionId, {
      data: {
        ...currentSession?.data,
        ...parsed.session, // No validation of what's being stored
      },
    });
  }
});
```

**Impact:**

1. Clients can store arbitrary data in sessions
2. Potential for injection if session data is used unsafely elsewhere
3. Memory exhaustion via large payloads

**Recommendation:**

1. Define and validate expected message schemas
2. Limit payload sizes
3. Sanitize data before storing

---

### [LOW] Tool Execution Context Created from Client Data

**Location:** `server.ts:385-448`

**Description:** Tool execution context uses `sessionId` and `experienceId` from either socket data or the event data, allowing clients to specify these values.

**Evidence:**

```typescript
// server.ts:385-386
const sessionId = socket.data.sessionId || data.sessionId; // Client can provide
const experienceId = data.experienceId; // Always from client
```

**Impact:** Clients could potentially specify different experience IDs to access resources from other experiences.

**Recommendation:**

1. Validate that the connected user has permission to access the specified experience
2. Prefer server-side session data over client-provided values

---

### [INFORMATIONAL] CORS Allowlist Properly Implemented

**Location:** `server.ts:173-227`

**Description:** The CORS configuration uses an allowlist approach with multiple sources of allowed origins.

**Evidence:**

```typescript
// server.ts:173-197
const buildAllowedOrigins = (): string[] => {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(",").map((origin: string) =>
      origin.trim(),
    );
  }
  // ... derives from NEXT_PUBLIC_SOCKET_SERVER_URL
  return [
    "http://localhost:3000",
    ...(dev ? ["http://localhost:3001", "http://127.0.0.1:3000"] : []),
  ];
};
```

**Assessment:** This is a positive security pattern - allowlist instead of wildcard.

---

### [INFORMATIONAL] Typed Socket Events

**Location:** `server.ts:204`, type definitions

**Description:** Socket.IO is configured with TypeScript type definitions for events.

**Evidence:**

```typescript
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
```

**Assessment:** Type safety helps prevent runtime errors but doesn't enforce runtime validation.

---

## Positive Security Observations

1. **CORS allowlist** - Uses explicit allowlist rather than wildcard
2. **Typed events** - TypeScript provides compile-time safety
3. **Session status tracking** - Sessions are marked connected/disconnected
4. **Logging** - Connection and disconnection events are logged
5. **Error handling** - Try/catch blocks prevent crashes from malformed data

---

## Risk Assessment

### Overall Rating: HIGH

**Attack Surface:**

- Unauthenticated WebSocket connections
- No rate limiting on any events
- Internal HTTP endpoints without authentication
- Session IDs can be created by clients

**Key Risks:**

1. Any client can connect and listen to events
2. Session hijacking via ID guessing/fixation
3. DoS via event flooding or session creation
4. Spoofing via unauthenticated internal endpoints

**Compensating Controls:**

- CORS allowlist restricts browser-based attacks
- Sessions are only useful if you know the ID
- Production would have different origin restrictions

---

## Recommendations

### Priority 1 (Critical - Block Public Release)

1. **Add authentication to socket connections** - Verify JWT before accepting connection
2. **Implement budget-aware rate limiting** - Track estimated LLM API cost per session and enforce limits
3. **Add hard connection limits** - Maximum concurrent connections and per-IP limits

### Priority 2 (High)

4. **Never adopt client-provided session IDs** - Always generate server-side with crypto randomness
5. **Protect internal HTTP endpoints** - Add auth to `/api/toast` and `/api/socket-delegation-status`
6. **Add session expiration (TTL)** - Implement idle timeout and max session duration

### Priority 3 (Medium)

7. **Bind sessions to authenticated users** - Associate session ID with JWT identity
8. **Validate socket event payloads** - Schema validation for incoming data
9. **Add memory usage monitoring** - Alert on unusual session counts

**Public Release Readiness:** NOT READY - Unauthenticated connections and lack of rate limiting create unacceptable financial and availability risks
