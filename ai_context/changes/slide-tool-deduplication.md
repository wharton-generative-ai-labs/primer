# Slide Tool Deduplication Fix

**Date:** 2026-01-21  
**Status:** ✅ Complete

## Problem

With `@primer/slide-plugin` now mapping to the `'builtin'` group (same as `@primer/builtin-plugin`), there was a potential for tool duplication if an experience configuration declared both plugins:

```json
{
  "tools": {
    "plugins": [
      "@primer/builtin-plugin",
      "@primer/slide-plugin"
    ]
  }
}
```

### What Would Happen Without Deduplication

1. `pluginNamesToGroups(['@primer/builtin-plugin', '@primer/slide-plugin'])`
   - Returns: `['builtin', 'builtin']` ❌

2. `getToolsForGroups(['builtin', 'builtin'])`
   - `flatMap` creates: `['scene', 'information', ..., 'slide', 'scene', 'information', ..., 'slide']` ❌
   - Maps to Tool objects: Creates duplicate Tool instances ❌

3. Result: Agent gets duplicate tools in their tool list ❌

## Solution

Added deduplication at two levels:

### 1. Plugin-to-Group Conversion

**File:** `src/app/lib/tools/groups.ts`

```typescript
export function pluginNamesToGroups(pluginNames: string[]): string[] {
  const groups = pluginNames
    .map(name => PLUGIN_NAME_TO_GROUP[name])
    .filter((group): group is string => group !== undefined);
  
  // Deduplicate groups (e.g., both @primer/builtin-plugin and @primer/slide-plugin map to 'builtin')
  return [...new Set(groups)];
}
```

**Result:** `['builtin', 'builtin']` → `['builtin']` ✅

### 2. Group-to-Tools Conversion

**File:** `src/app/lib/tools/groups.ts`

```typescript
export function getToolsForGroups(groupNames: string[]): Tool[] {
  const registry = ToolRegistry.getInstance();
  
  // Collect all tool names from the requested groups
  const toolNames = groupNames.flatMap(group => TOOL_GROUPS[group] || []);
  
  // Deduplicate tool names (important when multiple plugins map to same group)
  const uniqueToolNames = [...new Set(toolNames)];
  
  // Get the tool definitions from the registry
  const tools = uniqueToolNames
    .map(name => registry.getTool(name))
    .filter((tool): tool is Tool => tool !== null);
  
  return tools;
}
```

**Result:** Even if duplicate groups slip through, tool names are deduplicated ✅

## Defense in Depth

We added deduplication at **both** levels:

1. **First line of defense:** `pluginNamesToGroups` deduplicates group names
2. **Second line of defense:** `getToolsForGroups` deduplicates tool names

This ensures no duplicates even if:
- Multiple plugins map to the same group
- The same plugin is listed multiple times
- The same group is passed multiple times directly

## Test Coverage

Added comprehensive tests:

### `pluginNamesToGroups` Tests

```typescript
it('should deduplicate when multiple plugins map to same group', () => {
  const result = pluginNamesToGroups([
    '@primer/builtin-plugin',
    '@primer/slide-plugin',  // Also maps to 'builtin'
    '@primer/celebrate-plugin',
  ]);

  expect(result).toEqual(['builtin', 'celebrate']);
  expect(result.length).toBe(2); // Not 3
});

it('should deduplicate repeated plugins', () => {
  const result = pluginNamesToGroups([
    '@primer/builtin-plugin',
    '@primer/builtin-plugin',
    '@primer/celebrate-plugin',
  ]);

  expect(result).toEqual(['builtin', 'celebrate']);
  expect(result.length).toBe(2);
});
```

### `getToolsForGroups` Tests

```typescript
it('should deduplicate tools when same group appears multiple times', () => {
  const result = getToolsForGroups(['builtin', 'builtin']);

  // Should only call getTool once per unique tool name, not twice
  const uniqueToolCount = TOOL_GROUPS['builtin'].length;
  expect(mockRegistry.getTool).toHaveBeenCalledTimes(uniqueToolCount);
  expect(result.length).toBe(uniqueToolCount);
});
```

## Files Changed

1. `src/app/lib/tools/groups.ts`
   - Added deduplication to `pluginNamesToGroups()`
   - Added deduplication to `getToolsForGroups()`
   - Updated JSDoc comments

2. `src/app/lib/tools/__tests__/groups.test.ts`
   - Added 2 new tests for `pluginNamesToGroups` deduplication
   - Added 1 new test for `getToolsForGroups` deduplication
   - Updated 2 existing tests to expect deduplicated results

## Verification

✅ All 52 tests passing in `groups.test.ts`  
✅ No linter errors in implementation file  
✅ Deduplication works at both plugin→group and group→tools levels  
✅ Backward compatible with existing configurations

## Impact

**Experiences with both plugins:**
```json
{
  "tools": {
    "plugins": [
      "@primer/builtin-plugin",
      "@primer/slide-plugin"
    ]
  }
}
```

**Before:** Would potentially get duplicate tools  
**After:** Get unique set of builtin tools (including `slide`) ✅

**Experiences with only one plugin:**
```json
{
  "tools": {
    "plugins": ["@primer/builtin-plugin"]
  }
}
```

**Before:** Works fine  
**After:** Still works fine ✅

## Key Takeaway

When consolidating tools into shared groups, always add deduplication to prevent duplicate tool registrations. Using `Set` for deduplication is simple and effective:

```typescript
const unique = [...new Set(array)];
```
