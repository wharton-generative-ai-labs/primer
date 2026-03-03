# 03. WebSockets

## Overview

This section examines the Socket.IO WebSocket server implementation that enables real-time communication between the Primer frontend and backend. WebSocket security matters because it provides a persistent, bidirectional channel that, if misconfigured, could allow unauthorized access to sessions, event eavesdropping, or denial-of-service attacks.

The attack surfaces analyzed include: connection authentication, session management, event handling, rate limiting, CORS configuration, and internal HTTP endpoints. Primer uses Socket.IO with an in-memory session store, room-based event routing, and typed event definitions for compile-time safety.

| Component | Technology | Purpose |
|-----------|------------|---------|
| WebSocket Server | Socket.IO | Real-time bidirectional communication |
| Session Store | In-memory Map | Track active sessions and their state |
| Event Routing | Socket.IO rooms | Isolate events to specific sessions |
| Session IDs | UUIDv4 (`sess_*`) | 122-bit entropy session identifiers |

---

## Executive Summary

| Assessment | Result |
|------------|--------|
| **Overall Status** | :material-check-circle: **PASS** |
| **Risk Level** | Medium |
| **PoC Blocker** | No |
| **Action Required** | Documentation required |

**Review approach:** AI performed static code analysis of `server.ts` and socket type definitions, identifying code-level vulnerabilities and architectural concerns. Human performed live testing including unauthenticated connection attempts, session ID entropy analysis, and internal endpoint accessibility verification.

**Key findings:** Socket connections accept without authentication, but human testing revealed this has limited practical impact because (1) session IDs are cryptographically random UUIDs that cannot be brute-forced, (2) events route to session-specific rooms so attackers cannot eavesdrop without a valid session ID, and (3) LLM calls require valid session data. Rate limiting is absent but acceptable for PoC with billing alert monitoring.

**Bottom Line:** Acceptable for PoC release with documented limitations and billing alerts configured.

---

## Finding Synthesis Matrix

**Synthesis Date:** 2026-02-04

| ID | Finding | AI | Human | Final Severity | PoC Status |
|----|---------|:--:|:-----:|----------------|------------|
| WS-1 | No authentication on socket connections | HIGH | Disputed | **Low** | Acceptable with documentation |
| WS-2 | Client-provided session IDs (probing risk) | HIGH | Disputed | **Low** | Acceptable (UUIDs unguessable) |
| WS-3 | No rate limiting on socket events | HIGH | Agreed | **Medium** | Acceptable with monitoring |
| WS-4 | In-memory session store (resource exhaustion) | HIGH | Agreed | **Low** | Acceptable (limited users) |
| WS-5 | Unprotected internal HTTP endpoints | MEDIUM | NEW | **Medium** | Acceptable with deployment controls |
| WS-6 | Session data pollution via session.update | LOW | NEW | **Low** | Acceptable |
| WS-7 | experienceId trust boundary | LOW | NEW | **Low** | Acceptable |

---

### WS-1: No Authentication on Socket Connections

**AI Assessment:** HIGH - Socket connections accepted without JWT or token verification
**Human Assessment:** Low - Unauthenticated connections cannot perform useful actions

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Socket.IO connections are accepted without authentication. No JWT verification occurs in the connection handler. |
| **Location** | `server.ts:243-269` |
| **Evidence** | `io.on("connection", async (socket) => { ... })` accepts all connections; no `io.use()` middleware |
| **Impact** | Limited in practice: without a valid session ID, attacker cannot trigger LLM calls or receive other users' events |

**Why severity was downgraded:** Human testing confirmed that while connections succeed without auth, the attacker's capabilities are severely limited:
1. LLM calls require `sessionData.model` which is undefined without a valid session
2. Events emit to session rooms (`io.to(sessionId)`) so attackers hear nothing without the ID
3. Session IDs are 122-bit UUIDs (WS-2) making guessing infeasible
4. CORS restricts browser-based attacks

**Resolution:** Document as known limitation. Add `io.use()` middleware for production hardening.

---

### WS-2: Client-Provided Session IDs

**AI Assessment:** HIGH - Session probing attack via client-provided IDs
**Human Assessment:** Low - UUIDs make probing infeasible

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Clients can provide their own session ID in handshake auth; server adopts it if not found in store |
| **Location** | `server.ts:256-261` |
| **Evidence** | `socket.data.sessionId = existingSessionId; createNewSession(existingSessionId);` |
| **Impact** | Theoretical session hijacking if IDs were predictable or leaked |

**Session ID entropy analysis (human-provided):**

```typescript hl_lines="3"
// src/app/lib/session-utils.ts
function generateSessionId(): string {
  const uuid = crypto.randomUUID();
  return `sess_${uuid}`;
}
```

UUIDv4 provides 122 bits of entropy. Brute-forcing would require ~2^61 attempts on average to find a collision.

**Leakage vector investigation:**

| Vector | Cross-user exposure? |
|--------|---------------------|
| URL query params | No (same user's browser only) |
| Server logs | No (internal infrastructure) |
| API responses | No (returned to requesting client only) |
| sessionStorage | No (tab-scoped, same-origin) |
| WebSocket messages | No (sent to session owner only) |

**Resolution:** Acceptable for PoC. For production, bind sessions to authenticated user identity.

---

### WS-3: No Rate Limiting on Socket Events

**AI Assessment:** HIGH - Financial DoS via unbounded LLM API calls
**Human Assessment:** Agreed (Medium) - Real risk, mitigated by monitoring for PoC

| Aspect | Analysis |
|--------|----------|
| **The Issue** | No rate limiting on `client:message`, `tool.call`, or other event handlers |
| **Location** | `server.ts:283-341`, `server.ts:349-467` |
| **Evidence** | Event handlers process every message without throttling |
| **Impact** | Potential API cost exhaustion; legitimate users blocked when quotas hit |

**Resolution for PoC:**
- Configure billing alerts at $50/$100 thresholds on OpenAI/Anthropic dashboards
- Document as known risk in deployment runbook
- Limited trusted users reduces practical risk

**Resolution for production:** Implement token bucket rate limiting per session with budget caps.

---

### WS-4: In-Memory Session Store Resource Exhaustion

**AI Assessment:** HIGH - Slowloris-style memory exhaustion attack
**Human Assessment:** Agreed (Low) - Acceptable with limited users

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Session store is an unbounded in-memory Map with no TTL, limits, or eviction |
| **Location** | `server.ts:41-71` |
| **Evidence** | `class InMemorySessionStore { private sessions: Map<string, Session> = new Map(); }` |
| **Impact** | Memory growth until OOM with sustained attack; requires many connections |

**Resolution for PoC:** Restart server if sessions accumulate. Limited trusted users makes attack unlikely.

**Resolution for production:** Move to Redis with TTL; add session count metrics; implement idle timeout.

---

### WS-5: Unprotected Internal HTTP Endpoints

**AI Assessment:** MEDIUM - Toast and delegation endpoints lack authentication
**Human Assessment:** NEW finding expanded - Potential phishing vector

| Aspect | Analysis |
|--------|----------|
| **The Issue** | `/api/toast` and `/api/socket-delegation-status` are raw HTTP handlers that bypass Next.js middleware |
| **Location** | `server.ts:81-117`, `server.ts:119-159` |
| **Evidence** | `curl -X POST http://localhost:3000/api/toast -d '{"sessionId":"test","message":"spoofed"}' # 200 OK` |
| **Impact** | Arbitrary toast injection into user sessions; potential phishing ("Session expired, click here") |

**Resolution for PoC:** Ensure deployment environment restricts access (reverse proxy blocking these paths, or network isolation).

**Resolution for production:** Add authentication or route through Next.js middleware.

---

### WS-6: Session Data Pollution via session.update

**AI Assessment:** LOW - No schema validation on session updates
**Human Assessment:** NEW (expanded) - Arbitrary key injection possible

| Aspect | Analysis |
|--------|----------|
| **The Issue** | `session.update` messages merge client data into session store via object spread without validation |
| **Location** | `server.ts:283-295` |
| **Evidence** | `sessionStore.update(..., { data: { ...currentSession?.data, ...parsed.session } })` |
| **Impact** | Logic bugs if server trusts session.data; memory exhaustion via large objects |

**Resolution:** Document as post-PoC hardening. Add schema validation and field allowlist.

---

### WS-7: experienceId Trust Boundary

**AI Assessment:** LOW - Client can specify experienceId for tool execution
**Human Assessment:** NEW (expanded) - Depends on external permission checks

| Aspect | Analysis |
|--------|----------|
| **The Issue** | `tool.call` handler accepts `experienceId` directly from client data |
| **Location** | `server.ts:385-386` |
| **Evidence** | `const experienceId = data.experienceId; // Always from client` |
| **Impact** | Cross-experience access if no permission checks exist elsewhere |

**Resolution:** Acceptable for PoC with trusted users. Verify experience access controls exist; add validation if not.

---

## Positive Security Controls

| Control | Status | Notes |
|---------|--------|-------|
| CORS allowlist | Implemented | Explicit origin allowlist, not wildcard |
| TypeScript typed events | Implemented | Compile-time safety for event contracts |
| Session room isolation | Implemented | Events emit to specific session rooms |
| Cryptographic session IDs | Implemented | UUIDv4 provides 122-bit entropy |
| Connection logging | Implemented | Connect/disconnect events logged |
| Error handling | Implemented | Try/catch prevents crashes from malformed data |

---

## Research Insights: AI vs Human Performance

### Detection Comparison

| Category | AI | Human | Notes |
|----------|:--:|:-----:|-------|
| Issues identified | 9 | 7 (4 validated + 3 new) | AI found more, human validated practical impact |
| Concrete evidence | No | Yes | Human tested live connections and endpoints |
| False positives | 2 (overrated) | 0 | AI overrated WS-1 and WS-2 severity |

### AI Strengths
- Systematic code coverage identifying all event handlers and data flows
- Identified architectural patterns (in-memory store, no middleware)
- Comprehensive attack scenario documentation (probing, financial DoS)
- Found issues human might have accepted without investigation (session adoption)

### AI Limitations
- Could not test actual exploitability of findings
- Overrated severity of WS-1 and WS-2 without analyzing compensating controls
- Did not trace session ID generation to determine entropy
- Could not verify event isolation through live testing

### Human Strengths
- Validated actual exploitability through live testing
- Traced session ID generation to confirm UUID usage
- Analyzed leakage vectors to confirm no cross-user exposure
- Correctly downgraded theoretical risks to practical severity levels
- Identified phishing vector in toast endpoint (AI missed this angle)

### Human Limitations
- Did not test session probing (would need active victim session)
- Did not test cross-session access (single-user test environment)
- Did not test message flooding (cost concerns)
- Time-constrained (5 hrs)

---

## Consolidated Recommendations

### For PoC Release

| Priority | Action | Owner |
|----------|--------|-------|
| **Required** | Configure billing alerts ($50/$100) on AI provider dashboards | Ops |
| **Required** | Document WebSocket limitations in deployment runbook | Docs |
| **Recommended** | Block `/api/toast` and `/api/socket-delegation-status` at reverse proxy | Ops |

### For Production Release

| Priority | Action | Effort |
|----------|--------|--------|
| **P1** | Add `io.use()` middleware for JWT verification | Medium |
| **P1** | Implement per-session rate limiting with budget caps | Medium |
| **P2** | Migrate session store to Redis with TTL | Medium |
| **P2** | Bind session IDs to authenticated user identity | Low |
| **P3** | Add schema validation to session.update handler | Low |
| **P3** | Validate experienceId against user permissions | Low |

---

## PoC Readiness

- [x] Session IDs are cryptographically random (122-bit UUIDs)
- [x] No cross-user session ID leakage vectors identified
- [x] Event routing isolates sessions via Socket.IO rooms
- [x] CORS restricts browser-based attacks
- [x] Billing alerts configured (required before release)
- [x] Limitations documented

---

## Detailed Reviews

- [AI Review](../appendices/ai-reviews/websocket-ai-review.md)
- [Human Review](../appendices/human-reviews/websocket-human-review.md)
