import { StorageService, FileStats } from './StorageService';
import { Readable } from 'stream';
import fs from 'fs/promises';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('LocalStorageService');

export class LocalStorageService implements StorageService {
  private baseDir: string;
  private baseUrl: string;

  constructor(baseDir: string, baseUrl: string) {
    this.baseDir = baseDir;
    this.baseUrl = baseUrl;
  }

  private getFullPath(filePath: string): string {
    const fullPath = path.join(this.baseDir, filePath);
    const resolvedPath = path.resolve(fullPath);
    
    // Basic path traversal protection
    if (!resolvedPath.startsWith(this.baseDir)) {
      throw new Error('Invalid path: Path traversal detected');
    }
    
    return resolvedPath;
  }

  async storeFile(filePath: string, buffer: Buffer): Promise<void> {
    const fullPath = this.getFullPath(filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }

  async storeFileFromStream(filePath: string, stream: Readable): Promise<void> {
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
    
    await this.storeFile(filePath, buffer);
  }

  async readFile(filePath: string): Promise<Buffer> {
    const fullPath = this.getFullPath(filePath);
    return fs.readFile(fullPath);
  }

  async readFileAsText(filePath: string): Promise<string> {
    const fullPath = this.getFullPath(filePath);
    return fs.readFile(fullPath, 'utf8');
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = this.getFullPath(filePath);
    await fs.unlink(fullPath);
  }

  async listFiles(directory: string): Promise<string[]> {
    const fullPath = this.getFullPath(directory);
    
    async function getFiles(dir: string): Promise<string[]> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(entries.map(async (entry) => {
          const res = path.resolve(dir, entry.name);
          return entry.isDirectory() ? getFiles(res) : res;
        }));
        return files.flat();
      } catch (error) {
        logger.error(error, `Error reading directory ${dir}`);
        return [];
      }
    }

    try {
      const files = await getFiles(fullPath);
      return files.map(file => path.relative(this.baseDir, file));
    } catch (error) {
      logger.error(error, `Error listing files in ${directory}`);
      return [];
    }
  }

  async listDirectories(directory: string): Promise<string[]> {
    const fullPath = this.getFullPath(directory);
    
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const directories = entries
        .filter(entry => entry.isDirectory())
        .map(entry => path.relative(this.baseDir, path.join(fullPath, entry.name)));
      
      return directories;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist, return empty array
        return [];
      }
      throw error;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = this.getFullPath(filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  getFileUrl(filePath: string): string {
    // Ensure the path uses forward slashes for URLs
    const normalizedPath = filePath.split(path.sep).join('/');
    return `${this.baseUrl}/${normalizedPath}`;
  }

  async getFileStats(filePath: string): Promise<FileStats | null> {
    try {
      const fullPath = this.getFullPath(filePath);
      const stats = await fs.stat(fullPath);
      return {
        size: stats.size,
        mtime: stats.mtime
      };
    } catch {
      return null;
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    const fullPath = this.getFullPath(dirPath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    const fullPath = this.getFullPath(dirPath);
    await fs.rm(fullPath, { recursive: true, force: true });
  }
} 