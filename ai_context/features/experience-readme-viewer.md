# Experience README Viewer Feature

**Date**: January 9, 2026  
**Status**: Complete  
**Type**: New Feature

## Overview

Added the ability for users to view README.md files (and linked documentation) for Experiences directly within Primer. This helps users understand what an Experience does before or while using it.

## Implementation

### 1. API Endpoints

Created `/api/experiences/[id]/readme` endpoint:
- Fetches README.md from experience folders
- Supports optional `docPath` query parameter for linked docs (e.g., `docs/chemistry-demo-improvements.md`)
- Validates paths to prevent directory traversal attacks
- Returns 404 if README doesn't exist

### 2. Experience Metadata

Updated Experience interfaces to include `hasReadme` flag:
- `/api/experiences` route checks for README.md existence when listing experiences
- `ExperienceMetadata` type includes optional `hasReadme` field
- Play page checks for README availability during experience loading

### 3. Shared ReadmeDialog Component

Created `src/app/components/ReadmeDialog.tsx`:
- Uses `react-markdown` with GitHub Flavored Markdown support
- Renders markdown with custom styling for dark theme
- Handles relative markdown links (e.g., links to `docs/*.md` files)
- Opens external links in new tabs
- Supports navigation between README and linked docs with back button
- Fully styled with proper typography, code blocks, tables, etc.

### 4. ExperienceCatalog Integration

Updated `src/app/components/ExperienceCatalog.tsx`:
- Shows Lucide `Info` icon next to experience title when README exists
- Icon is blue and hover-interactive
- Clicking icon opens ReadmeDialog overlay
- Dialog is dismissible and doesn't navigate away from catalog

### 5. PlayPage Footer Integration

Updated `src/app/components/PlayPage/PlayPageControls.tsx`:
- Added `Info` icon button in lower right of footer (next to other controls)
- **Removed** Edit button from footer (already available in ExperienceCatalog)
- Info button only appears if experience has README
- Opens same ReadmeDialog component
- Consistent styling with other footer icons

### 6. Dependencies

Added npm packages:
- `react-markdown` - Core markdown rendering
- `remark-gfm` - GitHub Flavored Markdown support (tables, strikethrough, etc.)

## User Experience

### In ExperienceCatalog
1. User sees blue (i) icon next to experiences that have README
2. Clicking icon opens modal overlay with README content
3. User can read documentation without leaving catalog
4. Links to other docs within the experience work seamlessly
5. User can close modal and continue browsing

### In PlayPage
1. User sees Info icon in footer (lower right) if experience has README
2. Clicking opens same README dialog
3. User can reference documentation while using the experience
4. No Edit button clutter (removed as requested)

## Technical Details

### Path Security
- All document paths are validated to prevent directory traversal
- Paths are normalized and checked for `..` sequences
- Only files within the experience folder can be accessed

### Markdown Rendering
- Custom component styling for dark theme compatibility
- Syntax highlighting for code blocks
- Proper table rendering
- External links open in new tabs
- Internal markdown links navigate within the dialog

### Performance
- README existence is checked once during experience list loading
- README content is only fetched when user opens the dialog
- Lazy loading of linked documentation files

## Example Usage

The `component-demo` experience includes:
- Main `README.md` with overview and architecture
- Linked docs in `docs/` folder:
  - `chemistry-demo-improvements.md`
  - `geography-globe-component.md`

Users can now:
1. See the Info icon in the catalog
2. Click to read the comprehensive README
3. Click links to detailed component documentation
4. Navigate back to README or close dialog

## Benefits

1. **Discoverability**: Users can learn what an experience does before trying it
2. **In-App Documentation**: No need to extract/unzip files to read docs
3. **Context-Aware**: Documentation available both in catalog and during use
4. **Extensible**: Supports any markdown files within experience folders
5. **Clean UI**: Removed redundant Edit button from footer

## Files Modified

- `src/app/api/experiences/[id]/readme/route.ts` (new)
- `src/app/api/experiences/route.ts` (added hasReadme check)
- `src/app/components/ReadmeDialog.tsx` (new)
- `src/app/components/ExperienceCatalog.tsx` (added Info icon)
- `src/app/components/PlayPage/PlayPageControls.tsx` (added Info icon, removed Edit button)
- `src/app/components/PlayPage.tsx` (pass hasReadme prop)
- `src/app/play/[id]/page.tsx` (check README existence)
- `src/app/lib/types.ts` (added hasReadme to ExperienceMetadata)
- `package.json` (added react-markdown, remark-gfm)

## Future Enhancements

Possible improvements:
- Add search within README content
- Support for images in markdown (already works via relative paths)
- Table of contents generation for long READMEs
- Syntax highlighting themes
- Print/export functionality
