# Methodology

This audit combines automated scanning with independent AI and human code review across 11 categories.

## Approach

For critical paths (authentication, WebSockets, adapters), both AI and human reviewers conduct **blind independent reviews**, followed by a synthesized analysis comparing findings.

This dual-review approach supports Wharton's research comparing AI and human security review capabilities.

## Process

```text
Automated Scans ─► AI Review ─► Human Review ─► Synthesis ─► Final Report
(tools)           (Claude)      (expert)        (cross-ref)  (deliverables)
```

1. **Automated Scans** - Gitleaks (secrets), npm audit (vulnerabilities), license-checker
2. **AI Review** - Claude conducts systematic code review per category
3. **Human Review** - Security expert reviews independently (blind to AI findings)
4. **Synthesis** - Cross-reference findings, identify gaps, reconcile severity ratings
5. **Final Report** - Consolidated findings with remediation priorities

## Finding Classification

Each finding receives two ratings:

### Severity (Technical Risk)

| Severity | Criteria |
|----------|----------|
| **Critical** | RCE, auth bypass, data breach possible with no/low skill |
| **High** | Significant impact, exploitation requires moderate skill |
| **Medium** | Moderate impact, requires specific conditions |
| **Low** | Minor impact or difficult to exploit |
| **Informational** | Best practice, defense in depth |

### PoC Classification (Release Relevance)

| Classification | Meaning |
|----------------|---------|
| **PoC Blocker** | Must fix before any release |
| **PoC Acceptable** | Documented risk, acceptable for controlled PoC |
| **Production Required** | Not needed for PoC, required before scaling |

See [Deployment Context](deployment-context.md) for the full risk framework.

## Human Review Focus

Human reviews are scoped to PoC relevance:

- Validate AI-identified blockers
- Spot-check acceptable items
- Identify anything the AI missed

Full production-grade reviews are deferred to V2 planning.
