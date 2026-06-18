import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import {
  getSessionMetadataFilePath,
  SessionMetadata,
} from '@/app/lib/file-utils';

/**
 * Thrown when a session metadata file does not exist on disk. Callers can
 * catch this to translate the missing row into the appropriate response (404
 * from API routes, refusal-to-resume in server actions, etc.) instead of
 * surfacing a raw `ENOENT`.
 */
export class SessionMetadataNotFoundError extends Error {
  readonly experienceId: string;
  readonly sessionId: string;
  readonly metadataPath: string;

  constructor(experienceId: string, sessionId: string, metadataPath: string) {
    super(
      `Session metadata not found for experience=${experienceId} session=${sessionId} (path=${metadataPath})`,
    );
    this.name = 'SessionMetadataNotFoundError';
    this.experienceId = experienceId;
    this.sessionId = sessionId;
    this.metadataPath = metadataPath;
  }
}

/**
 * Per-session in-process write lock for `session.json`. Each call chains
 * onto the previous in-flight mutation for the same `(experienceId,
 * sessionId)` so that concurrent read-modify-write paths (e.g. parallel
 * `/api/session-events` POSTs and the resume action firing at the same time)
 * cannot drop events to a last-writer-wins race.
 *
 * The lock is per-process. Multi-process correctness still relies on the
 * atomic write below (write-temp + rename) so a crash mid-write leaves the
 * old `session.json` intact rather than a half-written file.
 */
const inflight: Map<string, Promise<unknown>> = new Map();

function sessionKey(experienceId: string, sessionId: string): string {
  return `${experienceId}::${sessionId}`;
}

/**
 * Result wrapper a mutator can return when it needs to surface a value to
 * the caller (e.g. a route returning the appended event). Mutators that
 * don't need a return value just return the new metadata directly.
 */
export type MutatorResult<T> =
  | SessionMetadata
  | { metadata: SessionMetadata; result: T };

function isWrappedResult<T>(
  value: MutatorResult<T>,
): value is { metadata: SessionMetadata; result: T } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'metadata' in value &&
    'result' in value
  );
}

/**
 * Read `session.json`, hand the parsed metadata to `mutator`, then atomically
 * write the result back. All calls for the same session are serialized via a
 * module-scoped promise chain so the read-modify-write window is a critical
 * section.
 *
 * The mutator can either:
 * - return the new `SessionMetadata` directly (when the caller doesn't need
 *   a value back — `T = void`), or
 * - return `{ metadata, result }` to surface a value (e.g. the new event the
 *   caller wants to echo in its HTTP response).
 *
 * Throws {@link SessionMetadataNotFoundError} if `session.json` is missing.
 */
export async function mutateSessionMetadata<T = void>(
  experienceId: string,
  sessionId: string,
  mutator: (metadata: SessionMetadata) => Promise<MutatorResult<T>>,
): Promise<T> {
  const key = sessionKey(experienceId, sessionId);
  const previous = inflight.get(key) ?? Promise.resolve();

  const next = previous
    // Swallow errors from the previous mutation so an unrelated caller's
    // failure doesn't poison our turn — each mutation reports its own outcome
    // through its own returned promise.
    .catch(() => undefined)
    .then(() => runMutation<T>(experienceId, sessionId, mutator));

  inflight.set(key, next);

  try {
    return await next;
  } finally {
    // Drop the entry once this chain settles to its tail so the map doesn't
    // grow without bound. If a follow-up call arrived in the meantime it
    // already replaced this entry, so only delete when we're still the tail.
    if (inflight.get(key) === next) {
      inflight.delete(key);
    }
  }
}

async function runMutation<T>(
  experienceId: string,
  sessionId: string,
  mutator: (metadata: SessionMetadata) => Promise<MutatorResult<T>>,
): Promise<T> {
  const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);

  let raw: string;
  try {
    raw = await fs.readFile(metadataPath, 'utf-8');
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'ENOENT'
    ) {
      throw new SessionMetadataNotFoundError(experienceId, sessionId, metadataPath);
    }
    throw err;
  }

  const metadata: SessionMetadata = JSON.parse(raw);
  const mutated = await mutator(metadata);

  let nextMetadata: SessionMetadata;
  let result: T;
  if (isWrappedResult<T>(mutated)) {
    nextMetadata = mutated.metadata;
    result = mutated.result;
  } else {
    nextMetadata = mutated;
    // For the unwrapped form, `T` is `void`; the cast preserves the typed
    // contract without forcing callers to write `return undefined`.
    result = undefined as unknown as T;
  }

  await atomicWriteJson(metadataPath, nextMetadata);
  return result;
}

/**
 * Atomic JSON write: stage to a sibling temp file, then rename. `rename(2)` is
 * atomic within a single filesystem, so a crash mid-write either leaves the
 * old `session.json` intact or replaces it wholesale — never a half-written
 * file that breaks `JSON.parse` on the next read.
 *
 * Exported so other writers to `session.json` (e.g. the artifact-creation
 * route's `lastActivity` touch) can share this helper instead of issuing a
 * plain `fs.writeFile`, which truncates first and leaves an empty file if the
 * process is interrupted mid-write.
 */
export async function atomicWriteJson(targetPath: string, payload: unknown): Promise<void> {
  const dir = path.dirname(targetPath);
  const tempPath = path.join(dir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`);
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2));
  try {
    await fs.rename(tempPath, targetPath);
  } catch (err) {
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  }
}
