# 11. Dependencies

## Overview

This section examines npm package vulnerabilities and license compliance for Primer's dependency tree. Vulnerabilities in dependencies can introduce security flaws without any changes to application code, while incompatible licenses can create legal obligations or block open-source release.

Primer uses a standard Next.js/React stack with approximately 1,669 total dependencies (773 production, 839 development, 108 optional). Key dependencies include:

| Category | Key Packages | License |
|----------|--------------|---------|
| Framework | Next.js, React | MIT |
| AI SDKs | @anthropic-ai/sdk, openai | MIT/Apache-2.0 |
| Real-time | socket.io | MIT |
| Validation | zod | MIT |
| Visualization | mermaid | MIT |
| Image Processing | sharp (via libvips) | Apache-2.0 (LGPL bindings) |
| Accessibility | axe-core | MPL-2.0 |
| Sanitization | dompurify | MPL-2.0 OR Apache-2.0 |

---

## Executive Summary

| Assessment | Result |
|------------|--------|
| **Overall Status** | :material-check-circle: **PASS** |
| **Risk Level** | Low |
| **PoC Blocker** | No |
| **Action Required** | Documentation (license acknowledgments) |

**Review approach:** Automated scanning via `npm audit` and `license-checker`, followed by AI analysis of license compatibility and human validation of copyleft risks.

**Key findings:** 7 moderate vulnerabilities exist, all stemming from a single prototype pollution issue in `lodash-es` (a transitive dependency of mermaid). The attack path is indirect and requires crafted mermaid diagram input. License analysis found 4 weak copyleft packages (LGPL/MPL), all compatible with MIT release through dynamic linking or dual-license options.

**Bottom Line:** Dependencies are clean for PoC release. Document the LGPL/MPL acknowledgments and accept the lodash-es risk.

---

## Finding Synthesis Matrix

**Synthesis Date:** 2026-02-04

| ID | Finding | AI | Human | Final Severity | PoC Status |
|----|---------|:--:|:-----:|----------------|------------|
| DEP-1 | lodash-es prototype pollution (via mermaid) | Medium | Agreed | **Low** | Acceptable |
| DEP-2 | LGPL-3.0 in sharp/libvips bindings | Info | Agreed | **Info** | Documentation |
| DEP-3 | MPL-2.0 in axe-core | Info | Agreed | **Info** | Documentation |
| DEP-4 | Dual-licensed packages (jszip, dompurify) | Info | Agreed | **Info** | Documentation |
| DEP-5 | Project license (MPL-2.0) implications | — | NEW | **Info** | Documentation |

---

## Detailed Findings

### DEP-1: lodash-es Prototype Pollution

**AI Assessment:** Medium — Prototype pollution vulnerability in transitive dependency
**Human Assessment:** Agreed — Low practical risk given indirect attack path

| Aspect | Analysis |
|--------|----------|
| **The Issue** | `lodash-es` versions 4.0.0–4.17.22 have prototype pollution in `_.unset` and `_.omit` |
| **Location** | `mermaid` -> `@mermaid-js/parser` -> `langium` -> `chevrotain` -> `lodash-es` |
| **Evidence** | [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg), CVSS 6.5 |
| **Impact** | Potential property injection if attacker controls mermaid diagram input |

**npm audit output:**
```json
{
  "vulnerabilities": { "total": 7, "moderate": 7 },
  "root_cause": "lodash-es via mermaid dependency chain"
}
```

**Risk factors reducing severity:**
- Attack requires crafted mermaid diagram content
- Mermaid diagrams typically authored by trusted users
- Exploit path through parser is indirect and complex
- No direct API exposure to untrusted input

**Resolution:** Accept risk with documentation. Monitor for upstream fix in mermaid.

---

### DEP-2: LGPL-3.0 in sharp/libvips

**AI Assessment:** Info — LGPL allows dynamic linking without copyleft
**Human Assessment:** Agreed

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Pre-built libvips binaries for `sharp` are LGPL-3.0-or-later |
| **Location** | `@img/sharp-libvips-linux-x64` (versions 1.0.4, 1.1.0) |
| **Impact** | None for MIT release — LGPL permits dynamic linking |

**LGPL compatibility requirements:**
1. Acknowledge LGPL components in LICENSE/NOTICES
2. Allow users to replace the LGPL library (already possible via npm)
3. Include LGPL license text

**Resolution:** Add LGPL acknowledgment to project documentation.

---

### DEP-3: MPL-2.0 in axe-core

**AI Assessment:** Info — MPL-2.0 is file-level copyleft, compatible with MIT
**Human Assessment:** Agreed

| Aspect | Analysis |
|--------|----------|
| **The Issue** | `axe-core` (accessibility testing) uses MPL-2.0 |
| **Location** | `axe-core@4.10.3` |
| **Impact** | None — MPL only requires sharing modifications to MPL files themselves |

**Resolution:** Acknowledge in project documentation.

---

### DEP-4: Dual-Licensed Packages

**AI Assessment:** Info — Choose permissive license option
**Human Assessment:** Agreed

| Package | Version | License Options | Choose |
|---------|---------|-----------------|--------|
| `jszip` | 3.10.1 | MIT OR GPL-3.0-or-later | **MIT** |
| `dompurify` | 3.2.6 | MPL-2.0 OR Apache-2.0 | **Apache-2.0** |

**Resolution:** Document that project uses these packages under their permissive license option.

---

### DEP-5: Project License Implications (Human-Discovered)

**Human Assessment:** Info — MPL-2.0 is appropriate for open-source core

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Primer itself is licensed under MPL-2.0 |
| **Implication** | Modifications to existing Primer files must remain MPL-2.0 if distributed |
| **Benefit** | New files can use different licenses; allows proprietary extensions |

**Compatibility notes:**
- MIT/Apache-2.0 dependencies: Fully compatible
- BSD variants: Compatible
- GPL-2.0: Can receive MPL code but not vice versa (one-way)
- LGPL: Generally compatible for linking

**Resolution:** Current dependency mix is well-suited for MPL-2.0 project licensing. No action needed.

---

## Positive Security Controls

| Control | Status | Notes |
|---------|--------|-------|
| No GPL/AGPL contamination | :material-check-circle: | No viral copyleft in dependency tree |
| No critical vulnerabilities | :material-check-circle: | 0 critical, 0 high severity |
| Permissive license majority | :material-check-circle: | 99%+ MIT/Apache/BSD/ISC |
| AI SDK licensing | :material-check-circle: | Anthropic and OpenAI use permissive licenses |
| No commercial/GPL dual-license risks | :material-check-circle: | No UI grids, database drivers, or similar risky patterns |

---

## Research Insights: AI vs Human Performance

### Detection Comparison

| Category | AI | Human | Notes |
|----------|:--:|:-----:|-------|
| Issues identified | 4 | 1 new + 4 validations | AI covered vulnerability and license analysis |
| Concrete evidence | Yes (scan data) | Yes (validation) | Both worked from automated scan output |
| False positives | 0 | 0 | Clean analysis |

### AI Strengths
- Systematic analysis of entire license inventory (1,437 packages)
- Clear categorization of license types and compatibility
- Provided recommended license text and NOTICES format
- Identified all copyleft/weak-copyleft packages

### AI Limitations
- Did not identify project's own license (MPL-2.0) implications
- Required human context on deployment model for severity calibration

### Human Strengths
- Validated AI findings efficiently
- Added context about MPL-2.0 project license implications
- Identified risk vectors in npm ecosystem (database drivers, crypto libraries)
- Confirmed no GPL/AGPL contamination patterns present

### Human Limitations
- Limited time for exhaustive transitive dependency review
- Relied on automated tooling for comprehensive scan

---

## Consolidated Recommendations

### For PoC Release

| Priority | Action | Owner |
|----------|--------|-------|
| **Required** | Add NOTICES.md with LGPL/MPL acknowledgments | Docs |
| **Required** | Document dual-license choices (jszip→MIT, dompurify→Apache) | Docs |
| **Recommended** | Document lodash-es vulnerability as known limitation | Docs |

### For Production Release

| Priority | Action | Effort |
|----------|--------|--------|
| **P2** | Monitor mermaid for lodash-es fix upstream | Low |
| **P3** | Consider automated license scanning in CI | Low |
| **P3** | Add dependency update policy | Low |

---

## License Summary

| Category | Count | Examples |
|----------|-------|----------|
| MIT | ~1,122 (78%) | next, react, socket.io, zod |
| Apache-2.0 | ~150 (10%) | AWS SDK, @anthropic-ai/sdk |
| ISC | ~88 (6%) | Various utilities |
| BSD-3-Clause | ~35 (2%) | Various utilities |
| BSD-2-Clause | ~20 (1%) | Various utilities |
| LGPL-3.0 | 2 (<1%) | @img/sharp-libvips-linux-x64 |
| MPL-2.0 | 2 (<1%) | axe-core, dompurify (dual) |
| Dual (MIT/GPL) | 1 (<1%) | jszip |

**Verdict:** All dependencies are compatible with MIT/MPL-2.0 release.

---

## PoC Readiness

- [x] No critical or high vulnerabilities
- [x] No GPL/AGPL contamination
- [x] All licenses compatible with open-source release
- [x] Weak copyleft packages have clear usage paths
- [ ] NOTICES.md with acknowledgments (documentation task)

---

## Raw Scan Data

- [npm-audit.json](../appendices/automated-scans/npm-audit.json)
- [licenses.json](../appendices/automated-scans/licenses.json)

## Detailed Reviews

- [AI Review - Licenses](../appendices/ai-reviews/licenses-ai-review.md)
- [Human Review - Licenses](../appendices/human-reviews/licenses-human-review.md)
