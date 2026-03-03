/**
 * Session management utilities for Primer.
 * 
 * IMPORTANT: Sessions should ONLY be created through the /play/ route.
 * Use hasSession() or getExistingSessionId() to check for sessions without creating them.
 * Use ensureSession() only from the play page to create a new session.
 */

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('session-utils');
const SESSION_KEY = 'primer:session-id';

/**
 * Generate a new session ID
 */
function generateSessionId(): string {
  const uuid = (typeof globalThis !== 'undefined' &&
    typeof (globalThis as any).crypto !== 'undefined' &&
    typeof (globalThis as any).crypto.randomUUID === 'function')
    ? (globalThis as any).crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
  return `sess_${uuid}`;
}

/**
 * Check if a session exists in sessionStorage.
 * Does NOT create a session if one doesn't exist.
 */
export function hasSession(): boolean {
  if (typeof sessionStorage === 'undefined') {
    return false;
  }
  return sessionStorage.getItem(SESSION_KEY) !== null;
}

/**
 * Get the current session ID if one exists.
 * Returns null if no session exists - does NOT create one.
 * 
 * Use this for operations that should only work within an active session.
 */
export function getExistingSessionId(): string | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  return sessionStorage.getItem(SESSION_KEY);
}

/**
 * Get the current session ID.
 * 
 * @deprecated Use getExistingSessionId() for read-only access, or ensureSession() to create.
 * This function now throws an error if no session exists to catch accidental session creation.
 * 
 * @throws Error if no session exists
 */
export function getSessionId(): string {
  const sessionId = getExistingSessionId();
  
  if (!sessionId) {
    throw new Error(
      'No session exists. Sessions should only be created through the /play/ route. ' +
      'Use getExistingSessionId() for read-only access or ensureSession() to create a session.'
    );
  }
  
  return sessionId;
}

/**
 * Ensure a session exists, creating one if necessary.
 * This also initializes the session on disk with metadata and a session_started event.
 * 
 * IMPORTANT: This should ONLY be called from the /play/ route.
 * 
 * @param experienceId - The experience ID to associate with the session
 * @param userName - Optional user name for session metadata
 * @param userEmail - Optional user email for session metadata
 * @returns The session ID (existing or newly created)
 */
export async function ensureSession(
  experienceId: string, 
  userName?: string, 
  userEmail?: string
): Promise<string> {
  // Check if we already have a session
  let sessionId = getExistingSessionId();
  
  if (sessionId) {
    logger.debug({ sessionId }, 'Using existing session');
    return sessionId;
  }
  
  // Generate new session ID
  sessionId = generateSessionId();
  
  // Store in sessionStorage
  sessionStorage.setItem(SESSION_KEY, sessionId);
  
  // Initialize session on disk via API
  try {
    const response = await fetch('/api/session-init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        experienceId,
        sessionId,
        userName,
        userEmail,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      logger.error({ errorData, sessionId }, 'Failed to initialize session on disk');
      // Session is still valid in sessionStorage, just won't have disk metadata yet
      // The disk metadata will be created when the first artifact is created
    } else {
      const result = await response.json();
      logger.debug({
        sessionId,
        created: result.created,
        hasEvents: result.metadata?.events?.length > 0
      }, 'Session initialized');
    }
  } catch (error) {
    logger.error(error, 'Error initializing session');
    // Continue anyway - session is valid, disk init failed
  }
  
  return sessionId;
}

/**
 * Clear the current session from sessionStorage.
 */
export function clearSession(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

/**
 * Set a specific session ID (used for session recovery).
 * This overwrites any existing session ID.
 */
export function setSessionId(sessionId: string): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
}

// Re-export SessionMetadata from file-utils for backward compatibility
export type { SessionMetadata } from './file-utils';
