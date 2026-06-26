# Deployment Context & Risk Framework

This document establishes the security context for Primer's V1 proof-of-concept release and provides a framework for interpreting audit findings.

## V1 Release Goals

Per the Statement of Work, the V1 release aims to deliver:

- A **functional foundation** that technical audiences can readily expand upon
- An **open-source proof-of-concept** for AI-architected pedagogical experiences
- A platform where **community contributors will drive ongoing development**

This is NOT a production-grade enterprise deployment. Security requirements should be calibrated accordingly.

## Deployment Assumptions

### V1 PoC Environment

| Aspect | Assumption |
|--------|------------|
| **User Base** | Limited, known users (researchers, educators, students) |
| **Access Control** | Invitation-based or institutional authentication |
| **Infrastructure** | University-managed or controlled cloud environment |
| **Data Sensitivity** | Educational content; no financial/health PII |
| **Monitoring** | Manual oversight of usage and costs |
| **Scale** | Tens to hundreds of concurrent users, not thousands |

### Trust Model

- Users are generally trusted (not adversarial)
- Administrators can monitor and intervene manually
- API costs can be tracked and capped externally (provider dashboards)
- Abuse would be noticed and addressed through non-technical means

## Finding Classification Scheme

Audit findings are classified by their relevance to PoC vs production deployment:

### PoC Blocker

Issues that **must be fixed** before any public release, even a PoC:

- Credentials or secrets exposed in code/history
- Complete authentication bypass
- Trivial remote code execution
- Data exposure to unauthenticated users

### PoC Acceptable

Issues that are **documented risks** acceptable for a controlled PoC:

- Advanced attack vectors requiring significant skill/resources
- DoS risks mitigable through manual monitoring
- Missing hardening that matters at scale
- Defense-in-depth gaps with compensating controls

These should be addressed before scaling to production.

### Production Required

Issues that **don't affect PoC** but must be addressed before:

- Public internet deployment without access controls
- Handling sensitive PII or financial data
- High-scale deployment (thousands of users)
- Compliance requirements (SOC2, HIPAA, etc.)

## Risk Tolerance Matrix

| Risk Category | PoC Tolerance | Production Tolerance |
|---------------|---------------|----------------------|
| Authentication bypass | None | None |
| Authorization gaps | Low (known users) | None |
| DoS via resource exhaustion | Medium (monitor manually) | None |
| Financial DoS (API costs) | Medium (monitor dashboards) | None |
| Session security | Medium (trusted users) | Low |
| XSS/injection | Low (but trusted users) | None |
| Information disclosure | Medium | Low |
| Missing rate limiting | High (low user count) | None |
| Advanced attacks (DNS rebinding) | High (unlikely target) | Low |

## Applying This Framework

When reading audit reports:

1. **Check the finding severity** - Critical/High/Medium/Low
2. **Check the PoC classification** - Blocker/Acceptable/Production Required
3. **Consider your deployment** - Does it match PoC assumptions?

If deploying in a more exposed environment than assumed, treat "PoC Acceptable" findings as higher priority.

## Progression Path

```text
V1 PoC Release          V2 Production Release
─────────────────────────────────────────────────►

Fix PoC Blockers        Fix PoC Acceptable items
│                       │
├─ Secrets scan         ├─ WebSocket authentication
├─ Open registration    ├─ Rate limiting
└─ Critical vulns       ├─ Session hardening
                        ├─ Remove unsafe-eval
                        └─ Scale infrastructure
```

## Questions to Ask

Before deploying, confirm:

1. Is the user base limited and known?
2. Is there manual oversight of usage/costs?
3. Is the infrastructure access-controlled?
4. Are users generally trusted (not adversarial)?
5. Is there a process to handle abuse reports?

If "no" to any of these, re-evaluate which "PoC Acceptable" items need immediate attention.
