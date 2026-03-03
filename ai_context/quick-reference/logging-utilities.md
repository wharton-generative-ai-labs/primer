# Logging Utilities

**File:** `src/lib/log-utils.ts`  
**Last Updated:** 2026-01-21

## Overview

Smart logging utilities that automatically truncate long string values for readability while preserving metadata about the truncation.

## Functions

### `truncateForLogging(obj, maxLength?, truncationSuffix?)`

Recursively truncates long string values in an object for logging purposes.

**Parameters:**
- `obj` - The object to process (can be any type)
- `maxLength` - Maximum length for string values (default: 200)
- `truncationSuffix` - Suffix to append when truncated (default: '...')

**Returns:** A new object with truncated string values

**Features:**
- ✅ Recursively processes nested objects and arrays
- ✅ Adds metadata when truncating: `${key}_truncated` and `${key}_original_length`
- ✅ Preserves non-string values as-is
- ✅ Handles null, undefined, primitives, objects, and arrays

**Example:**

```typescript
import { truncateForLogging } from '@/lib/log-utils';

const data = {
  title: 'Short title',
  content: 'x'.repeat(500),
  nested: {
    description: 'y'.repeat(300)
  }
};

const truncated = truncateForLogging(data, 200);

console.log(truncated);
// {
//   title: 'Short title',
//   content: 'xxx...xxx...',  // 197 chars + '...'
//   content_truncated: true,
//   content_original_length: 500,
//   nested: {
//     description: 'yyy...yyy...',  // 197 chars + '...'
//     description_truncated: true,
//     description_original_length: 300
//   }
// }
```

### `formatToolCallForLogging(toolName, args, callId, maxLength?)`

Formats tool call data for logging with smart truncation.

**Parameters:**
- `toolName` - Name of the tool being called
- `args` - Tool arguments (any object)
- `callId` - Unique call identifier
- `maxLength` - Maximum length for string values (default: 200)

**Returns:** Formatted object ready for logging

**Example:**

```typescript
import { formatToolCallForLogging } from '@/lib/log-utils';

const logData = formatToolCallForLogging(
  'slide',
  { 
    action: 'show', 
    title: 'My Slide',
    content: '# Very Long Content\n\n' + 'Lorem ipsum '.repeat(100)
  },
  'call-123'
);

logger.info(logData, 'Tool call received');
// Logs:
// {
//   level: 'info',
//   msg: 'Tool call received',
//   callId: 'call-123',
//   toolName: 'slide',
//   args: {
//     action: 'show',
//     title: 'My Slide',
//     content: '# Very Long Content\n\nLorem ipsum Lorem ipsum...',
//     content_truncated: true,
//     content_original_length: 1200
//   }
// }
```

## Usage in Backend

### Tool Call Logging

**File:** `server.ts`

All inbound `tool.call` events are logged at INFO level with full parameters:

```typescript
socket.on('tool.call', async (data) => {
  const { formatToolCallForLogging } = await import('./src/lib/log-utils');
  
  // Log at INFO level with all parameters (truncated for readability)
  logger.info(
    formatToolCallForLogging(data.toolName, data.args, data.callId),
    'Tool call received'
  );
  
  // ... execute tool ...
});
```

### Example Log Output

**Short content:**
```json
{
  "level": "info",
  "time": 1737489234567,
  "msg": "Tool call received",
  "callId": "tool_slide_1737489234567_abc123",
  "toolName": "slide",
  "args": {
    "action": "show",
    "title": "Quick Note",
    "content": "# Hello\n\nThis is a short slide."
  }
}
```

**Long content (truncated):**
```json
{
  "level": "info",
  "time": 1737489234567,
  "msg": "Tool call received",
  "callId": "tool_slide_1737489234567_def456",
  "toolName": "slide",
  "args": {
    "action": "show",
    "title": "Documentation",
    "content": "# Introduction\n\nThis is a very long document with lots of content that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and...",
    "content_truncated": true,
    "content_original_length": 5000
  }
}
```

## Benefits

1. **Readable Logs**: Long strings don't flood log output
2. **Full Context**: All parameters are logged, just truncated
3. **Metadata Preserved**: Know when truncation occurred and original length
4. **Debuggable**: Can see exactly what was passed to tools
5. **Audit Trail**: Complete record of all tool invocations
6. **Performance**: Reduces log file size for long content

## Configuration

Default truncation length is **200 characters**, which provides a good balance between:
- Seeing enough context to understand what's being logged
- Keeping logs readable and not overwhelming
- Preserving log file size

To customize:

```typescript
// Use custom max length
const truncated = truncateForLogging(data, 500);  // 500 char limit

// Use custom suffix
const truncated = truncateForLogging(data, 200, ' [...]');  // Custom suffix
```

## Testing

Comprehensive test suite at `src/lib/__tests__/log-utils.test.ts`:

```bash
npm test -- src/lib/__tests__/log-utils.test.ts
```

Tests cover:
- Short strings (no truncation)
- Long strings (with truncation)
- Nested objects
- Arrays
- Null/undefined handling
- Primitives
- Tool call formatting

## Related

- `src/lib/logger.ts` - Main logger implementation
- `server.ts` - Backend tool call handling
- `ai_context/architecture/backend-first-tool-pattern.md` - Backend-first architecture
