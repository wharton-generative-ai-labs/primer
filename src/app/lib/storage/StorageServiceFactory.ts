import { StorageService } from './StorageService';
import { LocalStorageService } from './LocalStorageService';
import { env } from '@/config/env';
import path from 'path';

export class StorageServiceFactory {
  private static instance: StorageService;

  static initialize(storageType: 'local' = 'local'): void {
    if (storageType === 'local') {
      // Use environment variable with fallback to default storage directory
      const baseDir = env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
      const baseUrl = '/api/storage';
      this.instance = new LocalStorageService(baseDir, baseUrl);
    } else {
      throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }

  static getInstance(): StorageService {
    if (!this.instance) {
      this.initialize();
    }
    return this.instance;
  }

  /**
   * Get the storage root path (respects STORAGE_ROOT_PATH environment variable)
   * @returns Absolute path to storage root directory
   */
  static getStorageRoot(): string {
    return env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
  }
} 