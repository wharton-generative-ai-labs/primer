import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { fireObjectiveSignal } from '@/app/lib/workflow-phases/objectiveSignals';

jest.mock('@/app/lib/workflow-phases/objectiveSignals', () => ({
  fireObjectiveSignal: jest.fn().mockResolvedValue(undefined),
}));

const mockFire = fireObjectiveSignal as jest.Mock;

// `STORAGE_ROOT_PATH` is read through `src/config/env`, which validates and
// caches `process.env` once at module load. By the time a test file runs,
// that cache is already populated — mutating `process.env` later has no
// effect. To redirect storage to a tmpdir we mock `file-utils` instead,
// which is the only consumer of the env var inside the storage layer.
const TEST_ROOT = path.join(
  os.tmpdir(),
  `primer-storage-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
);

jest.mock('@/app/lib/file-utils', () => {
  const actual = jest.requireActual('@/app/lib/file-utils');
  const nodePath = jest.requireActual('path') as typeof import('path');
  return {
    ...actual,
    getExperienceFolder: async (experienceId: string) =>
      nodePath.join(TEST_ROOT, experienceId),
    getExperienceArtifactsFolder: async (experienceId: string, sessionId: string) =>
      nodePath.join(TEST_ROOT, experienceId, 'session_data', sessionId, 'artifacts'),
    getSessionMetadataFilePath: async (experienceId: string, sessionId: string) =>
      nodePath.join(TEST_ROOT, experienceId, 'session_data', sessionId, 'session.json'),
  };
});

import {
  createArtifact,
  updateArtifact,
  restoreArtifactRevision,
  listArtifactRevisions,
  readArtifactHead,
  normalizeArtifactRecord,
} from '@/app/lib/artifacts/storage';
import { hashContent } from '@/app/lib/artifacts/revisions';
import type { SessionArtifactRecord } from '@/app/lib/artifacts/types';

const TEST_USER = { kind: 'user' as const, email: 'test@example.com', name: 'Tester' };
const EXPERIENCE_ID = 'exp-test';

let sessionCounter = 0;
function nextSessionId(): string {
  sessionCounter += 1;
  return `sess-${sessionCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

afterAll(async () => {
  try {
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
  } catch {
    // best effort
  }
});

describe('normalizeArtifactRecord', () => {
  it('defaults missing currentRev to 1', () => {
    const rec = {
      id: 'a',
      name: 'n',
      type: 'markdown',
      filename: 'a.md',
      createdAt: '',
      updatedAt: '',
    } satisfies SessionArtifactRecord;

    expect(normalizeArtifactRecord(rec).currentRev).toBe(1);
  });

  it('preserves explicit currentRev', () => {
    const rec = {
      id: 'a',
      name: 'n',
      type: 'markdown',
      filename: 'a.md',
      createdAt: '',
      updatedAt: '',
      currentRev: 4,
    } satisfies SessionArtifactRecord;

    expect(normalizeArtifactRecord(rec).currentRev).toBe(4);
  });
});

describe('hashContent', () => {
  it('hashes utf-8 text deterministically', () => {
    expect(hashContent('hello')).toBe(hashContent(Buffer.from('hello', 'utf-8')));
  });
});

describe('storage write path (integration)', () => {
  let sessionId: string;

  beforeEach(() => {
    sessionId = nextSessionId();
  });

  it('createArtifact writes head + rev-1 + sets lastAuthor', async () => {
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Doc',
      content: '# v1',
      author: TEST_USER,
    });

    expect(artifact.currentRev).toBe(1);
    expect(artifact.lastAuthor).toEqual({
      kind: 'user',
      email: TEST_USER.email,
      name: TEST_USER.name,
    });

    const head = await readArtifactHead({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
    });
    expect(head?.content).toBe('# v1');

    const listed = await listArtifactRevisions({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
    });
    expect(listed?.revisions).toHaveLength(1);
    expect(listed?.revisions[0].rev).toBe(1);
    expect(listed?.revisions[0].parentRev).toBeNull();
  });

  it('updateArtifact bumps currentRev, persists rev-N, and refreshes lastAuthor', async () => {
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Doc',
      content: '# v1',
      author: TEST_USER,
    });

    const result = await updateArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
      content: '# v2',
      author: { kind: 'agent', agentKey: 'hal-9000' },
    });

    expect(result.noop).toBeUndefined();
    expect(result.artifact.currentRev).toBe(2);
    expect(result.artifact.lastAuthor?.kind).toBe('agent');
    if (result.artifact.lastAuthor?.kind === 'agent') {
      expect(result.artifact.lastAuthor.agentKey).toBe('hal-9000');
      // Display name falls back to agentKey when experience.json isn't found,
      // which is the case in this tmpdir setup. That's the documented
      // resolveAgentDisplayName fallback.
      expect(result.artifact.lastAuthor.name).toBe('hal-9000');
    }

    const listed = await listArtifactRevisions({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
    });
    expect(listed?.revisions.map((r) => r.rev)).toEqual([1, 2]);
    expect(listed?.revisions[1].parentRev).toBe(1);
  });

  it('updateArtifact returns noop when content is byte-identical (utf-8)', async () => {
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Doc',
      content: 'same',
      author: TEST_USER,
    });

    const result = await updateArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
      content: 'same',
      author: TEST_USER,
    });

    expect(result.noop).toBe(true);
    expect(result.artifact.currentRev).toBe(1);
    expect(result.content).toBe('same');
  });

  it('updateArtifact returns noop for byte-identical binary buffers', async () => {
    const png = Buffer.from('\x89PNG\r\n\x1a\nbinarydata').toString('base64');
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'image',
      content: png,
      type: 'png',
      author: TEST_USER,
    });

    const result = await updateArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
      content: png,
      author: TEST_USER,
    });

    expect(result.noop).toBe(true);
    expect(result.artifact.currentRev).toBe(1);
  });

  it('bootstrap-on-write seeds rev-1 (system) when artifact was never rev-aware', async () => {
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Legacy',
      content: 'legacy v1',
      author: TEST_USER,
    });
    const artifactsFolder = path.join(
      TEST_ROOT,
      EXPERIENCE_ID,
      'session_data',
      sessionId,
      'artifacts',
    );
    // Simulate a pre-revisions artifact: drop the .revisions sidecar and
    // strip the currentRev/lastAuthor fields from meta. The next write
    // should hit the bootstrap-on-write path and seed rev-1 (system).
    // We discover the meta file dynamically by id rather than guessing the
    // filename — slugification + collision suffixing makes the on-disk
    // name harder to predict than artifact.id.
    const baseName = path.parse(artifact.filename).name;
    await fs.rm(path.join(artifactsFolder, `${baseName}.revisions`), {
      recursive: true,
      force: true,
    });
    const folderEntries = await fs.readdir(artifactsFolder);
    let metaPath: string | undefined;
    for (const file of folderEntries) {
      if (!file.endsWith('.json')) continue;
      const candidate = path.join(artifactsFolder, file);
      try {
        const parsed = JSON.parse(await fs.readFile(candidate, 'utf-8')) as { id?: string };
        if (parsed.id === artifact.id) {
          metaPath = candidate;
          break;
        }
      } catch {
        // ignore non-meta json files (e.g. revision sidecars)
      }
    }
    if (!metaPath) throw new Error(`meta for ${artifact.id} not found`);
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8')) as SessionArtifactRecord;
    delete meta.currentRev;
    delete meta.lastAuthor;
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

    const result = await updateArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
      content: 'legacy v2',
      author: TEST_USER,
    });

    expect(result.artifact.currentRev).toBe(2);
    const listed = await listArtifactRevisions({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
    });
    expect(listed?.revisions).toHaveLength(2);
    expect(listed?.revisions[0].rev).toBe(1);
    expect(listed?.revisions[0].author.kind).toBe('system');
    expect(listed?.revisions[1].rev).toBe(2);
  });

  it('concurrent updateArtifact calls produce monotonic rev numbers', async () => {
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Hot',
      content: 'v1',
      author: TEST_USER,
    });

    // Fan-out 5 distinct writes in parallel. The keyedMutex must serialize
    // them so we end at rev=6 with exactly one rev per write (no skips, no
    // collisions).
    await Promise.all(
      [2, 3, 4, 5, 6].map((n) =>
        updateArtifact({
          experienceId: EXPERIENCE_ID,
          sessionId,
          artifactId: artifact.id,
          content: `v${n}`,
          author: TEST_USER,
        }),
      ),
    );

    const listed = await listArtifactRevisions({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
    });
    expect(listed?.revisions.map((r) => r.rev)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(listed?.currentRev).toBe(6);
  });

  it('createArtifact: same name + same type + same agents coerces to update of existing artifact', async () => {
    // The "iterate then save again" agent pattern was producing sibling
    // artifacts via the counter-suffix path. A second create with the same
    // logical identity should now bump the existing artifact's revision
    // instead.
    const first = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Practice Prompt',
      content: '# v1',
      author: TEST_USER,
    });

    const second = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Practice Prompt',
      content: '# v2',
      author: TEST_USER,
    });

    // Same artifact id (no sibling created).
    expect(second.artifact.id).toBe(first.artifact.id);
    expect(second.artifact.currentRev).toBe(2);

    const head = await readArtifactHead({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: first.artifact.id,
    });
    expect(head?.content).toBe('# v2');

    // No `_(1)` sibling was created on disk.
    const folder = path.join(
      TEST_ROOT,
      EXPERIENCE_ID,
      'session_data',
      sessionId,
      'artifacts',
    );
    const entries = await fs.readdir(folder);
    expect(entries.some((f) => /_\(1\)/.test(f))).toBe(false);
  });

  it('createArtifact: same name + same agents declaration treats undefined and undefined as equal', async () => {
    const first = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Doc',
      content: 'a',
      author: TEST_USER,
    });
    const second = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Doc',
      content: 'b',
      author: TEST_USER,
    });
    expect(second.artifact.id).toBe(first.artifact.id);
    expect(second.artifact.currentRev).toBe(2);
  });

  it('createArtifact: same name but different type does not coerce to update', async () => {
    // Two artifacts with the same display name but different types are
    // clearly distinct logical artifacts that just happen to share a
    // name. The same-name → update coercion must NOT fire here — the
    // second create remains a brand-new rev-1 artifact, not a rev-2 of
    // the first.
    const first = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Asset',
      content: '# notes',
      type: 'markdown',
      author: TEST_USER,
    });

    const png = Buffer.from('\x89PNG\r\n\x1a\nbinary').toString('base64');
    const second = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Asset',
      content: png,
      type: 'png',
      author: TEST_USER,
    });

    // Both filenames live side-by-side because the extensions differ.
    // The key invariant: the second create did NOT bump the first
    // artifact's revision (which would have happened if the coercion
    // had misfired across types).
    expect(first.artifact.filename.endsWith('.md')).toBe(true);
    expect(second.artifact.filename.endsWith('.png')).toBe(true);
    expect(second.artifact.currentRev).toBe(1);
  });

  it('createArtifact: parenthesized suffix on new name coerces to update of unsuffixed existing', async () => {
    // The Casting Director was observed re-saving as
    // "Mentor Prompt (Template-Preserved)" when "Mentor Prompt" already
    // existed, producing a sibling artifact and confusing downstream
    // consumers. The suffix-stripped lookup must coerce to an update of
    // the existing artifact when type and agents match.
    const first = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Mentor Prompt',
      content: '# v1',
      author: TEST_USER,
    });

    const second = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Mentor Prompt (Template-Preserved)',
      content: '# v2',
      author: TEST_USER,
    });

    expect(second.artifact.id).toBe(first.artifact.id);
    expect(second.artifact.currentRev).toBe(2);
    // The display name is preserved from the original record — the
    // coercion is "this is the same artifact, save a new revision," not
    // "rename it to the suffixed form."
    expect(second.artifact.name).toBe('Mentor Prompt');

    const head = await readArtifactHead({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: first.artifact.id,
    });
    expect(head?.content).toBe('# v2');
  });

  it('createArtifact: short parenthesized suffix (Foo (v2)) coerces when type+agents match', async () => {
    const first = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Foo',
      content: 'one',
      author: TEST_USER,
    });

    const second = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Foo (v2)',
      content: 'two',
      author: TEST_USER,
    });

    expect(second.artifact.id).toBe(first.artifact.id);
    expect(second.artifact.currentRev).toBe(2);
  });

  it('createArtifact: parenthesized-suffix coercion does NOT fire when type differs', async () => {
    // Different types are distinct logical artifacts even if the names
    // share a base. The suffix-stripped lookup must still respect the
    // type+agents gate that the exact-match path uses, so the legacy
    // counter-suffix sibling path remains correct here.
    const first = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Asset',
      content: '# notes',
      type: 'markdown',
      author: TEST_USER,
    });

    const png = Buffer.from('\x89PNG\r\n\x1a\nbinary').toString('base64');
    const second = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Asset (icon)',
      content: png,
      type: 'png',
      author: TEST_USER,
    });

    // The second create did NOT bump the first artifact's revision.
    expect(second.artifact.id).not.toBe(first.artifact.id);
    expect(first.artifact.currentRev).toBe(1);
    expect(second.artifact.currentRev).toBe(1);
    expect(first.artifact.filename.endsWith('.md')).toBe(true);
    expect(second.artifact.filename.endsWith('.png')).toBe(true);
  });

  it('createArtifact: same name + same type but different agents falls through to counter-suffix sibling', async () => {
    // `agents` declares which agents can read/write the artifact. Two
    // same-named artifacts with different agent scopes are functionally
    // distinct, so the counter-suffix path is correct here.
    const first = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Shared Doc',
      content: 'one',
      agents: { writer: ['alpha'] },
      author: TEST_USER,
    });

    const second = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Shared Doc',
      content: 'two',
      agents: { writer: ['beta'] },
      author: TEST_USER,
    });

    expect(second.artifact.id).not.toBe(first.artifact.id);
    expect(second.artifact.currentRev).toBe(1);
    // The second artifact gets the counter-suffix filename because both
    // resolve to the same `shared_doc.md` base.
    expect(second.artifact.filename).toMatch(/_\(1\)/);
  });

  it('createArtifact: empty content is allowed (placeholder artifacts carry tags)', async () => {
    // Declared artifacts with 0-byte source files (e.g. result-tag
    // placeholders) must still be seeded so their `metadata.tags` are
    // available for downstream lookups.
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Built Experience Id',
      content: '',
      metadata: { tags: ['result:experience-id'] },
      author: TEST_USER,
    });

    expect(artifact.metadata).toEqual({ tags: ['result:experience-id'] });
    const head = await readArtifactHead({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
    });
    expect(head?.content).toBe('');
    expect(head?.metadata).toEqual({ tags: ['result:experience-id'] });
  });

  it('restoreArtifactRevision: parentRev points to prior head (linear), not to source rev', async () => {
    // Locks in the deviation from the original plan: we keep parentRev
    // linear (== workingRev at the time of write) so the rev graph stays
    // a chain. Audit info ("which rev did we restore from") lives in the
    // `message` field instead.
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Restorable',
      content: 'v1',
      author: TEST_USER,
    });
    await updateArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
      content: 'v2',
      author: TEST_USER,
    });
    await updateArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
      content: 'v3',
      author: TEST_USER,
    });

    const restored = await restoreArtifactRevision({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
      rev: 1,
      author: TEST_USER,
    });

    expect(restored.artifact.currentRev).toBe(4);
    expect(restored.content).toBe('v1');

    const listed = await listArtifactRevisions({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
    });
    const rev4 = listed?.revisions.find((r) => r.rev === 4);
    expect(rev4?.parentRev).toBe(3);
    expect(rev4?.message).toMatch(/restored from version 1/i);
  });
});

describe('storage — artifact-write hook fires objective signal', () => {
  let sessionId: string;

  beforeEach(() => {
    sessionId = nextSessionId();
    mockFire.mockClear();
  });

  it('createArtifact with non-empty content fires newlyPopulated: true', async () => {
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Doc',
      content: 'hello',
      author: TEST_USER,
    });
    expect(mockFire).toHaveBeenCalledWith(
      expect.objectContaining({
        experienceId: EXPERIENCE_ID,
        sessionId,
        signal: {
          kind: 'artifactWrite',
          slug: artifact.id,
          newlyPopulated: true,
        },
      }),
    );
  });

  it('createArtifact with empty content fires newlyPopulated: false', async () => {
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Empty',
      content: '',
      author: TEST_USER,
    });
    expect(mockFire).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: {
          kind: 'artifactWrite',
          slug: artifact.id,
          newlyPopulated: false,
        },
      }),
    );
  });

  it('createArtifact with whitespace-only content fires newlyPopulated: false', async () => {
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Ws',
      content: '   \n  \t',
      author: TEST_USER,
    });
    expect(mockFire).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.objectContaining({ slug: artifact.id, newlyPopulated: false }),
      }),
    );
  });

  it('updateArtifact empty → non-empty fires newlyPopulated: true', async () => {
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Doc',
      content: '',
      author: TEST_USER,
    });
    mockFire.mockClear();
    await updateArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
      content: 'first content',
      author: TEST_USER,
    });
    expect(mockFire).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: { kind: 'artifactWrite', slug: artifact.id, newlyPopulated: true },
      }),
    );
  });

  it('updateArtifact non-empty → non-empty fires newlyPopulated: false', async () => {
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Doc',
      content: 'first',
      author: TEST_USER,
    });
    mockFire.mockClear();
    await updateArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
      content: 'second',
      author: TEST_USER,
    });
    expect(mockFire).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: { kind: 'artifactWrite', slug: artifact.id, newlyPopulated: false },
      }),
    );
  });

  it('updateArtifact no-op (same content) does NOT fire signal', async () => {
    const { artifact } = await createArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      name: 'Doc',
      content: 'same',
      author: TEST_USER,
    });
    mockFire.mockClear();
    await updateArtifact({
      experienceId: EXPERIENCE_ID,
      sessionId,
      artifactId: artifact.id,
      content: 'same',
      author: TEST_USER,
    });
    expect(mockFire).not.toHaveBeenCalled();
  });
});
