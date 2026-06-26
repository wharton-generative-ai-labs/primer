# API Security - Human Review

---

??? info "AI Review Guidance :material-robot-outline:"
    The AI review (see `api-security-ai-review.md`) rated this category LOW-MEDIUM with no PoC blockers. The AI identified DNS rebinding as a theoretical SSRF bypass but could not test it against a running deployment.

    ### Where You Add the Most Value

    This review can be brief. Focus on things the AI could not test:

    1. **Test DNS rebinding bypass.** If deployed on cloud with metadata endpoint, attempt a rebinding attack. Use a domain you control or a test service like `rebind.it` to verify whether the SSRF protection can be bypassed.

    2. **Verify rate limiting effectiveness.** Send rapid requests to rate-limited endpoints. Confirm the limits are enforced and responses indicate throttling (429 status).

    3. **Check Zod schema bounds.** Send oversized payloads to key endpoints. Do they get rejected at the middleware level, or does validation happen after the full body is parsed into memory?

    4. **Inspect error responses.** Trigger various error conditions. Do any responses leak stack traces, file paths, or internal state?

    ### Practical Test Steps

    ```bash
    1. Identify cloud environment (AWS/GCP/Azure) and metadata endpoint
    2. If applicable, test DNS rebinding with a test domain
    3. Use curl or similar to rapid-fire requests and verify rate limiting
    4. Send large payloads (10MB+ JSON) to API endpoints
    5. Trigger 400/500 errors and inspect response bodies
    ```

    ### V1 PoC Focus

    **Context:** This is a proof-of-concept release for trusted users (researchers, educators, students) in a controlled environment. Focus your review on PoC blockers rather than production-scale concerns.

    #### PoC Blockers

    **None identified by AI review.**

    #### PoC Acceptable (Validate or Dispute)

    | Finding               | AI Assessment  | Notes                                         |
    | --------------------- | -------------- | --------------------------------------------- |
    | DNS rebinding in SSRF | PoC Acceptable | Test rebinding if deployed on cloud           |
    | Zod schema strictness | PoC Acceptable | Send oversized payloads to check bounds       |
    | Proxy timing attacks  | PoC Acceptable | Low priority - verify if timing leaks exist   |

    ### Focused Review Areas

    Since no blockers were identified, the human review can be brief:

    1. **Validate AI assessment** - Confirm no blockers for PoC release
    2. **Test error responses** - Verify no sensitive data leakage
    3. **Identify any missed blockers** - Are there issues the AI didn't catch?

---

## Findings

### AI Finding Validation

**DNS Rebinding:**

- [x] Agree: PoC Acceptable

not on cloud with metadata

**Rate Limiting:**

- [x] Verified working

### Additional Findings

<!-- Only document NEW findings not covered by AI review -->

**API-1 (Deny-List SSRF Protection):**
The `validateUrl` function in `src/app/lib/security/url-validation.ts` uses a deny-list for IP ranges (e.g., `^10\.`). This is inherently fragile and vulnerable to bypasses (e.g., IPv6 mapped IPv4, rare formats, or DNS rebinding).

_Recommendation:_
Nothing to fix for V1.
For V2, switch to an allow-list of permitted domains or use a dedicated request library that supports safe server-side fetching (preventing internal network access).

**API-2 (Path Traversal in Tool Context - Low):**
The `createFile` and `getResourceContent` functions in `src/app/api/backend-agent/utils/context.ts` use `path.join()` but don't validate against path traversal. A malicious path like `../../etc/passwd` passed through these functions could escape the experience folder.

```typescript
// context.ts:492 - no validation after path.join
const fullPath = await import('path').then(p => p.join(experienceFolder, path));
```

However, these functions are only called by backend agent tools (not direct user input), so exploitation requires compromising the AI agent's tool calls.

_Severity:_ Low (indirect access vector)
_Recommendation:_ Add path validation similar to storage API - check that resolved path starts with intended directory.

**API-3 (Console.log Still Present):**
Confirmed AI finding - one console.log statement remains in production code:

```text
src/app/api/backend-agent/managers/ToolRegistrationManager.ts:94
console.log('[BACKEND-AGENT] Image-related tools available to agent:', ...)
```

_Recommendation:_ Replace with structured logger before production.

**API-4 (Error Handling Reviewed - Good):**
Tested error responses across multiple endpoints. Confirmed:
- Stack traces only exposed in development mode (`env.NODE_ENV === 'development'`)
- Generic error messages in production
- No file paths or internal state leaked in 500 responses

Example from upload/route.ts:
```typescript
const isDevelopment = env.NODE_ENV === 'development';
return NextResponse.json({
  error: error instanceof Error ? error.message : 'Unknown error',
  ...(isDevelopment && error instanceof Error && { details: error.stack })
}, { status: 500 });
```

**API-5 (Admin Endpoint Authorization - Good):**
Reviewed `/api/admin/users/route.ts`. Solid authorization:
- Session check before any operation
- Permission check (`ADMIN_USERS`) before data access
- Audit logging for all authorization failures
- Rate limiting applied
- Cannot modify env-defined users (read-only protection)

---

## PoC Readiness Assessment

- [ ] Any PoC blockers discovered?
- [x] Acceptable for controlled deployment?

---

## Sign-off

- **Reviewer:** Chris (Technical Auditor)
- **Date:** 2026-02-03
- **Time Spent:** 2.5 hrs
- **Update Notes:** Added findings API-2 through API-5 based on deeper code review
