# Migration Guide

**Audience:** Developers migrating routes to the standardized error handling pattern

## Overview

This guide provides step-by-step instructions for migrating an API route to the standardized error handling pattern.

---

## Before You Start

### Prerequisites
- [ ] Read [recommended-pattern.md](./recommended-pattern.md)
- [ ] Review [utilities.md](./utilities.md)
- [ ] Understand the route you're migrating
- [ ] Have tests ready (or plan to add them)

### Tools Needed
- Zod (already installed)
- Utility functions (see Phase 1 of implementation)
- Logger (already available)

---

## Migration Steps

### Step 1: Analyze Current Error Handling

**Time:** 15-30 minutes

1. **Identify current pattern:**
   - What status codes are used?
   - How are errors logged?
   - What error response structure is used?
   - Are there validation checks?

2. **List all error scenarios:**
   - Authentication failures
   - Validation errors
   - Authorization failures
   - Resource not found
   - Rate limiting (if applicable)
   - Unexpected errors

3. **Check for special cases:**
   - Streaming responses
   - Background jobs
   - Health checks
   - File uploads/downloads

**Example Analysis:**

```typescript
// Current: src/app/api/example/route.ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Manual validation
    if (!body.id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }
    
    // Business logic
    const result = await doSomething(body.id);
    return NextResponse.json(result);
    
  } catch (error) {
    logger.error(error, 'Error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**Analysis:**
- ✅ Has 400 for validation
- ❌ No authentication check
- ❌ No rate limiting
- ❌ Manual validation (should use Zod)
- ❌ Generic error message
- ❌ No environment-aware error exposure

---

### Step 2: Create Validation Schema (if needed)

**Time:** 10-20 minutes

If the route has complex input validation, create a Zod schema:

```typescript
import { z } from 'zod';

// Define schema at top of file
const RequestSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format').optional(),
  metadata: z.record(z.string()).optional()
});

// Type inference
type RequestBody = z.infer<typeof RequestSchema>;
```

**When to skip Zod:**
- Simple single-field validation (e.g., just checking `if (!id)`)
- Header or query parameter validation (use manual checks)

---

### Step 3: Add Authentication Check

**Time:** 5 minutes

Add authentication check at the top of the try block:

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const token = await getToken({ req: request });
    if (!token?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // ... rest of route
```

**Skip if:**
- Route is public (e.g., health check)
- Route has custom authentication (document why)

---

### Step 4: Add Rate Limiting (if appropriate)

**Time:** 5-10 minutes

Add rate limiting for expensive operations:

```typescript
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/app/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    // ...
    
    // 2. Rate limiting
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
```

**Rate limit configs:**
- `rateLimitConfigs.api` - Standard API calls (100/15min)
- `rateLimitConfigs.upload` - File uploads (10/hour)
- `rateLimitConfigs.auth` - Authentication (5/15min)
- `rateLimitConfigs.strict` - Expensive operations (20/15min)

**Apply rate limiting to:**
- File uploads
- AI API calls (backend-agent, OpenAI routes)
- Expensive operations (analytics, bulk operations)

**Skip for:**
- Simple GET requests
- Health checks
- Session initialization

---

### Step 5: Add Input Validation

**Time:** 10-15 minutes

Replace manual validation with Zod schema validation:

**Before:**
```typescript
const body = await request.json();

if (!body.id) {
  return NextResponse.json({ error: 'ID required' }, { status: 400 });
}

if (!body.name) {
  return NextResponse.json({ error: 'Name required' }, { status: 400 });
}
```

**After:**
```typescript
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
// Use validatedData instead of body from here on
```

---

### Step 6: Add Authorization Check (if needed)

**Time:** 5-10 minutes

Add authorization checks after validation:

```typescript
// Check if user has permission
const hasPermission = await canManageResource(token.email, validatedData.resourceId);
if (!hasPermission) {
  return NextResponse.json(
    { error: 'Forbidden: Insufficient permissions' },
    { status: 403 }
  );
}
```

**Common authorization patterns:**
- Experience ownership: `isExperienceOwner(experienceId, userEmail)`
- Class management: `canManageClasses(experienceId, userEmail)`
- Permission checks: `hasMergedPermission(userEmail, Permission.ADMIN_USERS)`

---

### Step 7: Add Resource Existence Check (if needed)

**Time:** 5 minutes

Check if resources exist before operating on them:

```typescript
const resource = await storage.fileExists(path);
if (!resource) {
  return NextResponse.json(
    { error: 'Resource not found' },
    { status: 404 }
  );
}
```

---

### Step 8: Update Error Handling in Catch Block

**Time:** 10 minutes

Update the catch block to use environment-aware error exposure:

**Before:**
```typescript
catch (error) {
  logger.error(error, 'Error');
  return NextResponse.json({ error: 'Failed' }, { status: 500 });
}
```

**After:**
```typescript
catch (error) {
  logger.error(error, 'Route error', {
    path: request.url,
    method: request.method,
    userEmail: token?.email,
    // Add relevant context
    resourceId: validatedData?.resourceId
  });
  
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

---

### Step 9: Update Tests

**Time:** 20-30 minutes

Update or add tests for all error scenarios:

```typescript
describe('POST /api/example', () => {
  it('returns 401 when not authenticated', async () => {
    const response = await POST(mockRequest);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 for invalid input', async () => {
    const response = await POST(mockRequestWithInvalidData);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
    expect(data.details).toHaveLength(1);
  });

  it('returns 403 when user lacks permission', async () => {
    const response = await POST(mockRequestWithoutPermission);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Forbidden');
  });

  it('returns 404 when resource not found', async () => {
    const response = await POST(mockRequestWithNonexistentResource);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Resource not found');
  });

  it('returns 429 when rate limited', async () => {
    // Make many requests to trigger rate limit
    const response = await POST(mockRequest);
    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
  });

  it('returns 500 for unexpected errors', async () => {
    // Mock an error in business logic
    const response = await POST(mockRequest);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error'); // in production
  });
});
```

---

### Step 10: Review and Test

**Time:** 15-30 minutes

1. **Self-review checklist:**
   - [ ] Authentication check (if needed)
   - [ ] Rate limiting (if appropriate)
   - [ ] Input validation (Zod for complex, manual for simple)
   - [ ] Authorization check (if needed)
   - [ ] Resource existence check (if needed)
   - [ ] Environment-aware error exposure
   - [ ] Consistent error response structure
   - [ ] Context in error logging
   - [ ] All tests pass
   - [ ] No console.log statements

2. **Manual testing:**
   - Test each error scenario
   - Verify status codes
   - Check error response structure
   - Test in both dev and production mode

3. **Code review:**
   - Submit PR with migration checklist
   - Address reviewer feedback

---

## Complete Example: Before and After

### Before

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('example');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.experienceId) {
      return NextResponse.json({ error: 'Experience ID required' }, { status: 400 });
    }
    
    if (!body.name) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }
    
    const result = await createResource(body.experienceId, body.name);
    
    return NextResponse.json({ success: true, data: result });
    
  } catch (error) {
    logger.error(error, 'Error creating resource');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create resource' },
      { status: 500 }
    );
  }
}
```

### After

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { z } from 'zod';
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/app/lib/rate-limit';
import { createModuleLogger } from '@/lib/logger';
import { env } from '@/config/env';
import { canManageExperience } from '@/app/lib/permissions';

const logger = createModuleLogger('example');

// Validation schema
const CreateResourceSchema = z.object({
  experienceId: z.string().min(1, 'Experience ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const token = await getToken({ req: request });
    if (!token?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Rate limiting
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

    // 3. Input validation
    const body = await request.json();
    const validationResult = CreateResourceSchema.safeParse(body);
    
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

    // 4. Authorization
    const hasPermission = await canManageExperience(token.email, validatedData.experienceId);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to manage this experience' },
        { status: 403 }
      );
    }

    // 5. Business logic
    const result = await createResource(
      validatedData.experienceId,
      validatedData.name,
      validatedData.description
    );
    
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    // 6. Error handling
    logger.error(error, 'Error creating resource', {
      path: request.url,
      method: request.method,
      userEmail: token?.email
    });
    
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

## Common Pitfalls

### 1. Forgetting to Use Validated Data

❌ **Wrong:**
```typescript
const validationResult = Schema.safeParse(body);
if (!validationResult.success) { /* ... */ }

// Still using body instead of validatedData!
const result = await doSomething(body.id);
```

✅ **Correct:**
```typescript
const validationResult = Schema.safeParse(body);
if (!validationResult.success) { /* ... */ }

const validatedData = validationResult.data;
const result = await doSomething(validatedData.id);
```

### 2. Wrong Validation Order

❌ **Wrong:**
```typescript
// Checking permissions before validating input
const hasPermission = await checkPermission(body.resourceId);
// What if body.resourceId is undefined?
```

✅ **Correct:**
```typescript
// Validate input first
const validatedData = validateInput(body);
// Then check permissions
const hasPermission = await checkPermission(validatedData.resourceId);
```

### 3. Exposing Errors in Production

❌ **Wrong:**
```typescript
catch (error) {
  return NextResponse.json(
    { error: error.message }, // Always exposes internal errors!
    { status: 500 }
  );
}
```

✅ **Correct:**
```typescript
catch (error) {
  const isDevelopment = env.NODE_ENV === 'development';
  return NextResponse.json(
    {
      error: isDevelopment && error instanceof Error
        ? error.message
        : 'Internal server error'
    },
    { status: 500 }
  );
}
```

### 4. Forgetting to Log Errors

❌ **Wrong:**
```typescript
catch (error) {
  // No logging!
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

✅ **Correct:**
```typescript
catch (error) {
  logger.error(error, 'Descriptive message', { context });
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

### 5. Using Wrong Status Codes

❌ **Wrong:**
```typescript
if (!token) {
  return NextResponse.json({ error: 'Not logged in' }, { status: 403 }); // Should be 401
}

if (!hasPermission) {
  return NextResponse.json({ error: 'Not allowed' }, { status: 401 }); // Should be 403
}
```

✅ **Correct:**
```typescript
if (!token) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

if (!hasPermission) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## Quick Reference

### Status Code Cheat Sheet

| Code | Use Case | Example |
|------|----------|---------|
| 400 | Bad input | Validation failed, missing required field |
| 401 | Not authenticated | No token, invalid token |
| 403 | Not authorized | Valid token but insufficient permissions |
| 404 | Not found | Resource doesn't exist |
| 429 | Rate limited | Too many requests |
| 500 | Server error | Unexpected exception |
| 503 | Unavailable | Health check failed |

### Validation Order

1. Authentication (401)
2. Rate limiting (429)
3. Input validation (400)
4. Authorization (403)
5. Resource existence (404)
6. Business logic (500 if throws)

---

## Getting Help

- Review [recommended-pattern.md](./recommended-pattern.md)
- Check [examples/](./examples/) for complete examples
- Ask in team chat
- Review existing migrated routes

---

## Checklist Template

Copy this checklist for each route migration:

```markdown
## Route: /api/[route-name]

- [ ] Analyzed current error handling
- [ ] Created Zod schema (if needed)
- [ ] Added authentication check
- [ ] Added rate limiting (if appropriate)
- [ ] Added input validation
- [ ] Added authorization check (if needed)
- [ ] Added resource existence check (if needed)
- [ ] Updated catch block with environment-aware errors
- [ ] Added context to logging
- [ ] Updated/added tests
- [ ] Manual testing complete
- [ ] Code review requested
- [ ] Documentation updated
```
