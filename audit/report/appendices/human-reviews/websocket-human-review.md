# WebSocket Security - Human Review

---

??? info "AI Review Guidance :material-robot-outline:"
    The AI review (see `websocket-ai-review.md`) rated this category HIGH — the highest risk area in the audit. All findings were based on static code analysis of `server.ts`. The AI could not connect to the socket server, test session probing, or observe runtime behavior.

    ### Where You Add the Most Value

    1. **Confirm unauthenticated access.** The AI's top finding (WS-1) is that socket connections require no authentication. Connect to the socket server without any auth token and confirm this. Then try emitting events — can you trigger AI calls or receive other users' data? This turns a code-level observation into a demonstrated vulnerability.

    2. **Determine session ID predictability.** The AI flagged session probing (WS-2) but couldn't determine the actual session ID format. If IDs are UUIDs (128-bit), brute-forcing is infeasible and the severity should be lower. If they're short or predictable, the finding stands at HIGH. Check where session IDs are generated — are they `crypto.randomUUID()`, sequential counters, or user-provided strings?

    3. **Test cross-session event isolation.** Open two browser tabs as different users. Can User A receive events from User B's session? The AI noted this is theoretically possible but couldn't verify actual event routing.

    4. **Test internal HTTP endpoints externally.** The AI flagged `/api/toast` and `/api/socket-delegation-status` as unauthenticated. These bypass Next.js middleware. Verify: can you hit them from outside the server process? If they're only reachable internally, the severity drops significantly.

    5. **Message size limits.** Send a large payload (1MB+ JSON) through a socket event. Does the server handle it gracefully, reject it, or crash?

    ### Practical Test Steps

    ```bash
    # 1. Test unauthenticated socket connection (browser console)
    const socket = io('http://localhost:3000', { auth: {} })
    socket.on('connect', () => console.log('Connected without auth:', socket.id))

    # 2. Try emitting events without auth
    socket.emit('client:message', { message: '{"type":"session.update","session":{}}' })

    # 3. Try joining another session by ID
    const socket2 = io('http://localhost:3000', { auth: { sessionId: 'target-session-id' } })

    # 4. Test internal HTTP endpoints from outside
    curl -X POST http://localhost:3000/api/toast \
      -H 'Content-Type: application/json' \
      -d '{"sessionId":"test","message":"spoofed notification","type":"error"}'

    # 5. Rapid-fire events
    for (let i = 0; i < 100; i++) socket.emit('client:message', { message: `flood-${i}` })
    ```

    ### V1 PoC Focus

    **Context:** This is a proof-of-concept release for trusted users (researchers, educators, students) in a controlled environment. Focus your review on PoC blockers rather than production-scale concerns.

    #### PoC Blockers to Validate

    The AI review identified two blockers requiring human validation:

    | Finding                            | AI Assessment   | Human Action                      |
    | ---------------------------------- | --------------- | --------------------------------- |
    | WS-1: No authentication on sockets | **PoC Blocker** | Validate and confirm fix approach |
    | WS-2: Client-provided session IDs  | **PoC Blocker** | Validate — see investigation below |

    #### PoC Acceptable (Validate or Dispute)

    | Finding                           | AI Assessment  | Notes                                   |
    | --------------------------------- | -------------- | --------------------------------------- |
    | WS-2: Client-provided session IDs | PoC Blocker    | Check if session IDs are actually guessable or leaked |
    | WS-3: No rate limiting            | PoC Acceptable | Monitor API dashboards manually         |
    | WS-4: Session resource exhaustion | PoC Acceptable | Limited users; restart if needed        |
    | Internal HTTP endpoints           | PoC Acceptable | Only reachable from server              |

    ### Focused Review Areas

    Rather than a full review, focus on:

    1. **Validate WS-1/WS-2 fix approaches** - What's the minimum viable auth for PoC?
    2. **Test unauthenticated access** - Can you connect and receive events without auth?
    3. **Identify any missed blockers** - Are there issues the AI didn't catch that block PoC release?

---

## Findings

### AI Finding Validation

<!-- For each AI finding, confirm or dispute -->

**WS-1 (No Socket Authentication):**

- [ ] ~~Confirmed as blocker~~ **Disputed — PoC Acceptable**

Yes, socket connections succeed without authentication. Tested from browser console with empty auth object.

However, after tracing what an unauthenticated connection can actually *do*, the risk is lower than it appears:

1. **Can't trigger LLM calls** — The `conversation.item.create` handler pulls model config from `sessionData`. Without a valid session, `model` is undefined and the OpenAI call fails.

2. **Can't receive other users' events** — Events emit to session rooms (`io.to(sessionId)`). Without knowing a valid session ID, you're broadcasting to nobody.

3. **WS-2 already acceptable** — Since session IDs are UUIDs and not leaked cross-user, an attacker can't guess their way into someone else's session.

4. **CORS restricts browser attacks** — Non-browser clients can connect, but that requires deliberate tooling against a known deployment.

The combination of WS-1 + WS-2 would be dangerous if session IDs were guessable. They're not. With WS-2 acceptable, WS-1 becomes defense-in-depth rather than a blocker.

**Recommendation:** Add `io.use()` middleware for production hardening. For PoC release, document as known limitation.

**WS-2 (Client Session ID Adoption):**

- [ ] ~~Confirmed as blocker~~ **Disputed — PoC Acceptable**

The AI flagged that clients can specify session IDs, theoretically enabling "session probing." This assumes an attacker can discover valid session IDs. Investigated and found this isn't a practical concern.

**Session IDs are UUIDs:**

From `src/app/lib/session-utils.ts`:
```typescript
function generateSessionId(): string {
  const uuid = crypto.randomUUID();
  return `sess_${uuid}`;
}
```

UUIDv4 gives 122 bits of entropy — brute-forcing isn't feasible.

**Leakage vector investigation:**

Checked all places session IDs appear in the codebase:

| Vector | Present? | Cross-user exposure? |
|--------|----------|---------------------|
| URL query params | Yes | No — only visible in same user's browser |
| Server logs | Yes (debug) | No — internal infrastructure |
| API responses | Yes | No — returned to requesting client only |
| sessionStorage | Yes | No — tab-scoped, same-origin |
| WebSocket messages | Yes | No — sent to session owner's socket only |
| Error messages | No | — |
| localStorage/cookies | No | — |

All exposure is limited to the same user who owns the session. No mechanism for User A to discover User B's session ID through normal app use.

**Assessment:** The "probing" attack requires knowing another user's session ID. Since IDs are cryptographically random and not leaked cross-user, this isn't exploitable in practice.

Binding sessions to authenticated users remains a good post-PoC hardening step, but not a blocker.

**WS-3 (No Rate Limiting):**

- [x] PoC Acceptable with monitoring

For PoC: Monitor OpenAI/Anthropic dashboards for unusual usage. Set up billing alerts at $50/$100 thresholds. Document this as a known risk in deployment runbook.

Post-PoC: Implement token bucket rate limiting per session. Track estimated cost per session and enforce budget caps.

**WS-4 (Resource Exhaustion):**

- [x] PoC Acceptable with limited users

In-memory session store is fine for a handful of trusted users. If sessions accumulate, restart the server. No complex cleanup logic needed for PoC.

Post-PoC: Move to Redis with TTL. Add session count metrics. Implement idle timeout (e.g., 30 min inactive = cleanup).

### Additional Findings

<!-- Only document NEW findings not covered by AI review -->

**WS-5 (Unprotected Internal Endpoints):**
The endpoints `/api/toast` and `/api/socket-delegation-status` in `server.ts` are defined before the Next.js handler and lack any authentication.
Intended for internal server-to-server communication only. Since they're exposed on the same port as the main app, any client with network access can call them.

Could allow arbitrary toast message injection into user sessions - potential phishing vector (e.g., "Session expired, click here to re-authenticate").

_High severity_ but _PoC Acceptable_ if deployment environment restricts port access (e.g., behind reverse proxy that blocks these paths).

**WS-6 (Session Data Pollution via session.update):**
The `client:message` handler accepts `session.update` messages and merges arbitrary client data into the session store using object spread. No schema validation, no field allowlist.

From the AI review evidence:
```typescript
sessionStore.update(socket.data.sessionId, {
  data: {
    ...currentSession?.data,
    ...parsed.session, // No validation of what's being stored
  },
});
```

Impact:
- Client can inject arbitrary keys into session data
- If any server-side code trusts session.data without validation, could lead to logic bugs
- Memory exhaustion by sending huge objects

_Medium severity_ - Requires auth to be meaningful; without auth, attacker already has full access anyway. But worth noting for post-PoC hardening.

**WS-7 (experienceId Trust Boundary):**
The `tool.call` handler accepts `experienceId` directly from client data without verification. If experiences contain user-specific content or permissions, this could allow cross-experience access.

From AI review:
```typescript
const experienceId = data.experienceId; // Always from client
```

Need to verify: Does the codebase enforce any permission checks on experience access elsewhere? If not, client can potentially specify any experienceId and execute tools in that context.

_Medium severity_ - Depends on what experience access controls exist elsewhere. For PoC with trusted users, acceptable.

---

## PoC Readiness Assessment

- [x] Are all PoC blockers addressed? **Yes — no blockers remain**
- [x] Any new blockers discovered? **No**
- [x] Acceptable for PoC code release

### Assessment Notes

Both AI-identified blockers were downgraded after investigation:

- **WS-1** (no socket auth): Unauthenticated connections can't do anything useful without a valid session ID, and session IDs are unguessable UUIDs.
- **WS-2** (client session IDs): 122 bits of entropy, no cross-user leakage vectors.

This is distributable PoC code — deployers are responsible for their own security posture. The code works, the architecture is sound for a proof-of-concept, and the hardening steps are well-documented.

**What's acceptable for PoC:**
- Unauthenticated socket connections (no useful action without session)
- Client-provided session IDs (UUIDs, no leakage path)
- No rate limiting (document: set billing alerts)
- In-memory session store (restart if issues)

**Post-PoC hardening (document in README):**
- Add `io.use()` middleware for socket auth
- Bind sessions to authenticated user IDs
- Redis session store with TTL
- Per-user rate limiting on LLM-triggering events

---

## Runtime Testing Notes

### Tested Scenarios

| Test | Result | Notes |
|------|--------|-------|
| Unauthenticated socket connection | **CONFIRMED** | Socket connects with empty auth object |
| Event emission without auth | **CONFIRMED** | Can emit `client:message` events |
| Session probing | Not tested | Would need active victim session |
| Cross-session access | Not tested | Single-user test environment |
| `/api/toast` external access | **CONFIRMED** | curl succeeds from localhost |
| Message flood | Not tested | Didn't want to incur API costs |

### Unauthenticated Connection Test

```javascript
// Browser console test
const socket = io('http://localhost:3000', { auth: {} });
socket.on('connect', () => console.log('Connected:', socket.id));
// Result: Connected successfully with no auth
```

### Toast Endpoint Test

```bash
curl -X POST http://localhost:3000/api/toast \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"test","message":"Hello from curl","type":"info"}'
# Result: 200 OK, message delivered (would need active session to verify display)
```

---

## Sign-off

- **Reviewer:** Chris (Technical Auditor)
- **Date:** 2026-02-03
- **Time Spent:** 5 hrs
