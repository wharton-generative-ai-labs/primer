# Slide Tool Group Fix

**Date:** 2026-01-21  
**Status:** ✅ Complete

## Problem

Backend agents (via delegation) couldn't access the `slide` tool, even though it was properly registered in `register.ts`. The tool appeared in frontend agent tool lists but was missing from backend agent tool lists.

### Symptoms

- Frontend agents: ✅ Could call `slide` tool successfully
- Backend agents: ❌ Tool not in their `toolNames` array (36 tools instead of 37)
- Backend logs showed no `slide` tool available when delegating tasks

## Root Cause

The `slide` tool was registered but placed in its own separate group:

```typescript
// groups.ts - WRONG
export const TOOL_GROUPS: Record<string, string[]> = {
  'builtin': ['scene', 'information', /* ... */, 'observe', 'present'],
  'slide': ['slide'],  // ❌ Separate group
  // ...
};
```

Backend agents default to these tool groups:
```typescript
['builtin', 'experience', 'matter-compiler', 'image-generator']
```

Since `'slide'` wasn't in the default groups, backend agents couldn't access it.

## Solution

### 1. Move `slide` to `builtin` Group

**File:** `src/app/lib/tools/groups.ts`

```typescript
export const TOOL_GROUPS: Record<string, string[]> = {
  'builtin': [
    'scene',
    'information',
    'file',
    'artifact',
    'checklist',
    'agent',
    'toast',
    'observe',
    'present',
    'slide'  // ✅ Now in builtin!
  ],
  // ... other groups (slide group removed)
};
```

### 2. Update Plugin Mapping

**File:** `src/app/lib/tools/groups.ts`

For backward compatibility with experiences that reference `@primer/slide-plugin`:

```typescript
export const PLUGIN_NAME_TO_GROUP: Record<string, string> = {
  '@primer/builtin-plugin': 'builtin',
  '@primer/slide-plugin': 'builtin',  // ✅ Maps to builtin now
  // ... other plugins
};
```

### 3. Update Tests

**File:** `src/app/lib/tools/__tests__/groups.test.ts`

- ✅ Added `'slide'` to expected builtin tools array
- ✅ Removed separate `'slide'` group test
- ✅ Updated plugin mapping test to expect `'builtin'` for `@primer/slide-plugin`
- ✅ Changed uniqueness test to allow multiple plugins mapping to same group
- ✅ Removed `'slide'` from `getAllGroups()` expectations

## Why This Matters

**Frontend agents** use tool stubs (`createToolStub`) that forward all calls to the backend via socket. They always get the full tool list because the stub registration happens independently.

**Backend agents** get their tools from `ToolRegistrationManager.initializeTools()`, which filters by tool groups. They only get tools in their configured groups.

This is why the issue only manifested when delegating to backend agents!

## Files Changed

1. `src/app/lib/tools/groups.ts`
   - Moved `slide` into `'builtin'` group
   - Removed separate `'slide'` group
   - Updated `PLUGIN_NAME_TO_GROUP` mapping

2. `src/app/lib/tools/__tests__/groups.test.ts`
   - Updated 6 test expectations to match new structure
   - Changed uniqueness test to allow multiple plugins per group

3. `ai_context/architecture/migrating-frontend-to-backend-first.md`
   - Added Step 9: "Add to Builtin Tool Group"
   - Added Mistake 5: "Tool Not in Builtin Group"
   - Updated verification checklist

## Verification

✅ All tests passing (50/50 in `groups.test.ts`)  
✅ No linter errors  
✅ Backend agents now show 37 tools (including `slide`)  
✅ Frontend agents still work (unchanged behavior)  
✅ Backward compatibility maintained via plugin mapping

## Key Lesson

When migrating a tool to backend-first:

1. ✅ Register in `register.ts`
2. ✅ Create socket handlers
3. ✅ Add client stub in `register-client.ts`
4. ✅ Add socket types
5. ✅ Remove old registration
6. ✅ **Add to `'builtin'` group in `groups.ts`** ← Don't forget this!

Without step 6, the tool won't be available to backend agents!
