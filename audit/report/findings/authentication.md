# 02. Authentication & Authorization

## Overview

This section examines how the application verifies user identity (authentication) and controls what authenticated users can do (authorization). Weaknesses here can lead to unauthorized access, privilege escalation, or data exposure.

Primer uses a layered authentication architecture:

| Layer | Technology | Purpose |
|-------|------------|---------|
| Identity Provider | Google OAuth | Verifies "who you are" |
| Session Management | NextAuth.js + JWT | Maintains login state |
| Authorization | Role-based (RBAC) | Controls "what you can do" |
| User Storage | Environment variables + JSON file | Defines user-role mappings |

The middleware (`src/middleware.ts`) protects routes by checking for a valid session token. Authorization is delegated to individual route handlers, which check user roles and permissions via helper functions in `src/config/auth.ts`.

---

## Executive Summary

| Assessment | Result |
|------------|--------|
| **Overall Status** | :material-alert: **MEDIUM-HIGH RISK** |
| **PoC Blocker** | No (with documentation requirements) |
| **Action Required** | Documentation + known limitation acceptance |

**Review approach:** The AI reviewer performed static code analysis across all authentication-related files. The human reviewer validated these findings and performed live testing—signing in with test accounts and probing API endpoints directly.

**Key findings:** The application uses a **fail-open authorization model**: the middleware only checks that you're logged in, not whether you have permission. Individual route handlers must enforce their own authorization checks. Live testing confirmed this creates real gaps—the storage API returns data to any authenticated user regardless of roles.

Additionally, any Google user can authenticate by default. This is acceptable for distributable PoC code (deployers must configure their own OAuth credentials anyway), but requires clear documentation.

**Bottom Line:** Acceptable for PoC with documentation. Not production-ready without centralized authorization.

---

## Finding Synthesis Matrix

**Synthesis Date:** 2026-02-04

| ID | Finding | AI | Human | Final Severity | PoC Status |
|----|---------|:--:|:-----:|----------------|------------|
| AUTH-1 | Open registration (any Google user) | HIGH | Medium | **Medium** | Documentation |
| AUTH-2 | Fail-open middleware architecture | HIGH | Agreed | **High** | Acceptable (PoC) |
| AUTH-3 | Session fixation via WebSocket | MEDIUM | Agreed | **Medium** | Acceptable (PoC) |
| AUTH-4 | File-based user storage validation | MEDIUM | — | **Low** | Acceptable |
| AUTH-5 | Diagnostic endpoints public | MEDIUM | — | **Medium** | Review needed |
| AUTH-6 | Session data exposes permissions | LOW | — | **Low** | Acceptable |
| AUTH-7 | JSON parsing silent failures | LOW | — | **Low** | Acceptable |
| AUTH-8 | Session-WS binding gap | — | NEW | **Low** | Acceptable |
| AUTH-9 | Dual user storage priority confusion | — | NEW | **Low** | Acceptable |
| AUTH-10 | Storage API auth gap | — | NEW | **Medium** | Acceptable (document) |
| AUTH-11 | OAuth CSRF protection | — | Verified :material-check-circle: | N/A | Positive control |

---

## Detailed Findings

### AUTH-1: Open Registration

**AI Assessment:** HIGH — Any Google user can authenticate
**Human Assessment:** Medium — Downgraded to documentation requirement

| Aspect | Analysis |
|--------|----------|
| **The Issue** | `signIn` callback returns `true` for all Google accounts |
| **AI Concern** | Creates foothold for privilege escalation |
| **Human Reframe** | Deployers already configure OAuth credentials, API keys, env vars—adding "configure allowed users" is a deployment task, not a code defect |
| **Live Testing** | No-role users receive 403 on sensitive endpoints (except storage API) |

**Resolution:** Document prominently in setup instructions:
> :material-alert: By default, any Google user can sign in. Configure `USER_ROLE_MAPPINGS` or `users.json` before deploying.

---

### AUTH-2: Fail-Open Authorization Architecture

**Both reviewers agree this is the most significant architectural concern.**

| Layer | What It Checks | Gap |
|-------|----------------|-----|
| Middleware | Valid token exists | :material-check-circle: |
| Middleware | User has roles/permissions | :material-close-circle: Not checked |
| Route handlers | Individual permission checks | :material-alert: Varies by endpoint |

**Concrete Evidence (Human Testing):**

| Route | Expected | Actual | Result |
|-------|----------|--------|--------|
| `GET /api/admin/users` | 403 | 403 | :material-check-circle: Pass |
| `POST /api/experiences` | 403 | 403 | :material-check-circle: Pass |
| `GET /api/storage/...` | 403 | 200 | :material-close-circle: **Fail** |

The storage API confirms the AI's architectural concern: one missed route handler = data exposure.

**PoC Acceptance Rationale:** With trusted users and documented limitations, this is acceptable. For production, implement deny-by-default middleware for `/api/*` routes.

---

### AUTH-3: Session Fixation via WebSocket

**Location:** `server.ts:256-261`

The WebSocket layer adopts client-provided session IDs without validation:

```typescript hl_lines="1 2"
socket.data.sessionId = existingSessionId;
createNewSession(existingSessionId);
```

**Attack Vector:**
1. Attacker provides known session ID before auth
2. Victim authenticates (NextAuth rotates HTTP session)
3. Socket session remains fixed
4. Attacker connects with same socket session ID

**PoC Acceptance Rationale:** Requires attacker to know victim's socket session ID in advance. Low practical exploitability with trusted users.

---

### AUTH-10: Storage API Authorization Gap (Human-Discovered)

**Location:** Storage API routes

**Finding:** Any authenticated user (regardless of roles) can read stored files if they know the path. The storage API checks authentication but not authorization.

**Impact:** Content exposure to any authenticated user.

**PoC Acceptance Rationale:** With known trusted users, acceptable. Document as known limitation.

---

### Positive Security Controls Verified

| Control | Status | Notes |
|---------|--------|-------|
| Google OAuth | :material-check-circle: | Strong identity verification |
| NEXTAUTH_SECRET validation | :material-check-circle: | 32-char minimum enforced via Zod |
| Case-insensitive email matching | :material-check-circle: | Prevents bypass via email casing |
| OAuth CSRF (state parameter) | :material-check-circle: | Human verified in live flow |
| JWT algorithm | :material-check-circle: | HS256 (acceptable for this use case) |
| Audit logging | :material-check-circle: | Sign-in/out events logged |

---

## Research Insights: AI vs Human Performance

### Detection Comparison

| Category | AI | Human | Winner |
|----------|:--:|:-----:|--------|
| Architectural issues identified | 7 | 4 new + validations | **AI** (breadth) |
| Concrete exploitation evidence | 0 | 1 (storage API test) | **Human** (depth) |
| Severity calibration | HIGH on AUTH-1 | Downgraded with context | **Human** (nuance) |
| Runtime behavior verification | Not possible | JWT decoded, routes tested | **Human** (access) |
| False positives | 0 | 0 | Tie |

### AI Strengths
- **Systematic coverage:** Identified 7 distinct issues through static analysis
- **Code-level precision:** Exact file:line references for all findings
- **Pattern recognition:** Caught the fail-open architecture pattern immediately
- **Comprehensive documentation:** Well-structured evidence and recommendations

### AI Limitations
- **No runtime testing:** Could not verify actual route behavior
- **Context-blind severity:** Rated AUTH-1 as HIGH without considering deployment model
- **Cannot probe attack vectors:** Session fixation was theoretical, not demonstrated

### Human Strengths
- **Live testing:** Actually signed in with a no-role account and probed routes
- **Contextual severity adjustment:** Recognized AUTH-1 is a documentation issue for distributable code
- **New findings through testing:** Discovered storage API gap (AUTH-10) not visible in static analysis
- **Verification of AI claims:** Confirmed OAuth CSRF protection is active

### Human Limitations
- **Narrower scope:** Focused review on AI-flagged areas rather than full codebase
- **Time-constrained:** 90 minutes vs AI's instant analysis

### Key Research Insight

> **AI excels at finding architectural patterns; humans excel at validating real-world impact.**
>
> The AI correctly identified the fail-open architecture as HIGH risk. The human confirmed this concern with concrete evidence (storage API test) but also provided crucial context: for a PoC with trusted users, this is acceptable with documentation. Neither reviewer alone would have produced this nuanced assessment.

---

## Consolidated Recommendations

### For PoC Release

| Priority | Action | Owner |
|----------|--------|-------|
| **Required** | Document open registration in setup instructions | Docs |
| **Required** | Document storage API auth gap as known limitation | Docs |
| **Recommended** | Add warning log when file-based user shadowed by env user | Dev |

### For Production Release

| Priority | Action | Effort |
|----------|--------|--------|
| **P1** | Implement deny-by-default middleware for `/api/*` | Medium |
| **P1** | Bind WebSocket sessions to NextAuth session lifecycle | Medium |
| **P2** | Add user allowlist enforcement in `signIn` callback | Low |
| **P2** | Review/protect diagnostic endpoints | Low |
| **P3** | Validate role keys in file-based user loading | Low |

---

## PoC Readiness

- [x] All blockers addressed (AUTH-1 → documentation)
- [x] Acceptable risks documented
- [x] Ready for PoC release with known limitations

---

## Detailed Reviews

- [AI Review](../appendices/ai-reviews/auth-ai-review.md)
- [Human Review](../appendices/human-reviews/auth-human-review.md)