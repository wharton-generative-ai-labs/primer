import { NextRequest, NextResponse } from 'next/server';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { getSessionUploadPath, getFileInfoUrl } from '@/app/lib/file-utils';
import { createSafeFilename } from '@/app/lib/artifact-utils';
import { getToken } from 'next-auth/jwt';
import { FILE_UPLOAD_LIMITS, SUPPORTED_MIME_TYPES } from '@/config/constants';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';
import { auditFileUpload } from '@/lib/audit-logger';

const logger = createModuleLogger('user-upload');

// Note: We now use the filename as the ID instead of generating a random UUID

export async function POST(request: NextRequest) {
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
    const contentType = request.headers.get('content-type') || '';
    
    // Ensure we have a file upload
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > FILE_UPLOAD_LIMITS.USER_UPLOAD_MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds size limit' }, { status: 400 });
    }

    // Validate file type
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Get the session-specific upload path
    const basePath = getSessionUploadPath(experienceId, sessionId);
    
    // Use original filename with sanitization and duplicate handling
    const originalName = path.parse(file.name).name; // Get name without extension
    const fileExt = path.extname(file.name);
    const safeBaseName = createSafeFilename(originalName);
    let fileName = `${safeBaseName}${fileExt}`;
    let counter = 1;
    
    // Check for duplicates and add counter if needed
    while (true) {
      const checkPath = path.join(basePath, fileName);
      const exists = await storage.fileExists(checkPath);
      if (!exists) {
        // File doesn't exist, we can use this filename
        break;
      }
      // File exists, increment counter and try again
      fileName = `${safeBaseName}_(${counter})${fileExt}`;
      counter++;
    }
    
    const filePath = path.join(basePath, fileName);
    
    // Ensure the directory exists
    await storage.createDirectory(basePath);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    await storage.storeFile(filePath, buffer);

    // Use the filename (without extension) as the ID
    const uploadId = path.parse(fileName).name;

    // Log audit event
    await auditFileUpload(token.email, request, {
      experienceId,
      sessionId,
      fileName,
      originalName: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadId,
    });

    // Return the file info endpoint URL
    const fileInfoUrl = getFileInfoUrl(fileName);
    
    return NextResponse.json({
      success: true,
      fileInfoUrl,
      uploadId,
      fileName: fileName, // Return the actual stored filename
      originalName: file.name, // Also include the original filename
      fileType: file.type,
      fileSize: file.size
    });

  } catch (error) {
    logger.error(error, 'Upload error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 