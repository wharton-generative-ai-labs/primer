# 06. Configuration Security

## Overview

This section examines security headers, Content Security Policy (CSP), and environment variable configuration. Proper configuration prevents common attack vectors including XSS amplification, clickjacking, information leakage, and runtime misconfigurations.

Primer implements security headers in two locations: static headers in `next.config.ts` and dynamic CSP generation in middleware. The application uses Zod for environment variable validation with fail-fast behavior.

| Component | Technology | Purpose |
|-----------|------------|---------|
| Security Headers | next.config.ts | HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Content Security Policy | src/lib/csp.ts, src/middleware.ts | Dynamic CSP generation with nonce support |
| Environment Validation | src/config/env.ts | Zod schema validation with fail-fast |

---

## Executive Summary

| Assessment | Result |
|------------|--------|
| **Overall Status** | :material-alert: **MEDIUM RISK** |
| **Risk Level** | Medium |
| **PoC Blocker** | No (with conditions) |
| **Action Required** | Documentation + minor code changes |

**Review approach:** AI performed static code analysis of configuration files and CSP directives. Human validated header presence, tested CSP behavior in browser, and assessed PoC acceptability of `unsafe-eval`.

**Key findings:** CSP includes `unsafe-eval` to support Babel runtime compilation for custom components, which weakens XSS protections. However, both reviewers agree this is acceptable for PoC with trusted users. `X-Powered-By` header is not explicitly disabled. A duplicate config file (`next.config.mjs`) exists alongside the active `next.config.ts`.

**Bottom Line:** Configuration is well-implemented for a PoC; `unsafe-eval` risk is accepted for trusted user deployment, with documentation required.

---

## Finding Synthesis Matrix

**Synthesis Date:** 2026-02-04

| ID | Finding | AI | Human | Final Severity | PoC Status |
|----|---------|:--:|:-----:|----------------|------------|
| CFG-1 | `unsafe-eval` in CSP | HIGH | Agreed (PoC Acceptable) | **Medium** | Acceptable with documentation |
| CFG-2 | `unsafe-inline` for scripts/styles | LOW | Agreed | **Low** | Acceptable |
| CFG-3 | X-Powered-By header not disabled | LOW | Agreed | **Low** | Recommended fix |
| CFG-4 | Server version headers unverified | LOW | Not separately flagged | **Low** | Documentation |
| CFG-5 | Duplicate config files | NEW | Human-only | **Low** | Recommended fix |
| CFG-6 | CDN source (jsdelivr) added | NEW | Human-only | **Informational** | Acceptable |

---

### CFG-1: `unsafe-eval` in Content Security Policy

**AI Assessment:** HIGH — `unsafe-eval` negates CSP XSS protection; any XSS becomes complete compromise
**Human Assessment:** Agreed on technical risk, but PoC Acceptable for trusted users in controlled environment

| Aspect | Analysis |
|--------|----------|
| **The Issue** | CSP includes `'unsafe-eval'` directive, allowing `eval()`, `Function()`, and similar dynamic code execution |
| **Location** | `next.config.ts:48`, `src/lib/csp.ts:60-63` |
| **Evidence** | `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com` |
| **Impact** | XSS vulnerabilities become fully exploitable; attacker can execute arbitrary JavaScript |

**Why ratings differ:** The AI assessed this as HIGH for a public release where untrusted users could exploit XSS. The human correctly contextualized for PoC deployment: trusted educational users (researchers, students) in a controlled environment significantly reduce the likelihood of malicious exploitation.

**Resolution:** Accept for PoC with documentation. For production release, implement pre-compilation to remove `unsafe-eval` requirement.

---

### CFG-3: X-Powered-By Header Not Disabled

**AI Assessment:** LOW — Reconnaissance aid for attackers
**Human Assessment:** Agreed — X-Powered-By likely sent by default

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Next.js sends `X-Powered-By: Next.js` by default, revealing framework |
| **Location** | `next.config.ts` (missing `poweredByHeader: false`) |
| **Evidence** | Config option not present in next.config.ts |
| **Impact** | Information disclosure aids targeted attacks against known Next.js vulnerabilities |

**Resolution:** Add `poweredByHeader: false` to `next.config.ts`. Low effort fix.

---

### CFG-5: Duplicate Configuration Files

**AI Assessment:** Not identified
**Human Assessment:** LOW — Potential confusion and security regression risk

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Both `next.config.ts` and `next.config.mjs` exist; only `.ts` has security headers |
| **Location** | Project root |
| **Evidence** | `.ts` version has full security headers; `.mjs` version does not |
| **Impact** | If `.mjs` is accidentally loaded (e.g., build config change), all security headers would be missing |

**Resolution:** Remove the unused `next.config.mjs` file.

---

## Positive Security Controls

| Control | Status | Notes |
|---------|--------|-------|
| HSTS Configuration | :material-check-circle: | 2-year max-age with includeSubDomains and preload |
| X-Frame-Options | :material-check-circle: | SAMEORIGIN prevents clickjacking |
| X-Content-Type-Options | :material-check-circle: | nosniff prevents MIME confusion attacks |
| Referrer-Policy | :material-check-circle: | strict-origin-when-cross-origin (privacy-preserving) |
| Permissions-Policy | :material-check-circle: | Camera, microphone, geolocation disabled |
| Frame-ancestors CSP | :material-check-circle: | `'none'` — defense in depth with X-Frame-Options |
| Object-src CSP | :material-check-circle: | `'none'` — blocks plugin-based attacks |
| Environment Validation | :material-check-circle: | Zod schemas with fail-fast (process.exit(1)) |
| NEXTAUTH_SECRET | :material-check-circle: | Requires minimum 32 characters |
| Browser Variable Isolation | :material-check-circle: | Only NEXT_PUBLIC_* exposed to client |

---

## Research Insights: AI vs Human Performance

### Detection Comparison

| Category | AI | Human | Notes |
|----------|:--:|:-----:|-------|
| Issues identified | 4 | 4 (2 new) | AI found core issues; human found deployment-specific gaps |
| Concrete evidence | Partial | Yes | Human verified headers actually work in browser |
| False positives | 0 | 0 | Both accurate |

### AI Strengths
- Comprehensive CSP directive analysis with clear tables
- Systematic coverage of all standard security headers
- Detailed explanation of `unsafe-eval` risks and why "documented mitigations" don't address XSS
- Strong environment validation analysis

### AI Limitations
- Could not test actual HTTP responses to verify headers are served
- Could not verify CSP violations in browser DevTools
- Did not identify duplicate config file issue
- Could not assess real-world exploitability in PoC context

### Human Strengths
- Verified headers are actually served correctly
- Tested CSP in browser DevTools for violations
- Contextualized `unsafe-eval` risk for PoC deployment scenario
- Identified duplicate config file risk
- Noted CDN addition (jsdelivr) not in original AI review

### Human Limitations
- Did not perform live deployment testing (reviewed source only)
- Acknowledged re-review was needed after initial incorrect assessment of header presence

---

## Consolidated Recommendations

### For PoC Release

| Priority | Action | Owner |
|----------|--------|-------|
| **Required** | Document `unsafe-eval` as known limitation for trusted user deployment | Docs |
| **Recommended** | Set `poweredByHeader: false` in next.config.ts | Dev |
| **Recommended** | Remove unused `next.config.mjs` file | Dev |

### For Production Release

| Priority | Action | Effort |
|----------|--------|--------|
| **P1** | Remove `unsafe-eval` via pre-compilation for custom components | High |
| **P2** | Add CSP `report-uri` for violation monitoring | Low |
| **P3** | Consider nonce-based script loading | Medium |

---

## PoC Readiness

- [x] Security headers properly configured
- [x] HSTS with strong settings (2 years, preload)
- [x] Environment validation enforced
- [x] CSP present and functional
- [x] `unsafe-eval` risk accepted for trusted users
- [ ] Document `unsafe-eval` limitation
- [ ] Disable X-Powered-By header
- [ ] Remove duplicate config file

---

## Detailed Reviews

- [AI Review](../appendices/ai-reviews/config-ai-review.md)
- [Human Review](../appendices/human-reviews/config-human-review.md)
