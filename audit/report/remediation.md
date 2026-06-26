# Remediation

This section consolidates all audit findings into a prioritized remediation plan, organized by release phase. Findings are classified based on their impact on the V1 proof-of-concept code release and subsequent production deployment.

## Overview

The audit identified 21 findings across 11 security categories. After cross-referencing AI and human reviews, these findings have been organized into three remediation phases:

- **Phase 1 (Documentation)** — Items requiring clear documentation for deployers
- **Phase 2 (PoC Recommended)** — Issues recommended for PoC but acceptable as documented risks
- **Phase 3 (Post-PoC)** — Hardening for production deployment

No code blockers were identified. The human review downgraded three AI-identified blockers (WS-1, WS-2, AUTH-1) after investigating practical exploitability. This is distributable PoC code—deployers are responsible for their own security configuration.

---

## Phase 1: Documentation Requirements

These items require clear documentation in the setup/deployment guide. They are not code defects—they reflect the default-open nature of PoC code that deployers must configure for their environment.

### AUTH-1: Open Registration

**Severity:** MEDIUM | **Classification:** Documentation

The NextAuth signIn callback returns `true` for any Google user. This is intentional for easy setup—deployers configure restrictions based on their needs.

**Location:** `src/app/api/auth/[...nextauth]/route.ts:43`

**Documentation Required:**
> :material-alert: **Security Notice:** By default, any Google user can sign in. Before deploying publicly, configure user restrictions via `USER_ROLE_MAPPINGS` environment variable or `users.json` file.

**For deployers who want restrictions:**

```typescript hl_lines="3-4 8"
async signIn({ user }) {
  // Option 1: Domain restriction
  if (!user.email?.endsWith('@yourdomain.edu')) {
    return false;
  }

  // Option 2: Allowlist check
  return await isEnvDefinedUser(user.email) || await userExists(user.email);
}
```

### WS-1 & WS-2: WebSocket Security Model

**Severity:** MEDIUM | **Classification:** Documentation

WebSocket connections don't independently verify authentication, and clients can provide session IDs. Human review determined these are acceptable for PoC:

- **WS-1:** Without a valid session, clients can't trigger LLM calls or receive other users' events
- **WS-2:** Session IDs are UUIDs (122-bit entropy) with no cross-user leakage vectors

**Documentation Required:**
> The WebSocket layer relies on session-based isolation rather than connection-level authentication. This is appropriate for trusted-user deployments. For production hardening, add `io.use()` middleware to verify NextAuth sessions.

---

## Phase 2: Recommended for PoC

These issues are recommended for remediation during the PoC phase but can be documented as accepted risks if time constraints require prioritization.

### WS-5: Internal Endpoints Accessible

**Severity:** MEDIUM | **Classification:** PoC Acceptable

Internal API endpoints (`/api/toast`, `/api/socket-delegation-status`) are accessible without authentication when the server port is exposed.

**Remediation:** Add authentication checks to these endpoints, or ensure they are not exposed on public-facing ports.

### FE-1: Weak Content Security Policy

**Severity:** MEDIUM | **Classification:** PoC Acceptable

The CSP includes `unsafe-inline` and `unsafe-eval` directives, weakening XSS protections. This is currently required by mermaid.js for diagram rendering.

**Remediation:** Document as a known limitation. For V2, investigate mermaid configuration options or alternative rendering approaches that don't require `unsafe-eval`.

### FE-3: Client-Side Permission Checks

**Severity:** MEDIUM | **Classification:** PoC Acceptable

Some permission checks are performed only on the client side without corresponding server-side validation.

**Remediation:** Audit all API routes to ensure server-side permission checks mirror client-side restrictions.

### ADAPT-1: Missing Output Sanitization

**Severity:** MEDIUM | **Classification:** PoC Acceptable

AI-generated content is rendered without sanitization, creating potential XSS vectors if AI output contains malicious markup.

**Remediation:** Sanitize AI-generated content before DOM rendering using a library like DOMPurify.

### CONFIG-3: Missing Security Headers

**Severity:** LOW | **Classification:** PoC Acceptable

Some recommended security headers are not configured (HSTS preload, X-Content-Type-Options).

**Remediation:** Add headers to Next.js configuration:

```javascript hl_lines="2 3"
headers: [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' }
]
```

---

## Phase 3: Post-PoC Hardening

These issues should be addressed before scaling to production but do not impact the controlled PoC deployment.

### Session and Authentication Hardening

| ID | Finding | Remediation |
|----|---------|-------------|
| WS-2 | Client-provided session IDs accepted without validation | Bind sessions to authenticated user IDs |
| AUTH-2 | Middleware authorization approach needs review | Implement consistent authorization middleware |
| AUTH-3 | Users without roles can still authenticate | Block roleless users at signIn callback |

### Performance and DoS Protection

| ID | Finding | Remediation |
|----|---------|-------------|
| WS-3 | No rate limiting on WebSocket events | Implement per-user rate limiting on socket events |
| API-RATE | API rate limiting incomplete | Extend rate limiting to all API endpoints |

### Code Quality and Maintainability

| ID | Finding | Remediation |
|----|---------|-------------|
| FE-2 | `eval('require')` pattern in codebase | Replace with proper dynamic imports |
| CODE-1 | "God Hook" in useHandleServerEvent | Refactor into smaller, focused hooks |
| CONFIG-4 | X-Powered-By header exposes technology | Remove or customize header |

### Advanced Protections

| ID | Finding | Remediation |
|----|---------|-------------|
| ADAPT-2 | No prompt injection detection | Implement input/output monitoring for injection patterns |

---

## Low Priority / Informational

These findings represent defense-in-depth improvements with minimal practical risk in the current deployment context.

| ID | Finding | Notes |
|----|---------|-------|
| AUTH-5 | Session includes full role objects | Consider trimming session data |
| WS-6 | No schema validation on socket event data | Add Zod schemas to socket handlers |
| API-1 | Ping endpoint reveals server timestamp | Minimal information disclosure |
| API-2 | Console.log statements in production | Clean up before production |
| DATA-1 | User files stored without encryption | Evaluate based on data sensitivity requirements |

---

## Positive Security Controls

The audit identified several well-implemented security controls that require no remediation:

**Input Validation & Injection Prevention**
- Comprehensive Zod schemas validate API inputs
- SSRF protection with URL validation
- Path traversal prevention with multiple defensive layers
- ZIP bomb protection on file uploads

**Infrastructure Security**
- Security headers configured (CSP, HSTS)
- Environment variable validation at startup
- Audit logging infrastructure in place

**Authentication**
- Google OAuth integration via NextAuth
- Case-insensitive email handling
- Session management with secure defaults

---

## Implementation Checklist

### Before V1 PoC Release (Documentation Only)

- [ ] **AUTH-1:** Document open registration default with configuration instructions
- [ ] **WS-1/WS-2:** Document WebSocket security model and hardening path
- [ ] **General:** Add deployment security checklist (billing alerts, user setup)

### Post-PoC Hardening (If Time Permits)

- [ ] **WS-5:** Add auth to internal endpoints
- [ ] **FE-3:** Audit API routes for server-side permission checks
- [ ] **ADAPT-1:** Add output sanitization for AI content
- [ ] **CONFIG-3:** Add HSTS and X-Content-Type-Options headers

### Before V2 Production

- [ ] **WS-1:** Add Socket.IO authentication middleware
- [ ] **WS-2:** Bind sessions to authenticated users
- [ ] **WS-3:** Implement WebSocket rate limiting
- [ ] **AUTH-1:** Implement domain restriction or user allowlist (code-level)
- [ ] **AUTH-3:** Block roleless users at signIn
- [ ] **FE-2:** Remove eval('require') pattern
- [ ] **ADAPT-2:** Add prompt injection detection
