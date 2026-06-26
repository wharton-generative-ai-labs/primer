---
id: custom-tools
title: Custom Tools
sidebar_position: 2
---

# Creating Custom Tools

Extend Primer by adding custom tools for agents.

## Overview

Tools are functions agents can call. Creating a custom tool involves:

1. Define tool schema
2. Implement handler function
3. Register with ToolRegistry
4. Add to tool group
5. Use in experiences

## Step-by-Step Guide

### 1. Create Tool File

Create `src/app/lib/tools/mygroup/mytool.ts`:

```typescript
import { z } from 'zod';
import type { ToolContext, ToolResponse } from '../types';

export const myToolSchema = {
  name: 'myTool',
  description: 'Does something useful',
  parameters: z.object({
    action: z.enum(['do', 'undo']).describe('Action to perform'),
    value: z.string().optional().describe('Optional value'),
  }),
};

export async function myToolHandler(
  args: z.infer<typeof myToolSchema.parameters>,
  context: ToolContext
): Promise<ToolResponse> {
  try {
    if (args.action === 'do') {
      // Implementation
      return {
        status: 'success',
        data: { result: 'Done!' },
        message: 'Action completed'
      };
    }
    
    return { status: 'error', message: 'Unknown action' };
  } catch (error) {
    return {
      status: 'error',
      message: `Error: ${error.message}`
    };
  }
}
```

### 2. Export from Group

Create or update `src/app/lib/tools/mygroup/index.ts`:

```typescript
import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { myToolSchema, myToolHandler } from './mytool';

export async function registerMyGroupTools() {
  const registry = ToolRegistry.getInstance();
  registry.register(myToolSchema, myToolHandler);
}
```

### 3. Add to Tool Groups

Update `src/app/lib/tools/groups.ts`:

```typescript
export const TOOL_GROUPS = {
  // ... existing groups
  mygroup: ['myTool'],
};
```

### 4. Register in ConfigLoader

Update `src/app/lib/ConfigLoader.ts`:

```typescript
import { registerMyGroupTools } from './tools/mygroup';

// In registration section:
if (toolGroups.includes('mygroup')) {
  await registerMyGroupTools();
}
```

### 5. Use in Experience

```json
{
  "agents": {
    "my-agent": {
      "toolGroups": ["builtin", "mygroup"]
    }
  }
}
```

## Best Practices

### Design

- **Use command/action pattern** for related functionality
- **Validate inputs** with Zod schemas
- **Return clear responses** with status and data
- **Handle errors gracefully**
- **Log operations** for debugging

### Implementation

- **Keep tools focused** on single responsibility
- **Use context** for environment access
- **Avoid side effects** outside tool scope
- **Test thoroughly**
- **Document parameters** clearly

### Performance

- **Minimize I/O** operations
- **Cache when appropriate**
- **Use async/await** for I/O
- **Return quickly** for UI responsiveness

## Example: Weather Tool

```typescript
export const weatherToolSchema = {
  name: 'weather',
  description: 'Get weather information',
  parameters: z.object({
    action: z.enum(['current', 'forecast']),
    location: z.string().describe('City name'),
  }),
};

export async function weatherToolHandler(
  args: z.infer<typeof weatherToolSchema.parameters>,
  context: ToolContext
): Promise<ToolResponse> {
  const { action, location } = args;
  
  try {
    if (action === 'current') {
      // Fetch current weather
      const weather = await fetchWeather(location);
      return {
        status: 'success',
        data: weather,
        message: `Current weather in ${location}`
      };
    }
    
    // Handle forecast...
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to get weather: ${error.message}`
    };
  }
}
```

## Next Steps

- [Tools System](/developer/architecture/tools-system) - Architecture details
- [Experience Format](/developer/architecture/experience-format) - Configuration
- [Contributing](/developer/contributing) - Submit your tool
