# Slide Tool Usage Guide

**Last Updated:** 2026-01-21

## Overview

The slide tool creates presentation windows to display content. It works via socket communication (backend-first) and integrates with the unified window management system.

## Actions

### `show` - Create Slide with Content

Creates a new slide with markdown content and returns the slideId.

```typescript
const result = await slide({
  action: 'show',
  title: 'My Slide Title',
  content: '# Hello\n\nMarkdown content here'
});

const slideId = result.data.slideId;  // 'slide-abc123'
```

**Returns:**
```typescript
{
  status: 'success',
  data: {
    slideId: string,
    title: string
  }
}
```

### `showArtifact` - Create Slide from Artifact

Creates a slide displaying artifact content. Automatically handles text and binary artifacts.

```typescript
const result = await slide({
  action: 'showArtifact',
  artifactId: 'my-artifact-id',
  title: 'Optional Title'  // Uses artifact name if omitted
});

const slideId = result.data.slideId;
```

**Returns:**
```typescript
{
  status: 'success',
  data: {
    slideId: string,
    title: string,
    artifactId: string,
    artifactName: string,
    artifactType: string
  }
}
```

**Artifact handling:**
- **Text artifacts** (markdown, code): Displays content directly
- **Image artifacts** (png, jpg, gif, svg): Creates data URL and displays image
- **Other binary** (pdf, zip): Shows informative message

## Window Management

After creating a slide, use the `present` tool to control it:

```typescript
// Move slide
await present({ action: 'move', id: slideId, x: 200, y: 100 });

// Resize slide
await present({ action: 'resize', id: slideId, w: 800, h: 600 });

// Maximize slide
await present({ action: 'maximize', id: slideId });

// Hide slide
await present({ action: 'hide', id: slideId });

// Show hidden slide
await present({ action: 'show', id: slideId });
```

## Query UI State

Use the `observe` tool to see all slides and UI elements:

```typescript
const result = await observe({});

// result.data contains:
// - elements: All PrimerUIElements (including slides)
// - viewport: { width, height }
// - summary: { total, visible, hidden, visibleIds, hiddenIds }
// - spatial: Spatial relationships
```

## Complete Example

```typescript
// 1. Create a slide
const slideResult = await slide({
  action: 'show',
  title: 'Project Status',
  content: `# Project Status

## Completed
- Feature A
- Feature B

## In Progress
- Feature C

## Next Steps
- Feature D
- Feature E
`
});

const slideId = slideResult.data.slideId;

// 2. Position it
await present({ 
  action: 'move', 
  id: slideId, 
  x: 100, 
  y: 100 
});

// 3. Resize it
await present({ 
  action: 'resize', 
  id: slideId, 
  w: 600, 
  h: 400 
});

// 4. Later, hide it
await present({ 
  action: 'hide', 
  id: slideId 
});

// 5. Show it again
await present({ 
  action: 'show', 
  id: slideId 
});
```

## Artifact Example

```typescript
// 1. Get artifact content
const artifact = await artifact({
  action: 'get',
  id: 'my-notes-id'
});

// 2. Show on slide
const slideResult = await slide({
  action: 'showArtifact',
  artifactId: 'my-notes-id',
  title: 'My Notes'
});

// 3. Control the slide
await present({
  action: 'move',
  id: slideResult.data.slideId,
  x: 200,
  y: 150
});
```

## Error Handling

All actions return consistent error shape:

```typescript
{
  status: 'error',
  data: {
    error: 'Error message here'
  }
}
```

Common errors:
- `Socket communication not available` - Tool called in wrong context
- `title and content are required` - Missing parameters for show action
- `artifactId is required` - Missing parameter for showArtifact action
- `Artifact {id} not found` - Invalid artifact ID

## Best Practices

1. **Always save the slideId** - You'll need it to control the slide later
2. **Use present for window management** - Don't try to manage windows with slide tool
3. **Use observe to query state** - See what slides are visible/hidden
4. **Handle errors gracefully** - Check result.status before accessing data
5. **Use showArtifact for artifacts** - It handles binary content automatically

## Migration from Old API

If you have old code using deprecated actions:

```typescript
// OLD (no longer works)
slide({ action: 'hide', id: 'slide-123' });
slide({ action: 'hideAll' });
slide({ action: 'list' });

// NEW (correct)
present({ action: 'hide', id: 'slide-123' });
present({ action: 'hideAll' });
observe({});  // Returns all UI elements
```

## Related Tools

- **artifact** - Store and retrieve file content
- **present** - Control any UI window (show/hide/move/resize/maximize)
- **observe** - Query UI state and spatial relationships
