# Configuration Security - AI Review

- **Review Date:** 2026-01-27
- **Reviewer:** Claude (AI)
- [x] **Status:** Complete

---

## Scope

### Files Reviewed

| File                | Purpose                  |
| ------------------- | ------------------------ |
| `next.config.ts`    | Next.js security headers |
| `src/lib/csp.ts`    | CSP generation utility   |
| `src/middleware.ts` | Runtime CSP application  |
| `src/config/env.ts` | Environment validation   |

---

## Security Headers Analysis

### Headers Configured in next.config.ts

| Header                      | Value                                          | Assessment                  |
| --------------------------- | ---------------------------------------------- | --------------------------- |
| `Content-Security-Policy`   | See CSP analysis below                         | :material-check-circle: Comprehensive            |
| `X-DNS-Prefetch-Control`    | `on`                                           | :material-check-circle: Performance optimization |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | :material-check-circle: Strong HSTS (2 years)    |
| `X-Frame-Options`           | `SAMEORIGIN`                                   | :material-check-circle: Clickjacking protection  |
| `X-Content-Type-Options`    | `nosniff`                                      | :material-check-circle: MIME sniffing protection |
| `X-XSS-Protection`          | `1; mode=block`                                | :material-check-circle: Legacy XSS protection    |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | :material-check-circle: Privacy-preserving       |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     | :material-check-circle: Feature restrictions     |

**Overall Assessment:** Excellent security header configuration.

---

## Content Security Policy Analysis

### CSP Directives

| Directive         | Value                                                               | Assessment                     |
| ----------------- | ------------------------------------------------------------------- | ------------------------------ |
| `default-src`     | `'self'`                                                            | :material-check-circle: Secure default              |
| `script-src`      | `'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com` | :material-alert: See note below              |
| `script-src-elem` | `'self' 'unsafe-inline' https://cdnjs.cloudflare.com`               | :material-alert: See note below              |
| `style-src`       | `'self' 'unsafe-inline' https://gail.wharton.upenn.edu`             | :material-alert: unsafe-inline for Tailwind  |
| `style-src-attr`  | `'unsafe-inline'`                                                   | :material-alert: Required for Three.js       |
| `font-src`        | `'self' data: https://gail.wharton.upenn.edu`                       | :material-check-circle: Limited sources             |
| `img-src`         | `'self' data: blob:`                                                | :material-check-circle: No external images          |
| `connect-src`     | `'self' https://api.openai.com [dynamic]`                           | :material-check-circle: Limited connections         |
| `media-src`       | `'self'`                                                            | :material-check-circle: Self only                   |
| `object-src`      | `'none'`                                                            | :material-check-circle: Blocks plugins              |
| `base-uri`        | `'self'`                                                            | :material-check-circle: Base tag restricted         |
| `form-action`     | `'self'`                                                            | :material-check-circle: Form submissions restricted |
| `frame-ancestors` | `'none'`                                                            | :material-check-circle: No framing allowed          |
| `frame-src`       | `'none'`                                                            | :material-check-circle: No iframes                  |
| `worker-src`      | `'self' blob: data:`                                                | :material-check-circle: Worker restrictions         |
| `manifest-src`    | `'self'`                                                            | :material-check-circle: PWA manifest restricted     |

### CSP Notes

**`unsafe-eval` Usage:**

The CSP includes `'unsafe-eval'` which is documented as required for:

1. Babel standalone (custom component JSX compilation)
2. Next.js HMR in development

**Mitigation stated in code:**

```typescript
// Note: unsafe-eval for custom components is mitigated by:
// - Components only loaded from trusted storage
// - Babel runs in isolated scope with blocked APIs (fetch, localStorage, etc.)
// - Components cannot access dangerous globals
```

**Risk Assessment:** MEDIUM - `unsafe-eval` is a security weakening, but mitigations are documented. This is a trade-off for feature functionality.

---

### [HIGH] unsafe-eval in CSP - XSS Amplification Risk

**Location:** `next.config.ts:48`, `src/lib/csp.ts:60-63`

**Description:** The CSP includes `'unsafe-eval'` to support Babel for custom component compilation. This effectively negates CSP's protection against XSS exploitation.

**Impact:**

1. Allows `eval()`, `Function()`, and similar dynamic code execution
2. **Any XSS vulnerability becomes a complete compromise** - attacker can execute arbitrary code
3. CSP's primary protection (blocking inline script execution) is bypassed
4. Combined with frontend review gaps, this is a critical risk for public release

**The "Documented Mitigation" Fallacy:**
The code comments state mitigations exist (isolated scope, blocked APIs). However:

- These mitigations protect _intentional_ custom component execution
- They do NOT protect against XSS-injected code which runs outside the Babel scope
- An attacker using `eval()` via XSS bypasses all these controls

**Mitigating Factors (Weak):**

1. Custom components loaded from trusted storage only - irrelevant to XSS
2. Babel runs in isolated scope - irrelevant to XSS
3. React's default escaping prevents most XSS - but not all (dangerouslySetInnerHTML)

**Recommendation:**

1. **Strongly consider pre-compilation** - Move Babel to build step, remove `unsafe-eval`
2. If runtime compilation is essential, explore alternatives:
   - `expr-eval` library for safe expression evaluation
   - Web Workers with restricted scope
   - Sandboxed iframes for component rendering
3. Until `unsafe-eval` is removed, conduct exhaustive XSS audit of frontend
4. Add CSP violation reporting (`report-uri`) to detect exploitation attempts

---

### [LOW] Server Version Headers Not Verified

**Location:** `next.config.ts`, server configuration

**Description:** The review did not verify whether `X-Powered-By` or `Server` headers are being sent, which can reveal exact Node.js/Next.js versions to attackers.

**Impact:**

- Attackers can identify exact framework versions
- Enables targeted exploitation of known CVEs
- Aids reconnaissance for automated scanners

**Recommendation:**

1. Verify `X-Powered-By` header is disabled (Next.js: `poweredByHeader: false`)
2. Check if reverse proxy adds `Server` header
3. Test with: `curl -I https://your-domain.com | grep -i "x-powered-by\|server"`

---

### [LOW] unsafe-inline for Scripts and Styles

**Location:** `next.config.ts:48-51`

**Description:** Both scripts and styles use `'unsafe-inline'`.

**For Scripts:**

- Required for Next.js inline hydration scripts
- Industry standard for Next.js applications

**For Styles:**

- Required for Tailwind CSS
- Required for dynamic styles (Three.js)

**Assessment:** These are necessary for the framework and libraries used. Not easily avoidable.

---

## Environment Configuration Security

### Validation

| Variable               | Validation             | Assessment |
| ---------------------- | ---------------------- | ---------- |
| `OPENAI_API_KEY`       | Required, min 1 char   | :material-check-circle:         |
| `GOOGLE_CLIENT_ID`     | Required, min 1 char   | :material-check-circle:         |
| `GOOGLE_CLIENT_SECRET` | Required, min 1 char   | :material-check-circle:         |
| `NEXTAUTH_SECRET`      | Required, min 32 chars | :material-check-circle: Strong  |
| `NEXTAUTH_URL`         | Optional, URL format   | :material-check-circle:         |
| `ANTHROPIC_API_KEY`    | Optional               | :material-check-circle:         |
| `GOOGLE_AI_API_KEY`    | Optional               | :material-check-circle:         |
| `ALLOWED_ORIGINS`      | Optional               | :material-check-circle:         |

**Assessment:** Strong environment validation with Zod schemas. Required secrets are enforced.

---

### [INFORMATIONAL] Fail-Fast on Missing Config

**Location:** `src/config/env.ts:124-138`

**Description:** The server exits with code 1 if required environment variables are missing.

**Evidence:**

```typescript
if (typeof process !== "undefined" && typeof process.exit === "function") {
  process.exit(1);
} else {
  throw new Error("Environment variable validation failed");
}
```

**Assessment:** This is a positive security practice - fail fast rather than running with invalid configuration.

---

## Positive Security Observations

1. **Strong HSTS** - 2-year max-age with preload
2. **Comprehensive CSP** - All major directives configured
3. **No external images** - img-src restricted to self/data/blob
4. **Frame blocking** - Both frame-ancestors and X-Frame-Options
5. **Feature policy** - Camera, microphone, geolocation disabled
6. **Environment validation** - Zod schemas with fail-fast

---

## Risk Assessment

### Overall Rating: MEDIUM

**Strengths:**

- Comprehensive security headers
- Strong HSTS configuration
- Environment validation

**Critical Concern:**

- **`unsafe-eval` negates CSP protection against XSS** - This is not adequately mitigated by "documented controls"
- The frontend security review is incomplete, meaning XSS vulnerabilities may exist
- Combined risk: XSS + `unsafe-eval` = complete compromise

**Other Concerns:**

- `unsafe-inline` required for framework (industry standard, acceptable)
- Server version headers not verified

---

## Recommendations

### Priority 1 (High - Blocks Public Release)

1. **Remove `unsafe-eval`** - Implement pre-compilation for custom components
2. If runtime compilation is essential, use sandboxed alternatives (Web Workers, iframes)
3. Complete frontend XSS audit before public release

### Priority 2 (Medium)

4. Add CSP `report-uri` for violation monitoring
5. Verify `X-Powered-By` header is disabled
6. Check server/proxy headers for version leakage

### Priority 3 (Low)

7. Consider nonce-based script loading if feasible
8. Document CSP trade-offs in security documentation

**Public Release Readiness:** CONDITIONAL - Remove `unsafe-eval` OR complete exhaustive XSS audit
