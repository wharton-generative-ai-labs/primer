# API Security - AI Review

- **Review Date:** 2026-01-27
- **Reviewer:** Claude (AI)
- [x] **Status:** Complete

---

## Scope

### API Routes Analyzed

Total routes: **45 API endpoints**

| Category       | Routes | Files Reviewed                                    |
| -------------- | ------ | ------------------------------------------------- |
| Authentication | 1      | `api/auth/[...nextauth]/route.ts`                 |
| Admin          | 1      | `api/admin/users/route.ts`                        |
| Experiences    | 5      | `api/experiences/**/route.ts`                     |
| Artifacts      | 4      | `api/artifacts/**/route.ts`                       |
| Upload         | 2      | `api/upload/route.ts`, `api/user-upload/route.ts` |
| Storage        | 1      | `api/storage/[...path]/route.ts`                  |
| Proxy          | 1      | `api/proxy/route.ts`                              |
| Diagnostic     | 2      | `api/diagnostic/**/route.ts`                      |
| Sessions       | 5      | `api/session*/route.ts`                           |
| OpenAI         | 5      | `api/openai/**/route.ts`                          |
| Other          | 18     | Various utility endpoints                         |

### Security Controls Reviewed

1. Input validation (Zod schemas)
2. Rate limiting
3. SSRF protection
4. Path traversal prevention
5. Authorization checks
6. Error handling

---

## Findings

### [MEDIUM] SSRF Protection - DNS Rebinding Not Addressed

**Location:** `src/app/lib/security/url-validation.ts`

**Description:** The URL validation blocks private IPs but is vulnerable to DNS rebinding attacks. The validation occurs at request time, but DNS can resolve differently when the actual fetch happens (TOCTOU vulnerability).

**Evidence:**

```typescript
// Blocks:
// - localhost variations (127.0.0.1, ::1, 0.0.0.0)
// - AWS metadata endpoint (169.254.169.254)
// - Private IP ranges (10.x, 172.16-31.x, 192.168.x)
// - Link-local addresses (169.254.x)
// - Multicast addresses (224-239.x)
// - IPv6 private ranges (fc00:, fd00:, fe80:)
// - Non-HTTP protocols
```

**DNS Rebinding Attack Scenario:**

1. Attacker controls `evil.com` DNS
2. First DNS lookup (validation): `evil.com` → `8.8.8.8` (passes validation)
3. Second DNS lookup (fetch): `evil.com` → `169.254.169.254` (AWS metadata)
4. Attacker exfiltrates cloud credentials

**Impact:**

- Cloud metadata credentials could be stolen in AWS/GCP/Azure deployments
- Internal services could be accessed
- Validation provides false sense of security

**Recommendation:**

1. Resolve DNS once and pass IP to fetch (not hostname)
2. Or use DNS pinning library that prevents rebinding
3. Or fetch with explicit IP and Host header
4. Consider disabling DNS caching for outbound requests

---

### [INFORMATIONAL] Rate Limiting Framework Present

**Location:** `src/app/lib/rate-limit.ts`

**Description:** In-memory rate limiter with multiple configurations.

**Evidence:**

```typescript
// Configurations:
// - api: 100 requests per 15 minutes
// - upload: 10 requests per hour
// - auth: 5 requests per 15 minutes
// - strict: 20 requests per 15 minutes (admin operations)
```

**Assessment:** Good implementation. Note that in-memory rate limiting won't persist across server restarts or scale across multiple instances.

**Recommendation:** For production at scale, consider Redis-backed rate limiting.

---

### [INFORMATIONAL] Path Traversal Prevention in Storage API

**Location:** `src/app/api/storage/[...path]/route.ts`

**Description:** Multiple layers of path traversal protection.

**Evidence:**

```typescript
// Protection layers:
// 1. path.normalize() to resolve relative paths
// 2. Check for '..' after normalization
// 3. Check for absolute paths
// 4. Segment-by-segment validation
// 5. Leading slash removal
```

**Assessment:** Comprehensive protection against path traversal attacks.

---

### [INFORMATIONAL] ZIP Upload Security

**Location:** `src/app/api/upload/route.ts`

**Description:** ZIP file upload has multiple security controls.

**Evidence:**

```typescript
// Security controls:
// 1. Rate limiting (10/hour)
// 2. File size limit (FILE_UPLOAD_LIMITS.EXPERIENCE_MAX_SIZE)
// 3. Decompressed size limit (ZIP bomb protection)
// 4. Path sanitization for ZIP entries
// 5. URL validation for remote URLs (SSRF protection)
// 6. Audit logging
// 7. Cleanup on failure
```

**Assessment:** Excellent upload security implementation.

---

### [LOW] Zod Schema Strictness Not Verified

**Location:** Various API routes

**Description:** While Zod validation is used consistently, the strictness of schemas was not audited. A `z.string()` without `.max()` can accept arbitrarily large payloads.

**Example Concern:**

```typescript
// Hypothetical unbounded schema
const schema = z.object({
  message: z.string(), // Could accept 100MB string
  data: z.any(), // No validation at all
});
```

**Impact:**

- Unbounded strings can cause memory exhaustion
- Large payloads can DoS the server
- `z.any()` defeats the purpose of validation

**Recommendation:**

1. Audit all Zod schemas for `.max()` on strings
2. Add `.max()` to array types
3. Avoid `z.any()` - use specific types
4. Consider global request size limits at the middleware level

---

### [LOW] Proxy Endpoint - Timing Attack Potential

**Location:** `src/app/api/proxy/route.ts`

**Description:** The proxy endpoint, while rate-limited, could be used for internal network reconnaissance via timing attacks. Response time differences can reveal whether internal hosts/ports are reachable.

**Impact:**

- Attacker can probe internal network topology
- Can identify running services behind the firewall
- Rate limiting slows but doesn't prevent reconnaissance

**Recommendation:**

1. Add artificial response time jitter to mask timing
2. Consider removing proxy endpoint if not essential
3. Log and alert on scanning patterns (sequential IPs/ports)

---

### [LOW] Diagnostic Ping Endpoint Reveals Timestamp

**Location:** `src/app/api/diagnostic/ping/route.ts`

**Description:** The ping endpoint returns server timestamp.

**Evidence:**

```typescript
return NextResponse.json({
  status: "ok",
  timestamp: new Date().toISOString(),
  message: "pong",
});
```

**Impact:** Minor information disclosure (server time). Could be used for timing attacks in some scenarios.

**Recommendation:** Consider whether timestamp is necessary. If not, remove it.

---

### [LOW] Console.log Statements in Production Code

**Location:** `src/app/api/tool-mappings/route.ts`, `src/app/api/backend-agent/managers/ToolRegistrationManager.ts`

**Description:** Found 2 files with console.log statements that could leak information.

**Impact:** Debug output in production could expose internal state.

**Recommendation:** Replace with structured logger or remove.

---

### [INFORMATIONAL] Authorization Patterns

**Assessment of API authorization:**

| Endpoint           | Auth Type        | Implementation                       |
| ------------------ | ---------------- | ------------------------------------ |
| `/api/admin/users` | Permission-based | :material-check-circle: `ADMIN_USERS` permission required |
| `/api/experiences` | Visibility-based | :material-check-circle: `canViewExperienceInCatalog()`    |
| `/api/upload`      | Rate-limited     | :material-check-circle: Rate limiting, audit logging      |
| `/api/storage`     | None specific    | :material-alert: Relies on middleware auth only    |
| `/api/proxy`       | Rate-limited     | :material-check-circle: Rate limiting, SSRF protection    |
| `/api/diagnostic`  | Public           | :material-alert: Intentionally public              |

---

## Positive Security Observations

1. **Zod validation** - Used consistently for request body validation
2. **SSRF protection** - Comprehensive URL validation for proxy/remote fetch
3. **ZIP bomb protection** - Decompressed size limits on uploads
4. **Path traversal protection** - Multiple validation layers
5. **Rate limiting** - Applied to sensitive endpoints
6. **Audit logging** - Admin actions and uploads are logged
7. **Error sanitization** - Stack traces only in development mode

---

## Risk Assessment

### Overall Rating: LOW-MEDIUM

The API security implementation has good foundations but gaps remain:

**Strengths:**

- Input validation is present (Zod)
- Path traversal is well-handled
- Rate limiting is applied to sensitive endpoints

**Gaps Identified:**

1. **SSRF protection vulnerable to DNS rebinding** - Validation can be bypassed
2. **Zod schema strictness not verified** - Potential DoS via large payloads
3. **Proxy endpoint enables reconnaissance** - Timing attacks possible
4. Rate limiting is in-memory (won't scale across instances)
5. Diagnostic endpoints are publicly accessible

**Note:** The "Excellent" ratings in initial scans were premature. Defense-in-depth is present but advanced bypass techniques were not tested.

---

## Recommendations

### Priority 1 (Medium)

1. **Address DNS rebinding in SSRF protection** - Resolve DNS once and use IP for fetch
2. **Audit Zod schemas for strictness** - Add `.max()` to all unbounded types
3. Consider Redis-backed rate limiting for production scale

### Priority 2 (Low)

4. Review diagnostic endpoint exposure
5. Add timing jitter to proxy responses or remove endpoint
6. Remove console.log statements from production code
