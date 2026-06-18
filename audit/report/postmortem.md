# Audit Postmortem

A retrospective analysis of the Primer security audit, documenting methodology effectiveness, AI vs human reviewer performance, and lessons learned for future audits.

---

## Executive Summary

| Metric                      | Value                         |
| --------------------------- | ----------------------------- |
| **Audit Duration**          | 8 days (Jan 27 – Feb 4, 2026) |
| **Human Review Time**       | ~31.5 hours                   |
| **Categories Reviewed**     | 11                            |
| **Total Findings**          | 73                            |
| **PoC Blockers Found**      | 0                             |
| **AI Reviews Completed**    | 10 of 11                      |
| **Human Reviews Completed** | 11 of 11                      |

The audit successfully achieved its dual objectives: (1) assessing Primer's readiness for V1 PoC release, and (2) generating research data comparing AI and human security review capabilities. The codebase was determined suitable for PoC release with trusted users, pending documentation of known limitations.

---

## What Worked Well

### Dual-Review Methodology

The AI-first, human-validation approach proved effective:

| Aspect          | Outcome                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| **Coverage**    | AI provided systematic breadth; human provided targeted depth                        |
| **Efficiency**  | Human reviewer used AI findings to focus investigation (~40% time savings estimated) |
| **Quality**     | Complementary strengths caught issues neither would find alone                       |
| **Calibration** | Human contextual judgment corrected 6 AI severity overestimates                      |

### Structured Finding Format

Standardized finding documentation enabled:

- Direct comparison between AI and human findings
- Clear severity justifications with evidence
- Actionable recommendations with effort estimates
- Traceable synthesis back to original reviews

### Automated Tooling

| Tool            | Coverage             | Value                                                                         |
| --------------- | -------------------- | ----------------------------------------------------------------------------- |
| Gitleaks        | Git history + source | Eliminated manual secret scanning; 3 false positives correctly identified     |
| npm audit       | Dependencies         | Automated vulnerability detection; all 7 moderate traced to single root cause |
| license-checker | 1,437 packages       | Comprehensive license inventory; identified 4 weak-copyleft packages          |

### PoC-Focused Scope

The deployment context framework (trusted users, controlled environment) enabled pragmatic risk assessment:

- 4 HIGH findings downgraded to MEDIUM/LOW based on practical exploitability
- No blockers despite architectural concerns
- Clear separation of PoC-acceptable vs production-required fixes

---

## What Could Be Improved

### AI Review Coverage Gap

Frontend Security was not reviewed by AI (template only), creating an incomplete comparison baseline. This occurred due to:

- Unclear handoff between AI review phases
- No automated tracking of review completion status

**Recommendation:** Implement checklist-driven AI review scheduling with explicit completion criteria.

### Time Tracking Accuracy

Initial human review time estimates were significantly underreported (~12 hrs logged vs ~31.5 hrs realistic):

- Did not account for AI review reading time
- Underestimated codebase exploration
- Report writing time not captured

**Recommendation:** Use structured time tracking with categories (exploration, testing, writing).

### Finding ID Consistency

Finding IDs were not always consistent between AI reviews, human reviews, and synthesis:

- Some findings renamed during synthesis
- Cross-references occasionally broken

**Recommendation:** Establish finding IDs at AI review stage; maintain through synthesis.

### Parallel Review Coordination

AI and human reviews were conducted sequentially. Parallel review with blind comparison would strengthen research validity.

**Recommendation:** For future research, consider independent parallel reviews before synthesis.

---

## AI vs Human Performance Analysis

### Detection Metrics

| Category               | AI  | Human | Notes                           |
| ---------------------- | :-: | :---: | ------------------------------- |
| Findings identified    | 52  |  41   | AI broader, human deeper        |
| Unique findings        | 19  |  21   | Different focus areas           |
| Overlapping findings   | 33  |  33   | Strong agreement on core issues |
| False positives        |  4  |   0   | AI flagged non-existent gaps    |
| Severity overestimates |  6  |   0   | AI lacked deployment context    |

### AI Strengths Observed

1.  **Systematic Coverage**
    - Reviewed all files in scope without fatigue
    - Consistent documentation format
    - Found subtle issues (loading state bugs, duplicate switch cases)

2.  **Pattern Recognition**
    - Identified architectural anti-patterns (fail-open auth, God Hook)
    - Comprehensive attack vector enumeration
    - Cross-file relationship tracking

3.  **Documentation Quality**
    - Clear code evidence with line numbers
    - Structured severity justifications
    - Actionable recommendations

### AI Limitations Observed

1.  **No Runtime Verification**
    - Could not test actual exploitability
    - Missed implemented controls in separate files (rate limiting, iteration limits)
    - Cannot verify headers actually served

2.  **Context Blindness**
    - Rated findings without deployment context
    - Could not assess "trusted users" risk reduction
    - Theoretical severity vs practical severity

3.  **Incomplete Execution**
    - Frontend Security review not completed
    - Some reviews missed obvious issues (custom windowing complexity)

### Human Strengths Observed

1.  **Live Testing**
    - Verified route authorization with test accounts
    - Decoded JWTs, inspected network traffic
    - Found storage API auth gap through actual probing

2.  **Contextual Calibration**
    - Downgraded severity based on deployment model
    - Recognized documentation issues vs code defects
    - Understood PoC vs production requirements

3.  **Cross-Domain Connection**
    - Linked frontend permission checks to backend AUTH-2
    - Connected SSRF to DNS rebinding research
    - Identified architectural debt impact on maintainability

### Human Limitations Observed

1.  **Time Constraints**
    - ~31.5 hours insufficient for exhaustive review
    - Relied on AI to prioritize focus areas
    - Some categories received lighter coverage

2.  **Narrower Scope**
    - Fewer files reviewed than AI
    - Depth over breadth tradeoff
    - Missed some issues AI found (inline CSS, loading bugs)

### Key Research Finding

> **AI and human reviewers have complementary strengths that together exceed either alone.**
>
> AI excels at systematic coverage and pattern detection. Humans excel at contextual judgment and exploitation verification. The optimal approach combines AI breadth with human depth, using AI findings to focus human investigation while human testing validates AI concerns.

---

## Methodology Refinements

### For Future Audits

| Change                                   | Rationale                               |
| ---------------------------------------- | --------------------------------------- |
| Track AI review completion explicitly    | Prevent coverage gaps                   |
| Use structured time tracking             | Accurate effort measurement             |
| Establish finding IDs at AI stage        | Maintain consistency through synthesis  |
| Include deployment context in AI prompts | Enable contextual severity assessment   |
| Add runtime testing checklist for human  | Ensure consistent verification coverage |

### For AI Review Prompts

Include in future AI review prompts:

```
Deployment Context:
- Target users: [trusted/public]
- Environment: [controlled/production]
- Data sensitivity: [high/medium/low]

Consider this context when assessing severity.
A HIGH finding for public deployment may be MEDIUM for trusted users.
```

### For Human Review Guidance

Provide humans with:

- Prioritized list of AI findings to validate
- Suggested live testing scenarios
- Time allocation guidance by category
- Template for documenting new findings

---

## Remediation Status

### Completed Before PoC

| Item              | Type          | Status      |
| ----------------- | ------------- | ----------- |
| Finding synthesis | Documentation | :material-check-circle: Complete |
| Findings overview | Documentation | :material-check-circle: Complete |
| Postmortem        | Documentation | :material-check-circle: Complete |

### Required for PoC Release

| Item                          | Owner | Status  |
| ----------------------------- | ----- | ------- |
| Document open registration    | Docs  | Pending |
| Document storage API auth gap | Docs  | Pending |
| Document CSP unsafe-eval      | Docs  | Pending |
| Configure billing alerts      | Ops   | Pending |
| Add NOTICES.md (LGPL/MPL)     | Docs  | Pending |

### Deferred to Production

All P1/P2/P3 code changes deferred—PoC release acceptable with documentation only.

---

## Timeline

| Date       | Milestone                                           |
| ---------- | --------------------------------------------------- |
| 2026-01-26 | Audit setup, category planning, deployment context  |
| 2026-01-27 | AI reviews commenced, initial human validation      |
| 2026-01-28 | Synthesis reports, extended human validation        |
| 2026-01-29 | Report consolidation, deep human validation         |
| 2026-01-30 | Additional human review, technical evaluation       |
| 2026-02-03 | Human review completion, time estimate updates      |
| 2026-02-04 | Synthesis completion, findings overview, postmortem |

---

## Research Contributions

This audit contributes to Wharton's research on AI-assisted security review:

### Data Generated

- 10 AI review documents with standardized findings
- 11 human review documents with validation notes
- 11 synthesis documents comparing AI and human performance
- Quantitative metrics on detection rates, false positives, severity calibration

### Hypotheses Supported

1. **AI provides efficient coverage** — AI reviewed more files and identified more total findings
2. **Humans provide contextual judgment** — All severity downgrades came from human review
3. **Combination exceeds either alone** — 21 human-only + 19 AI-only findings = neither alone achieved full coverage

### Open Questions

1. Would parallel blind review change the overlap rate?
2. How does AI performance vary with prompt specificity?
3. What is the minimum human review time needed to validate AI findings effectively?

---

## Acknowledgments

- **AI Reviewer:** Claude (Anthropic) — Systematic code analysis across 11 categories
- **Human Reviewer:** Chris — Live testing, contextual calibration, synthesis
- **Research Context:** Wharton School — AI vs human security review methodology study
