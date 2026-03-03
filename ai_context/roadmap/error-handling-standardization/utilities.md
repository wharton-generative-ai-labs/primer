# Utility Functions

**Status:** To Be Implemented (Phase 1)

## Overview

This document defines the utility functions that will be created to support the standardized error handling pattern and reduce boilerplate.

---

## Error Response Utilities

### Location
`src/app/lib/api-utils/error-response.ts`

### Functions

#### `createErrorResponse()`

Creates a standardized error response with environment-aware error exposure.

```typescript
import { NextResponse } from 'next/server';
import { env } from '@/config/env';

interface ErrorResponseOptions {
  error: unknown;
  message?: string;
  status?: number;
  context?: Record<string, any>;
}

export function createErrorResponse(options: ErrorResponseOptions): NextResponse {
  const {
    error,
    message = 'Internal server error',
    status = 500,
    context = {}
  } = options;

  const isDevelopment = env.NODE_ENV === 'development';

  // Log error with context
  if (error instanceof Error) {
    logger.error(error, message, context);
  } else {
    logger.error({ err: error, ...context }, message);
  }

  // Build response
  const responseBody: { error: string; details?: string } = {
    error: isDevelopment && error instanceof Error
      ? error.message
      : message
  };

  if (isDevelopment && error instanceof Error) {
    responseBody.details = error.stack;
  }

  return NextResponse.json(responseBody, { status });
}
```

**Usage:**
```typescript
catch (error) {
  return createErrorResponse({
    error,
    message: 'Failed to create resource',
    context: {
      path: request.url,
      userEmail: token?.email,
      resourceId: validatedData.resourceId
    }
  });
}
```

---

#### `createValidationErrorResponse()`

Creates a standardized validation error response from Zod errors.

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';

export function createValidationErrorResponse(
  error: z.ZodError
): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation failed',
      details: error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    },
    { status: 400 }
  );
}
```

**Usage:**
```typescript
const validationResult = Schema.safeParse(body);

if (!validationResult.success) {
  return createValidationErrorResponse(validationResult.error);
}
```

---

#### `createRateLimitResponse()`

Creates a standardized rate limit response with appropriate headers.

```typescript
import { NextResponse } from 'next/server';
import { RateLimitResult } from '@/app/lib/rate-limit';

export function createRateLimitResponse(
  limitResult: RateLimitResult
): NextResponse {
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

**Usage:**
```typescript
const limitResult = rateLimit(identifier, rateLimitConfigs.api);

if (!limitResult.allowed) {
  return createRateLimitResponse(limitResult);
}
```

---

#### `createSimpleErrorResponse()`

Creates a simple error response for common cases (401, 403, 404).

```typescript
import { NextResponse } from 'next/server';

type ErrorType = 'unauthorized' | 'forbidden' | 'not-found' | 'bad-request';

const ERROR_MESSAGES: Record<ErrorType, { message: string; status: number }> = {
  'unauthorized': { message: 'Unauthorized', status: 401 },
  'forbidden': { message: 'Forbidden: Insufficient permissions', status: 403 },
  'not-found': { message: 'Resource not found', status: 404 },
  'bad-request': { message: 'Bad request', status: 400 }
};

export function createSimpleErrorResponse(
  type: ErrorType,
  customMessage?: string
): NextResponse {
  const { message, status } = ERROR_MESSAGES[type];
  
  return NextResponse.json(
    { error: customMessage || message },
    { status }
  );
}
```

**Usage:**
```typescript
if (!token?.email) {
  return createSimpleErrorResponse('unauthorized');
}

if (!hasPermission) {
  return createSimpleErrorResponse('forbidden', 'Not authorized to manage this resource');
}

if (!resource) {
  return createSimpleErrorResponse('not-found');
}
```

---

## Validation Utilities

### Location
`src/app/lib/api-utils/validation.ts`

### Common Schemas

```typescript
import { z } from 'zod';

// Common field schemas
export const schemas = {
  // IDs
  uuid: z.string().uuid('Invalid UUID format'),
  experienceId: z.string().min(1, 'Experience ID is required'),
  sessionId: z.string().min(1, 'Session ID is required'),
  classId: z.string().min(1, 'Class ID is required'),
  
  // User data
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  
  // Common types
  url: z.string().url('Invalid URL format'),
  positiveInt: z.number().int().positive('Must be a positive integer'),
  nonEmptyString: z.string().min(1, 'Field is required'),
  
  // Pagination
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20)
  }),
  
  // Metadata
  metadata: z.record(z.string(), z.any()).optional()
};
```

**Usage:**
```typescript
import { schemas } from '@/app/lib/api-utils/validation';

const CreateResourceSchema = z.object({
  experienceId: schemas.experienceId,
  name: schemas.name,
  email: schemas.email.optional(),
  metadata: schemas.metadata
});
```

---

### Validation Helper

```typescript
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createValidationErrorResponse } from './error-response';

export function validateRequest<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    return {
      success: false,
      response: createValidationErrorResponse(result.error)
    };
  }
  
  return {
    success: true,
    data: result.data
  };
}
```

**Usage:**
```typescript
const validation = validateRequest(CreateResourceSchema, body);

if (!validation.success) {
  return validation.response;
}

const validatedData = validation.data;
// Continue with validated data
```

---

## Authentication Utilities

### Location
`src/app/lib/api-utils/auth.ts`

### Functions

#### `requireAuth()`

Checks authentication and returns error response if not authenticated.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createSimpleErrorResponse } from './error-response';

export async function requireAuth(
  request: NextRequest
): Promise<{ success: true; email: string; token: any } | { success: false; response: NextResponse }> {
  const token = await getToken({ req: request });
  
  if (!token?.email) {
    return {
      success: false,
      response: createSimpleErrorResponse('unauthorized')
    };
  }
  
  return {
    success: true,
    email: token.email,
    token
  };
}
```

**Usage:**
```typescript
const auth = await requireAuth(request);

if (!auth.success) {
  return auth.response;
}

const userEmail = auth.email;
// Continue with authenticated user
```

---

#### `requirePermission()`

Checks both authentication and authorization.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Permission } from '@/config/auth';
import { hasMergedPermission } from '@/config/user-storage';
import { requireAuth } from './auth';
import { createSimpleErrorResponse } from './error-response';

export async function requirePermission(
  request: NextRequest,
  permission: Permission
): Promise<{ success: true; email: string; token: any } | { success: false; response: NextResponse }> {
  // First check authentication
  const auth = await requireAuth(request);
  
  if (!auth.success) {
    return auth;
  }
  
  // Then check permission
  if (!hasMergedPermission(auth.email, permission)) {
    return {
      success: false,
      response: createSimpleErrorResponse('forbidden')
    };
  }
  
  return auth;
}
```

**Usage:**
```typescript
const auth = await requirePermission(request, Permission.MANAGE_OWN_CLASSES);

if (!auth.success) {
  return auth.response;
}

// User is authenticated and has permission
```

---

## Rate Limiting Utilities

### Location
`src/app/lib/api-utils/rate-limit.ts`

### Functions

#### `checkRateLimit()`

Checks rate limit and returns error response if exceeded.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIdentifier, RateLimitConfig } from '@/app/lib/rate-limit';
import { createRateLimitResponse } from './error-response';

export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): { success: true } | { success: false; response: NextResponse } {
  const identifier = getClientIdentifier(request);
  const limitResult = rateLimit(identifier, config);
  
  if (!limitResult.allowed) {
    return {
      success: false,
      response: createRateLimitResponse(limitResult)
    };
  }
  
  return { success: true };
}
```

**Usage:**
```typescript
import { rateLimitConfigs } from '@/app/lib/rate-limit';

const rateCheck = checkRateLimit(request, rateLimitConfigs.api);

if (!rateCheck.success) {
  return rateCheck.response;
}

// Continue with request
```

---

## Complete Route Helper

### Location
`src/app/lib/api-utils/route-handler.ts`

### Function

Combines all checks into a single helper for maximum convenience.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Permission } from '@/config/auth';
import { RateLimitConfig } from '@/app/lib/rate-limit';
import { requireAuth, requirePermission } from './auth';
import { checkRateLimit } from './rate-limit';
import { validateRequest } from './validation';

interface RouteHandlerOptions<T extends z.ZodType> {
  requireAuth?: boolean;
  requirePermission?: Permission;
  rateLimit?: RateLimitConfig;
  schema?: T;
}

interface RouteHandlerContext<T extends z.ZodType> {
  request: NextRequest;
  userEmail?: string;
  token?: any;
  data?: z.infer<T>;
}

export async function createRouteHandler<T extends z.ZodType>(
  request: NextRequest,
  options: RouteHandlerOptions<T>,
  handler: (context: RouteHandlerContext<T>) => Promise<NextResponse>
): Promise<NextResponse> {
  const context: RouteHandlerContext<T> = { request };
  
  try {
    // 1. Authentication
    if (options.requireAuth || options.requirePermission) {
      const auth = options.requirePermission
        ? await requirePermission(request, options.requirePermission)
        : await requireAuth(request);
      
      if (!auth.success) {
        return auth.response;
      }
      
      context.userEmail = auth.email;
      context.token = auth.token;
    }
    
    // 2. Rate limiting
    if (options.rateLimit) {
      const rateCheck = checkRateLimit(request, options.rateLimit);
      
      if (!rateCheck.success) {
        return rateCheck.response;
      }
    }
    
    // 3. Validation
    if (options.schema) {
      const body = await request.json();
      const validation = validateRequest(options.schema, body);
      
      if (!validation.success) {
        return validation.response;
      }
      
      context.data = validation.data;
    }
    
    // 4. Call handler
    return await handler(context);
    
  } catch (error) {
    return createErrorResponse({
      error,
      context: {
        path: request.url,
        method: request.method,
        userEmail: context.userEmail
      }
    });
  }
}
```

**Usage:**
```typescript
import { createRouteHandler } from '@/app/lib/api-utils/route-handler';
import { rateLimitConfigs } from '@/app/lib/rate-limit';
import { Permission } from '@/config/auth';

const CreateResourceSchema = z.object({
  name: z.string().min(1),
  experienceId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  return createRouteHandler(
    request,
    {
      requirePermission: Permission.CREATE_EXPERIENCES,
      rateLimit: rateLimitConfigs.api,
      schema: CreateResourceSchema
    },
    async ({ data, userEmail }) => {
      // All checks passed, data is validated
      const result = await createResource(data.name, data.experienceId);
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }
  );
}
```

---

## Testing Utilities

### Location
`src/app/lib/api-utils/__tests__/test-utils.ts`

### Functions

```typescript
import { NextRequest } from 'next/server';

// Mock authenticated request
export function createMockAuthenticatedRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    email?: string;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  // Implementation
}

// Mock unauthenticated request
export function createMockUnauthenticatedRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  // Implementation
}

// Test error response structure
export function expectErrorResponse(
  response: NextResponse,
  expectedStatus: number,
  expectedErrorMessage?: string
): void {
  expect(response.status).toBe(expectedStatus);
  const data = await response.json();
  expect(data).toHaveProperty('error');
  
  if (expectedErrorMessage) {
    expect(data.error).toBe(expectedErrorMessage);
  }
}

// Test validation error response
export function expectValidationErrorResponse(
  response: NextResponse,
  expectedFields: string[]
): void {
  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toBe('Validation failed');
  expect(data.details).toBeDefined();
  
  const fields = data.details.map(d => d.field);
  expectedFields.forEach(field => {
    expect(fields).toContain(field);
  });
}
```

---

## Implementation Checklist

Phase 1 tasks for utility creation:

- [ ] Create `src/app/lib/api-utils/` directory
- [ ] Implement `error-response.ts`
  - [ ] `createErrorResponse()`
  - [ ] `createValidationErrorResponse()`
  - [ ] `createRateLimitResponse()`
  - [ ] `createSimpleErrorResponse()`
- [ ] Implement `validation.ts`
  - [ ] Common schemas
  - [ ] `validateRequest()`
- [ ] Implement `auth.ts`
  - [ ] `requireAuth()`
  - [ ] `requirePermission()`
- [ ] Implement `rate-limit.ts`
  - [ ] `checkRateLimit()`
- [ ] Implement `route-handler.ts`
  - [ ] `createRouteHandler()`
- [ ] Create tests for all utilities
- [ ] Update documentation
- [ ] Create example routes using utilities

---

## Benefits

Using these utilities provides:

1. **Reduced Boilerplate** - Less code per route
2. **Consistency** - All routes handle errors the same way
3. **Type Safety** - TypeScript ensures correct usage
4. **Testability** - Easier to test with helper functions
5. **Maintainability** - Changes in one place affect all routes
6. **Developer Experience** - Faster to write new routes

---

## References

- [Recommended Pattern](./recommended-pattern.md)
- [Migration Guide](./migration-guide.md)
- [Implementation Phases](./implementation-phases.md)
