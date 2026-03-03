# Error Handling Pattern Analysis

**Date:** January 12, 2026  
**Routes Analyzed:** 40+ API routes in `src/app/api/`

## Current Patterns Identified

### Pattern 1: Basic Try-Catch with Generic 500 Error

**Prevalence:** ~40% of routes  
**Examples:** `/api/session/route.ts`, `/api/openai/text/route.ts`, `/api/session-init/route.ts`

```typescript
try {
  // ... business logic
  return NextResponse.json(data);
} catch (error) {
  logger.error(error, 'Error message');
  return NextResponse.json(
    { error: 'Generic error message' },
    { status: 500 }
  );
}
```

**Pros:**
- Simple and consistent
- Always logs errors
- Safe (doesn't leak internal details)

**Cons:**
- Loses error details for client
- Always returns 500, even for validation errors
- No distinction between error types

**Routes using this pattern:**
- `src/app/api/session/route.ts`
- `src/app/api/openai/text/route.ts`
- `src/app/api/session-init/route.ts`
- `src/app/api/storage/[...path]/route.ts`

---

### Pattern 2: Try-Catch with Conditional Error Message Exposure

**Prevalence:** ~30% of routes  
**Examples:** `/api/experience/route.ts`, `/api/artifacts/create/route.ts`, `/api/download/route.ts`

```typescript
try {
  // ... business logic
  return NextResponse.json(data);
} catch (error) {
  logger.error(error, 'Error message');
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Fallback message' },
    { status: 500 }
  );
}
```

**Pros:**
- Provides more context to client
- Still logs errors
- Type-safe error handling

**Cons:**
- May expose internal error details in production
- Still always returns 500
- Inconsistent about when to expose vs. hide errors

**Routes using this pattern:**
- `src/app/api/experience/route.ts`
- `src/app/api/artifacts/create/route.ts`
- `src/app/api/download/route.ts`
- `src/app/api/resources/route.ts`

---

### Pattern 3: Validation Before Try-Catch with Specific Status Codes

**Prevalence:** ~20% of routes  
**Examples:** `/api/classes/route.ts`, `/api/analytics/run/route.ts`, `/api/backend-agent/route.ts`

```typescript
try {
  // Early validation with specific status codes
  if (!param) {
    return NextResponse.json({ error: 'Param required' }, { status: 400 });
  }
  
  // Authorization checks
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Business logic that may throw
  const result = await someOperation();
  
  return NextResponse.json(result);
} catch (error) {
  logger.error(error, 'Error message');
  return NextResponse.json({ error: 'Generic message' }, { status: 500 });
}
```

**Pros:**
- Appropriate HTTP status codes
- Clear separation of validation vs. runtime errors
- Better client error handling

**Cons:**
- Verbose with many early returns
- Catch block still generic 500
- Validation logic mixed with business logic

**Routes using this pattern:**
- `src/app/api/classes/route.ts`
- `src/app/api/analytics/run/route.ts`
- `src/app/api/backend-agent/route.ts`
- `src/app/api/experiences/route.ts`

---

### Pattern 4: Zod Validation with Structured Error Responses

**Prevalence:** ~5% of routes (only 2 routes!)  
**Examples:** `/api/upload/route.ts`, `/api/proxy/route.ts`

```typescript
const Schema = z.object({
  url: z.string().url('URL must be valid')
});

try {
  const validationResult = Schema.safeParse(body);
  
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: validationResult.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      },
      { status: 400 }
    );
  }
  
  // Business logic
  return NextResponse.json(data);
} catch (error) {
  logger.error(error, 'Error message');
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Unknown error' },
    { status: 500 }
  );
}
```

**Pros:**
- Type-safe validation
- Structured error responses
- Clear field-level errors
- Appropriate status codes

**Cons:**
- More boilerplate
- Not consistently used across all routes
- Still exposes error messages in production

**Routes using this pattern:**
- `src/app/api/upload/route.ts` (also has dev/prod error switching!)
- `src/app/api/proxy/route.ts`

---

### Pattern 5: Special Cases

#### Health Check Pattern (`/api/health/route.ts`)
```typescript
export async function GET() {
  const checks = { status: 'ok', /* ... */ };
  let allHealthy = true;

  try {
    // Check storage
    await storage.listDirectories('');
    checks.storage = 'ok';
  } catch {
    checks.storage = 'error';
    allHealthy = false;
  }

  return NextResponse.json(checks, {
    status: allHealthy ? 200 : 503
  });
}
```

**Assessment:** ✅ Appropriate for health checks (shouldn't fail, returns 503 for unhealthy)

#### Rate Limiting Pattern (multiple routes)
```typescript
const limitResult = rateLimit(identifier, rateLimitConfigs.api);
if (!limitResult.allowed) {
  return NextResponse.json(
    { error: limitResult.message },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limitResult.max.toString(),
        'X-RateLimit-Remaining': limitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(limitResult.resetTime).toISOString(),
        'Retry-After': Math.ceil((limitResult.resetTime - Date.now()) / 1000).toString()
      }
    }
  );
}
```

**Assessment:** ✅ Good pattern, but not used everywhere (only ~5 routes)

---

## Detailed Inconsistencies

### 1. Error Message Exposure

| Route | Pattern | Production Safe? |
|-------|---------|------------------|
| `/api/session/route.ts` | Generic message | ✅ Yes |
| `/api/experience/route.ts` | Exposes `error.message` | ❌ No |
| `/api/upload/route.ts` | Dev/prod switching | ✅ Yes |
| `/api/backend-agent/route.ts` | Exposes `error.message` | ❌ No |
| `/api/classes/route.ts` | Generic message | ✅ Yes |
| `/api/proxy/route.ts` | Generic message | ✅ Yes |

**Finding:** Only 1 route (`/api/upload/route.ts`) has proper dev/prod error switching!

### 2. Status Code Usage

| Status Code | Usage | Routes |
|-------------|-------|--------|
| 400 (Bad Request) | ✅ Used | ~15 routes |
| 401 (Unauthorized) | ✅ Used | ~20 routes |
| 403 (Forbidden) | ✅ Used | ~8 routes |
| 404 (Not Found) | ✅ Used | ~10 routes |
| 429 (Rate Limited) | ⚠️ Partial | ~5 routes |
| 500 (Server Error) | ✅ Used | All routes |
| 503 (Unavailable) | ✅ Used | 1 route (health) |

**Finding:** Status codes are used appropriately where present, but many routes only return 500.

### 3. Validation Approaches

| Approach | Routes | Examples |
|----------|--------|----------|
| Manual `if` checks | ~30 routes | Most routes |
| Zod schemas | 2 routes | `/api/upload`, `/api/proxy` |
| No validation | ~8 routes | Some GET endpoints |

**Finding:** Zod validation is barely used despite being available and superior.

### 4. Error Response Structures

| Structure | Routes | Example |
|-----------|--------|---------|
| `{ error: string }` | ~35 routes | Most routes |
| `{ error: string, details: any }` | 2 routes | `/api/upload`, `/api/proxy` |
| `{ error: string, details?: string }` | 1 route | `/api/upload` (dev only) |
| `{ success: false, error: string }` | 1 route | `/api/backend-agent` |

**Finding:** Mostly consistent, but some variation exists.

### 5. Logging Patterns

| Pattern | Routes | Example |
|---------|--------|---------|
| `logger.error(error, 'Message')` | ~35 routes | Standard |
| `logger.error(error, 'Message', context)` | ~5 routes | Better |
| `logger.error({ err: error }, 'Message')` | ~3 routes | Pino style |
| No logging | 1 route | `/api/health` |

**Finding:** Mostly consistent, but context logging could be more widespread.

---

## Routes by Pattern

### Pattern 1 (Basic Try-Catch, Generic 500)
- `src/app/api/session/route.ts`
- `src/app/api/openai/text/route.ts`
- `src/app/api/openai/vision/route.ts`
- `src/app/api/session-init/route.ts`
- `src/app/api/storage/[...path]/route.ts`
- `src/app/api/session-events/route.ts`
- `src/app/api/session-metadata/route.ts`
- `src/app/api/artifacts/list/route.ts`
- `src/app/api/artifacts/[id]/route.ts`
- `src/app/api/user-upload/route.ts`
- `src/app/api/user-upload/list/route.ts`
- `src/app/api/file-info/[...path]/route.ts`
- `src/app/api/download-session-data/route.ts`
- `src/app/api/save-resource/route.ts`
- `src/app/api/resource-content/route.ts`

### Pattern 2 (Conditional Error Exposure)
- `src/app/api/experience/route.ts`
- `src/app/api/artifacts/create/route.ts`
- `src/app/api/artifacts/[id]/update/route.ts`
- `src/app/api/download/route.ts`
- `src/app/api/resources/route.ts`
- `src/app/api/experiences/[id]/route.ts`
- `src/app/api/experiences/[id]/readme/route.ts`
- `src/app/api/experiences/[id]/components/[componentId]/route.ts`
- `src/app/api/openai/generate-image/route.ts`
- `src/app/api/openai/websearch/route.ts`
- `src/app/api/openai/multi/route.ts`

### Pattern 3 (Validation + Status Codes)
- `src/app/api/classes/route.ts`
- `src/app/api/classes/[classId]/route.ts`
- `src/app/api/classes/check-access/route.ts`
- `src/app/api/analytics/run/route.ts`
- `src/app/api/analytics/sessions-index/route.ts`
- `src/app/api/backend-agent/route.ts`
- `src/app/api/experiences/route.ts`
- `src/app/api/sessions/user/route.ts`
- `src/app/api/admin/users/route.ts`

### Pattern 4 (Zod Validation)
- `src/app/api/upload/route.ts` ⭐ (also has dev/prod switching)
- `src/app/api/proxy/route.ts`

### Pattern 5 (Special Cases)
- `src/app/api/health/route.ts` (health check pattern)
- `src/app/api/resources/tools/route.ts` (tool discovery)

---

## Key Findings Summary

1. **Most routes (70%) use basic error handling** with only 500 status codes
2. **Only 2 routes use Zod validation** despite it being available
3. **Only 1 route has dev/prod error switching** (`/api/upload/route.ts`)
4. **Rate limiting is inconsistently applied** (only ~5 routes)
5. **Error response structure is mostly consistent** but has variations
6. **Logging is mostly consistent** but could include more context
7. **Status codes are used appropriately** where present, but not everywhere

## Recommendations

See [recommended-pattern.md](./recommended-pattern.md) for the standardized pattern to adopt.
