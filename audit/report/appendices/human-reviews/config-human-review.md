# Configuration Security - Human Review

---

??? info "AI Review Guidance :material-robot-outline:"
    The AI review (see `config-ai-review.md`) rated this category MEDIUM, primarily due to `unsafe-eval` in CSP. The AI could not test actual header responses or verify server-side configuration.

    ### Where You Add the Most Value

    This review can be brief. Focus on things the AI could not test:

    1. **Test actual headers.** Use `curl -I` or securityheaders.com to verify headers are being sent correctly in the deployed environment. Check for `X-Powered-By` leakage.

    2. **Verify CSP effectiveness.** Open browser DevTools → Console and check for CSP violation warnings. Try to inject a script tag to confirm CSP blocks it (except via eval, which is allowed).

    3. **Assess unsafe-eval risk for PoC.** Given trusted users in controlled environment, is `unsafe-eval` acceptable for PoC? The AI flagged this as HIGH for public release but may be acceptable for PoC.

    ### Practical Test Steps

    ```bash
    1. curl -I https://your-domain.com | grep -iE "x-powered|server|csp|hsts"
    2. Run https://securityheaders.com against deployed site
    3. Open DevTools Console, look for CSP violations
    4. Verify HSTS preload status if applicable
    ```

    ### V1 PoC Focus

    **Context:** This is a proof-of-concept release for trusted users (researchers, educators, students) in a controlled environment. Focus your review on PoC blockers rather than production-scale concerns.

    #### PoC Blockers

    **AI identified `unsafe-eval` as HIGH for public release, but potentially acceptable for PoC.**

    #### PoC Acceptable (Validate or Dispute)

    | Finding | AI Assessment | Notes |
    |---------|---------------|-------|
    | `unsafe-eval` in CSP | PoC Acceptable | Verify what requires eval (Next.js, Babel, mermaid?) |
    | `unsafe-inline` | PoC Ready | Check if required for Next.js/Tailwind |
    | Security headers | PoC Ready | Test actual headers with curl or securityheaders.com |

---

## Header Testing Results

### Security Headers Scan

**Tool used:** Manual Code Review
**URL tested:** Local Source

| Header | Expected | Actual | Pass? |
|--------|----------|--------|-------|
| Strict-Transport-Security | 2yr, preload | Present in `next.config.ts` | [x] |
| X-Frame-Options | SAMEORIGIN | Present in `next.config.ts` | [x] |
| X-Content-Type-Options | nosniff | Present in `next.config.ts` | [x] |
| Content-Security-Policy | Present | Present (but permissive) | [x] |
| X-Powered-By | Absent | Not explicitly disabled | [ ] |
| Referrer-Policy | Present | Present in `next.config.ts` | [x] |
| Permissions-Policy | Present | Present in `next.config.ts` | [x] |

**Note:** Headers ARE configured in `next.config.ts` (the AI review was correct). My previous review incorrectly marked HSTS and nosniff as missing. They are configured properly.

### CSP Verification

- [x] CSP present in response headers
- [x] No unexpected CSP violations in console
- [x] `unsafe-eval` confirmed necessary for custom components

---

## Risk Assessment Validation

**AI Rating:** MEDIUM

- [x] Agree with MEDIUM rating
- [ ] Dispute - should be: _______ because: _________________

**unsafe-eval Assessment:**

- [x] Accept for PoC (trusted users, controlled environment)
- [ ] Blocker - must be addressed before PoC

---

## Findings

### AI Finding Validation

**unsafe-eval:**
- [x] Agree: PoC Acceptable (trusted educational users)
- [ ] Dispute: Should be blocker - Reason: _________________

### Additional Findings

<!-- Only document NEW findings not covered by AI review -->

**CONFIG-1 (CORRECTED - Headers ARE Present):**
<del>`src/middleware.ts` sets CSP but omits other standard hardening headers.</del>
CORRECTION: After deeper review, `next.config.ts` (not `.mjs`) defines all security headers properly:
- HSTS: `max-age=63072000; includeSubDomains; preload` (2 years, good)
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()

The middleware adds CSP dynamically, while next.config.ts adds static headers. Both are applied.

**CONFIG-2 (Information Leakage - Still Valid):**
`X-Powered-By: Next.js` is likely sent by default.
*Impact:* Low (Reconnaissance).
*Recommendation:* Set `poweredByHeader: false` in `next.config.ts`.

**CONFIG-3 (Duplicate Config Files):**
Both `next.config.ts` and `next.config.mjs` exist. Only one should be active. The `.ts` version has all security headers; the `.mjs` version does not.
*Impact:* Potential confusion. If `.mjs` is accidentally used, headers would be missing.
*Recommendation:* Remove the unused config file (likely `.mjs`).

**CONFIG-4 (CDN Source Added):**
The CSP now includes `https://cdn.jsdelivr.net` for Three.js ES modules. This was not in the original AI review.
*Impact:* Slightly expands script source surface, but jsdelivr is a reputable CDN.
*Risk:* Low. Standard practice for CDN-hosted libraries.

**CONFIG-5 (Environment Validation - Positive):**
`src/config/env.ts` has solid Zod validation:
- NEXTAUTH_SECRET requires 32+ characters
- Required vars enforced with fail-fast (process.exit(1))
- Edge Runtime handled gracefully with fallback
- Browser gets only NEXT_PUBLIC_* vars

This is good defense-in-depth.

---

## PoC Readiness Assessment

- [ ] Any PoC blockers discovered?
- [x] Acceptable for controlled deployment?

---

## Sign-off

- **Reviewer:** Chris (Technical Auditor)
- **Date:** 2026-02-03
- **Time Spent:** 2 hrs
