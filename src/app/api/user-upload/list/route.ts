import { NextRequest, NextResponse } from 'next/server';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { getSessionUploadPath, getFileInfoUrl } from '@/app/lib/file-utils';
import { getToken } from 'next-auth/jwt';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('user-upload-list');

export async function GET(request: NextRequest) {
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

    const storage = StorageServiceFactory.getInstance();
    const basePath = getSessionUploadPath(experienceId, sessionId);
    logger.debug({ basePath }, 'Listing files');
    // Check if directory exists
    const exists = await storage.fileExists(basePath);
    if (!exists) {
      return NextResponse.json([]);
    }

    const files = await storage.listFiles(basePath);

    // Get file info for each file
    const fileInfos = await Promise.all(
      files.map(async (filePath) => {
        const stats = await storage.getFileStats(filePath);
        if (!stats) return null;

        const fileName = path.basename(filePath);
        const uploadId = path.basename(filePath, path.extname(filePath));
        const fileInfoUrl = getFileInfoUrl(fileName);

        return {
          success: true,
          fileInfoUrl,
          uploadId,
          fileName,
          fileType: path.extname(filePath).slice(1), // Remove the dot
          fileSize: stats.size
        };
      })
    );

    // Filter out any null values from files that couldn't be processed
    const validFileInfos = fileInfos.filter((info): info is NonNullable<typeof info> => info !== null);

    return NextResponse.json(validFileInfos);
  } catch (error) {
    logger.error(error, 'Error listing files');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list files' },
      { status: 500 }
    );
  }
} 