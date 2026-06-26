# 07. Data Handling & Privacy

## Overview

This section examines how Primer handles user data, file uploads, storage, logging, and privacy considerations. Data handling is critical for maintaining user trust and regulatory compliance, especially in an educational context where student data may be involved.

The attack surfaces examined include file upload security, storage service architecture, user data persistence, audit logging practices, and session data management. Primer handles data across several layers: a storage service abstraction supporting local filesystem and S3 backends, file-based user role storage, in-memory session management, and structured audit logging via Pino.

| Component | Technology | Purpose |
|-----------|------------|---------|
| Upload API | Next.js API Route | Experience file ingestion with multi-layer validation |
| Storage Service | Factory Pattern | Abstracted local/S3 storage with path validation |
| User Storage | JSON File | Role assignments for non-environment users |
| Audit Logger | Pino | Security event logging with user attribution |
| Session Store | In-Memory | WebSocket session tracking |

---

## Executive Summary

| Assessment | Result |
|------------|--------|
| **Overall Status** | :material-check-circle: **PASS** |
| **Risk Level** | Low |
| **PoC Blocker** | No |
| **Action Required** | Documentation |

**Review approach:** AI conducted static code analysis of storage, upload, and logging components. Human performed targeted review of analytics authorization, SSRF protection, and PII handling with live inspection of key files.

**Key findings:** Upload security is robust with rate limiting, ZIP bomb protection, path traversal prevention, and SSRF blocking. User file storage is unencrypted but contains no secrets (OAuth-only auth). Audit logs intentionally include email addresses for accountability in the research context. Minor gap identified in DNS rebinding protection for SSRF, but not exploitable in PoC context.

**Bottom Line:** Data handling is well-implemented with defense-in-depth; acceptable for PoC with documentation of log confidentiality requirements.

---

## Finding Synthesis Matrix

**Synthesis Date:** 2026-02-04

| ID | Finding | AI | Human | Final Severity | PoC Status |
|----|---------|:--:|:-----:|----------------|------------|
| DATA-1 | Upload Security Implementation | Informational | Agreed | **Informational** | Positive Control |
| DATA-2 | SSRF Protection | Not Noted | Informational | **Informational** | Acceptable (DNS rebinding gap noted) |
| DATA-3 | Storage Path Validation | Informational | Agreed | **Informational** | Positive Control |
| DATA-4 | User File Storage Unencrypted | Low | Agreed | **Low** | Documentation |
| DATA-5 | Session Data No TTL | Low | Not Tested | **Low** | Acceptable |
| DATA-6 | PII in Audit Logs | Low | Agreed | **Low** | Documentation |
| DATA-7 | Teacher Access Control | NEW | Informational | **Informational** | Acceptable |

---

### DATA-1: Upload Security Implementation

**AI Assessment:** Informational — Comprehensive security controls implemented
**Human Assessment:** Agreed — Confirmed with code review; test coverage validated

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Not an issue - this is a positive security finding |
| **Location** | `src/app/api/upload/route.ts` |
| **Evidence** | See controls table below |
| **Impact** | N/A - defense in depth working as designed |

**Security Controls Verified:**

| Control | Implementation | Verified By |
|---------|----------------|-------------|
| Rate limiting | 10 uploads/hour per client | AI + Human |
| File size limit | 25MB compressed, 500MB decompressed | Human |
| ZIP bomb protection | Decompressed size tracking | AI + Human |
| Path traversal | `sanitizeZipEntryPath()` function | AI + Human |
| SSRF protection | `validateUrl()` for remote URLs | AI + Human |
| File type validation | Requires `experience.json` in root | AI |
| Audit logging | `auditExperienceUpload()` called | AI |
| Cleanup on failure | Removes partially extracted files | AI + Human |

**Resolution:** No action required. Test coverage exists in `__tests__/sanitization.test.ts` with 400+ lines covering attack scenarios.

---

### DATA-2: SSRF Protection

**AI Assessment:** Not explicitly noted
**Human Assessment:** Informational — Good coverage with minor DNS rebinding gap

| Aspect | Analysis |
|--------|----------|
| **The Issue** | SSRF protection covers common targets but not DNS rebinding |
| **Location** | `src/app/lib/security/url-validation.ts` |
| **Evidence** | Blocks localhost, AWS metadata, RFC 1918 ranges, link-local, IPv6 private |
| **Impact** | Attacker could theoretically use DNS rebinding to access internal services |

**What is blocked:**
- Localhost variants (127.0.0.1, ::1, 0.0.0.0)
- AWS metadata endpoint (169.254.169.254)
- RFC 1918 private ranges (10.x, 172.16-31.x, 192.168.x)
- Link-local addresses
- IPv6 private ranges

**DNS rebinding gap:** An attacker could set up a domain that initially resolves to a public IP (passing validation), then changes to an internal IP. This is a sophisticated attack requiring DNS infrastructure.

**Resolution:** Document as known limitation. Not a PoC blocker due to attack complexity. For production, consider re-validating IP at connection time or using a DNS pinning library.

---

### DATA-3: Storage Path Validation

**AI Assessment:** Informational — Abstracted storage with path validation
**Human Assessment:** Agreed — Defense in depth confirmed

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Not an issue - positive security control |
| **Location** | `src/app/lib/storage/LocalStorageService.ts` |
| **Evidence** | `getFullPath()` verifies resolved paths stay within `baseDir` |
| **Impact** | N/A - prevents path traversal at storage layer |

**Resolution:** No action required. Defense in depth working correctly - path validation at both ZIP extraction and storage layer.

---

### DATA-4: User File Storage Unencrypted

**AI Assessment:** Low — File-based users stored without encryption
**Human Assessment:** Agreed — PoC Acceptable since no secrets stored

| Aspect | Analysis |
|--------|----------|
| **The Issue** | `users.json` stores role assignments in plaintext |
| **Location** | `src/config/user-storage.ts` |
| **Evidence** | `JSON.parse(fs.readFileSync(filePath, "utf-8"))` |
| **Impact** | User roles visible to anyone with filesystem access |

**Mitigating factors:**
- Environment-defined users take precedence
- No passwords or tokens stored (OAuth-only authentication)
- File should be in protected directory

**Contents stored:**
- Email addresses (as keys)
- Role assignments
- Creation/modification timestamps

**Resolution:** Document that file system security is required for `users.json` protection. For production, restrict file permissions (chmod 600).

---

### DATA-5: Session Data No TTL

**AI Assessment:** Low — In-memory sessions without expiration
**Human Assessment:** Not explicitly tested

| Aspect | Analysis |
|--------|----------|
| **The Issue** | WebSocket sessions persist indefinitely in memory |
| **Location** | `server.ts` (WebSocket session store) |
| **Evidence** | Session interface lacks TTL field; no cleanup routine observed |
| **Impact** | Potential memory growth over time; stale sessions persist |

**Resolution:** Acceptable for PoC with limited users. For production, implement session TTL and periodic cleanup.

---

### DATA-6: PII in Audit Logs

**AI Assessment:** Low — Email addresses logged for audit purposes
**Human Assessment:** Agreed — Intentional for research accountability

| Aspect | Analysis |
|--------|----------|
| **The Issue** | User email addresses included in audit logs |
| **Location** | `src/lib/audit-logger.ts` and various API routes |
| **Evidence** | Auth events, admin actions, uploads all log user email |
| **Impact** | Logs must be treated as confidential; GDPR implications in some jurisdictions |

**Data logged:**
- User email (userId)
- Client IP address (from x-forwarded-for headers)
- User agent string
- Event-specific details

**Resolution:** Document that logs contain PII and must be secured. For US research context, this is acceptable. For broader deployment, consider log retention policies and GDPR compliance review.

---

### DATA-7: Teacher Access Control

**AI Assessment:** Not noted
**Human Assessment:** Informational — Analytics limited to experience author

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Only experience author can run analytics |
| **Location** | `src/app/api/analytics/run/route.ts` |
| **Evidence** | Authorization check limits to single author |
| **Impact** | Co-teachers cannot access shared class analytics |

**Resolution:** Acceptable for PoC. Document limitation for co-teaching scenarios. Future enhancement could support shared ownership.

---

## Positive Security Controls

| Control | Status | Notes |
|---------|--------|-------|
| Multi-layer upload validation | Present | Rate limit + size + ZIP bomb + path traversal + SSRF |
| Storage abstraction | Present | Consistent security across local/S3 backends |
| Path traversal protection | Present | Both at extraction and storage layers |
| SSRF blocking | Present | Covers common internal targets |
| Audit logging | Present | Comprehensive security event coverage |
| No password storage | Present | OAuth-only eliminates credential theft risk |
| Structured logging | Present | Pino with module namespacing |
| Upload test coverage | Present | 400+ lines covering attack scenarios |

---

## Research Insights: AI vs Human Performance

### Detection Comparison

| Category | AI | Human | Notes |
|----------|:--:|:-----:|-------|
| Issues identified | 6 | 7 | Human found SSRF gap and teacher access control |
| Concrete evidence | Yes | Yes | Both provided code-level analysis |
| False positives | 0 | 0 | All findings validated |

### AI Strengths
- Systematic enumeration of upload security controls
- Complete data flow diagrams
- Identified session TTL issue (not tested by human)

### AI Limitations
- Did not drill into SSRF implementation details
- Missed DNS rebinding attack vector
- Did not analyze analytics authorization

### Human Strengths
- Deep dive into SSRF protection revealed DNS rebinding gap
- Identified teacher access control limitation
- Verified test coverage exists for attack scenarios

### Human Limitations
- Did not independently test session TTL behavior
- Time constraints limited full logging review

---

## Consolidated Recommendations

### For PoC Release

| Priority | Action | Owner |
|----------|--------|-------|
| **Required** | Document that audit logs contain PII and must be secured | Docs |
| **Required** | Document file permission requirements for users.json | Docs |
| **Recommended** | Note DNS rebinding as known SSRF limitation | Docs |

### For Production Release

| Priority | Action | Effort |
|----------|--------|--------|
| **P1** | Implement session TTL and cleanup routine | Medium |
| **P2** | Add DNS pinning or re-validation for SSRF protection | Medium |
| **P2** | Restrict users.json file permissions in deployment | Low |
| **P3** | Define log retention policy for PII compliance | Low |
| **P3** | Support co-teacher access for shared experiences | Medium |

---

## PoC Readiness

- [x] Upload security validated with comprehensive controls
- [x] Storage path validation prevents traversal attacks
- [x] SSRF protection covers common attack targets
- [x] No credentials stored in user file (OAuth-only)
- [x] Audit logging provides accountability
- [ ] Document log confidentiality requirements
- [ ] Document users.json file security requirements

---

## Detailed Reviews

- [AI Review](../appendices/ai-reviews/data-handling-ai-review.md)
- [Human Review](../appendices/human-reviews/data-handling-human-review.md)
