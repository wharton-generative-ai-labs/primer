# Experience Context Defaulting for Backend Agents

## Problem

Backend agents (like Interface Designer) were creating components in new experiences instead of the current one because:

1. The `experienceId` was sent to the backend API but not exposed to the AI agent in its task message
2. File operations like `createFile` and `getResourceContent` required explicit `experienceId` parameters
3. Agents couldn't "see" the experienceId in their delegation request, leading to confusion

## Solution

Made all experience file operations default to `context.experienceId` when not explicitly provided, following the same pattern as `deployArtifact` and `validateComponent`.

### Tools Updated

The following tools now have **optional `experienceId`** that defaults to `context.experienceId`:

- `createFile`
- `createDirectory`
- `deleteFile`
- `deleteDirectory`
- `moveFile`
- `moveDirectory`
- `listResources`
- `getResourceContent`
- `deployArtifact` (already optional)
- `validateComponent` (already optional)

### Pattern Applied

Each function now follows this pattern:

```typescript
export async function createFile(
  args: { experienceId?: string; path: string; content: string },
  context: ToolContext
): Promise<ToolResponse> {
  // Default to current experience if not specified
  const targetExperienceId = args.experienceId || context.experienceId;
  
  if (!targetExperienceId) {
    return {
      status: 'error',
      data: { error: 'experienceId must be provided or available in context' }
    };
  }
  
  // Use targetExperienceId for the operation
  await experienceContext.createFile(targetExperienceId, args.path, args.content);
  // ...
}
```

## Benefits

### For Backend Agents Working Within Current Experience

**Interface Designer** and similar agents can now use file operations without specifying experienceId:

```javascript
// Simple - automatically uses current experience
const config = await getResourceContent({
  path: 'experience.json'
});

createFile({
  path: 'resources/components/counter.jsx',
  content: componentCode
});
```

### For Backend Agents Working Across Experiences

**Experience Builder** and similar agents continue to work exactly as before by explicitly providing experienceId:

```javascript
// Explicit - works with specific experience
const config = await getResourceContent({
  experienceId: newExperienceId,
  path: 'experience.json'
});

createFile({
  experienceId: newExperienceId,
  path: 'resources/instructions/agent/mentor.md',
  content: agentPrompt
});
```

## Impact Analysis

### ✅ No Breaking Changes

- Experience Builder prompt requires **no changes**
- All existing explicit `experienceId` parameters continue to work
- Only agents that omit `experienceId` get the new defaulting behavior

### ✅ Consistent Pattern

- All experience file operations now behave consistently
- Same pattern as `deployArtifact` and `validateComponent`
- Clear error if neither `experienceId` argument nor `context.experienceId` exists

### ✅ Simplified Instructions

Interface Designer instructions simplified from:

```markdown
**FIRST STEP**: Extract experienceId from delegation request
Example: { "experienceId": "deckard", ... }
Use this experienceId for ALL file operations.
```

To:

```markdown
All file operations automatically work within the current experience.
You don't need to specify experienceId - it's handled automatically.
```

## Files Changed

### Core Implementation
- `/src/app/lib/tools/experience/experience.ts` - Updated 8 functions to make experienceId optional with defaulting
- `/src/app/lib/tools/experience/index.ts` - Updated tool registrations to reflect optional experienceId

### Documentation
- `/storage/deckard/resources/instructions/agent/interface-designer.md` - Simplified to remove experienceId extraction logic
- `/ai_context/roadmap/custom-components/EXPERIENCE-CONTEXT-DEFAULTING.md` - This document

## Testing Considerations

1. **Interface Designer**: Should now create components in the current (deckard) experience
2. **Experience Builder**: Should continue to work unchanged with explicit experienceId parameters
3. **Error handling**: Should gracefully fail with clear message if neither experienceId source exists

## Future Considerations

This pattern could be extended to other context-aware operations where backend agents typically work within the current experience context.
