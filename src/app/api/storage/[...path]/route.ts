import { NextRequest, NextResponse } from 'next/server';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import path from 'path';
import { getContentType } from '@/app/lib/mimeTypes';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('storage');

type Context = {
  params: Promise<{ path: string[] }>;
};

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    const { path: pathSegments } = await context.params;
    let filePath = pathSegments.join('/');
    
    // Normalize path to resolve any . or .. sequences
    filePath = path.normalize(filePath);
    
    // Prevent path traversal attacks - ensure path stays within storage root
    // Check for path traversal sequences (normalize may not catch all cases)
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      return NextResponse.json(
        { error: 'Invalid path: Path traversal detected' },
        { status: 400 }
      );
    }
    
    // Additional validation: ensure normalized path doesn't contain parent directory references
    // This catches cases where normalize() might have resolved but we still want to block
    const normalizedSegments = filePath.split(path.sep);
    if (normalizedSegments.some(segment => segment === '..' || segment === '.')) {
      return NextResponse.json(
        { error: 'Invalid path: Path traversal detected' },
        { status: 400 }
      );
    }
    
    // Remove leading slashes to ensure relative path
    filePath = filePath.replace(/^\/+/, '');
    
    const storage = StorageServiceFactory.getInstance();

    // Check if file exists
    const exists = await storage.fileExists(filePath);
    if (!exists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Get file stats (if available)
    const stats = await storage.getFileStats(filePath);
    const lastModified = stats?.mtime || new Date();
    const etag = `"${stats?.size}-${lastModified.getTime()}"`;

    // Check if-none-match header
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    // Check if-modified-since header
    const ifModifiedSince = request.headers.get('if-modified-since');
    if (ifModifiedSince && new Date(ifModifiedSince) >= lastModified) {
      return new NextResponse(null, { status: 304 });
    }

    // Read file
    const buffer = await storage.readFile(filePath);

    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = getContentType(ext);

    // Return file with appropriate headers
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        'ETag': etag,
        'Last-Modified': lastModified.toUTCString()
      },
    });
  } catch (error) {
    logger.error(error, 'Error serving file');
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
