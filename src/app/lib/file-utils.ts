import crypto from 'crypto';
import path from 'path';
import { env } from '@/config/env';

export function hashUserEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

/**
 * Generate a simple random experience ID using alphanumeric characters.
 * This produces a 13-character string suitable for use as folder names.
 * Used consistently across experience creation (builder, upload, template copy).
 */
export function generateExperienceId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Gets the path for session-specific uploads within an experience
 * Returns a path relative to storage root: {experienceId}/session_data/{sessionId}/uploads
 */
export function getSessionUploadPath(experienceId: string, sessionId: string): string {
  if (!experienceId || !sessionId) {
    throw new Error('Both experienceId and sessionId are required');
  }
  
  return path.join(experienceId, 'session_data', sessionId, 'uploads');
}

/**
 * @deprecated Use getSessionUploadPath instead. This function is kept for backward compatibility.
 * Gets the old user-specific upload path
 */
export function getUserUploadPath(experienceId: string | null, userEmail: string | null): string {
  if (!experienceId || !userEmail) {
    throw new Error('Both experienceId and userEmail are required');
  }
  
  const hashedEmail = hashUserEmail(userEmail);
  return path.join('user-uploads', hashedEmail, experienceId);
}

export function getFileInfoUrl(fileName: string): string {
  return `/api/file-info/${fileName}`;
}

export async function getExperienceFolder(experienceId: string): Promise<string> {
  if (!experienceId) {
    throw new Error('Experience ID is required');
  }
  
  // Experience permanent data is stored in the storage directory
  // Use STORAGE_ROOT_PATH environment variable if set, otherwise default to process.cwd()/storage
  const storageRoot = env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
  return path.join(storageRoot, experienceId);
}

/**
 * Gets the path for session-specific artifacts within an experience
 * Returns a path relative to storage root: {experienceId}/session_data/{sessionId}/artifacts
 */
export function getExperienceArtifactsPath(experienceId: string, sessionId: string): string {
  if (!experienceId || !sessionId) {
    throw new Error('Experience ID and Session ID are required');
  }
  
  return path.join(experienceId, 'session_data', sessionId, 'artifacts');
}

/**
 * @deprecated Use getExperienceArtifactsPath with StorageService instead. 
 * This function returns full filesystem paths and is kept for backward compatibility.
 */
export async function getExperienceArtifactsFolder(experienceId: string, sessionId: string): Promise<string> {
  if (!experienceId || !sessionId) {
    throw new Error('Experience ID and Session ID are required');
  }
  
  // Session-scoped artifacts are now stored in storage/{experienceId}/session_data/{sessionId}/artifacts
  // Use STORAGE_ROOT_PATH environment variable if set, otherwise default to process.cwd()/storage
  const storageRoot = env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
  return path.join(storageRoot, experienceId, 'session_data', sessionId, 'artifacts');
}

export async function getExperienceConfigFolder(experienceId: string): Promise<string> {
  if (!experienceId) {
    throw new Error('Experience ID is required');
  }
  
  // Experience configurations are stored in the storage directory
  // Use STORAGE_ROOT_PATH environment variable if set, otherwise default to process.cwd()/storage
  const storageRoot = env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
  return path.join(storageRoot, experienceId);
}

/**
 * Session event structure - logged by AI agents or system
 */
export interface SessionEvent {
  event: string;                    // e.g., "session_started", "phase_started", "session_completed"
  agent: string;                    // Origin agent key or "system" for automatic events
  timestamp: string;                // ISO 8601 timestamp
  data?: Record<string, any>;       // Optional payload, e.g., { phase: "introduction" }
}

/**
 * Well-known session event types
 */
export const SESSION_EVENTS = {
  SESSION_STARTED: 'session_started',
  SESSION_COMPLETED: 'session_completed',
  PHASE_STARTED: 'phase_started',
  PHASE_COMPLETED: 'phase_completed',
} as const;

/**
 * Session metadata structure
 */
export interface SessionMetadata {
  sessionId: string;
  experienceId: string;
  startTime: string;                // ISO 8601 timestamp
  lastActivity?: string;            // ISO 8601 timestamp - updated on significant user activity
  userName?: string;
  userEmail?: string;
  events: SessionEvent[];           // Event log for session lifecycle tracking
}

/**
 * Gets the path for session metadata file
 */
export function getSessionMetadataPath(experienceId: string, sessionId: string): string {
  if (!experienceId || !sessionId) {
    throw new Error('Experience ID and Session ID are required');
  }
  
  return path.join(experienceId, 'session_data', sessionId, 'session.json');
}

/**
 * Gets the full filesystem path for session metadata file
 */
export async function getSessionMetadataFilePath(experienceId: string, sessionId: string): Promise<string> {
  if (!experienceId || !sessionId) {
    throw new Error('Experience ID and Session ID are required');
  }
  
  const storageRoot = env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
  return path.join(storageRoot, experienceId, 'session_data', sessionId, 'session.json');
} 