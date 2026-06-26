# V1 PoC Release Checklist

A simplified checklist for the Primer V1 proof-of-concept code release. For full details, see the individual category reports.

> **Context:** This is distributable PoC code intended for technical audiences to deploy themselves. Security configuration is the deployer's responsibility.

---

## Pre-Release Requirements

### Secrets & Credentials
- [x] **No secrets in git history** — Gitleaks scan passed
- [x] **No hardcoded credentials in source** — Source scan passed
- [x] **.env files gitignored** — Verified

### Dependencies
- [x] **No critical CVEs** — npm audit shows only moderate (lodash-es via mermaid)
- [x] **License compatibility verified** — MIT-compatible for open source release

### Documentation
- [ ] **Document open registration default** — Add prominent warning in setup instructions
- [ ] **Document WebSocket security model** — Explain session binding and post-PoC hardening
- [ ] **Include deployment checklist** — API billing alerts, user configuration steps

---

## PoC Acceptable (Document for Deployers)

These items were evaluated and deemed acceptable for PoC code distribution:

| Item | Notes |
|------|-------|
| Open registration (AUTH-1) | Deployer responsibility; document configuration steps |
| Unauthenticated sockets (WS-1) | No useful action without valid session; UUIDs unguessable |
| Client-provided session IDs (WS-2) | UUIDs (122-bit entropy); no cross-user leakage vectors |
| No rate limiting on sockets | Document: set billing alerts on API provider dashboards |
| In-memory session store | Restart if memory issues; acceptable for PoC scale |
| `unsafe-eval` in CSP | Required by mermaid.js; document limitation |
| Fail-open authorization | Sensitive routes check permissions (verified) |

---

## Recommended for V1 (Not Blocking)

Nice-to-have improvements that strengthen the PoC:

- [ ] Add CSP violation reporting (`report-uri`)
- [ ] Remove console.log statements from production code
- [ ] Add session TTL to WebSocket sessions
- [ ] Verify `X-Powered-By` header is disabled

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Security Reviewer (AI) | Claude | 2026-01-27 | Yes |
| Security Reviewer (Human) | Chris | 2026-02-04 | Yes |
| Project Lead | | | |

---

## Post-V1 Roadmap

For production readiness (V2+), address:

1. WebSocket authentication bound to NextAuth sessions
2. Budget-aware rate limiting for LLM API calls
3. Remove `unsafe-eval` via component pre-compilation
4. Centralized authorization layer (deny-by-default)
5. Redis-backed rate limiting for scale
6. Session hardening (TTL, limits, binding)
