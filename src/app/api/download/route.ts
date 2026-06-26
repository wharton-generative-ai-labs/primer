import { NextRequest, NextResponse } from 'next/server';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import archiver from 'archiver';
import { createModuleLogger } from '@/lib/logger';
import { assertSafeExperienceId } from '@/app/lib/file-utils';

const logger = createModuleLogger('download');
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const start = new Date();
    const experienceId = request.nextUrl.searchParams.get('experienceId');
    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    try {
      assertSafeExperienceId(experienceId);
    } catch (validationError) {
      logger.warn({ err: validationError, experienceId }, 'Rejected unsafe download request');
      return NextResponse.json({ error: 'Invalid experience ID' }, { status: 400 });
    }
    logger.debug({ experienceId }, 'Download request');

    const storage = StorageServiceFactory.getInstance();

    // Read experience.json to get metadata
    const configPath = `${experienceId}/experience.json`;
    const configContent = await storage.readFile(configPath);
    const config = JSON.parse(configContent.toString());

    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression for files that need it
    });

    // Create a buffer to store the zip file
    const chunks: Buffer[] = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => {
      logger.debug('Archive completed');
    });

    // Handle archive errors
    archive.on('error', (err) => {
      logger.error(err, 'Archive error');
    });

    // Add all files from the experience directory
    const files = await storage.listFiles(experienceId);

    // List of extensions for files that should be stored without compression
    const noCompressionExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp',  // Images
      '.mp3', '.mp4', '.ogg', '.wav', '.flac',          // Audio/Video
      '.zip', '.rar', '.7z', '.gz', '.bz2',             // Archives
      '.pdf'                                            // PDFs
    ];

    for (const file of files) {
      try {
        // Skip .DS_Store files
        if (file.endsWith('.DS_Store')) {
          continue;
        }

        const relativePath = file.replace(`${experienceId}/`, '');
        
        // Skip session_data folder
        if (relativePath.startsWith('session_data/')) {
          continue;
        }

        const content = await storage.readFile(file);
        const extension = path.extname(file).toLowerCase();

        // Get file stats to preserve timestamps
        const stats = await storage.getFileStats(file);

        // Options for the file
        const fileOptions = stats
          ? { name: relativePath, date: stats.mtime }
          : { name: relativePath };

        // If the file has an extension that shouldn't be compressed, use store method
        if (noCompressionExtensions.includes(extension)) {
          archive.append(content, {
            ...fileOptions,
            store: true
          });
        } else {
          archive.append(content, fileOptions);
        }
      } catch (fileError) {
        logger.error({ err: fileError, file }, 'Error processing file');
        // Continue with other files even if one fails
      }
    }

    // Finalize the archive
    try {
      await archive.finalize();
      logger.debug('Archive finalized');
    } catch (finalizeError) {
      logger.error(finalizeError, 'Error finalizing archive');
      throw finalizeError;
    }

    const end = new Date();
    const duration = end.getTime() - start.getTime();
    logger.debug({ duration }, 'ZIP operation completed');

    // Generate filename from metadata
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month (01-12)
    const day = now.getDate().toString().padStart(2, '0'); // Day (01-31)
    const hours = now.getHours().toString().padStart(2, '0'); // Hours (00-23)
    const minutes = now.getMinutes().toString().padStart(2, '0'); // Minutes (00-59)

    const dateTimeString = `${year}${month}${day}${hours}${minutes}`;
    const filename = `${config.title}_${config.version}_${dateTimeString}.zip`;

    // Set response headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    // Return the buffer as a response
    return new NextResponse(Buffer.concat(chunks), {
      headers
    });

  } catch (error) {
    logger.error(error, 'Download error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download experience' },
      { status: 500 }
    );
  }
}