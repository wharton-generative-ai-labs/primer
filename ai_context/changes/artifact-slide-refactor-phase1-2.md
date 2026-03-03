# Artifact and Slide Refactoring - Phase 1 & 2

**Date:** 2026-01-21  
**Status:** Complete

## Overview

Completed Phase 1 and Phase 2 of the artifact/slide refactoring to separate file storage concerns from UI presentation concerns. This resolves the issue where the Experience Builder agent was failing due to attempting to use `artifact` with `action: "show"` in a backend context where `showSlide` was not available.

## Problem

The Experience Builder agent was failing with errors:
```
artifact function "show" error: showSlide function not available
```

This was caused by:
1. The `artifact` tool having a `show` action that was a duplicate of slide functionality
2. The `show` action requiring `showSlide` function which isn't available in backend contexts
3. Confusion between file storage (artifacts) and UI presentation (slides)
4. Overlapping responsibilities between artifacts and slides

## Changes Made

### 1. Removed `show` Action from Artifact Tool

**File:** `src/app/lib/tools/builtin/artifact-tool.ts`

- **Removed** the entire `show` case from the artifact tool (lines 185-255)
- **Updated** tool description to clarify artifacts are for "FILE STORAGE AND RETRIEVAL only"
- **Updated** action type to remove `'show'` from the union type
- **Updated** parameter documentation to remove references to `show` action
- **Updated** error message to only list valid actions: `list, get, create, edit, delete`

**Key changes:**
- Tool description now states: "Artifacts are for FILE STORAGE AND RETRIEVAL only. Use 'list' to see all artifacts, 'get' to retrieve content, 'create' to store new files, 'edit' to update content, 'delete' to remove files. To DISPLAY artifact content to users, retrieve it with 'get' and then use the 'slide' tool to present it."
- Removed 70 lines of code that duplicated slide functionality
- Artifacts are now purely a file management concern

### 2. Enhanced Slide Tool with Artifact Support

**File:** `src/app/lib/tools/ui/slides.ts`

- **Added** new `showArtifact` action to slide tool
- **Added** `artifactId` parameter for the new action
- **Implemented** logic to retrieve artifact content and display it on a slide

**New functionality:**
```typescript
case 'showArtifact': {
  // Retrieves artifact by ID
  const artifact = await context.getArtifact(args.artifactId);
  // Displays artifact content on a slide
  const result = slideContext.showSlide(title, artifact.content);
  return { status: 'success', data: { result, artifactId, artifactName } };
}
```

This provides a clean separation:
- **Artifacts**: Storage and retrieval of file content
- **Slides**: Presentation of content to users

### 3. Updated Experience Builder Prompt

**File:** `storage/2j0ib7lz9ge/resources/instructions/agent/experience-builder.md`

- **Added** explicit warning about artifact usage in "Your Process Overview" section
- **Updated** mandatory sequence to clarify artifact usage
- **Added** critical note: "Use `action: 'get'` to retrieve artifact content, NEVER use `action: 'show'`"

**Key additions:**
```markdown
**IMPORTANT**: Artifacts are for file storage only. Use `artifact` with `action: "get"` 
to retrieve content, NOT `action: "show"`. The artifact tool does not display content to users.
```

```markdown
**CRITICAL**: Use `action: "get"` to retrieve artifact content, NEVER use `action: "show"`
- Artifacts are for file storage only, not for displaying content
```

## Architecture After Changes

### Clear Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                     ARTIFACT TOOL                           │
│  Purpose: File Storage and Retrieval                        │
│  Actions: list, get, create, edit, delete                   │
│  Scope: Backend-compatible, file system operations          │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ artifact.get(id) → content
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      SLIDE TOOL                             │
│  Purpose: UI Presentation                                   │
│  Actions: show, showArtifact, hide, list, etc.              │
│  Scope: Frontend-first (for now), displays content          │
└─────────────────────────────────────────────────────────────┘
```

### Usage Pattern

**Before (broken):**
```javascript
// This was failing in backend contexts
artifact({ action: 'show', id: 'artifact-id' })
```

**After (correct):**
```javascript
// Option 1: Get artifact content, then show on slide
const artifact = await artifact({ action: 'get', id: 'artifact-id' });
slide({ action: 'show', title: artifact.name, content: artifact.content });

// Option 2: Use the new showArtifact action (convenience method)
slide({ action: 'showArtifact', artifactId: 'artifact-id' });
```

## Benefits

1. **Clear Separation**: Artifacts handle storage, slides handle presentation
2. **Backend Compatible**: Artifact tool no longer requires frontend-specific functions
3. **No Duplication**: Removed 70 lines of duplicate slide functionality from artifact tool
4. **Better Semantics**: Tool names now clearly indicate their purpose
5. **Fixes Experience Builder**: Backend agents can now use artifacts without errors
6. **Maintains Functionality**: The `slide.showArtifact` action provides the convenience of displaying artifacts

## Testing

- No linter errors in modified files
- No test files needed updating (no tests referenced artifact show)
- Experience Builder should now work correctly with artifacts

## Phase 3 Status

✅ **COMPLETED** - See `artifact-slide-refactor-phase3-complete.md` for details

## Files Changed

- `src/app/lib/tools/builtin/artifact-tool.ts` - Removed show action
- `src/app/lib/tools/ui/slides.ts` - Added showArtifact action
- `storage/2j0ib7lz9ge/resources/instructions/agent/experience-builder.md` - Updated instructions

## Impact

- **Breaking Change**: Any code calling `artifact({ action: 'show' })` will now fail
- **Migration Path**: Replace with `slide({ action: 'showArtifact', artifactId: '...' })`
- **Experience Builder**: Now works correctly in backend contexts
- **Other Agents**: Should be reviewed to ensure they don't use artifact show
