# Data Handling & Privacy - Human Review

---

??? info "AI Review Guidance :material-robot-outline:"
    The AI review (see `data-handling-ai-review.md`) rated this category LOW risk. The AI identified that data is primarily stored in the local filesystem and S3.

    ### Where You Add the Most Value

    Focus on the *logic* of data access, particularly in multi-user scenarios (Classrooms):

    1. **Verify Teacher-Student Data Isolation.** Can a teacher see data from a class they don't own? Can a student see another student's data?
    2. **Check Analytics Privacy.** The analytics engine aggregates student data. Does it respect user consent (if implemented)?
    3. **Inspect PII Handling.** Where are emails and names stored? Are they logged?

    ### Practical Test Steps

    ```bash
    1. Review src/app/api/analytics/run/route.ts for authorization checks
    2. Check src/config/user-storage.ts for PII storage
    3. Grep for logging of email addresses
    ```

    ### V1 PoC Focus

    **Context:** This is a proof-of-concept release for trusted users in a controlled environment.

    #### PoC Acceptable (Validate or Dispute)

    | Finding | AI Assessment | Notes |
    |---------|---------------|-------|
    | Filesystem Storage | PoC Acceptable | Verify isolation between users |
    | In-memory Job Tracking | PoC Acceptable | Check behavior on server restart |
    | PII Logging (Audit) | PoC Acceptable | Review what PII is logged and where |

---

## Findings

### AI Finding Validation

**Filesystem Storage:**
- [x] Agree: PoC Acceptable
- [ ] Dispute: Should be blocker - Reason: _________________

### Additional Findings

**DATA-1 (Teacher Access Control):**
`src/app/api/analytics/run/route.ts` enforces that only the **author** of an experience can run analytics on it.
*Observation:* This effectively limits data access to the creator.
*Risk:* If a class is co-taught, the second teacher cannot see analytics.
*Assessment:* Acceptable for PoC.

**DATA-2 (PII in Logs):**
The `auditAnalytics` and other audit loggers explicitly record user email addresses.
*Observation:* This is intentional for the research context (accountability).
*Risk:* Logs must be treated as confidential data.
*Recommendation:* Ensure log aggregation systems are secure.

**DATA-3 (Upload Security - Strong):**
Reviewed `/home/chris/dev/wharton/primer/src/app/api/upload/route.ts`. The upload implementation has multiple defense layers:
- Rate limiting: 10 uploads/hour per client
- Size limits: 25MB compressed, 500MB decompressed
- Path traversal protection via `sanitizeZipEntryPath()` - thorough implementation
- ZIP bomb protection with decompressed size tracking
- SSRF protection via `validateUrl()` for remote URLs
- Cleanup on failure removes partial uploads
*Assessment:* Solid implementation. Test coverage exists in `__tests__/sanitization.test.ts` with 400+ lines covering attack scenarios.

**DATA-4 (SSRF Protection - Good):**
Reviewed `/home/chris/dev/wharton/primer/src/app/lib/security/url-validation.ts`. Blocks:
- Localhost variants (127.0.0.1, ::1, 0.0.0.0)
- AWS metadata endpoint (169.254.169.254)
- RFC 1918 private ranges (10.x, 172.16-31.x, 192.168.x)
- Link-local addresses
- IPv6 private ranges
*Observation:* Good coverage of common SSRF targets.
*Minor gap:* DNS rebinding attacks not addressed. Attacker could set up a domain that initially resolves to public IP, then changes to internal IP. Not a blocker for PoC.

**DATA-5 (Storage Service Path Validation):**
Reviewed `/home/chris/dev/wharton/primer/src/app/lib/storage/LocalStorageService.ts`. The `getFullPath()` method includes path traversal protection that verifies resolved paths stay within `baseDir`.
*Assessment:* Defense in depth - good to have both at ZIP extraction and storage layer.

**DATA-6 (Audit Logging - IP and User Agent):**
Reviewed `/home/chris/dev/wharton/primer/src/lib/audit-logger.ts`. Logs capture:
- User email (userId)
- Client IP address (from x-forwarded-for or x-real-ip headers)
- User agent string
- Event-specific details
*Observation:* Standard audit logging. IP addresses are PII in some jurisdictions (GDPR).
*Assessment:* Acceptable for PoC in US research context.

**DATA-7 (User Storage - No Sensitive Data):**
Reviewed `/home/chris/dev/wharton/primer/src/config/user-storage.ts`. File stores:
- Email addresses (as keys)
- Role assignments
- Creation/modification timestamps
No passwords or tokens stored (OAuth-only auth). File is unencrypted but no secrets present.
*Assessment:* PoC Acceptable. Production should restrict file permissions.

---

## PoC Readiness Assessment

- [ ] Any PoC blockers discovered?
- [x] Acceptable for controlled deployment?

---

## Sign-off

- **Reviewer:** Chris (Technical Auditor)
- **Date:** 2026-02-03
- **Time Spent:** 2.5 hrs
