# 04. API Security

## Overview

This section examines the security of Primer's 45 API endpoints, focusing on input validation, authorization, SSRF protection, and error handling. API security is critical because these endpoints are the primary interface between users and server-side functionality.

Primer's API architecture uses Next.js App Router with a mix of public and authenticated endpoints. The application implements multiple layers of defense including Zod schema validation, rate limiting, path traversal protection, and SSRF filtering.

| Category | Routes | Security Approach |
|----------|--------|-------------------|
| Authentication | 1 | NextAuth.js session management |
| Admin | 1 | Permission-based (`ADMIN_USERS` required) |
| Experiences | 5 | Visibility-based authorization |
| Upload | 2 | Rate limiting + size limits + audit logging |
| Storage | 1 | Path traversal protection |
| Proxy | 1 | SSRF protection + rate limiting |
| Diagnostic | 2 | Public (intentional) |
| Sessions/OpenAI | 10 | Mixed auth patterns |

---

## Executive Summary

| Assessment | Result |
|------------|--------|
| **Overall Status** | :material-alert: **MEDIUM RISK** |
| **Risk Level** | Low-Medium |
| **PoC Blocker** | No |
| **Action Required** | Documentation + minor code fixes |

**Review approach:** AI performed static analysis of all 45 API endpoints, examining Zod schemas, authorization patterns, and security utilities. Human reviewer tested rate limiting, error responses, and performed code review to validate AI findings and discover additional issues.

**Key findings:** The API has solid foundations (Zod validation, path traversal protection, rate limiting) but two gaps need attention: (1) the SSRF protection uses a deny-list approach vulnerable to bypass techniques, and (2) backend agent context functions lack path traversal validation. Both are low-severity given the PoC context but should be documented.

**Bottom Line:** Acceptable for PoC release with documentation of known limitations.

---

## Finding Synthesis Matrix

**Synthesis Date:** 2026-02-04

| ID | Finding | AI | Human | Final Severity | PoC Status |
|----|---------|:--:|:-----:|----------------|------------|
| API-1 | Deny-list SSRF protection | Medium | Agreed | **Low** | Acceptable |
| API-2 | Path traversal in tool context | -- | NEW | **Low** | Acceptable |
| API-3 | Console.log in production code | Low | Confirmed | **Low** | Documentation |
| API-4 | Zod schema strictness | Low | Not tested | **Low** | Acceptable |
| API-5 | Proxy timing attacks | Low | Not tested | **Informational** | Acceptable |
| API-6 | Diagnostic timestamp disclosure | Low | -- | **Informational** | Acceptable |

---

### API-1: Deny-List SSRF Protection

**AI Assessment:** Medium - DNS rebinding can bypass validation
**Human Assessment:** Agreed (Low for PoC) - Not on cloud with metadata endpoint

| Aspect | Analysis |
|--------|----------|
| **The Issue** | URL validation uses deny-list for private IPs, vulnerable to DNS rebinding and alternative IP formats |
| **Location** | `src/app/lib/security/url-validation.ts` |
| **Evidence** | Blocks `^10\.`, `^192\.168\.`, etc. but validation occurs before fetch, allowing TOCTOU attacks |
| **Impact** | Could allow access to cloud metadata endpoints or internal services if deployed on cloud infrastructure |

**Resolution:**
- PoC: Document as known limitation. Current deployment is not on cloud with metadata endpoint.
- Production: Switch to allow-list of permitted domains or use DNS pinning library.

---

### API-2: Path Traversal in Tool Context

**AI Assessment:** Not identified
**Human Assessment:** Low - Indirect access vector through AI agent tools

| Aspect | Analysis |
|--------|----------|
| **The Issue** | `createFile` and `getResourceContent` use `path.join()` without validating the result stays within the experience folder |
| **Location** | `src/app/api/backend-agent/utils/context.ts:492` |
| **Evidence** | `const fullPath = await import('path').then(p => p.join(experienceFolder, path));` |
| **Impact** | A path like `../../etc/passwd` could escape the experience folder, but requires compromising AI agent tool calls |

**Resolution:** Add path validation similar to storage API - verify resolved path starts with intended directory. Low priority given the indirect attack vector (requires AI agent manipulation).

---

### API-3: Console.log in Production Code

**AI Assessment:** Low - Debug output could expose internal state
**Human Assessment:** Confirmed - One instance remains

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Console.log statement in production code |
| **Location** | `src/app/api/backend-agent/managers/ToolRegistrationManager.ts:94` |
| **Evidence** | `console.log('[BACKEND-AGENT] Image-related tools available to agent:', ...)` |
| **Impact** | Minor information disclosure of available tools |

**Resolution:** Replace with structured logger before production release.

---

### API-4: Zod Schema Strictness

**AI Assessment:** Low - Unbounded strings/arrays could cause DoS
**Human Assessment:** Not tested (deferred)

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Zod schemas may lack `.max()` constraints on strings and arrays |
| **Location** | Various API routes |
| **Evidence** | Theoretical - specific unbounded schemas not identified |
| **Impact** | Large payloads could cause memory exhaustion |

**Resolution:** Audit schemas for production. For PoC, existing middleware and hosting limits provide baseline protection.

---

## Positive Security Controls

| Control | Status | Notes |
|---------|--------|-------|
| Zod input validation | :material-check-circle: | Used consistently across API routes |
| Path traversal protection | :material-check-circle: | Storage API has multiple validation layers |
| Rate limiting | :material-check-circle: | Applied to sensitive endpoints (upload, auth, admin) |
| ZIP bomb protection | :material-check-circle: | Decompressed size limits on uploads |
| Audit logging | :material-check-circle: | Admin actions and uploads logged |
| Error sanitization | :material-check-circle: | Stack traces only in development mode |
| Admin authorization | :material-check-circle: | Permission-based with audit logging |

---

## Research Insights: AI vs Human Performance

### Detection Comparison

| Category | AI | Human | Notes |
|----------|:--:|:-----:|-------|
| Issues identified | 6 | 2 new + 4 validations | AI found more theoretical issues; human found practical code gap |
| Concrete evidence | Partial | Yes | Human confirmed error handling, tested rate limiting |
| False positives | 0 | 0 | No disputed findings |

### AI Strengths
- Systematic coverage of all 45 endpoints
- Identified theoretical attack vectors (DNS rebinding, timing attacks)
- Comprehensive documentation of security controls
- Pattern-based detection across multiple files

### AI Limitations
- Could not test against running deployment
- DNS rebinding severity assessment required deployment context
- Did not identify path traversal gap in backend agent context
- Could not verify rate limiting actually enforced

### Human Strengths
- Found path traversal issue in backend agent context (AI missed)
- Verified rate limiting works in practice
- Confirmed error handling doesn't leak sensitive data
- Applied deployment context to severity calibration

### Human Limitations
- Did not test Zod schema bounds or timing attacks
- Limited time (2.5 hrs) constrained coverage depth
- Did not test DNS rebinding (not applicable to current deployment)

---

## Consolidated Recommendations

### For PoC Release

| Priority | Action | Owner |
|----------|--------|-------|
| **Required** | Document SSRF deny-list limitation | Docs |
| **Recommended** | Add path validation to context.ts | Dev |
| **Recommended** | Replace console.log with structured logger | Dev |

### For Production Release

| Priority | Action | Effort |
|----------|--------|--------|
| **P1** | Switch SSRF to allow-list or DNS pinning | Medium |
| **P1** | Add path traversal validation to backend agent context | Low |
| **P2** | Audit Zod schemas for `.max()` constraints | Medium |
| **P2** | Implement Redis-backed rate limiting | Medium |
| **P3** | Review diagnostic endpoint exposure | Low |

---

## PoC Readiness

- [x] No authentication bypass vulnerabilities
- [x] Rate limiting functional on sensitive endpoints
- [x] Path traversal protected in storage API
- [x] Error responses sanitized in production mode
- [x] Admin endpoints properly authorized
- [ ] Document SSRF deny-list limitation
- [ ] Add path validation to backend agent context (recommended)

---

## Detailed Reviews

- [AI Review](../appendices/ai-reviews/api-security-ai-review.md)
- [Human Review](../appendices/human-reviews/api-security-human-review.md)
