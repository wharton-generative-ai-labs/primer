import { Parse } from 'unzipper';
import { Readable } from 'stream';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { FILE_UPLOAD_LIMITS } from '@/config/constants';
import { createModuleLogger } from '@/lib/logger';
import path from 'path';

const logger = createModuleLogger('zip-utils');

/**
 * Sanitizes and validates a file path from a ZIP entry to prevent path traversal attacks.
 * Returns null if the path is invalid.
 */
export function sanitizeZipEntryPath(zipEntryPath: string, targetDir: string): string | null {
  if (!zipEntryPath || zipEntryPath.trim().length === 0) {
    return null;
  }

  const normalized = path.normalize(zipEntryPath);

  if (normalized.includes('..') || path.isAbsolute(normalized)) {
    return null;
  }

  const parts = normalized.split(path.sep).filter(part => part.length > 0);
  const sanitizedParts = parts.map(part => {
    const parsed = path.parse(part);

    const sanitizedName = parsed.name
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 100)
      || 'untitled';

    const sanitizedExt = parsed.ext
      ? parsed.ext.replace('.', '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 10)
      : '';

    return sanitizedExt ? `${sanitizedName}.${sanitizedExt}` : sanitizedName;
  });

  const sanitizedPath = sanitizedParts.join(path.sep);

  const fullPath = path.join(targetDir, sanitizedPath);
  const resolvedPath = path.resolve(fullPath);
  const resolvedDir = path.resolve(targetDir);

  if (!resolvedPath.startsWith(resolvedDir)) {
    return null;
  }

  return sanitizedPath;
}

export interface ExtractZipOptions {
  /** The target directory ID (folder name) within storage */
  targetId: string;
  /** If true, requires experience.json in the ZIP root */
  requireExperienceJson?: boolean;
}

/**
 * Extracts a ZIP buffer into storage under the given target directory.
 * Returns the storage URL of the experience.json config file.
 */
export async function extractZipToStorage(
  zipBuffer: Buffer,
  options: ExtractZipOptions
): Promise<string> {
  const { targetId, requireExperienceJson = true } = options;
  const storage = StorageServiceFactory.getInstance();

  try {
    const extractedFiles: string[] = [];
    const storePromises: Promise<void>[] = [];
    let totalDecompressedSize = 0;

    await new Promise<void>((resolve, reject) => {
      Readable.from(zipBuffer)
        .pipe(Parse())
        .on('entry', (entry) => {
          const fullPath = entry.path;
          if (!fullPath) {
            entry.autodrain();
            return;
          }

          const sanitizedPath = sanitizeZipEntryPath(fullPath, targetId);
          if (!sanitizedPath) {
            logger.warn({ fullPath, targetId }, 'Skipping invalid ZIP entry path');
            entry.autodrain();
            return;
          }

          const entryPath = path.join(targetId, sanitizedPath);

          if (entry.type === 'File') {
            const storePromise = (async () => {
              try {
                const chunks: Buffer[] = [];
                for await (const chunk of entry) {
                  chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);

                totalDecompressedSize += buffer.length;
                if (totalDecompressedSize > FILE_UPLOAD_LIMITS.EXPERIENCE_MAX_DECOMPRESSED_SIZE) {
                  throw new Error(`Decompressed size exceeds limit of ${FILE_UPLOAD_LIMITS.EXPERIENCE_MAX_DECOMPRESSED_SIZE / (1024 * 1024)}MB`);
                }

                await storage.storeFile(entryPath, buffer);
                extractedFiles.push(entryPath);
              } catch (error) {
                logger.error({ err: error, entryPath }, 'Error processing entry');
                throw error;
              }
            })();
            storePromises.push(storePromise);
          } else {
            entry.autodrain();
          }
        })
        .on('error', (error) => {
          logger.error(error, 'Zip parsing error');
          reject(error);
        })
        .on('finish', () => {
          Promise.all(storePromises)
            .then(() => resolve())
            .catch(reject);
        });
    });

    if (requireExperienceJson) {
      const configPath = `${targetId}/experience.json`;
      const exists = await storage.fileExists(configPath);
      if (!exists) {
        throw new Error('No experience.json found in root');
      }
    }

    return storage.getFileUrl(`${targetId}/experience.json`);
  } catch (error) {
    logger.error({ err: error, targetId }, 'Zip processing error');
    try {
      await storage.deleteDirectory(targetId);
      logger.debug({ targetId }, 'Cleaned up failed extraction directory');
    } catch (cleanupError) {
      logger.error({ err: cleanupError, targetId }, 'Failed to clean up extraction directory');
    }
    throw error;
  }
}
