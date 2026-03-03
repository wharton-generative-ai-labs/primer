# 09. Frontend Security

## Overview

This section examines client-side security controls including XSS prevention, Content Security Policy effectiveness, client storage security, input validation, and authentication state handling. Frontend vulnerabilities can enable credential theft, session hijacking, and malicious content injection.

Primer's frontend is built on Next.js with React, using a standard security model:

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 14 / React | Server-side and client-side rendering |
| Authentication | NextAuth.js | Session management via httpOnly cookies |
| Content Policy | Custom CSP | Script and resource restrictions |
| Real-time | Socket.IO + WebRTC | Live communication channels |
| Styling | Tailwind CSS | Dynamic styling (requires CSP exemptions) |

The frontend relies on React's default escaping for XSS prevention, with explicit sanitization (`sanitizeHtml`) for cases requiring `dangerouslySetInnerHTML`. Session tokens are managed server-side via httpOnly cookies, not accessible to JavaScript.

---

## Executive Summary

| Assessment | Result |
|------------|--------|
| **Overall Status** | :material-alert: **MEDIUM RISK** |
| **Risk Level** | Medium |
| **PoC Blocker** | No |
| **Action Required** | Documentation + production hardening notes |

**Review approach:** Human reviewer conducted static code analysis using grep searches for dangerous patterns (`dangerouslySetInnerHTML`, `eval`, `localStorage`, `unsafe-inline`) and performed live testing using browser DevTools, React DevTools, and network inspection. No AI review was completed for this section.

**Key findings:** The CSP includes both `'unsafe-eval'` and `'unsafe-inline'` directives, significantly weakening XSS protection. File upload validation is client-side only, creating potential stored XSS vectors. Permission checks rely on client-side state that could be bypassed if backend validation is inconsistent.

**Bottom Line:** Acceptable for PoC with trusted users. CSP hardening required before production.

---

## Finding Synthesis Matrix

**Synthesis Date:** 2026-02-04

| ID | Finding | AI | Human | Final Severity | PoC Status |
|----|---------|:--:|:-----:|----------------|------------|
| FE-1 | Weak CSP (unsafe-eval, unsafe-inline) | N/A | High | **High** | Acceptable (document) |
| FE-2 | Server-side eval usage | N/A | Low | **Low** | Acceptable |
| FE-3 | Client-side permission checks | N/A | Medium | **Medium** | Acceptable (see AUTH) |
| FE-4 | Client-side only file validation | N/A | Medium | **Medium** | Acceptable (document) |
| FE-5 | localStorage event persistence | N/A | Low | **Low** | Acceptable |
| FE-6 | CDN script sources in CSP | N/A | Informational | **Informational** | Acceptable |

---

## Detailed Findings

### FE-1: Weak Content Security Policy

**Human Assessment:** High — CSP includes unsafe-eval and unsafe-inline

| Aspect | Analysis |
|--------|----------|
| **The Issue** | CSP allows `'unsafe-eval'` (for Babel, dev HMR) and `'unsafe-inline'` (for Tailwind, Next.js scripts) |
| **Location** | `src/lib/csp.ts` |
| **Evidence** | See code below |
| **Impact** | If XSS injection point exists, CSP will not block script execution |

```typescript hl_lines="3 4"
'script-src': [
  "'self'",
  "'unsafe-eval'", // Required for Babel (custom components) and dev HMR
  "'unsafe-inline'", // Required for Next.js inline scripts
  "https://cdnjs.cloudflare.com",
  "https://cdn.jsdelivr.net",
],
```

**Why This Matters:**

| CSP Directive | Security Impact |
|---------------|-----------------|
| `'unsafe-eval'` | Allows `eval()`, `Function()`, and similar dynamic code execution |
| `'unsafe-inline'` | Allows inline `<script>` tags and event handlers like `onclick` |
| CDN allowlists | Any script from these domains can be loaded |

**PoC Acceptance Rationale:** React's default escaping and explicit sanitization provide primary XSS protection. CSP is defense-in-depth. With trusted users and no known XSS vectors, acceptable for PoC.

**Resolution:** Document as production hardening requirement. For production:
- Remove `'unsafe-eval'` if custom components don't require it
- Use nonces instead of `'unsafe-inline'`
- Add SRI hashes for CDN scripts

---

### FE-2: Server-Side eval Usage

**Human Assessment:** Low — eval('require') pattern for dynamic loading

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Uses `eval('require')` to dynamically load modules |
| **Location** | `src/app/lib/tools/groups.ts:48-50` |
| **Evidence** | See code below |
| **Impact** | Theoretical RCE if path were user-controlled (currently it is not) |

```typescript hl_lines="1-3"
const path = eval("require")("path");
const fs = eval("require")("fs");
const { env } = eval("require")("@/config/env");
```

**PoC Acceptance Rationale:** This runs server-side only, loading hardcoded modules. No user input flows into the require path. Low practical risk.

**Resolution:** Refactor to use proper dynamic imports (`import()`) for cleaner code, but not a security blocker.

---

### FE-3: Client-Side Permission Checks

**Human Assessment:** Medium — UI-only enforcement without guaranteed backend parity

| Aspect | Analysis |
|--------|----------|
| **The Issue** | `usePermissions` hook checks permissions from session context |
| **Location** | `src/app/hooks/usePermissions.ts` |
| **Evidence** | See code below |
| **Impact** | If backend doesn't mirror these checks, UI bypass enables unauthorized actions |

```typescript hl_lines="4"
const privileges = session?.user?.privileges || [];
const can = useCallback(
  (permission: Permission): boolean => {
    return privileges.includes(permission);
  },
  [session, privileges],
);
```

**Cross-Reference:** This is consistent with AUTH-2 (fail-open authorization architecture). The same risk applies: frontend permission checks are only as good as their backend counterparts.

**Resolution:** Covered by AUTH-2 recommendations. Ensure all `can(Permission.X)` checks in UI have matching `hasPermission` checks in API routes.

---

### FE-4: Client-Side Only File Type Validation

**Human Assessment:** Medium — File type validation easily bypassed

| Aspect | Analysis |
|--------|----------|
| **The Issue** | File uploads validated by client-side `accept` attribute only |
| **Location** | `src/app/components/FileUpload.tsx` |
| **Evidence** | `<input type="file" accept=".pdf,.doc,.docx,.txt" ... />` |
| **Impact** | Attacker can upload arbitrary files (e.g., `.html`) via DevTools or direct requests |

**Attack Scenario:**
1. User uploads `malicious.html` by modifying input or crafting request
2. Server stores file without MIME validation
3. File served back as `text/html`
4. Stored XSS when another user views the file

**PoC Acceptance Rationale:** Requires intentional bypass by trusted user. Document the limitation.

**Resolution:** For production:
- Server-side MIME type validation using magic bytes
- Serve uploaded files with `Content-Disposition: attachment`
- Consider content scanning for HTML/script content

---

### FE-5: localStorage Event Persistence

**Human Assessment:** Low — Non-sensitive data in localStorage

| Aspect | Analysis |
|--------|----------|
| **The Issue** | EventContext stores event preferences in localStorage |
| **Location** | `src/app/contexts/EventContext.tsx` |
| **Evidence** | DevTools inspection shows event IDs and UI state only |
| **Impact** | XSS could read localStorage, but no sensitive data exposed |

**PoC Acceptance Rationale:** Session tokens use httpOnly cookies (verified). localStorage contains only UI preferences.

---

### FE-6: CDN Script Sources in CSP

**Human Assessment:** Informational — Broad CDN allowlist

| Aspect | Analysis |
|--------|----------|
| **The Issue** | CSP allows scripts from `cdnjs.cloudflare.com` and `cdn.jsdelivr.net` |
| **Location** | `src/lib/csp.ts` |
| **Evidence** | See FE-1 code evidence |
| **Impact** | Expands attack surface if XSS exists (can load any library from these CDNs) |

**Resolution:** For production, use Subresource Integrity (SRI) hashes when loading CDN scripts.

---

## Positive Security Controls

| Control | Status | Notes |
|---------|--------|-------|
| HTML sanitization | Correct | `sanitizeHtml` used before `dangerouslySetInnerHTML` in MermaidDiagram |
| Session token storage | Correct | httpOnly cookies via NextAuth, not accessible to JS |
| Session ID generation | Correct | Uses `crypto.randomUUID()` for cryptographic randomness |
| React default escaping | Correct | JSX `{variable}` syntax auto-escapes HTML entities |
| Backend rate limiting | Correct | backend-agent API has rate limiting and tool execution limits |
| Limited dangerouslySetInnerHTML | Correct | Usage is isolated and sanitized |

---

## Research Insights: AI vs Human Performance

### Detection Comparison

| Category | AI | Human | Notes |
|----------|:--:|:-----:|-------|
| Issues identified | 0 | 6 | AI review not completed |
| Concrete evidence | N/A | Yes | DevTools, network inspection, grep searches |
| False positives | N/A | 0 | All findings verified |

### AI Strengths
- N/A (AI review not conducted for this section)

### AI Limitations
- **Coverage gap:** This section was never reviewed by AI, demonstrating that AI audits require explicit scoping and scheduling
- **Template-only output:** AI produced a template but did not populate findings

### Human Strengths
- **Multi-tool approach:** Combined static analysis (grep), DevTools inspection, and live testing
- **Cross-domain knowledge:** Connected frontend permission checks to backend authorization gaps
- **Practical exploitation analysis:** Evaluated real-world attack scenarios for file uploads
- **Verification of positive controls:** Confirmed httpOnly cookies, sanitization implementation

### Human Limitations
- **Time-constrained:** 3 hrs total across 16 files
- **Selective depth:** Focused on high-risk patterns rather than exhaustive line-by-line review

### Key Research Insight

> **Human-only review provides baseline for comparison.**
>
> This section demonstrates human review capability without AI assistance. The human identified 6 issues ranging from Informational to High severity, with concrete evidence (code snippets, DevTools verification). This establishes a benchmark for what thorough human review captures, enabling future comparison when AI reviews are completed.

---

## Consolidated Recommendations

### For PoC Release

| Priority | Action | Owner |
|----------|--------|-------|
| **Required** | Document CSP limitations in deployment guide | Docs |
| **Required** | Document file upload validation gap | Docs |
| **Recommended** | Note permission check parity requirement in developer guide | Docs |

### For Production Release

| Priority | Action | Effort |
|----------|--------|--------|
| **P1** | Harden CSP: remove unsafe-eval, use nonces for inline scripts | Medium |
| **P1** | Add server-side MIME validation for file uploads | Low |
| **P2** | Add SRI hashes for CDN scripts | Low |
| **P2** | Refactor eval('require') to use dynamic imports | Low |
| **P3** | Review localStorage usage for data minimization | Low |

---

## PoC Readiness

- [x] No critical blockers identified
- [x] High-severity items (CSP) documented as known limitations
- [x] Positive controls verified (sanitization, httpOnly cookies, React escaping)
- [x] Ready for PoC release with known limitations

---

## Detailed Reviews

- AI Review — *Not conducted; this section provides a human-only baseline for research comparison*
- [Human Review](../appendices/human-reviews/frontend-security-human-review.md)
