# Artifact Types

This document describes the supported artifact types in Primer, their content type mappings, and file extensions.

## Supported Artifact Types

Artifacts in Primer support a wide range of file types for creating educational content, code, and visual assets.

### Text-Based Artifacts

| Type | MIME Type | Extension | Use Case |
|------|-----------|-----------|----------|
| `markdown` / `md` | `text/markdown` | `.md` | Documentation, notes, formatted text |
| `javascript` / `js` | `application/javascript` | `.js` | JavaScript code |
| `jsx` | `text/jsx` | `.jsx` | React JSX components |
| `typescript` / `ts` | `application/typescript` | `.ts` | TypeScript code |
| `tsx` | `text/tsx` | `.tsx` | React TypeScript components |
| `html` | `text/html` | `.html` | HTML markup |
| `css` | `text/css` | `.css` | Stylesheets |
| `json` | `application/json` | `.json` | Data files, configuration |
| `python` / `py` | `text/x-python` | `.py` | Python code |
| `text` / `txt` | `text/plain` | `.txt` | Plain text |
| `xml` | `application/xml` | `.xml` | XML documents |
| `yaml` / `yml` | `application/x-yaml` | `.yml` | YAML configuration |
| `checklist` | `text/markdown` | `.md` | Interactive checklists with markdown checkboxes |

### Binary Artifacts

| Type | MIME Type | Extension | Use Case |
|------|-----------|-----------|----------|
| `png` | `image/png` | `.png` | Raster images |
| `jpg` / `jpeg` | `image/jpeg` | `.jpg` | JPEG images |
| `gif` | `image/gif` | `.gif` | Animated images |
| `svg` | `image/svg+xml` | `.svg` | Vector graphics |
| `pdf` | `application/pdf` | `.pdf` | Documents |
| `zip` | `application/zip` | `.zip` | Compressed archives |

## Usage

### Creating an Artifact

When creating an artifact with the `artifact` tool, you can specify the type using either:
- **Short form**: `'jsx'`, `'markdown'`, `'png'`
- **MIME type**: `'text/jsx'`, `'text/markdown'`, `'image/png'`

Example:

```javascript
// Using short form
artifact({
  action: 'create',
  name: 'my-component.jsx',
  type: 'jsx',
  content: '...'
})

// Using MIME type
artifact({
  action: 'create',
  name: 'my-component.jsx',
  type: 'text/jsx',
  content: '...'
})
```

### Special Types

#### Checklist Artifacts

Checklist artifacts are a special type of markdown artifact that contains interactive checkboxes. They must include markdown checkbox syntax (`- [ ]` or `- [x]`).

Example:

```javascript
artifact({
  action: 'create',
  name: 'todo-list',
  type: 'checklist',
  content: `# My Tasks
- [ ] First task
- [x] Completed task
- [ ] Another task`
})
```

## Content Type Utilities

The system provides several utility functions for working with content types:

### `normalizeContentType(type: string): string`

Converts MIME types to canonical short forms:
- `'text/jsx'` → `'jsx'`
- `'text/markdown'` → `'markdown'`
- `'image/png'` → `'png'`

### `getFileExtensionForType(type: string): string`

Returns the appropriate file extension for a type:
- `'jsx'` → `'jsx'`
- `'markdown'` → `'md'`
- `'png'` → `'png'`

### `getMimeTypeForType(type: string): string`

Converts short forms or validates MIME types:
- `'jsx'` → `'text/jsx'`
- `'markdown'` → `'text/markdown'`
- `'text/jsx'` → `'text/jsx'` (validated)

### `isBinaryFileType(type: string): boolean`

Determines if a type is binary (requires special handling):
- `'png'` → `true`
- `'jsx'` → `false`

## Filename Generation

Artifact filenames are automatically generated based on:
1. **Meaningful name** (if provided): Converts to safe filename
2. **Artifact ID**: Falls back to UUID-based naming

### Safe Filename Rules

- Converts to lowercase
- Replaces spaces with underscores
- Removes special characters
- Limits length to 100 characters (configurable)
- Falls back to `'untitled'` for empty names

Example transformations:
- `'My Component'` → `'my_component'`
- `'Design #1'` → `'design_1'`
- `'___Special___'` → `'special'`

## Related Documentation

- [Artifact Tool](/developer/experiences/tools#artifact)
- [Tool Groups](/developer/architecture/tools-system)
- [Custom Components](/developer/guides/custom-components)
