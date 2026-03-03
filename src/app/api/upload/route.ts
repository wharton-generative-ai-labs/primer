import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { StorageService } from '@/app/lib/storage/StorageService';
import { generateExperienceId } from '@/app/lib/file-utils';
import { validateUrl } from '@/app/lib/security/url-validation';
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/app/lib/rate-limit';
import { FILE_UPLOAD_LIMITS } from '@/config/constants';
import { createModuleLogger } from '@/lib/logger';
import { auditExperienceUpload } from '@/lib/audit-logger';
import { extractZipToStorage } from '@/app/lib/modules/zip-utils';
import { getToken } from 'next-auth/jwt';
import { env } from '@/config/env';

const logger = createModuleLogger('upload');

const UploadUrlSchema = z.object({
  url: z.string().url('URL must be a valid URL').min(1, 'URL is required')
});

const createUploadId = async (storage: StorageService): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const uploadId = generateExperienceId();
    const exists = await storage.fileExists(`${uploadId}/experience.json`);
    
    if (!exists) {
      return uploadId;
    }
    attempts++;
  }
  throw new Error('Failed to generate unique upload ID');
};

async function processZipFile(zipBuffer: Buffer): Promise<string> {
  const storage = StorageServiceFactory.getInstance();
  const uploadId = await createUploadId(storage);
  return extractZipToStorage(zipBuffer, { targetId: uploadId });
}

async function processRemoteUrl(url: string): Promise<string> {
  // Validate URL format (must be http/https and end with .zip)
  if (!url.match(/^https?:\/\/.+\.zip$/i)) {
    throw new Error('URL must end with .zip');
  }

  // Validate URL to prevent SSRF attacks (blocks internal/private IPs)
  try {
    validateUrl(url);
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : 'Access denied'}`);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch Experience: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > FILE_UPLOAD_LIMITS.EXPERIENCE_MAX_SIZE) {
      throw new Error('Experience file exceeds size limit');
    }

    return processZipFile(buffer);
  } catch (error) {
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for uploads
    const identifier = getClientIdentifier(request);
    const limitResult = rateLimit(identifier, rateLimitConfigs.upload);
    
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

    // Get user email for audit logging
    const token = await getToken({ req: request });
    const userEmail = token?.email || 'anonymous';

    const contentType = request.headers.get('content-type') || '';
    let configPath: string;
    let uploadSource: 'url' | 'file';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      
      // Validate request body with Zod
      const validationResult = UploadUrlSchema.safeParse(body);
      
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validationResult.error.issues.map((e) => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        );
      }

      const { url } = validationResult.data;
      configPath = await processRemoteUrl(url);
      uploadSource = 'url';
    } else {
      const buffer = Buffer.from(await request.arrayBuffer());
      if (buffer.length > FILE_UPLOAD_LIMITS.EXPERIENCE_MAX_SIZE) {
        throw new Error('Experience file exceeds size limit');
      }
      configPath = await processZipFile(buffer);
      uploadSource = 'file';
    }

    // Extract experience ID from config path
    const experienceId = configPath.split('/').slice(-2, -1)[0] || 'unknown';

    // Log audit event
    await auditExperienceUpload(userEmail, request, {
      experienceId,
      configPath,
      source: uploadSource,
    });

    return NextResponse.json({
      success: true,
      configPath
    });

  } catch (error) {
    logger.error(error, 'Upload error');

    // Never expose stack traces to clients in production
    const isDevelopment = env.NODE_ENV === 'development';
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        // Only include stack trace in development for debugging
        ...(isDevelopment && error instanceof Error && { details: error.stack })
      },
      { status: 500 }
    );
  }
}