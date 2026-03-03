# Findings Overview

This page summarizes all security and code quality findings from the Primer audit, synthesizing both AI and human review results across 11 categories.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total Findings** | 73 |
| **Critical** | 0 |
| **High** | 1 (downgraded to Medium for PoC) |
| **Medium** | 24 |
| **Low** | 31 |
| **Informational** | 17 |
| **PoC Blockers** | 0 |
| **Human Review Time** | ~31.5 hours |

**Bottom Line:** The codebase is suitable for V1 PoC release with trusted users in a controlled environment. No critical vulnerabilities were found. High-severity findings were downgraded based on deployment context (trusted users, not public-facing). Documentation of known limitations is required before release.

---

## Category Summary

| # | Category | Status | Risk | Findings | Key Issues |
|---|----------|--------|------|----------|------------|
| 01 | [Secrets](secrets.md) | :material-check-circle: **PASS** | Low | 0 | No secrets in git history or source code |
| 02 | [Authentication](authentication.md) | :material-alert: **MEDIUM-HIGH** | Medium-High | 11 | Fail-open authorization, storage API auth gap |
| 03 | [WebSockets](websockets.md) | :material-check-circle: **PASS** | Medium | 7 | No auth on connections (mitigated by UUID entropy) |
| 04 | [API Security](api-security.md) | :material-alert: **MEDIUM** | Low-Medium | 6 | SSRF deny-list approach, path traversal in context |
| 05 | [AI Adapters](adapters.md) | :material-alert: **MEDIUM** | Medium | 8 | Prompt injection possible, output sanitization gap |
| 06 | [Configuration](configuration.md) | :material-alert: **MEDIUM** | Medium | 6 | CSP unsafe-eval required for Babel |
| 07 | [Data Handling](data-handling.md) | :material-check-circle: **PASS** | Low | 7 | Strong upload security, PII in logs (intentional) |
| 08 | [Code Quality](code-quality.md) | :material-alert: **MEDIUM** | Medium | 10 | God Hook pattern, loose typing, swallowed errors |
| 09 | [Frontend Security](frontend-security.md) | :material-alert: **MEDIUM** | Medium | 6 | Weak CSP, client-side file validation only |
| 10 | [Frontend Code Quality](frontend-code-quality.md) | :material-check-circle: **PASS** | Low | 12 | Large event handler, inconsistent error handling |
| 11 | [Dependencies](dependencies.md) | :material-check-circle: **PASS** | Low | 5 | lodash-es vuln via mermaid (indirect) |

---

## Findings by Severity

### High Severity (Downgraded for PoC)

| ID | Finding | Original | Final | Rationale |
|----|---------|----------|-------|-----------|
| AUTH-2 | Fail-open authorization architecture | High | **Medium** | Route spot-checks show authorization enforced; trusted users |
| CFG-1 | CSP unsafe-eval | High | **Medium** | Required for Babel runtime; trusted users reduce XSS risk |
| WS-1 | No authentication on socket connections | High | **Low** | UUID entropy makes session guessing infeasible |
| WS-2 | Client-provided session IDs | High | **Low** | 122-bit UUIDs cannot be brute-forced |

### Medium Severity

| ID | Finding | Category |
|----|---------|----------|
| AUTH-1 | Open registration (any Google user) | Authentication |
| AUTH-3 | Session fixation via WebSocket | Authentication |
| AUTH-10 | Storage API authorization gap | Authentication |
| WS-3 | No rate limiting on socket events | WebSockets |
| WS-5 | Unprotected internal HTTP endpoints | WebSockets |
| API-1 | Deny-list SSRF protection | API Security |
| ADAPT-1 | Prompt injection possible | Adapters |
| ADAPT-2 | Tool arguments not schema-validated | Adapters |
| ADAPT-8 | Missing output sanitization (XSS) | Adapters |
| CFG-1 | unsafe-eval in CSP | Configuration |
| FE-1 | Weak CSP (unsafe-eval + unsafe-inline) | Frontend Security |
| FE-3 | Client-side permission checks | Frontend Security |
| FE-4 | Client-side only file validation | Frontend Security |
| CQ-1 | Loose typing in AI adapters | Code Quality |
| CQ-3 | God Hook pattern (700+ lines) | Code Quality |
| CQ-4 | Silently swallowed errors | Code Quality |
| CQ-6 | Large context factory (555 lines) | Code Quality |
| FEQ-1 | Large event handler (713 lines) | Frontend Code Quality |
| FEQ-2 | Inconsistent error handling | Frontend Code Quality |
| FEQ-6 | Custom windowing system complexity | Frontend Code Quality |

---

## AI vs Human Detection Summary

| Metric | AI | Human |
|--------|:--:|:-----:|
| Total findings identified | 52 | 41 |
| Unique findings (AI only) | 19 | 21 |
| Overlapping findings | 33 | 33 |
| False positives | 4 | 0 |
| Severity overestimates | 6 | 0 |

### Key Patterns

**AI Strengths:**
- Systematic coverage across all files
- Identified architectural patterns and theoretical attack vectors
- Comprehensive documentation with code evidence
- Found subtle issues like loading state bugs

**AI Limitations:**
- Could not verify exploitability through live testing
- Overestimated severity without deployment context
- Missed some controls that existed in separate files
- Did not complete Frontend Security review

**Human Strengths:**
- Live testing revealed actual exploitability
- Contextual severity calibration for PoC deployment
- Found issues AI missed (storage API gap, DNS rebinding, custom windowing)
- Verified positive controls actually work

**Human Limitations:**
- Time-constrained (~31.5 hours total)
- Narrower file coverage than AI
- Relied on AI findings to scope investigation

---

## Positive Security Controls

The audit identified numerous security controls working correctly:

| Category | Controls |
|----------|----------|
| **Authentication** | Google OAuth, NEXTAUTH_SECRET validation (32+ chars), case-insensitive email matching |
| **Input Validation** | Zod schemas throughout, path traversal protection, SSRF blocking |
| **Session Security** | httpOnly cookies, cryptographic session IDs (UUID v4) |
| **Upload Security** | Rate limiting, ZIP bomb protection, file size limits, audit logging |
| **Headers** | HSTS (2yr), X-Frame-Options, X-Content-Type-Options, Permissions-Policy |
| **Code Quality** | TypeScript strict mode, structured logging, manager patterns |

---

## PoC Release Requirements

### Required Actions

| Action | Owner | Status |
|--------|-------|--------|
| Document open registration in setup instructions | Docs | Pending |
| Document storage API auth gap as known limitation | Docs | Pending |
| Document CSP unsafe-eval limitation | Docs | Pending |
| Document file upload validation gap | Docs | Pending |
| Configure billing alerts on AI providers ($50/$100) | Ops | Pending |
| Add NOTICES.md with LGPL/MPL acknowledgments | Docs | Pending |

### Recommended Actions

| Action | Owner | Effort |
|--------|-------|--------|
| Set `poweredByHeader: false` in next.config.ts | Dev | Low |
| Remove unused `next.config.mjs` | Dev | Low |
| Fix duplicate `response.completed` switch case | Dev | Low |
| Fix `getArtifact` loading state bug | Dev | Low |
| Add debug logging to swallowed errors | Dev | Low |

---

## Production Hardening Roadmap

For production release beyond PoC, address these priorities:

### P1 - Critical Path

| Action | Category | Effort |
|--------|----------|--------|
| Implement deny-by-default middleware for `/api/*` | Auth | Medium |
| Bind WebSocket sessions to NextAuth lifecycle | Auth | Medium |
| Add `io.use()` middleware for JWT verification | WebSockets | Medium |
| Implement per-session rate limiting with budget caps | WebSockets | Medium |
| Harden CSP: remove unsafe-eval, use nonces | Config | Medium |
| Add server-side MIME validation for uploads | Frontend | Low |

### P2 - Security Hardening

| Action | Category | Effort |
|--------|----------|--------|
| Switch SSRF to allow-list or DNS pinning | API | Medium |
| Add Zod schema validation for tool arguments | Adapters | Medium |
| Implement prompt injection detection | Adapters | Medium |
| Add output sanitization for AI responses | Adapters | Medium |
| Migrate session store to Redis with TTL | WebSockets | Medium |

### P3 - Code Quality

| Action | Category | Effort |
|--------|----------|--------|
| Refactor useHandleServerEvent into event registry | Frontend | High |
| Extract context.ts into separate managers | Backend | Medium |
| Replace custom windowing with library | Frontend | Medium |
| Standardize error handling patterns | Both | Medium |

---

## Detailed Reports

| # | Report | AI Review | Human Review |
|---|--------|-----------|--------------|
| 01 | [Secrets](secrets.md) | [AI](../appendices/ai-reviews/secrets-git-history-ai-review.md) | [Human](../appendices/human-reviews/secrets-git-history-human-review.md) |
| 02 | [Authentication](authentication.md) | [AI](../appendices/ai-reviews/auth-ai-review.md) | [Human](../appendices/human-reviews/auth-human-review.md) |
| 03 | [WebSockets](websockets.md) | [AI](../appendices/ai-reviews/websocket-ai-review.md) | [Human](../appendices/human-reviews/websocket-human-review.md) |
| 04 | [API Security](api-security.md) | [AI](../appendices/ai-reviews/api-security-ai-review.md) | [Human](../appendices/human-reviews/api-security-human-review.md) |
| 05 | [AI Adapters](adapters.md) | [AI](../appendices/ai-reviews/adapters-ai-review.md) | [Human](../appendices/human-reviews/adapters-human-review.md) |
| 06 | [Configuration](configuration.md) | [AI](../appendices/ai-reviews/config-ai-review.md) | [Human](../appendices/human-reviews/config-human-review.md) |
| 07 | [Data Handling](data-handling.md) | [AI](../appendices/ai-reviews/data-handling-ai-review.md) | [Human](../appendices/human-reviews/data-handling-human-review.md) |
| 08 | [Code Quality](code-quality.md) | [AI](../appendices/ai-reviews/code-quality-ai-review.md) | [Human](../appendices/human-reviews/code-quality-human-review.md) |
| 09 | [Frontend Security](frontend-security.md) | *Not conducted* | [Human](../appendices/human-reviews/frontend-security-human-review.md) |
| 10 | [Frontend Code Quality](frontend-code-quality.md) | [AI](../appendices/ai-reviews/frontend-quality-ai-review.md) | [Human](../appendices/human-reviews/frontend-quality-human-review.md) |
| 11 | [Dependencies](dependencies.md) | [AI](../appendices/ai-reviews/licenses-ai-review.md) | [Human](../appendices/human-reviews/licenses-human-review.md) |
