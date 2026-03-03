# Validation Logging Bug Fix

**Date**: 2026-01-13  
**Status**: ✅ Fixed

## Issue

Validation error and warning details were not being written to log files despite being logged. Log entries showed only:

```json
{"level":"error","time":1768320904118,"env":"development","module":"experience-plugin","msg":"Component validation failed: linear-functions"}
```

Missing the expected structured data:
```json
{
  "errorCount": 2,
  "errors": [...],
  "warnings": [...]
}
```

## Root Cause

**Pino's API signature** is:
```typescript
logger.error(obj, msg)  // Correct
```

But our implementation was calling it as:
```typescript
logger.error(msg, obj)  // Incorrect
```

This caused Pino to:
1. ✅ Write the message to the log
2. ❌ Ignore the structured data in the second parameter

The Pino logger signature is:
```typescript
logger.level(obj: object, msg?: string, ...args: any[]): void
```

The object with structured data MUST come first, message second.

## The Fix

**File**: `src/app/lib/tools/experience/experience.ts` (lines 667-700)

Changed from:
```typescript
logger.error(`Component validation failed: ${componentId}`, {
    errorCount: validationResult.errors.length,
    errors: [...]
});
```

To:
```typescript
logger.error({
    errorCount: validationResult.errors.length,
    errors: [...]
}, `Component validation failed: ${componentId}`);
```

## Result

Now when you look at the logs after a validation failure, you'll see:

```bash
cat storage/logs/app-2026-01-13.log | jq 'select(.msg | contains("validation failed"))'
```

**Before the fix** (missing structured data):
```json
{"level":"error","time":1768320904118,"env":"development","module":"experience-plugin","msg":"Component validation failed: linear-functions"}
```

**After the fix** (includes all error details):
```json
{"level":"error","time":1768320904118,"env":"development","module":"experience-plugin","errorCount":2,"warningCount":1,"errors":[{"category":"syntax","message":"Unbalanced braces: 45 opening, 44 closing","suggestion":"Check for missing or extra braces"},{"category":"import","message":"Cannot import 'three'...","suggestion":"Access via window..."}],"warnings":[...],"msg":"Component validation failed: linear-functions"}
```

Now you'll have complete visibility into what went wrong with each validation attempt!

## Summary

✅ **Fixed the Pino API call order** - structured data now appears in logs  
✅ **All tests pass** - no breaking changes  
✅ **Documentation updated** - reflects the correct behavior  

The next time the interface designer creates a component that fails validation, you'll see the full error details in `storage/logs/app-YYYY-MM-DD.log` with all the categories, messages, and suggestions!