/**
 * InformationStore - Server-side information storage with file persistence
 * 
 * Stores key/value pairs for a session, persisted to disk in session_data.
 * Uses write-through caching: every save writes to disk immediately.
 * 
 * Storage location: storage/{experienceId}/session_data/{sessionId}/information.json
 */

import { createModuleLogger } from '@/lib/logger';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import path from 'path';

const logger = createModuleLogger('InformationStore');

interface InformationData {
  keys: Record<string, string>;
  lastUpdated: string;
}

// In-memory cache per session
const sessionCaches = new Map<string, InformationData>();

/**
 * Get the storage path for information data
 */
function getInformationPath(experienceId: string, sessionId: string): string {
  return path.join(experienceId, 'session_data', sessionId, 'information.json');
}

/**
 * Get cache key for session
 */
function getCacheKey(experienceId: string, sessionId: string): string {
  return `${experienceId}:${sessionId}`;
}

/**
 * Load information data from disk (or cache)
 */
async function loadInformation(experienceId: string, sessionId: string): Promise<InformationData> {
  const cacheKey = getCacheKey(experienceId, sessionId);
  
  // Check cache first
  const cached = sessionCaches.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Load from disk
  const storagePath = getInformationPath(experienceId, sessionId);
  const storage = StorageServiceFactory.getInstance();
  
  try {
    const exists = await storage.fileExists(storagePath);
    if (exists) {
      const content = await storage.readFileAsText(storagePath);
      const data = JSON.parse(content) as InformationData;
      sessionCaches.set(cacheKey, data);
      logger.debug({ experienceId, sessionId, keyCount: Object.keys(data.keys).length }, 'Loaded information from disk');
      return data;
    }
  } catch (error) {
    logger.warn({ error, experienceId, sessionId }, 'Failed to load information from disk, starting fresh');
  }
  
  // Return empty data if not found or error
  const emptyData: InformationData = {
    keys: {},
    lastUpdated: new Date().toISOString()
  };
  sessionCaches.set(cacheKey, emptyData);
  return emptyData;
}

/**
 * Save information data to disk
 */
async function saveInformation(experienceId: string, sessionId: string, data: InformationData): Promise<void> {
  const storagePath = getInformationPath(experienceId, sessionId);
  const storage = StorageServiceFactory.getInstance();
  
  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(storagePath);
    try {
      await storage.createDirectory(parentDir);
    } catch {
      // Directory may already exist, that's ok
    }
    
    // Write data as a buffer
    const content = JSON.stringify(data, null, 2);
    await storage.storeFile(storagePath, Buffer.from(content, 'utf-8'));
    logger.debug({ experienceId, sessionId, keyCount: Object.keys(data.keys).length }, 'Saved information to disk');
  } catch (error) {
    logger.error({ error, experienceId, sessionId }, 'Failed to save information to disk');
    throw error;
  }
}

/**
 * InformationStore class - manages information for a specific session
 */
export class InformationStore {
  private experienceId: string;
  private sessionId: string;
  
  constructor(experienceId: string, sessionId: string) {
    this.experienceId = experienceId;
    this.sessionId = sessionId;
  }
  
  /**
   * Get all stored keys
   */
  async getAllKeys(): Promise<string[]> {
    const data = await loadInformation(this.experienceId, this.sessionId);
    return Object.keys(data.keys);
  }
  
  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    const data = await loadInformation(this.experienceId, this.sessionId);
    return data.keys[key] ?? null;
  }
  
  /**
   * Save a key/value pair
   */
  async save(key: string, value: string): Promise<void> {
    const data = await loadInformation(this.experienceId, this.sessionId);
    data.keys[key] = value;
    data.lastUpdated = new Date().toISOString();
    
    // Update cache
    const cacheKey = getCacheKey(this.experienceId, this.sessionId);
    sessionCaches.set(cacheKey, data);
    
    // Write through to disk
    await saveInformation(this.experienceId, this.sessionId, data);
  }
  
  /**
   * Delete a key
   */
  async delete(key: string): Promise<boolean> {
    const data = await loadInformation(this.experienceId, this.sessionId);
    
    if (!(key in data.keys)) {
      return false;
    }
    
    delete data.keys[key];
    data.lastUpdated = new Date().toISOString();
    
    // Update cache
    const cacheKey = getCacheKey(this.experienceId, this.sessionId);
    sessionCaches.set(cacheKey, data);
    
    // Write through to disk
    await saveInformation(this.experienceId, this.sessionId, data);
    return true;
  }
  
  /**
   * Clear all information (internal use only, not exposed to agents)
   */
  async clearAll(): Promise<void> {
    const emptyData: InformationData = {
      keys: {},
      lastUpdated: new Date().toISOString()
    };
    
    // Update cache
    const cacheKey = getCacheKey(this.experienceId, this.sessionId);
    sessionCaches.set(cacheKey, emptyData);
    
    // Write through to disk
    await saveInformation(this.experienceId, this.sessionId, emptyData);
    logger.info({ experienceId: this.experienceId, sessionId: this.sessionId }, 'Cleared all information');
  }
}

/**
 * Factory function to create an InformationStore for a session
 */
export function createInformationStore(experienceId: string, sessionId: string): InformationStore {
  return new InformationStore(experienceId, sessionId);
}

/**
 * Clear the session cache (useful for testing or memory management)
 */
export function clearSessionCache(experienceId: string, sessionId: string): void {
  const cacheKey = getCacheKey(experienceId, sessionId);
  sessionCaches.delete(cacheKey);
}

/**
 * Clear all session caches
 */
export function clearAllSessionCaches(): void {
  sessionCaches.clear();
}
