import { Readable } from 'stream';

export interface FileStats {
  size: number;
  mtime: Date;
}

export interface StorageService {
  // Store a file from a buffer
  storeFile(path: string, buffer: Buffer): Promise<void>;
  
  // Store a file from a readable stream
  storeFileFromStream(path: string, stream: Readable): Promise<void>;
  
  // Read a file as a buffer
  readFile(path: string): Promise<Buffer>;
  
  // Read a file as text
  readFileAsText(path: string): Promise<string>;
  
  // Delete a file
  deleteFile(path: string): Promise<void>;
  
  // List files in a directory
  listFiles(directory: string): Promise<string[]>;
  
  // List directories in a directory
  listDirectories(directory: string): Promise<string[]>;
  
  // Check if a file exists
  fileExists(path: string): Promise<boolean>;
  
  // Get the URL to access a file
  getFileUrl(path: string): string;
  
  // Get file stats
  getFileStats(path: string): Promise<FileStats | null>;

  // Create a directory (and any necessary parent directories)
  createDirectory(path: string): Promise<void>;

  // Delete a directory and all its contents
  deleteDirectory(path: string): Promise<void>;
} 