# License Compliance - Human Review

---

??? info "AI Review Guidance :material-robot-outline:"
    The AI review (see `licenses-ai-review.md`) performed an automated scan. Human review focuses on "viral" license risks and compatibility.

    ### Where You Add the Most Value

    1. **Identify Copyleft risks.** Look for GPL (v2/v3) or AGPL dependencies. These can force the entire project to be open-sourced under the same license, which might conflict with Wharton's goals or the MPL-2.0 project license.
    2. **Verify Dual-Licensing.** Some packages are commercial/GPL dual-licensed (e.g., older Highcharts, specific UI grids).

    ### Practical Test Steps

    1. Scan package.json for known high-risk packages
    2. Check @types/ packages (usually MIT, but verify)

    ### V1 PoC Focus

    **Context:** This is a proof-of-concept release.

    #### PoC Blockers

    **None identified by AI review.**

    #### PoC Acceptable (Validate or Dispute)

    | Finding                 | AI Assessment  | Notes                              |
    | ----------------------- | -------------- | ---------------------------------- |
    | MPL-2.0 Project License | PoC Acceptable | Review implications for distribution |
    | MIT/Apache Dependencies | PoC Acceptable | Scan for any GPL/AGPL transitive deps |

---

## Findings

### AI Finding Validation

**License Compatibility:**

- [x] Agree

no conflicts found

### Additional Findings

**LIC-1 (Project License):**

The project itself is licensed under **MPL-2.0**.

_Implication:_ Any modifications to existing files _must_ be released under MPL-2.0 if distributed.
New files can be under different licenses. This allows proprietary extensions (unlike GPL) but ensures the core remains open.

_Assessment:_ Appropriate for an open-source core with potential proprietary modules.

**LIC-2 (Dependencies):**

Checked key dependencies:

- `next`, `react`, `tailwind`: MIT
- `@anthropic-ai/sdk`, `openai`: MIT/Apache
- `socket.io`: MIT
- `zod`: MIT
- `uuid`: MIT

_Assessment:_

Clean dependency tree. No GPL/AGPL contamination found.

**LIC-3 (Transitive Dependencies):**

Worth noting: the npm ecosystem typically stays MIT-heavy. The main risk vectors for copyleft issues are:
- Database drivers (some have GPL options)
- Crypto libraries (OpenSSL licensing quirks)
- UI component libraries (some commercial/GPL dual-licensed)

None of these patterns appear in this project's stack. The AI SDK providers (Anthropic, OpenAI) maintain permissive licensing specifically to avoid restricting commercial use.

**LIC-4 (MPL-2.0 Compatibility Notes):**

MPL-2.0 is "file-level copyleft" - less restrictive than GPL. Key compatibility notes:
- MIT/Apache-2.0: Fully compatible (no issues)
- BSD variants: Compatible
- GPL-2.0: Can receive MPL code but not vice versa (one-way)
- LGPL: Generally compatible for linking

Current dependency mix is well-suited for MPL-2.0 project licensing.

---

## PoC Readiness Assessment

- [ ] Any PoC blockers discovered?
- [x] Acceptable for controlled deployment?

---

## Sign-off

- **Reviewer:** Chris (Technical Auditor)
- **Date:** 2026-01-28 (updated 2026-02-03)
- **Time Spent:** 1.5 hrs
