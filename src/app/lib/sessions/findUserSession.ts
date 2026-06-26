import fs from 'fs/promises';
import path from 'path';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import {
  SessionMetadata,
  SessionEvent,
  SESSION_EVENTS,
} from '@/app/lib/file-utils';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('findUserSession');

export interface UserSessionLookup {
  session: SessionMetadata;
  hasArtifacts: boolean;
  isCompleted: boolean;
  lastEvent: SessionEvent | null;
}

/**
 * Finds the most recent session belonging to `userEmail` for `experienceId`.
 * Pure server function extracted from the legacy `GET /api/sessions/user`
 * route handler so the play RSC can read it directly during render.
 *
 * Returns `null` when there is no `session_data` directory yet, no session
 * folders match the user, or the user is unauthenticated. Errors reading
 * individual session metadata files are logged and skipped (matches the
 * legacy handler's tolerance).
 */
export async function findUserSession(
  experienceId: string,
  userEmail: string,
): Promise<UserSessionLookup | null> {
  const storage = StorageServiceFactory.getInstance();
  const sessionDataPath = path.join(experienceId, 'session_data');

  let sessionFolders: string[];
  try {
    sessionFolders = await storage.listDirectories(sessionDataPath);
  } catch (err) {
    logger.debug({ err, experienceId }, 'No session_data folder');
    return null;
  }

  let mostRecent: SessionMetadata | null = null;
  let mostRecentTime = 0;
  let mostRecentFolderPath: string | null = null;
  const normalizedUserEmail = userEmail.toLowerCase();

  for (const folderPath of sessionFolders) {
    const folder = path.basename(folderPath);
    if (!folder.startsWith('sess_')) continue;

    const sessionMetaPath = path.join(folderPath, 'session.json');
    try {
      if (!(await storage.fileExists(sessionMetaPath))) continue;

      const content = await storage.readFileAsText(sessionMetaPath);
      const sessionMeta: SessionMetadata = JSON.parse(content);

      if (sessionMeta.userEmail?.toLowerCase() !== normalizedUserEmail) continue;

      const activityTime = sessionMeta.lastActivity || sessionMeta.startTime;
      const timestamp = new Date(activityTime).getTime();
      if (!Number.isFinite(timestamp) || timestamp <= mostRecentTime) continue;

      mostRecentTime = timestamp;
      mostRecent = sessionMeta;
      mostRecentFolderPath = folderPath;
    } catch (err) {
      logger.error({ err, folder }, 'Error reading session metadata');
    }
  }

  if (!mostRecent || !mostRecentFolderPath) return null;

  // Derive flags only for the winning session — the previous version paid this
  // cost for every newer-than-prior candidate, including a recursive
  // `listFiles` walk over the artifacts directory.
  const events = mostRecent.events || [];
  const isCompleted = events.some(
    (e) => e.event === SESSION_EVENTS.SESSION_COMPLETED,
  );
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const hasArtifacts = await sessionHasArtifacts(mostRecentFolderPath);

  return {
    session: mostRecent,
    hasArtifacts,
    isCompleted,
    lastEvent,
  };
}

/**
 * True when `artifacts/` contains at least one **file** at any depth. Empty
 * subdirectories do not count (matches the legacy `listFiles` walk semantics
 * and avoids a false positive when only e.g. `artifacts/checklist/` exists).
 *
 * This intentionally uses `fs` under the storage root instead of
 * {@link StorageServiceFactory} — the factory only has a local backend
 * today; a cloud-backed `StorageService` should gain a
 * `hasFileUnder(path)`-style API and this can switch to it.
 */
async function sessionHasArtifacts(folderPath: string): Promise<boolean> {
  const baseDir = StorageServiceFactory.getStorageRoot();
  const artifactsDir = path.join(baseDir, folderPath, 'artifacts');
  try {
    return await directoryContainsAnyFile(artifactsDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    logger.warn({ err, artifactsDir }, 'Failed to enumerate artifacts');
    return false;
  }
}

/** Depth-first: first file wins; ignores empty directories. */
async function directoryContainsAnyFile(dir: string): Promise<boolean> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) return true;
    if (entry.isDirectory()) {
      if (await directoryContainsAnyFile(path.join(dir, entry.name))) {
        return true;
      }
    }
  }
  return false;
}
