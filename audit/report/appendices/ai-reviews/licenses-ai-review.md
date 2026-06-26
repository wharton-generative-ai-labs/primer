# Dependency License Audit - AI Review

- **Scan Date:** 2026-01-27
- **Tool:** license-checker
- **Reviewer:** Claude (AI)
- [x] **Status:** Complete

---

## Executive Summary

| Status | Count |
|--------|-------|
| Permissive (MIT, BSD, ISC, Apache) | ~1,416 |
| Weak Copyleft (LGPL, MPL) | 4 |
| Dual Licensed (can choose permissive) | 3 |
| Project Package (UNLICENSED) | 1 |
| **Total Packages** | ~1,437 |

**Verdict:** :material-check-circle: **Compatible with MIT release** with one consideration (LGPL in sharp's native bindings).

---

## License Distribution

```text
MIT:                    1,122 (78%)
Apache-2.0:               150 (10%)
ISC:                       88 (6%)
BSD-3-Clause:              35 (2%)
BSD-2-Clause:              20 (1%)
Other Permissive:          ~10 (1%)
Copyleft/Dual:              4 (<1%)
```

---

## Packages Requiring Attention

### 1. LGPL-3.0-or-later (Weak Copyleft)

| Package | Version | Notes |
|---------|---------|-------|
| `@img/sharp-libvips-linux-x64` | 1.0.4 | Native bindings for sharp |
| `@img/sharp-libvips-linux-x64` | 1.1.0 | Native bindings for sharp |

**What is this?**
- These are pre-built native binaries for libvips (image processing library)
- Used by the `sharp` package for image manipulation
- LGPL allows dynamic linking without requiring your code to be LGPL

**Impact on MIT Release:**
- :material-check-circle: **Compatible** - LGPL allows use in proprietary/MIT projects
- The LGPL only requires you to:
  1. Acknowledge the LGPL components
  2. Allow users to replace the LGPL library (already possible via npm)
  3. Provide LGPL license text

**Recommendation:** Include LGPL acknowledgment in your LICENSE file or NOTICES file.

---

### 2. MPL-2.0 (Weak Copyleft - File Level)

| Package | Version | Notes |
|---------|---------|-------|
| `axe-core` | 4.10.3 | Accessibility testing |
| `dompurify` | 3.2.6 | (MPL-2.0 OR Apache-2.0) - can choose Apache |

**Impact on MIT Release:**
- :material-check-circle: **Compatible** - MPL-2.0 is file-level copyleft
- Only requires sharing modifications to MPL files themselves
- Your own code remains MIT

**For dompurify:** Dual-licensed, choose Apache-2.0 to avoid any copyleft.

---

### 3. Dual Licensed (Choose Permissive)

| Package | Version | Licenses | Choose |
|---------|---------|----------|--------|
| `jszip` | 3.10.1 | MIT OR GPL-3.0-or-later | **MIT** |
| `dompurify` | 3.2.6 | MPL-2.0 OR Apache-2.0 | **Apache-2.0** |

**Action:** Document that you're using these under the permissive license option.

---

### 4. UNLICENSED

| Package | Notes |
|---------|-------|
| `@primer/primer@0.44.47` | **This is your project** - not a dependency |

This is the local workspace package, not an external dependency. You will apply your chosen license to this.

---

## Open Source License Options

### Option 1: MIT License ⭐ Recommended

**Compatibility:** :material-check-circle: All dependencies compatible

**Pros:**
- Maximum permissiveness
- Widely understood
- No patent clauses to worry about
- Standard for JS/Node projects

**Cons:**
- No patent protection
- No contribution requirements

**Required Acknowledgments:**
- LGPL notice for sharp/libvips bindings
- Standard copyright notice

---

### Option 2: Apache 2.0

**Compatibility:** :material-check-circle: All dependencies compatible

**Pros:**
- Explicit patent grant
- Clear contribution terms
- Corporate-friendly

**Cons:**
- Longer license text
- Patent retaliation clause may concern some

**Required Acknowledgments:**
- Same as MIT plus NOTICE file recommended

---

### Option 3: BSD 3-Clause

**Compatibility:** :material-check-circle: All dependencies compatible

**Pros:**
- Simple and permissive
- No endorsement clause

**Cons:**
- Less common than MIT
- No patent protection

---

### Option 4: ISC

**Compatibility:** :material-check-circle: All dependencies compatible

**Pros:**
- Functionally equivalent to MIT
- Slightly simpler text

**Cons:**
- Less widely recognized

---

## Recommended License Text (MIT)

```text
MIT License

Copyright (c) 2025 Wharton Generative AI Labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Recommended NOTICES Addition

If releasing as MIT, add this to a NOTICES.md or include in LICENSE:

```markdown
## Third-Party Licenses

This software includes the following third-party components:

### libvips (via sharp)
Licensed under LGPL-3.0-or-later
https://github.com/libvips/libvips
Users may replace this component with their own LGPL-compliant version.

### axe-core
Licensed under MPL-2.0
https://github.com/dequelabs/axe-core

### Full dependency licenses
Run `npx license-checker` for complete license information.
```

---

## Conclusion

**Recommended:** Release under **MIT License**

All dependencies are compatible. The LGPL components (sharp/libvips) are:
1. Dynamically linked (allowed under LGPL)
2. Replaceable by users (satisfies LGPL requirements)
3. Pre-built binaries, not modified source

No GPL-only dependencies exist that would require copyleft licensing of your code.
