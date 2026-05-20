/**
 * Tests for the per-session metadata write lock.
 *
 * Each test points the storage root at a temp dir so the helper hits real
 * disk through `getSessionMetadataFilePath`. That keeps the lock + atomic
 * write paths under test instead of mocking them away.
 *
 * @jest-environment node
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tempRoot: string;

// Set STORAGE_ROOT_PATH before importing modules that read env at module load.
beforeAll(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mutate-session-metadata-'));
  process.env.STORAGE_ROOT_PATH = tempRoot;
});

afterAll(async () => {
  delete process.env.STORAGE_ROOT_PATH;
  await fs.rm(tempRoot, { recursive: true, force: true });
});

// Pull in the SUT after the env var is set so any module-load env reads see it.
import {
  mutateSessionMetadata,
  SessionMetadataNotFoundError,
} from '@/app/lib/sessions/mutateSessionMetadata';
import {
  getSessionMetadataFilePath,
  SessionMetadata,
} from '@/app/lib/file-utils';

async function seedSession(
  experienceId: string,
  sessionId: string,
  overrides: Partial<SessionMetadata> = {},
): Promise<string> {
  const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  const metadata: SessionMetadata = {
    sessionId,
    experienceId,
    startTime: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    events: [],
    ...overrides,
  };
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  return metadataPath;
}

async function readSession(experienceId: string, sessionId: string): Promise<SessionMetadata> {
  const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
  const raw = await fs.readFile(metadataPath, 'utf-8');
  return JSON.parse(raw);
}

describe('mutateSessionMetadata', () => {
  it('serializes concurrent mutations on the same (experienceId, sessionId)', async () => {
    const experienceId = 'exp-serialize';
    const sessionId = 'sess-serialize';
    await seedSession(experienceId, sessionId);

    // Track the order in which mutator bodies start and the metadata each one
    // observes. If the lock is real, B must not start until A's mutator
    // promise has resolved AND the write has been flushed.
    const startOrder: string[] = [];
    const observedEventCounts: Record<string, number> = {};

    let resolveA!: () => void;
    const aGate = new Promise<void>((resolve) => {
      resolveA = resolve;
    });

    let aStarted!: () => void;
    const aStartedSignal = new Promise<void>((resolve) => {
      aStarted = resolve;
    });

    const callA = mutateSessionMetadata(experienceId, sessionId, async (meta) => {
      startOrder.push('A:start');
      observedEventCounts['A'] = meta.events.length;
      aStarted();
      await aGate;
      startOrder.push('A:end');
      meta.events.push({
        event: 'first',
        agent: 'system',
        timestamp: new Date().toISOString(),
      });
      return meta;
    });

    // Wait for A to have actually entered its mutator before queueing B —
    // that way B is unambiguously waiting on the lock, not just on the disk
    // read for A.
    await aStartedSignal;

    const callB = mutateSessionMetadata(experienceId, sessionId, async (meta) => {
      startOrder.push('B:start');
      observedEventCounts['B'] = meta.events.length;
      meta.events.push({
        event: 'second',
        agent: 'system',
        timestamp: new Date().toISOString(),
      });
      return meta;
    });

    // Drain microtasks to give B a chance to (incorrectly) start ahead of
    // A's completion if serialization were broken.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(startOrder).toEqual(['A:start']);

    resolveA();
    await Promise.all([callA, callB]);

    // Strict ordering: A starts, A finishes, then B starts.
    expect(startOrder).toEqual(['A:start', 'A:end', 'B:start']);
    // B observed A's appended event (read-modify-write was atomic).
    expect(observedEventCounts).toEqual({ A: 0, B: 1 });

    const finalMetadata = await readSession(experienceId, sessionId);
    expect(finalMetadata.events.map((e) => e.event)).toEqual(['first', 'second']);
  });

  it('runs concurrent mutations on different sessions in parallel', async () => {
    const experienceId = 'exp-parallel';
    await seedSession(experienceId, 'sess-A');
    await seedSession(experienceId, 'sess-B');

    let resolveA!: () => void;
    const aGate = new Promise<void>((resolve) => {
      resolveA = resolve;
    });

    let bStarted!: () => void;
    const bStartedSignal = new Promise<void>((resolve) => {
      bStarted = resolve;
    });

    const callA = mutateSessionMetadata(experienceId, 'sess-A', async (meta) => {
      await aGate;
      return meta;
    });

    const callB = mutateSessionMetadata(experienceId, 'sess-B', async (meta) => {
      bStarted();
      return meta;
    });

    // Without the same-session lock blocking B, B must reach its mutator
    // even though A is parked on its gate. This await would never resolve
    // if cross-session calls were serialized.
    await bStartedSignal;

    resolveA();
    await Promise.all([callA, callB]);
  });

  it('throws SessionMetadataNotFoundError when session.json is missing', async () => {
    await expect(
      mutateSessionMetadata('exp-missing', 'sess-missing', async (meta) => meta),
    ).rejects.toBeInstanceOf(SessionMetadataNotFoundError);
  });

  it('returns the wrapped result to the caller when mutator returns { metadata, result }', async () => {
    const experienceId = 'exp-wrapped';
    const sessionId = 'sess-wrapped';
    await seedSession(experienceId, sessionId);

    const value = await mutateSessionMetadata<{ ok: boolean; count: number }>(
      experienceId,
      sessionId,
      async (meta) => {
        meta.events.push({
          event: 'noted',
          agent: 'system',
          timestamp: new Date().toISOString(),
        });
        return { metadata: meta, result: { ok: true, count: meta.events.length } };
      },
    );

    expect(value).toEqual({ ok: true, count: 1 });
    const persisted = await readSession(experienceId, sessionId);
    expect(persisted.events).toHaveLength(1);
    expect(persisted.events[0].event).toBe('noted');
  });

  it('returns undefined when the mutator returns metadata directly (T = void)', async () => {
    const experienceId = 'exp-unwrapped';
    const sessionId = 'sess-unwrapped';
    await seedSession(experienceId, sessionId);

    const value = await mutateSessionMetadata(experienceId, sessionId, async (meta) => {
      meta.lastActivity = new Date('2026-02-02T00:00:00.000Z').toISOString();
      return meta;
    });

    expect(value).toBeUndefined();
    const persisted = await readSession(experienceId, sessionId);
    expect(persisted.lastActivity).toBe('2026-02-02T00:00:00.000Z');
  });

  it('writes atomically: rename target already existing leaves a complete file, not a partial', async () => {
    const experienceId = 'exp-atomic';
    const sessionId = 'sess-atomic';
    const metadataPath = await seedSession(experienceId, sessionId, {
      lastActivity: 'old',
    });

    // Sanity check: the rename target already exists from `seedSession`. The
    // helper must overwrite it wholesale, not leave a half-written file.
    const before = await fs.readFile(metadataPath, 'utf-8');
    expect(before).toContain('"lastActivity": "old"');

    await mutateSessionMetadata(experienceId, sessionId, async (meta) => {
      meta.lastActivity = 'fresh';
      meta.events.push({
        event: 'after-rename',
        agent: 'system',
        timestamp: new Date().toISOString(),
      });
      return meta;
    });

    // Final file must round-trip cleanly through JSON.parse and reflect the
    // mutator's full output. No mid-write artifacts (truncated payload, stray
    // temp files in the dir).
    const after = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as SessionMetadata;
    expect(after.lastActivity).toBe('fresh');
    expect(after.events.map((e) => e.event)).toEqual(['after-rename']);

    const dir = path.dirname(metadataPath);
    const entries = await fs.readdir(dir);
    const tmpLeftovers = entries.filter((name) => name.endsWith('.tmp'));
    expect(tmpLeftovers).toEqual([]);
  });
});
