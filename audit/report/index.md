---
icon: material/shield-check
---

# Primer Code Audit

**Project:** Primer - Interactive AI Experience Runtime Platform
**Client:** Wharton School, University of Pennsylvania
**Auditor:** Lincoln Loop
**Date:** January 2026

---

## Executive Summary

This security audit was conducted to assess Primer's readiness for open-source release as a V1 proof-of-concept. The audit serves a dual purpose: ensuring the platform meets baseline security requirements for public release, and generating research data for Wharton's study comparing AI and human security review capabilities.

Primer is an interactive AI experience runtime platform built on Next.js, enabling educators and researchers to create AI-powered pedagogical experiences. The V1 release targets a controlled environment of trusted users—researchers, educators, and students—operating within university-managed infrastructure.

### Overall Assessment

**The codebase is suitable for V1 PoC release.**

The audit identified 21 findings across 11 security categories. No critical vulnerabilities were discovered. After human review and adversarial analysis, no findings were classified as release blockers. Three findings initially flagged as high-severity by AI review were downgraded based on practical exploitability assessment:

| Severity | Count | Action Required |
|----------|-------|-----------------|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 12 | Document as accepted risk or post-PoC |
| Low | 9 | Address in V2 |

### Key Findings (Downgraded)

Three findings initially flagged as blockers were re-evaluated:

1. **WebSocket Authentication Gap (WS-1)** — Unauthenticated socket connections are possible, but without a valid session ID, clients cannot trigger LLM calls or receive other users' events. Session IDs are UUIDs (122-bit entropy) with no cross-user leakage. Risk is theoretical; practical exploitation requires chaining with WS-2, which was also deemed acceptable.

2. **Session ID Trust (WS-2)** — Clients can provide session IDs, but brute-forcing UUIDs is computationally infeasible, and session IDs aren't exposed cross-user. The "session probing" attack requires knowing a valid session ID, which isn't discoverable through normal app usage.

3. **Open Registration (AUTH-1)** — This is distributable PoC code, not a managed deployment. Deployers already must configure OAuth credentials and API keys; adding "configure allowed users" is a documentation requirement, not a code defect. No-role users can authenticate but cannot access sensitive routes (verified via spot-check).

### Security Strengths

The codebase demonstrates mature security practices in several areas:

- **Input Validation** — Comprehensive Zod schemas validate API inputs throughout the application
- **SSRF Protection** — URL validation prevents server-side request forgery attacks
- **Path Traversal Prevention** — Multiple defensive layers protect against directory traversal
- **Security Headers** — Proper CSP, HSTS, and other security headers are configured
- **Environment Validation** — Runtime checks ensure required configuration is present
- **ZIP Bomb Protection** — File upload handling includes archive decompression limits

### Recommendations

For V1 PoC release (documentation):

1. Document open registration in setup instructions with clear warning
2. Document WebSocket security model and post-PoC hardening steps
3. Include deployment security checklist (billing alerts, user configuration)

For V2 production release:

- Add WebSocket authentication middleware (`io.use()`)
- Implement user allowlist enforcement at signIn callback
- Add rate limiting across all API endpoints
- Remove `unsafe-eval` from CSP (requires mermaid configuration changes)
- Bind sessions to authenticated user identity

---

## Audit Scope

The audit examined 11 categories across the full application stack:

- **Backend Security** — Authentication, API security, WebSockets, adapters, configuration, data handling
- **Frontend Security** — XSS prevention, client-side state, CSP effectiveness
- **Dependencies** — Vulnerability scanning, license compliance
- **Code Quality** — Backend and frontend patterns, maintainability

See [Methodology](methodology/index.md) for the complete audit approach and [Scope](methodology/scope.md) for detailed coverage.

---

## About This Audit

This audit was conducted using a novel dual-review methodology. Each security category was first reviewed by an AI system (Claude) to identify potential security issues. A human security expert then reviewed the same categories with access to the AI findings, validating AI-identified issues through manual testing and identifying additional concerns the AI missed. The results were then synthesized to compare detection capabilities, severity assessments, and false positive rates.

This approach supports Wharton's research into AI-assisted security review while ensuring comprehensive coverage through complementary human and AI perspectives. The sequential methodology allows measurement of both AI capabilities (what can AI detect independently?) and human value-add (what additional risks does human analysis uncover?).

---

## Navigation

- [Methodology](methodology/index.md) — Audit approach, process, and finding classification
- [Findings](findings/index.md) — Detailed findings organized by category
- [Remediation](remediation.md) — Prioritized fixes and implementation guidance
- [AI vs Human Analysis](ai-vs-human-analysis.md) — Research findings comparing reviewer performance
- [Appendices](appendices/index.md) — Raw AI/human reviews and automated scan outputs
