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

/**
 * Detects if all meaningful ZIP entries share a single common top-level folder
 * (e.g. when macOS "Compress" wraps everything in a folder named after the zip).
 * Returns the prefix string to strip (including trailing slash), or null if no
 * wrapper is detected.
 */
export function detectWrapperFolder(entryPaths: string[]): string | null {
  const filePaths = entryPaths.filter(p => p && p.trim().length > 0);
  if (filePaths.length === 0) return null;

  const firstSegments = filePaths.map(p => {
    const normalized = p.replace(/\\/g, '/');
    const slash = normalized.indexOf('/');
    return slash !== -1 ? normalized.slice(0, slash + 1) : null;
  });

  // If any file sits at the root (no slash), there's no wrapper folder
  if (firstSegments.some(s => s === null)) return null;

  const first = firstSegments[0]!;
  // All entries must share the same top-level folder
  if (firstSegments.every(s => s === first)) return first;

  return null;
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

    // First pass: collect all entry paths to detect a common wrapper folder
    const allEntryPaths: { rawPath: string; type: string }[] = [];
    await new Promise<void>((resolve, reject) => {
      Readable.from(zipBuffer)
        .pipe(Parse())
        .on('entry', (entry) => {
          if (entry.path) allEntryPaths.push({ rawPath: entry.path, type: entry.type });
          entry.autodrain();
        })
        .on('error', reject)
        .on('finish', resolve);
    });

    // Detect a single common top-level wrapper folder (e.g. from macOS "Compress")
    // Ignore __MACOSX metadata entries when determining the prefix
    const meaningfulPaths = allEntryPaths
      .map(e => e.rawPath)
      .filter(p => !p.startsWith('__MACOSX') && !p.startsWith('._'));
    const stripPrefix = detectWrapperFolder(meaningfulPaths);
    if (stripPrefix) {
      logger.info({ stripPrefix }, 'Detected ZIP wrapper folder, stripping prefix');
    }

    await new Promise<void>((resolve, reject) => {
      Readable.from(zipBuffer)
        .pipe(Parse())
        .on('entry', (entry) => {
          const fullPath = entry.path;
          if (!fullPath) {
            entry.autodrain();
            return;
          }

          // Strip the common wrapper folder prefix if detected
          const effectivePath = stripPrefix && fullPath.startsWith(stripPrefix)
            ? fullPath.slice(stripPrefix.length)
            : fullPath;

          if (!effectivePath) {
            entry.autodrain();
            return;
          }

          const sanitizedPath = sanitizeZipEntryPath(effectivePath, targetId);
          if (!sanitizedPath) {
            logger.warn({ fullPath, effectivePath, targetId }, 'Skipping invalid ZIP entry path');
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
