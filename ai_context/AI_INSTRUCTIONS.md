# AI Assistant Instructions - Context Folder Management

**Purpose:** Guidelines for AI assistants working on the Primer project to maintain clean, organized documentation.

## Critical Rules

### 🚨 NEVER Place Files in Project Root

**This is an open source project.** Documentation and context files MUST NOT be placed in the project root directory.

❌ **NEVER DO THIS:**
```
/Users/bprzy/code/primer/primer/
├── my-notes.md              ❌ NO
├── implementation-plan.txt  ❌ NO
├── debug-log.md             ❌ NO
├── analysis.md              ❌ NO
└── context-about-X.md       ❌ NO
```

✅ **ALWAYS DO THIS:**
```
/Users/bprzy/code/primer/primer/context/
├── [appropriate-subfolder]/
│   └── descriptive-name.md  ✅ YES
```

**Why:** The project root should only contain:
- Source code directories (`src/`, `public/`, etc.)
- Configuration files (`package.json`, `tsconfig.json`, etc.)
- Standard open source files (`README.md`, `LICENSE`, `CONTRIBUTING.md`, etc.)
- Build/tooling directories (`.github/`, `scripts/`, etc.)

Random documentation files in the root create clutter and look unprofessional in an open source project.

### 🚨 NEVER Place Files in Context Root

Similarly, avoid cluttering the `/context` root directory with random files.

❌ **AVOID:**
```
/context/
├── notes-2026-01-11.md           ❌ Avoid dates in filenames
├── random-thoughts.md            ❌ Too vague
├── temp-analysis.md              ❌ Use appropriate subfolder
├── implementation-notes-v2.md    ❌ Use appropriate subfolder
└── testing-summary-2026-01-11.md ❌ Should be in /testing, no date needed
```

✅ **CORRECT:**
```
/context/
├── changes/
│   └── implementation-notes.md   ✅ Descriptive, in right place, kebab-case
├── testing/
│   └── overview.md               ✅ Organized by topic
└── bugs-and-todo-items/
    └── feature-analysis.md       ✅ Clear purpose and location
```

## Context Folder Structure

### Available Subfolders

Use these existing subfolders for organization:

| Folder | Purpose | Examples |
|--------|---------|----------|
| `architecture/` | System design, architecture decisions | `overview.md`, `delegation.md` |
| `bugs-and-todo-items/` | Issue tracking, planned work | `implement-feature-x.md` |
| `changes/` | Implementation notes, change logs | `refactoring-summary.md` |
| `code_reviews/` | Code review summaries | `code-review-dec-2025.md` |
| `external/` | External reference materials | `openai/`, third-party docs |
| `features/` | Feature documentation | `experience-catalog-permissions.md` |
| `fixes/` | Bug fix documentation | `render-docs-build-fix.md` |
| `guides/` | How-to guides, tutorials | `adding-tools.md` |
| `legacy/` | Historical/obsolete documentation | Outdated docs |
| `reference/` | Reference code and examples | `api-routes.md`, `artifacts/` |
| `roadmap/` | Project planning, future work | Feature proposals |
| `testing/` | Testing documentation | `overview.md`, `configuration.md` |

### Creating New Subfolders

If none of the existing folders fit your needs:

1. **Consider if a new folder is truly needed** - Can it fit in an existing folder?
2. **Use clear, descriptive names** - `performance/` not `perf/`
3. **Use lowercase with hyphens** - `user-experience/` not `UserExperience/` or `user_experience/`
4. **Update `/context/README.md`** - Add the new folder to the structure diagram

## File Naming Conventions

### ✅ Good File Names

- **Descriptive:** `experience-builder-refactoring.md`
- **Kebab-case:** `api-rate-limiting.md` (not `API_RATE_LIMITING.md` or `api_rate_limiting.md`)
- **Purpose-clear:** `oauth-implementation-guide.md`
- **Timeless:** `overview.md`, `configuration.md`

### ❌ Bad File Names

- **Too vague:** `notes.md`, `stuff.md`, `temp.md`
- **Wrong case:** `API_INSTRUCTIONS.md` (use `api-instructions.md` instead)
- **Snake_case:** `api_rate_limiting.md` (use kebab-case: `api-rate-limiting.md`)
- **Dated (usually):** `analysis-2026-01-11.md` (avoid dates - see below)
- **Versioned:** `implementation-v2.md` (use git history instead)
- **Personal:** `bobs-notes.md` (this is collaborative)
- **Temporary:** `temp-debug.md`, `scratch.md`

### When to Use Dates

**General Rule: Avoid dates in filenames and file contents unless there's a compelling reason.**

Dates are acceptable for:
- ✅ Code reviews: `code-review-dec-2025.md` (knowing when a review occurred has value)
- ✅ Specific time-bound events: `security-audit-2025-12.md`
- ✅ Historical snapshots: `architecture-snapshot-2026-01.md`

Dates should NOT be used for:
- ❌ Living documents: `overview.md` (not `overview-2026-01-11.md`)
- ❌ Configuration: `testing-config.md` (not `testing-config-2026-01-11.md`)
- ❌ Guides: `deployment-guide.md` (not `deployment-guide-2026-01.md`)
- ❌ File contents: Don't add "Created on 2026-01-11" headers unless the date is meaningful

**Why avoid dates?**
- Git history already tracks when files were created and modified
- Dates make filenames longer and harder to read
- Dates in content become stale and create maintenance burden
- Most documentation should be timeless and continuously updated

## Decision Tree: Where Should This File Go?

```
Is this a documentation or context file?
├─ NO → Put it in the appropriate source directory (src/, docs/, etc.)
└─ YES → Continue...

Is this about testing?
├─ YES → /context/testing/
└─ NO → Continue...

Is this about a bug or planned work?
├─ YES → /context/bugs-and-todo-items/
└─ NO → Continue...

Is this about a recent change or refactoring?
├─ YES → /context/changes/
└─ NO → Continue...

Is this a code review or audit?
├─ YES → /context/code_reviews/
└─ NO → Continue...

Is this architectural documentation?
├─ YES → /context/architecture/
└─ NO → Continue...

Is this a how-to guide?
├─ YES → /context/guides/
└─ NO → Continue...

Is this about a specific feature?
├─ YES → /context/features/
└─ NO → Continue...

Is this external reference material?
├─ YES → /context/external/
└─ NO → Continue...

Is this about future plans?
├─ YES → /context/roadmap/
└─ NO → Consider creating a new subfolder (with user approval)
```

## Maintenance Guidelines

### When Creating Documentation

1. **Choose the right subfolder** using the decision tree above
2. **Use descriptive filenames** that explain the content (in kebab-case)
3. **Add a header** with purpose at the top (avoid dates unless meaningful)
4. **Cross-reference** related documentation
5. **Update the subfolder's README** if one exists

### When Updating Documentation

1. **Update in place** for living documents (don't create v2, v3, etc.)
2. **Use git history** to track changes over time
3. **Update "Last Updated" dates** in document headers
4. **Check for outdated information** and mark it clearly
5. **Move obsolete docs** to `/context/legacy/` instead of deleting

### When Consolidating Documentation

1. **Identify redundancy** across multiple files
2. **Create a consolidated version** in the appropriate subfolder
3. **Remove the old files** (they're in git history if needed)
4. **Update cross-references** in other documents
5. **Document the consolidation** (like `CONSOLIDATION_SUMMARY.md`)

## Examples of Correct Placement

### Example 1: Testing Documentation
**Task:** Document new test coverage

❌ **Wrong:**
- `/testing-notes.md` (project root)
- `/context/test-coverage-2026-01-11.md` (context root, dated)

✅ **Correct:**
- `/context/testing/overview.md` (organized, timeless, kebab-case)

### Example 2: Implementation Notes
**Task:** Document a major refactoring

❌ **Wrong:**
- `/refactoring-notes.md` (project root)
- `/context/notes.md` (vague, context root)

✅ **Correct:**
- `/context/changes/component-refactoring.md` (descriptive, organized, kebab-case)

### Example 3: Bug Analysis
**Task:** Analyze a complex bug

❌ **Wrong:**
- `/bug-analysis.md` (project root)
- `/context/infinite-loop-bug.md` (context root)

✅ **Correct:**
- `/context/bugs-and-todo-items/realtime-controller-infinite-loop-fix.md` (descriptive, organized, kebab-case)

### Example 4: Architecture Decision
**Task:** Document why we chose a particular approach

❌ **Wrong:**
- `/architecture-decision.md` (project root)
- `/context/why-we-use-x.md` (context root)

✅ **Correct:**
- `/context/architecture/delegation.md` (clear, organized, kebab-case)

## Special Cases

### Temporary Working Files

If you need temporary working files during development:

1. **Use the system temp directory** - Not the project
2. **Clean up when done** - Don't leave temp files
3. **Never commit temp files** - They don't belong in the repo

### Large Reference Materials

For large external references (like API documentation):

1. **Use `/context/external/`** - Organized by source
2. **Create subfolders** - e.g., `/context/external/openai/`
3. **Include attribution** - Note the source and date
4. **Consider linking** - Instead of copying large docs

### Code Examples

For reference code that shouldn't be built:

1. **Use `/context/reference/`** - Explicitly for reference
2. **Add README** - Explain that these are examples only
3. **Note the source** - Where did this code come from?
4. **Don't import** - These files are excluded from build

## Checklist for AI Assistants

Before creating any documentation file, verify:

- [ ] Is this file necessary? (Could it be a comment in code instead?)
- [ ] Am I placing it in a subfolder? (Not project root or context root)
- [ ] Is the filename descriptive and clear?
- [ ] Does the filename follow kebab-case convention? (not snake_case or SCREAMING-CASE)
- [ ] Have I avoided using dates in the filename unless there's a compelling reason?
- [ ] Have I avoided adding unnecessary dates in the file contents?
- [ ] Have I checked if a similar file already exists?
- [ ] Could this content be added to an existing file instead?
- [ ] If creating a new subfolder, have I discussed it with the user?
- [ ] Have I added appropriate headers (without unnecessary date stamps)?
- [ ] Have I cross-referenced related documentation?

## Red Flags - Stop and Reconsider

🚩 **You're about to create a file in the project root** → STOP
- Use `/context/[subfolder]/` instead

🚩 **You're about to create a file in `/context/` root** → STOP
- Use an appropriate subfolder

🚩 **The filename includes "temp" or "scratch"** → STOP
- This probably shouldn't be committed

🚩 **The filename is very generic (notes.md, stuff.md)** → STOP
- Use a descriptive name

🚩 **You're creating version 2/3/4 of a file** → STOP
- Update the existing file instead

🚩 **The file duplicates existing documentation** → STOP
- Update or consolidate existing docs

## Summary

**Golden Rules:**
1. 🚫 Never place documentation in the project root
2. 🚫 Never place files directly in `/context/` root
3. ✅ Always use appropriate subfolders
4. ✅ Use descriptive, timeless filenames
5. ✅ Consolidate instead of duplicating
6. ✅ Update existing docs rather than creating new versions
7. ✅ Keep the open source project looking professional

**When in doubt:** Ask the user where a file should go rather than guessing.

## Related Documentation

- [Context Folder README](./README.md) - Overview of context folder purpose
- [Testing Documentation](./testing/README.md) - Example of well-organized subfolder
- [Contributing Guidelines](/CONTRIBUTING.md) - Project contribution standards

---

**Remember:** This is an open source project. Every file in the repository reflects on the project's professionalism and organization. Keep it clean, organized, and purposeful.
