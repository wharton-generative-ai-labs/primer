import { NextRequest, NextResponse } from 'next/server';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { FileProcessor } from '@/app/lib/fileProcessing/FileProcessor';
import { getSessionUploadPath, assertSafeRelativePath } from '@/app/lib/file-utils';
import { getToken } from 'next-auth/jwt';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('file-info');

type Context = {
  params: Promise<{
    path: string[]
  }>
};

// This is needed to tell Next.js this is a dynamic route that should be built
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    // Get user email from session (still used for auth, but not for path generation)
    const token = await getToken({ req: request });
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get experience ID and session ID from headers
    const experienceId = request.headers.get('x-experience-id');
    const sessionId = request.headers.get('x-session-id');
    
    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const { path: pathSegments } = await context.params;
    // The route is intended for a single filename, not a nested path. Reject
    // multi-segment requests so that traversal attempts (`..`, encoded slashes)
    // can never reach the filesystem layer.
    if (pathSegments.length !== 1) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }
    const fileName = pathSegments[0];
    let basePath: string;
    let filePath: string;
    try {
      assertSafeRelativePath(fileName);
      basePath = getSessionUploadPath(experienceId, sessionId);
      filePath = path.join(basePath, fileName);
    } catch (validationError) {
      logger.warn({ err: validationError, experienceId, sessionId, fileName }, 'Rejected unsafe file-info request');
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }
    
    const storage = StorageServiceFactory.getInstance();

    // Check if file exists
    const exists = await storage.fileExists(filePath);
    if (!exists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Process the file
    const fileProcessor = new FileProcessor(storage);
    const analysis = await fileProcessor.processFile(filePath);

    // Return the analysis
    return NextResponse.json({
      success: true,
      filePath,
      ...analysis
    });

  } catch (error) {
    logger.error(error, 'Error processing file');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    );
  }
} 