# Adding New Tools to Primer

This guide explains how to add new tools to Primer's centralized tool system.

## Overview

All tools are located in `src/app/lib/tools/` and organized by group. To add a new tool:

1. Decide which group it belongs to (or create a new group)
2. Create the tool definition and handler
3. Register the tool in the group's registration function
4. Add the tool name to `TOOL_GROUPS` in `groups.ts`

## Step-by-Step Guide

### 1. Create the Tool File

Create a new file in the appropriate group directory:

```
src/app/lib/tools/{group}/my-new-tool.ts
```

Example tool implementation:

```typescript
import { Tool, ToolResponse } from '@/app/lib/types';
import { ToolRegistry } from '@/app/lib/ToolRegistry';

// Define the tool schema
export const myNewTool: Tool = {
  type: 'function',
  name: 'myNewTool',
  description: 'Brief description of what this tool does',
  parameters: {
    type: 'object',
    properties: {
      requiredParam: {
        type: 'string',
        description: 'Description of this parameter'
      },
      optionalParam: {
        type: 'number',
        description: 'Optional numeric parameter'
      }
    },
    required: ['requiredParam']
  }
};

// Define the handler
export async function handleMyNewTool(
  args: { requiredParam: string; optionalParam?: number },
  context: any
): Promise<ToolResponse> {
  try {
    // Your tool logic here
    const result = doSomething(args.requiredParam, args.optionalParam);
    
    return {
      status: 'success',
      data: { result }
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Registration function
export async function registerMyNewTool(): Promise<void> {
  const registry = ToolRegistry.getInstance();
  await registry.register(myNewTool, handleMyNewTool);
}
```

### 2. Export from Group Index

Add your tool to the group's `index.ts`:

```typescript
// src/app/lib/tools/{group}/index.ts

export { registerMyNewTool } from './my-new-tool';

// In the main register function for the group
export async function register{Group}Tools(): Promise<void> {
  await registerExistingTool();
  await registerMyNewTool();  // Add this
}
```

### 3. Add to TOOL_GROUPS

Update `src/app/lib/tools/groups.ts`:

```typescript
export const TOOL_GROUPS: Record<string, string[]> = {
  // ... existing groups ...
  '{group}': [
    'existingTool',
    'myNewTool',  // Add this
  ],
};
```

### 4. Test the Tool

1. Start the dev server: `npm run dev`
2. Load an experience that includes your tool's group
3. Check console for registration logs: `🔧 [CENTRALIZED] Registering Tool: myNewTool`
4. Test the tool through an agent

## Tool Response Format

All tools must return a `ToolResponse`:

```typescript
interface ToolResponse {
  status: 'success' | 'error' | 'deferred';
  data?: any;      // Tool-specific data
  message?: string; // Error or status message
}
```

### Success Response
```typescript
return {
  status: 'success',
  data: { items: [...], count: 5 }
};
```

### Error Response
```typescript
return {
  status: 'error',
  message: 'File not found: example.txt'
};
```

### Deferred Response
Use `deferred` when the result will come later (e.g., user input needed):
```typescript
return {
  status: 'deferred',
  message: 'Waiting for user to upload file'
};
```

## Context Object

Tools receive a context object with useful information:

### Frontend Context
```typescript
{
  experienceId: string;
  sessionId: string;
  availableScenes: Record<string, { path: string; url: string }>;
  availableSounds: Record<string, { path: string; url: string }>;
  getInformation: (key: string) => any;
  saveInformation: (key: string, value: any) => void;
}
```

### Backend Context
```typescript
{
  experienceId: string;
  sessionId: string;
  delegationId?: string;
  userInfo?: { name: string; email: string };
  listArtifacts: () => Promise<Artifact[]>;
  getArtifact: (id: string) => Promise<Artifact | null>;
  createArtifact: (name, content, type) => Promise<string>;
  // ... more file operations
}
```

## Creating a New Tool Group

If your tool doesn't fit existing groups:

### 1. Create Group Directory
```
src/app/lib/tools/my-group/
├── index.ts
├── my-tool.ts
└── types.ts (optional)
```

### 2. Create Registration Function
```typescript
// src/app/lib/tools/my-group/index.ts
import { registerMyTool } from './my-tool';

export async function registerMyGroupTools(): Promise<void> {
  await registerMyTool();
}

export { registerMyTool };
```

### 3. Export from Main Index
```typescript
// src/app/lib/tools/index.ts
export { registerMyGroupTools } from './my-group';
```

### 4. Add to TOOL_GROUPS
```typescript
// src/app/lib/tools/groups.ts
export const TOOL_GROUPS: Record<string, string[]> = {
  // ...
  'my-group': ['myTool'],
};
```

### 5. Register in ConfigLoader (if needed for frontend)
```typescript
// src/app/lib/ConfigLoader.ts
import { registerMyGroupTools } from './tools/my-group';

// In the appropriate registration section
await registerMyGroupTools();
```

## Best Practices

1. **Keep tools focused**: Each tool should do one thing well
2. **Validate inputs**: Check required parameters before processing
3. **Return helpful errors**: Include actionable error messages
4. **Log appropriately**: Use console.log for debugging, console.error for errors
5. **Handle async properly**: Always await async operations
6. **Clean up resources**: Close files, connections, etc. on completion
7. **Consider both contexts**: Test tools in both frontend and backend if applicable

## Examples

### Existing Tools to Reference

| Tool | Location | Good Example Of |
|------|----------|-----------------|
| `artifact` | `builtin/builtin.ts` | Multi-action tool |
| `generateImage` | `image-generator/image.ts` | External API call |
| `displayNote` | `ui/displayNote.ts` | UI manipulation |
| `delegate` | `delegation/delegate.ts` | Complex orchestration |

## Troubleshooting

### Tool not appearing
- Check it's exported from the group's `index.ts`
- Check it's in `TOOL_GROUPS` in `groups.ts`
- Check the registration function is called

### Tool execution fails
- Check console for error logs
- Verify context has required properties
- Test handler function directly

### Type errors
- Ensure Tool type matches ToolResponse return
- Check parameter types in handler match schema
