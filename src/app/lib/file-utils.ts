import crypto from 'crypto';
import path from 'path';
import { env } from '@/config/env';
import type { WorkflowPhaseState } from '@/app/lib/workflow-phases';

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
  assertSafeExperienceId(experienceId);
  assertSafeSessionId(sessionId);

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

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function assertSafeExperienceId(experienceId: string): void {
  if (!experienceId) {
    throw new Error('Experience ID is required');
  }
  if (!SAFE_ID.test(experienceId)) {
    throw new Error(`Invalid experience ID: ${experienceId}`);
  }
}

export function assertSafeSessionId(sessionId: string): void {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }
  if (!SAFE_ID.test(sessionId)) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }
}

/**
 * Resolve `userPath` against `experienceFolder` and assert the result stays
 * inside it. Throws on traversal (`..`, absolute paths, null bytes) — callers
 * should treat this as a hard fail. Use for any filesystem operation where
 * the path segment is supplied by an LLM, the user, or an HTTP client.
 */
export function safeJoinExperiencePath(
  experienceFolder: string,
  userPath: string,
): string {
  if (typeof userPath !== 'string' || userPath.length === 0) {
    throw new Error('Path is required');
  }
  if (userPath.includes('\0')) {
    throw new Error('Invalid path: null byte');
  }
  const resolvedRoot = path.resolve(experienceFolder);
  const resolved = path.resolve(resolvedRoot, userPath);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Invalid path: traversal outside experience folder (${userPath})`);
  }
  return resolved;
}

/**
 * Validate that `userPath` is a safe relative path (no traversal, not absolute,
 * no null bytes). For use at the StorageService boundary, where paths are kept
 * relative to the storage root rather than resolved to absolute filesystem
 * paths. Throws on any unsafe input.
 */
export function assertSafeRelativePath(userPath: string): void {
  if (typeof userPath !== 'string' || userPath.length === 0) {
    throw new Error('Path is required');
  }
  if (userPath.includes('\0')) {
    throw new Error('Invalid path: null byte');
  }
  if (path.isAbsolute(userPath)) {
    throw new Error(`Invalid path: must be relative (${userPath})`);
  }
  // Split on both separators so we catch `..\\foo` on any host.
  const segments = userPath.split(/[\\/]/);
  if (segments.some((s) => s === '..')) {
    throw new Error(`Invalid path: traversal segment in '${userPath}'`);
  }
}

export async function getExperienceFolder(experienceId: string): Promise<string> {
  assertSafeExperienceId(experienceId);

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
  assertSafeExperienceId(experienceId);
  assertSafeSessionId(sessionId);

  return path.join(experienceId, 'session_data', sessionId, 'artifacts');
}

/**
 * @deprecated Use getExperienceArtifactsPath with StorageService instead. 
 * This function returns full filesystem paths and is kept for backward compatibility.
 */
export async function getExperienceArtifactsFolder(experienceId: string, sessionId: string): Promise<string> {
  assertSafeExperienceId(experienceId);
  assertSafeSessionId(sessionId);

  // Session-scoped artifacts are now stored in storage/{experienceId}/session_data/{sessionId}/artifacts
  // Use STORAGE_ROOT_PATH environment variable if set, otherwise default to process.cwd()/storage
  const storageRoot = env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
  return path.join(storageRoot, experienceId, 'session_data', sessionId, 'artifacts');
}

export async function getExperienceConfigFolder(experienceId: string): Promise<string> {
  assertSafeExperienceId(experienceId);

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
  SESSION_RESUMED: 'session_resumed',
  SESSION_COMPLETED: 'session_completed',
  PHASE_COMPLETED: 'phase_completed',
  WORKFLOW_PHASE_ENTERED: 'workflow_phase_entered',
  WORKFLOW_PHASE_LEFT: 'workflow_phase_left',
  WORKFLOW_PHASE_SKIPPED: 'workflow_phase_skipped',
  WORKFLOW_PHASE_REVISITED: 'workflow_phase_revisited',
  WORKFLOW_NEXT_OVERRIDDEN: 'workflow_next_overridden',
  EXPERIENCE_COMPLETED: 'experience_completed',
  EXPERIENCE_REWOUND: 'experience_rewound',
  /**
   * Emitted once per phase objective when the agent calls `complete` /
   * `nextPhase` on a phase whose objectives weren't all explicitly marked.
   * The server auto-marks the unmet ones and proceeds; this event is the
   * audit trail so we can spot phases where the agent never demonstrates
   * objective hygiene. Pure telemetry — no consumer should gate on it.
   */
  OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE: 'objective_auto_marked_on_next_phase',
  /**
   * Emitted when an objective is marked via either the agent's
   * `workflowPhase markObjective` action OR a system auto-mark hook
   * (delegate success / artifact populated). The event's `trigger`
   * field distinguishes ('agent' | 'system'). Pure telemetry — no
   * consumer should gate on it.
   */
  OBJECTIVE_MARKED: 'objective_marked',
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
  workflowPhaseState?: WorkflowPhaseState;
  experienceCompleted?: boolean;
}

/**
 * Gets the path for session metadata file
 */
export function getSessionMetadataPath(experienceId: string, sessionId: string): string {
  assertSafeExperienceId(experienceId);
  assertSafeSessionId(sessionId);

  return path.join(experienceId, 'session_data', sessionId, 'session.json');
}

/**
 * Gets the full filesystem path for session metadata file
 */
export async function getSessionMetadataFilePath(experienceId: string, sessionId: string): Promise<string> {
  assertSafeExperienceId(experienceId);
  assertSafeSessionId(sessionId);

  const storageRoot = env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
  return path.join(storageRoot, experienceId, 'session_data', sessionId, 'session.json');
}

/**
 * Full filesystem path for persisted document panel snapshot (`panel-state.json`).
 */
export async function getSessionPanelStateFilePath(
  experienceId: string,
  sessionId: string,
): Promise<string> {
  assertSafeExperienceId(experienceId);
  assertSafeSessionId(sessionId);

  const storageRoot = env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
  return path.join(storageRoot, experienceId, 'session_data', sessionId, 'panel-state.json');
}
