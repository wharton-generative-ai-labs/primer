import fs from 'fs/promises';
import path from 'path';
import {
  getExperienceArtifactsFolder,
  getExperienceFolder,
  getSessionMetadataFilePath,
  type SessionMetadata,
} from '@/app/lib/file-utils';
import { fireObjectiveSignal } from '@/app/lib/workflow-phases/objectiveSignals';
import { getContentFilename, getMetadataFilename, isBinaryFileType } from '@/app/lib/artifact-utils';
import { findMetadataFileByArtifactId } from '@/app/lib/artifacts/findMetadata';
import type { Author, AuthorInput, SessionArtifactRecord } from '@/app/lib/artifacts/types';
import {
  getRevisionDir,
  listRevisionMetas,
  listRevisionNumbers,
  readRevisionContent,
  readRevisionMeta,
  revisionDirExists,
  writeRevisionSnapshot,
} from '@/app/lib/artifacts/revisions';
import type { ArtifactRevisionMeta } from '@/app/lib/artifacts/types';

function createKeyedMutex() {
  const locks = new Map<string, Promise<void>>();
  return async function acquire(key: string): Promise<() => void> {
    const prev = locks.get(key) ?? Promise.resolve();
    let resolveRelease!: () => void;
    const next = new Promise<void>((res) => {
      resolveRelease = () => {
        res();
      };
    });
    locks.set(key, prev.then(() => next));
    await prev;
    return () => {
      resolveRelease();
    };
  };
}

const keyedMutex = createKeyedMutex();

async function withArtifactLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const release = await keyedMutex(key);
  try {
    return await fn();
  } finally {
    release();
  }
}

async function resolveAgentDisplayName(experienceId: string, agentKey: string): Promise<string> {
  try {
    const folder = await getExperienceFolder(experienceId);
    const expPath = path.join(folder, 'experience.json');
    const raw = await fs.readFile(expPath, 'utf-8');
    const config = JSON.parse(raw) as { agents?: Record<string, { name?: string }> };
    return config.agents?.[agentKey]?.name ?? agentKey;
  } catch {
    return agentKey;
  }
}

export async function resolveAuthor(experienceId: string, input: AuthorInput): Promise<Author> {
  if (input.kind === 'system') return { kind: 'system' };
  if (input.kind === 'user') return { kind: 'user', email: input.email, name: input.name };
  const name = await resolveAgentDisplayName(experienceId, input.agentKey);
  return { kind: 'agent', agentKey: input.agentKey, name };
}

async function readWorkflowPhaseId(experienceId: string, sessionId: string): Promise<string | undefined> {
  try {
    const p = await getSessionMetadataFilePath(experienceId, sessionId);
    const raw = await fs.readFile(p, 'utf-8');
    const meta = JSON.parse(raw) as SessionMetadata;
    return meta.workflowPhaseState?.currentPhase;
  } catch {
    return undefined;
  }
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmp = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, filePath);
}

async function writeFileAtomic(targetPath: string, data: Buffer | string): Promise<void> {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const tmp = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, targetPath);
}

function lockKeyArtifact(experienceId: string, sessionId: string, artifactId: string): string {
  return `${experienceId}:${sessionId}:${artifactId}`;
}

const CREATE_SLOT = '__create__';

function lockKeyCreate(experienceId: string, sessionId: string): string {
  return `${experienceId}:${sessionId}:${CREATE_SLOT}`;
}

/** API responses: legacy artifacts without revisions behave as currentRev 1 */
export function normalizeArtifactRecord(record: SessionArtifactRecord): SessionArtifactRecord {
  return {
    ...record,
    currentRev: record.currentRev ?? 1,
  };
}

function buffersEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && a.equals(b);
}

async function readHeadBuffer(contentPath: string): Promise<Buffer> {
  return fs.readFile(contentPath);
}

async function rmrf(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * Stable comparison of `agents` declarations. The shape is opaque (typed as
 * `unknown` on the artifact record), so the cheapest correct equality check is
 * a JSON serialize. Both `undefined` and `null` collapse to "no agents
 * declared" — they're treated as equal so an existing record without `agents`
 * matches a same-named create that also omits the field.
 */
function agentsEqual(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Strip a single trailing parenthesized suffix from a display name. Examples:
 *   "Mentor Prompt (Template-Preserved)" -> "Mentor Prompt"
 *   "Foo (v2)" -> "Foo"
 *   "Foo" -> "Foo"
 * Used by {@link findArtifactByName} so that a re-create with a hand-tagged
 * suffix still coerces to an update of the original artifact instead of
 * landing as a sibling. Only the trailing parenthesized group is stripped —
 * `"Foo (a) (b)"` collapses to `"Foo (a)"` after one pass, matching the agent
 * behavior that appends one decoration at a time.
 */
function stripTrailingParenSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Find an existing artifact in the session by display name. Walks the
 * artifacts folder once, parsing each `*.json` metadata file. Returns the
 * first record whose `name` matches exactly, or — if none match exactly —
 * the first record whose name matches the incoming name with a trailing
 * parenthesized suffix stripped. Used by {@link createArtifact} to detect
 * "save again" calls that should become updates of the existing artifact
 * rather than new siblings. The suffix-stripped form catches cases like
 * "Mentor Prompt (Template-Preserved)" being created when "Mentor Prompt"
 * already exists.
 */
async function findArtifactByName(
  artifactsFolder: string,
  name: string,
): Promise<SessionArtifactRecord | null> {
  let files: string[];
  try {
    files = await fs.readdir(artifactsFolder);
  } catch {
    return null;
  }

  const normalizedIncoming = stripTrailingParenSuffix(name);
  let suffixMatch: SessionArtifactRecord | null = null;

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    // Skip revision sidecars; they live in `.revisions/` subdirs but a stray
    // top-level `*.revisions.json` would never match a real artifact id.
    try {
      const raw = await fs.readFile(path.join(artifactsFolder, file), 'utf-8');
      const parsed = JSON.parse(raw) as Partial<SessionArtifactRecord>;
      if (!parsed || !parsed.id || typeof parsed.name !== 'string') continue;
      if (parsed.name === name) {
        return parsed as SessionArtifactRecord;
      }
      // Defer suffix-stripped match until after the loop so an exact-name hit
      // farther down the directory listing still wins. Only consider a
      // suffix-stripped collision when the incoming name actually had a
      // trailing parenthesized suffix to strip (otherwise both forms are
      // identical and we'd be re-running the exact-match check).
      if (
        !suffixMatch &&
        normalizedIncoming !== name &&
        parsed.name === normalizedIncoming
      ) {
        suffixMatch = parsed as SessionArtifactRecord;
      }
    } catch {
      continue;
    }
  }
  return suffixMatch;
}

export async function createArtifact(params: {
  experienceId: string;
  sessionId: string;
  name: string;
  content: string;
  type?: string;
  agents?: unknown;
  metadata?: Record<string, unknown>;
  author: AuthorInput;
}): Promise<{ artifact: SessionArtifactRecord }> {
  const {
    experienceId,
    sessionId,
    name,
    content,
    type = 'markdown',
    agents,
    metadata,
    author: authorInput,
  } = params;

  return withArtifactLock(lockKeyCreate(experienceId, sessionId), async () => {
    const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
    await fs.mkdir(artifactsFolder, { recursive: true });

    // Coerce same-name+same-type+same-agents `create` into an `update` of the
    // existing artifact. The agent's "iterate then save again" pattern was
    // producing sibling artifacts via the counter-suffix path below
    // (e.g. `practice_prompt` AND `practice_prompt_(1)`), confusing
    // downstream consumers that walk `artifactIds`. If logical identity
    // matches (same name, same type, same agents declaration), the second
    // save is semantically an update — delegate to updateArtifact so the
    // existing artifact gets a new revision instead of a sibling. If only
    // the name matches but type/agents differ, fall through to the
    // counter-suffix path because they're clearly distinct logical
    // artifacts that just happen to share a name.
    const existing = await findArtifactByName(artifactsFolder, name);
    if (
      existing &&
      (existing.type ?? 'markdown') === type &&
      agentsEqual(existing.agents, agents)
    ) {
      const updated = await updateArtifact({
        experienceId,
        sessionId,
        artifactId: existing.id,
        content,
        metadata,
        author: authorInput,
      });
      return { artifact: updated.artifact };
    }

    const workflowPhaseId = await readWorkflowPhaseId(experienceId, sessionId);
    const author = await resolveAuthor(experienceId, authorInput);

    const timestamp = new Date().toISOString();

    const baseContentFilename = getContentFilename('', type, name);
    let contentFilename = baseContentFilename;
    let counter = 1;

    while (true) {
      const checkPath = path.join(artifactsFolder, contentFilename);
      try {
        await fs.access(checkPath);
        const extension = path.extname(baseContentFilename);
        const nameWithoutExt = path.basename(baseContentFilename, extension);
        contentFilename = `${nameWithoutExt}_(${counter})${extension}`;
        counter++;
      } catch {
        break;
      }
    }

    const id = path.parse(contentFilename).name;
    const metadataFilename = getMetadataFilename(contentFilename);

    const binary = isBinaryFileType(type);
    const contentBuffer = binary ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf-8');

    const contentPath = path.join(artifactsFolder, contentFilename);
    await writeFileAtomic(contentPath, contentBuffer);

    const revDir = getRevisionDir(artifactsFolder, contentFilename);
    await writeRevisionSnapshot({
      revDir,
      rev: 1,
      artifactId: id,
      contentBuffer,
      isBinary: binary,
      author,
      workflowPhaseId,
      parentRev: null,
    });

    const artifact: SessionArtifactRecord = {
      id,
      name,
      type,
      agents,
      metadata,
      filename: contentFilename,
      createdAt: timestamp,
      updatedAt: timestamp,
      currentRev: 1,
      lastAuthor: author,
    };

    const metadataPath = path.join(artifactsFolder, metadataFilename);
    await writeJsonAtomic(metadataPath, artifact);

    // Best-effort objective auto-mark hook. The id is what we just wrote.
    // newlyPopulated is true iff the content we wrote is non-empty after
    // trim. Failures are swallowed inside fireObjectiveSignal so a hook
    // glitch never breaks the artifact write.
    void fireObjectiveSignal({
      experienceId,
      sessionId,
      signal: {
        kind: 'artifactWrite',
        slug: id,
        newlyPopulated: content.trim().length > 0,
      },
    });

    return { artifact };
  });
}

export async function updateArtifact(params: {
  experienceId: string;
  sessionId: string;
  artifactId: string;
  content: string;
  metadata?: Record<string, unknown>;
  author: AuthorInput;
  /** Server-side restore / undo message */
  message?: string;
}): Promise<{ artifact: SessionArtifactRecord; content: string; noop?: boolean }> {
  const { experienceId, sessionId, artifactId, content, metadata: metadataPatch, author: authorInput, message } =
    params;

  return withArtifactLock(lockKeyArtifact(experienceId, sessionId, artifactId), async () => {
    const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
    const metadataFilename = await findMetadataFileByArtifactId(artifactsFolder, artifactId);
    if (!metadataFilename) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    const metadataPath = path.join(artifactsFolder, metadataFilename);
    const rawMeta = await fs.readFile(metadataPath, 'utf-8');
    let record = JSON.parse(rawMeta) as SessionArtifactRecord;

    const contentFilename = record.filename;
    if (!contentFilename) {
      throw new Error(`Artifact ${artifactId} has no content filename`);
    }

    const binary = isBinaryFileType(record.type || 'markdown');
    const newBuffer = binary ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf-8');

    const contentPath = path.join(artifactsFolder, contentFilename);
    const oldBuffer = await readHeadBuffer(contentPath);

    if (buffersEqual(oldBuffer, newBuffer)) {
      const normalized = normalizeArtifactRecord(record);
      const outContent = binary ? oldBuffer.toString('base64') : oldBuffer.toString('utf-8');
      return { artifact: normalized, content: outContent, noop: true };
    }

    const workflowPhaseId = await readWorkflowPhaseId(experienceId, sessionId);
    const author = await resolveAuthor(experienceId, authorInput);

    const revDir = getRevisionDir(artifactsFolder, contentFilename);
    const hadRevisions = await revisionDirExists(artifactsFolder, contentFilename);

    let workingRev: number;
    if (record.currentRev !== undefined && record.currentRev !== null) {
      workingRev = record.currentRev;
    } else if (hadRevisions) {
      const nums = await listRevisionNumbers(revDir);
      workingRev = nums.length ? Math.max(...nums) : 0;
    } else {
      workingRev = 0;
    }

    if (!hadRevisions) {
      await writeRevisionSnapshot({
        revDir,
        rev: 1,
        artifactId,
        contentBuffer: oldBuffer,
        isBinary: binary,
        author: { kind: 'system' },
        workflowPhaseId,
        parentRev: null,
      });
      workingRev = 1;
    }

    await writeFileAtomic(contentPath, newBuffer);

    const nextRev = workingRev + 1;
    await writeRevisionSnapshot({
      revDir,
      rev: nextRev,
      artifactId,
      contentBuffer: newBuffer,
      isBinary: binary,
      author,
      workflowPhaseId,
      parentRev: workingRev,
      message,
    });

    const updatedAt = new Date().toISOString();
    record = {
      ...record,
      metadata: metadataPatch ? { ...record.metadata, ...metadataPatch } : record.metadata,
      updatedAt,
      currentRev: nextRev,
      lastAuthor: author,
    };

    await writeJsonAtomic(metadataPath, record);

    // newlyPopulated is true iff the OLD content was empty (or absent —
    // covered by the empty-check below) AND the new content is non-empty.
    // For binary types we compare buffer length, not utf-8 trim.
    const oldNonEmpty = binary
      ? oldBuffer.length > 0
      : oldBuffer.length > 0 && oldBuffer.toString('utf-8').trim().length > 0;
    const newNonEmpty = binary
      ? newBuffer.length > 0
      : content.trim().length > 0;
    void fireObjectiveSignal({
      experienceId,
      sessionId,
      signal: {
        kind: 'artifactWrite',
        slug: artifactId,
        newlyPopulated: !oldNonEmpty && newNonEmpty,
      },
    });

    const responseContent = binary ? newBuffer.toString('base64') : newBuffer.toString('utf-8');
    return { artifact: normalizeArtifactRecord(record), content: responseContent };
  });
}

export async function readArtifactHead(params: {
  experienceId: string;
  sessionId: string;
  artifactId: string;
}): Promise<(SessionArtifactRecord & { content: string }) | null> {
  const { experienceId, sessionId, artifactId } = params;
  const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
  const metadataFilename = await findMetadataFileByArtifactId(artifactsFolder, artifactId);
  if (!metadataFilename) return null;

  const metadataPath = path.join(artifactsFolder, metadataFilename);
  const rawMeta = await fs.readFile(metadataPath, 'utf-8');
  const record = JSON.parse(rawMeta) as SessionArtifactRecord;

  const contentPath = path.join(artifactsFolder, record.filename);
  const binary = isBinaryFileType(record.type || 'markdown');
  const buf = await readHeadBuffer(contentPath);
  const content = binary ? buf.toString('base64') : buf.toString('utf-8');

  return {
    ...normalizeArtifactRecord(record),
    content,
  };
}

export async function deleteArtifact(params: {
  experienceId: string;
  sessionId: string;
  artifactId: string;
}): Promise<void> {
  const { experienceId, sessionId, artifactId } = params;

  await withArtifactLock(lockKeyArtifact(experienceId, sessionId, artifactId), async () => {
    const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
    const metadataFilename = await findMetadataFileByArtifactId(artifactsFolder, artifactId);
    if (!metadataFilename) {
      throw new Error(`Artifact with id ${artifactId} not found`);
    }

    const metadataPath = path.join(artifactsFolder, metadataFilename);
    const rawMeta = await fs.readFile(metadataPath, 'utf-8');
    const meta = JSON.parse(rawMeta) as SessionArtifactRecord;

    const contentFilename = meta.filename;
    if (contentFilename) {
      const contentPath = path.join(artifactsFolder, contentFilename);
      try {
        await fs.unlink(contentPath);
      } catch {
        // ignore
      }
      const revDir = getRevisionDir(artifactsFolder, contentFilename);
      await rmrf(revDir);
    }

    await fs.unlink(metadataPath);
  });
}

export async function restoreArtifactRevision(params: {
  experienceId: string;
  sessionId: string;
  artifactId: string;
  rev: number;
  author: AuthorInput;
}): Promise<{ artifact: SessionArtifactRecord; content: string }> {
  const { experienceId, sessionId, artifactId, rev, author: authorInput } = params;

  const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
  const metadataFilename = await findMetadataFileByArtifactId(artifactsFolder, artifactId);
  if (!metadataFilename) {
    throw new Error(`Artifact ${artifactId} not found`);
  }

  const metadataPath = path.join(artifactsFolder, metadataFilename);
  const rawMeta = await fs.readFile(metadataPath, 'utf-8');
  const record = JSON.parse(rawMeta) as SessionArtifactRecord;
  const contentFilename = record.filename;
  if (!contentFilename) {
    throw new Error(`Artifact ${artifactId} has no content filename`);
  }

  const revDir = getRevisionDir(artifactsFolder, contentFilename);
  const binary = isBinaryFileType(record.type || 'markdown');
  const buf = await readRevisionContent(revDir, rev, binary);
  const content = binary ? buf.toString('base64') : buf.toString('utf-8');

  const r = await updateArtifact({
    experienceId,
    sessionId,
    artifactId,
    content,
    author: authorInput,
    message: `Restored from version ${rev}`,
  });

  return { artifact: r.artifact, content: r.content };
}

export async function getRevisionEntry(params: {
  experienceId: string;
  sessionId: string;
  artifactId: string;
  rev: number;
}): Promise<{ revisionMeta: ArtifactRevisionMeta; content: string } | null> {
  const { experienceId, sessionId, artifactId, rev } = params;
  const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
  const metadataFilename = await findMetadataFileByArtifactId(artifactsFolder, artifactId);
  if (!metadataFilename) return null;

  const metadataPath = path.join(artifactsFolder, metadataFilename);
  const rawMeta = await fs.readFile(metadataPath, 'utf-8');
  const record = JSON.parse(rawMeta) as SessionArtifactRecord;
  const contentFilename = record.filename;
  if (!contentFilename) return null;

  const revDir = getRevisionDir(artifactsFolder, contentFilename);
  const binary = isBinaryFileType(record.type || 'markdown');
  const revisionMeta = await readRevisionMeta(revDir, rev);
  if (!revisionMeta) return null;

  const buf = await readRevisionContent(revDir, rev, binary);
  const content = binary ? buf.toString('base64') : buf.toString('utf-8');

  return { revisionMeta, content };
}

export async function listArtifactRevisions(params: {
  experienceId: string;
  sessionId: string;
  artifactId: string;
}): Promise<{ revisions: ArtifactRevisionMeta[]; currentRev: number } | null> {
  const { experienceId, sessionId, artifactId } = params;
  const head = await readArtifactHead({ experienceId, sessionId, artifactId });
  if (!head) return null;

  const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
  const revisions = await listRevisionMetas(artifactsFolder, head.filename);

  return {
    revisions,
    currentRev: head.currentRev ?? 1,
  };
}
