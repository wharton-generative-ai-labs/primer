/**
 * Complete Example: Standardized Error Handling Pattern
 * 
 * This is a fully annotated example showing the recommended error handling
 * pattern for API routes in Primer.
 * 
 * Route: POST /api/resources/create
 * Purpose: Create a new resource for an experience
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { z } from 'zod';
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/app/lib/rate-limit';
import { createModuleLogger } from '@/lib/logger';
import { env } from '@/config/env';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { hasMergedPermission } from '@/config/user-storage';
import { Permission } from '@/config/auth';

const logger = createModuleLogger('resources-create');

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

/**
 * Define Zod schema for request validation.
 * This provides type safety and runtime validation.
 */
const CreateResourceSchema = z.object({
  experienceId: z.string().min(1, 'Experience ID is required'),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  type: z.enum(['document', 'image', 'video', 'audio'], {
    errorMap: () => ({ message: 'Type must be one of: document, image, video, audio' })
  }),
  metadata: z.record(z.string(), z.any()).optional()
});

// Type inference from schema
type CreateResourceRequest = z.infer<typeof CreateResourceSchema>;

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATION CHECK (401)
    // ========================================================================
    // Check if user is logged in
    // Returns 401 if not authenticated
    
    const token = await getToken({ req: request });
    if (!token?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.debug({ userEmail: token.email }, 'Authenticated request');

    // ========================================================================
    // 2. RATE LIMITING CHECK (429)
    // ========================================================================
    // Prevent abuse by limiting request rate
    // Returns 429 with rate limit headers if exceeded
    
    const identifier = getClientIdentifier(request);
    const limitResult = rateLimit(identifier, rateLimitConfigs.api);
    
    if (!limitResult.allowed) {
      logger.warn({ identifier, userEmail: token.email }, 'Rate limit exceeded');
      
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

    // ========================================================================
    // 3. INPUT VALIDATION (400)
    // ========================================================================
    // Validate request body against schema
    // Returns 400 with detailed validation errors if invalid
    
    const body = await request.json();
    const validationResult = CreateResourceSchema.safeParse(body);
    
    if (!validationResult.success) {
      logger.debug({ errors: validationResult.error.issues }, 'Validation failed');
      
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

    // Use validated data from here on (type-safe!)
    const validatedData: CreateResourceRequest = validationResult.data;

    logger.debug({
      experienceId: validatedData.experienceId,
      name: validatedData.name,
      type: validatedData.type
    }, 'Request validated');

    // ========================================================================
    // 4. AUTHORIZATION CHECK (403)
    // ========================================================================
    // Check if user has permission to perform this action
    // Returns 403 if user lacks required permissions
    
    // Check if user has permission to create resources
    const hasCreatePermission = hasMergedPermission(token.email, Permission.CREATE_EXPERIENCES);
    
    if (!hasCreatePermission) {
      logger.warn({
        userEmail: token.email,
        experienceId: validatedData.experienceId
      }, 'Authorization denied: insufficient permissions');
      
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to create resources' },
        { status: 403 }
      );
    }

    // ========================================================================
    // 5. RESOURCE EXISTENCE CHECK (404)
    // ========================================================================
    // Verify that referenced resources exist
    // Returns 404 if resource not found
    
    const storage = StorageServiceFactory.getInstance();
    const experiencePath = `${validatedData.experienceId}/experience.json`;
    const experienceExists = await storage.fileExists(experiencePath);
    
    if (!experienceExists) {
      logger.debug({ experienceId: validatedData.experienceId }, 'Experience not found');
      
      return NextResponse.json(
        { error: 'Experience not found' },
        { status: 404 }
      );
    }

    // Load experience config to verify ownership
    const experienceConfig = JSON.parse(
      (await storage.readFile(experiencePath)).toString()
    );

    // Additional authorization: check if user owns the experience
    if (experienceConfig.authorEmail !== token.email) {
      // User is authenticated and has CREATE_EXPERIENCES permission,
      // but doesn't own this specific experience
      logger.warn({
        userEmail: token.email,
        experienceAuthor: experienceConfig.authorEmail,
        experienceId: validatedData.experienceId
      }, 'Authorization denied: not experience owner');
      
      return NextResponse.json(
        { error: 'Forbidden: Not authorized to modify this experience' },
        { status: 403 }
      );
    }

    // ========================================================================
    // 6. BUSINESS LOGIC
    // ========================================================================
    // Perform the actual operation
    // Any errors thrown here will be caught by the catch block
    
    logger.info({
      userEmail: token.email,
      experienceId: validatedData.experienceId,
      resourceName: validatedData.name,
      resourceType: validatedData.type
    }, 'Creating resource');

    // Create the resource
    const resourceId = `resource-${Date.now()}`;
    const resourcePath = `${validatedData.experienceId}/resources/${resourceId}.json`;
    
    const resource = {
      id: resourceId,
      name: validatedData.name,
      description: validatedData.description,
      type: validatedData.type,
      metadata: validatedData.metadata,
      createdBy: token.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await storage.storeFile(
      resourcePath,
      Buffer.from(JSON.stringify(resource, null, 2))
    );

    logger.info({
      resourceId,
      experienceId: validatedData.experienceId
    }, 'Resource created successfully');

    // ========================================================================
    // 7. SUCCESS RESPONSE
    // ========================================================================
    // Return success with created resource data
    
    return NextResponse.json({
      success: true,
      data: resource
    }, {
      status: 201 // 201 Created for successful resource creation
    });

  } catch (error) {
    // ========================================================================
    // 8. ERROR HANDLING (500)
    // ========================================================================
    // Catch-all for unexpected errors
    // Logs detailed error server-side
    // Returns generic error in production, detailed in development
    
    logger.error(error, 'Unexpected error creating resource', {
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
        // Include stack trace only in development
        ...(isDevelopment && error instanceof Error && { details: error.stack })
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// ALTERNATIVE: Using Utility Functions (Phase 1+)
// ============================================================================

/**
 * After Phase 1 utilities are implemented, the route can be simplified:
 */

/*
import { createRouteHandler } from '@/app/lib/api-utils/route-handler';
import { rateLimitConfigs } from '@/app/lib/rate-limit';
import { Permission } from '@/config/auth';

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
      const storage = StorageServiceFactory.getInstance();
      
      // Check experience exists and user owns it
      const experiencePath = `${data.experienceId}/experience.json`;
      const experienceExists = await storage.fileExists(experiencePath);
      
      if (!experienceExists) {
        return createSimpleErrorResponse('not-found', 'Experience not found');
      }
      
      const experienceConfig = JSON.parse(
        (await storage.readFile(experiencePath)).toString()
      );
      
      if (experienceConfig.authorEmail !== userEmail) {
        return createSimpleErrorResponse('forbidden', 'Not authorized to modify this experience');
      }
      
      // Create resource
      const resource = await createResource(data, userEmail);
      
      return NextResponse.json({
        success: true,
        data: resource
      }, { status: 201 });
    }
  );
}
*/

// ============================================================================
// TESTING EXAMPLE
// ============================================================================

/**
 * Example tests for this route:
 */

/*
describe('POST /api/resources/create', () => {
  it('returns 401 when not authenticated', async () => {
    const request = createMockUnauthenticatedRequest('/api/resources/create', {
      method: 'POST',
      body: { experienceId: 'exp-1', name: 'Test', type: 'document' }
    });
    
    const response = await POST(request);
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid input', async () => {
    const request = createMockAuthenticatedRequest('/api/resources/create', {
      method: 'POST',
      body: { experienceId: 'exp-1' } // missing required fields
    });
    
    const response = await POST(request);
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
    expect(data.details).toHaveLength(2); // name and type missing
  });

  it('returns 403 when user lacks permission', async () => {
    const request = createMockAuthenticatedRequest('/api/resources/create', {
      method: 'POST',
      body: { experienceId: 'exp-1', name: 'Test', type: 'document' },
      email: 'user-without-permission@example.com'
    });
    
    const response = await POST(request);
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Forbidden');
  });

  it('returns 404 when experience not found', async () => {
    const request = createMockAuthenticatedRequest('/api/resources/create', {
      method: 'POST',
      body: { experienceId: 'nonexistent', name: 'Test', type: 'document' }
    });
    
    const response = await POST(request);
    
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Experience not found');
  });

  it('returns 403 when user is not experience owner', async () => {
    const request = createMockAuthenticatedRequest('/api/resources/create', {
      method: 'POST',
      body: { experienceId: 'exp-1', name: 'Test', type: 'document' },
      email: 'not-owner@example.com'
    });
    
    const response = await POST(request);
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Not authorized to modify this experience');
  });

  it('creates resource successfully', async () => {
    const request = createMockAuthenticatedRequest('/api/resources/create', {
      method: 'POST',
      body: {
        experienceId: 'exp-1',
        name: 'Test Resource',
        description: 'A test resource',
        type: 'document',
        metadata: { key: 'value' }
      }
    });
    
    const response = await POST(request);
    
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.name).toBe('Test Resource');
    expect(data.data.type).toBe('document');
  });

  it('returns 429 when rate limited', async () => {
    // Make many requests to trigger rate limit
    const requests = Array(101).fill(null).map(() =>
      createMockAuthenticatedRequest('/api/resources/create', {
        method: 'POST',
        body: { experienceId: 'exp-1', name: 'Test', type: 'document' }
      })
    );
    
    for (const request of requests.slice(0, 100)) {
      await POST(request);
    }
    
    const response = await POST(requests[100]);
    
    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(response.headers.get('Retry-After')).toBeDefined();
  });
});
*/
