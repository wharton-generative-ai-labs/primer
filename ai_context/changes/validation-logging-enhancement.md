# Validation Logging Enhancement

**Date**: 2026-01-13  
**Status**: ✅ Complete

## Problem

The interface designer was taking multiple attempts (6-7+) to create valid JSX components, indicating the validation routine was catching and helping resolve bugs. However, when validation failed, the server logs only showed:
- That validation failed
- The count of errors and warnings
- Whether external libraries were used

**Missing**: The actual error messages and suggestions that would help debug why validation failed.

## Solution

Enhanced the logging in the `validateComponent` tool to include full error and warning details when validation fails.

### Changes Made

**File**: `src/app/lib/tools/experience/experience.ts`

Modified the `validateComponent` function (lines 667-699) to:

1. **On validation success**:
   - Log success with warning count and library usage
   - If warnings exist, log them separately with full details (category, message, suggestion)

2. **On validation failure**:
   - Log error-level message with full context including:
     - Error count and warning count
     - Complete array of errors with: category, message, suggestion, line number
     - Complete array of warnings with: category, message, suggestion, line number

### Before

```typescript
logger.info(`Component validation ${validationResult.valid ? 'passed' : 'failed'}: ${componentId}`, {
  errors: validationResult.errors.length,
  warnings: validationResult.warnings.length,
  usesLibraries: validationResult.stats.usesExternalLibraries
});
```

**Log output on failure**:
```
[INFO] Component validation failed: game-of-life
  errors: 3
  warnings: 2
  usesLibraries: ["THREE"]
```

### After

```typescript
if (validationResult.valid) {
    logger.info(`Component validation passed: ${componentId}`, {
        warnings: validationResult.warnings.length,
        usesLibraries: validationResult.stats.usesExternalLibraries
    });
    
    // Log warnings if present
    if (validationResult.warnings.length > 0) {
        logger.warn(`Validation warnings for ${componentId}:`, {
            warnings: validationResult.warnings.map(w => ({
                category: w.category,
                message: w.message,
                suggestion: w.suggestion
            }))
        });
    }
} else {
    logger.error(`Component validation failed: ${componentId}`, {
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
        errors: validationResult.errors.map(e => ({
            category: e.category,
            message: e.message,
            suggestion: e.suggestion,
            line: e.line
        })),
        warnings: validationResult.warnings.map(w => ({
            category: w.category,
            message: w.message,
            suggestion: w.suggestion,
            line: w.line
        }))
    });
}
```

**Log output on failure** (JSON Lines format in file):
```json
{"level":"error","time":1768320904118,"env":"development","module":"experience-plugin","errorCount":3,"warningCount":2,"errors":[{"category":"import","message":"Cannot import 'three' - external libraries are pre-loaded and available on window","suggestion":"Access via window: if (!window.THREE) return; const THREE = window.THREE;"},{"category":"react-pattern","message":"Direct state mutation detected","suggestion":"Use setState instead: setState(prev => ({ ...prev, property: value }))"},{"category":"syntax","message":"Unbalanced braces: 45 opening, 44 closing","suggestion":"Check for missing or extra braces"}],"warnings":[{"category":"memory-leak","message":"requestAnimationFrame used without cleanup","suggestion":"Store animation ID in ref and cancel in useEffect cleanup: return () => cancelAnimationFrame(animationId.current);"},{"category":"library-check","message":"Using THREE without checking availability (libraries load asynchronously)","suggestion":"Add in useEffect: if (!window.THREE) return; const THREE = window.THREE;"}],"msg":"Component validation failed: game-of-life"}
```

**Pretty-printed for readability**:
```
[ERROR] Component validation failed: game-of-life
  errorCount: 3
  warningCount: 2
  errors: [
    {
      category: "import",
      message: "Cannot import 'three' - external libraries are pre-loaded and available on window",
      suggestion: "Access via window: if (!window.THREE) return; const THREE = window.THREE;"
    },
    {
      category: "react-pattern",
      message: "Direct state mutation detected",
      suggestion: "Use setState instead: setState(prev => ({ ...prev, property: value }))"
    },
    {
      category: "syntax",
      message: "Unbalanced braces: 45 opening, 44 closing",
      suggestion: "Check for missing or extra braces"
    }
  ]
  warnings: [
    {
      category: "memory-leak",
      message: "requestAnimationFrame used without cleanup",
      suggestion: "Store animation ID in ref and cancel in useEffect cleanup: return () => cancelAnimationFrame(animationId.current);"
    },
    {
      category: "library-check",
      message: "Using THREE without checking availability (libraries load asynchronously)",
      suggestion: "Add in useEffect: if (!window.THREE) return; const THREE = window.THREE;"
    }
  ]
```

## Benefits

1. **Faster debugging**: Developers can see exactly what validation errors occurred without needing to reproduce the issue
2. **Better understanding**: The full error messages and suggestions help understand patterns in validation failures
3. **Agent improvement**: The logged information can help improve the interface designer agent's prompts
4. **Structured logging**: Errors and warnings are logged as structured JSON for easy parsing and analysis

## Testing

- ✅ All existing tests pass (28/28 in `componentValidation.test.ts`)
- ✅ No linter errors
- ✅ TypeScript compilation succeeds for the modified code
- ✅ Logging uses pino's structured format for consistency

## Bug Fix (2026-01-13)

**Issue**: Structured error/warning data was not being written to log files. Log entries only showed the message without the detailed error information.

**Root Cause**: Pino's API expects `logger.error(object, message)` but we were calling it as `logger.error(message, object)`. This caused Pino to ignore the structured data in the second parameter.

**Fix**: Swapped the parameter order to match Pino's API:
```typescript
// Before (incorrect)
logger.error(`Component validation failed: ${componentId}`, { errors: [...] });

// After (correct)
logger.error({ errors: [...] }, `Component validation failed: ${componentId}`);
```

**Verification**: After the fix, log files now include the complete structured data as intended.

## Impact

- **Interface designer agent**: Will now have better visibility into validation failures
- **Development**: Easier to debug why components fail validation
- **Monitoring**: Can track common validation errors and improve agent instructions accordingly

## Related Files

- `src/app/lib/tools/experience/experience.ts` - Modified `validateComponent` function
- `src/app/lib/tools/experience/componentValidation.ts` - Underlying validation logic (unchanged)
- `storage/deckard/resources/instructions/agent/interface-designer.md` - Agent instructions that reference validation

## Next Steps

Consider:
1. Adding metrics/analytics for validation failure patterns
2. Creating a dashboard to visualize common validation errors
3. Using logged validation data to automatically suggest agent instruction improvements
