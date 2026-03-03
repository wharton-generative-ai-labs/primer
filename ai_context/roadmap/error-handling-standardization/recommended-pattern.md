# Recommended Error Handling Pattern

**Status:** Approved  
**Effective Date:** January 12, 2026

## Overview

This document defines the standardized error handling pattern that all API routes in Primer should follow.

## Core Principles

1. **Appropriate HTTP Status Codes** - Use the right status code for each error type
2. **Layered Validation** - Validate in a consistent order (auth → rate limit → input → authz → existence → business logic)
3. **Environment-Aware Error Exposure** - Detailed errors in dev, generic in production
4. **Consistent Error Response Structure** - Same shape across all routes
5. **Comprehensive Logging** - Always log unexpected errors with context

---

## The Standard Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { z } from 'zod';
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/app/lib/rate-limit';
import { createModuleLogger } from '@/lib/logger';
import { env } from '@/config/env';

const logger = createModuleLogger('route-name');

// 1. Define request validation schema (if needed)
const RequestSchema = z.object({
  param: z.string().min(1, 'Param is required'),
  optionalParam: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    // 2. Authentication check (401)
    const token = await getToken({ req: request });
    if (!token?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 3. Rate limiting check (429)
    const identifier = getClientIdentifier(request);
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

    // 4. Input validation (400)
    const body = await request.json();
    const validationResult = RequestSchema.safeParse(body);
    
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

    const validatedData = validationResult.data;

    // 5. Authorization check (403)
    const hasPermission = await checkPermission(token.email, validatedData.resourceId);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // 6. Resource existence check (404)
    const resource = await findResource(validatedData.resourceId);
    if (!resource) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }

    // 7. Business logic (may throw)
    const result = await performOperation(validatedData, resource);
    
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    // 8. Catch-all for unexpected errors (500)
    logger.error(error, 'Route error', {
      path: request.url,
      method: request.method,
      userEmail: token?.email
    });
    
    // Environment-aware error exposure
    const isDevelopment = env.NODE_ENV === 'development';
    
    return NextResponse.json(
      {
        error: isDevelopment && error instanceof Error
          ? error.message
          : 'Internal server error',
        ...(isDevelopment && error instanceof Error && { details: error.stack })
      },
      { status: 500 }
    );
  }
}
```

---

## HTTP Status Codes

### 400 - Bad Request
**Use for:** Validation errors, malformed input, invalid parameters

```typescript
// Zod validation failure
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

// Manual validation
if (!experienceId) {
  return NextResponse.json(
    { error: 'Experience ID is required' },
    { status: 400 }
  );
}
```

### 401 - Unauthorized
**Use for:** Missing or invalid authentication

```typescript
const token = await getToken({ req: request });
if (!token?.email) {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}
```

### 403 - Forbidden
**Use for:** Valid authentication but insufficient permissions

```typescript
const canManage = await canManageClasses(experienceId, userEmail);
if (!canManage) {
  return NextResponse.json(
    { error: 'Forbidden: Not authorized to manage classes' },
    { status: 403 }
  );
}
```

### 404 - Not Found
**Use for:** Resource doesn't exist

```typescript
const resource = await storage.fileExists(path);
if (!resource) {
  return NextResponse.json(
    { error: 'Resource not found' },
    { status: 404 }
  );
}
```

### 429 - Too Many Requests
**Use for:** Rate limiting

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

### 500 - Internal Server Error
**Use for:** Unexpected errors, exceptions

```typescript
catch (error) {
  logger.error(error, 'Unexpected error', { context });
  
  const isDevelopment = env.NODE_ENV === 'development';
  
  return NextResponse.json(
    {
      error: isDevelopment && error instanceof Error
        ? error.message
        : 'Internal server error',
      ...(isDevelopment && error instanceof Error && { details: error.stack })
    },
    { status: 500 }
  );
}
```

### 503 - Service Unavailable
**Use for:** Health checks only

```typescript
// Only in /api/health
return NextResponse.json(checks, {
  status: allHealthy ? 200 : 503
});
```

---

## Error Response Structures

### Simple Error (Most Cases)
```typescript
{
  error: string
}
```

**Example:**
```json
{
  "error": "Unauthorized"
}
```

### Validation Error (400 with Zod)
```typescript
{
  error: string,
  details: Array<{
    field: string,
    message: string
  }>
}
```

**Example:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "age",
      "message": "Must be at least 18"
    }
  ]
}
```

### Rate Limit Error (429)
```typescript
{
  error: string
}
// + headers
```

**Example:**
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2026-01-12T15:30:00.000Z
Retry-After: 900
```

### Development Error (500 in dev only)
```typescript
{
  error: string,
  details?: string  // stack trace
}
```

**Example:**
```json
{
  "error": "Cannot read property 'id' of undefined",
  "details": "TypeError: Cannot read property 'id' of undefined\n    at handler (/app/route.ts:45:20)\n    ..."
}
```

### Production Error (500 in production)
```typescript
{
  error: string
}
```

**Example:**
```json
{
  "error": "Internal server error"
}
```

---

## Validation Order

Always validate in this order to fail fast and provide clear error messages:

1. **Authentication** (401) - Is the user logged in?
2. **Rate Limiting** (429) - Has the user exceeded rate limits?
3. **Input Validation** (400) - Is the request data valid?
4. **Authorization** (403) - Does the user have permission?
5. **Resource Existence** (404) - Does the resource exist?
6. **Business Logic** (500 if throws) - Perform the operation

**Rationale:**
- Fail fast on authentication (no point validating if not logged in)
- Rate limiting before expensive validation operations
- Validate input before checking permissions (cheaper operation)
- Check permissions before loading resources (security first)
- Check existence before business logic (avoid unnecessary work)

---

## Zod Validation

### When to Use Zod

Use Zod schemas for:
- ✅ Complex request bodies with multiple fields
- ✅ Nested objects or arrays
- ✅ Type coercion needs (e.g., string to number)
- ✅ Custom validation logic
- ✅ Reusable validation schemas

Use manual validation for:
- ✅ Simple single-field checks (e.g., `if (!id)`)
- ✅ Header validation
- ✅ Query parameter validation (simple cases)

### Zod Schema Examples

**Simple Schema:**
```typescript
const CreateClassSchema = z.object({
  experienceId: z.string().min(1, 'Experience ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional()
});
```

**Complex Schema:**
```typescript
const AnalyticsRunSchema = z.object({
  experienceId: z.string().min(1),
  classId: z.string().min(1),
  agentKey: z.string().min(1),
  scope: z.enum(['student', 'class']),
  options: z.object({
    regenerate: z.boolean().optional(),
    sessionIds: z.array(z.string()).optional()
  }).optional()
});
```

**With Transform:**
```typescript
const UploadSchema = z.object({
  url: z.string().url('URL must be valid'),
  maxSize: z.string().transform(val => parseInt(val, 10))
});
```

---

## Logging Best Practices

### Always Log Unexpected Errors
```typescript
catch (error) {
  logger.error(error, 'Descriptive message', {
    // Include relevant context
    userId: token?.email,
    resourceId: validatedData.id,
    action: 'operation_name'
  });
  // ...
}
```

### Don't Log Expected Errors
```typescript
// ❌ Don't log validation errors (too noisy)
if (!validationResult.success) {
  // No logging needed
  return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
}

// ✅ Do log authorization failures (security monitoring)
if (!hasPermission) {
  logger.warn({ userId: token.email, resourceId }, 'Authorization denied');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Include Context
```typescript
logger.error(error, 'Failed to process upload', {
  experienceId,
  sessionId,
  fileSize: buffer.length,
  contentType: request.headers.get('content-type')
});
```

---

## Environment-Aware Error Exposure

### Development
- ✅ Expose error messages
- ✅ Include stack traces
- ✅ Provide detailed debugging info

```typescript
const isDevelopment = env.NODE_ENV === 'development';

return NextResponse.json(
  {
    error: isDevelopment && error instanceof Error
      ? error.message
      : 'Internal server error',
    ...(isDevelopment && error instanceof Error && { details: error.stack })
  },
  { status: 500 }
);
```

### Production
- ❌ Never expose error messages
- ❌ Never include stack traces
- ✅ Return generic error messages
- ✅ Log detailed errors server-side

```typescript
// Production response
{
  "error": "Internal server error"
}

// But server logs contain full details
logger.error(error, 'Full error details', { context });
```

---

## Special Cases

### Health Check Routes
Health checks should NOT use try-catch at the top level. Instead, catch errors inline:

```typescript
export async function GET() {
  const checks = { status: 'ok', timestamp: new Date().toISOString() };
  let allHealthy = true;

  // Check storage
  try {
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

### Streaming Responses
Routes that stream responses (e.g., SSE, file downloads) need special handling:

```typescript
try {
  const stream = await createStream();
  
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
} catch (error) {
  // Can't change headers after streaming starts
  logger.error(error, 'Stream creation failed');
  return NextResponse.json(
    { error: 'Failed to create stream' },
    { status: 500 }
  );
}
```

### Background Jobs
Routes that start background jobs should return success immediately:

```typescript
// Start job in background
runAnalytics(job, config).catch(error => {
  logger.error(error, `Job ${jobId} failed`);
  job.status = 'failed';
  job.error = error instanceof Error ? error.message : 'Unknown error';
});

// Return immediately
return NextResponse.json({
  success: true,
  jobId,
  status: 'pending'
});
```

---

## Complete Example

See [examples/complete-route.ts](./examples/complete-route.ts) for a fully annotated example route.

---

## Migration Checklist

When migrating a route to this pattern:

- [ ] Add Zod schema for complex request validation
- [ ] Add authentication check (if needed)
- [ ] Add rate limiting (if appropriate)
- [ ] Use appropriate HTTP status codes (400, 401, 403, 404, 429, 500)
- [ ] Add environment-aware error exposure
- [ ] Ensure consistent error response structure
- [ ] Add context to error logging
- [ ] Test error cases
- [ ] Update API documentation

---

## References

- [Migration Guide](./migration-guide.md)
- [Utility Functions](./utilities.md)
- [Implementation Phases](./implementation-phases.md)
