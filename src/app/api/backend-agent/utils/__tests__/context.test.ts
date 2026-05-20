/**
 * Tests for `createServerToolContext`'s workflow-phase accessors.
 *
 * The backend-agent tool context exposes `getCurrentWorkflowPhase` and
 * `getWorkflowPhases` synchronously. The values come from a one-shot read of
 * `experience.json` and the session metadata at context creation. This test
 * verifies the loader returns real phase info when both files are present
 * (so the agent tool's phase-gate code applies to backend callers) and falls
 * back to null/empty when either is missing.
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { createServerToolContext } from '../context';

jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Stub the InformationStore so we don't need the real persistence layer
// for these accessor-only tests.
jest.mock('@/app/lib/tools/server/InformationStore', () => ({
  createInformationStore: jest.fn(() => ({
    getAllKeys: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(false),
  })),
}));

// Stub toast notification (would otherwise try to reach the websocket layer).
jest.mock('../toast', () => ({
  sendToastNotification: jest.fn().mockResolvedValue(undefined),
}));

describe('createServerToolContext workflow-phase accessors', () => {
  let storageRoot: string;
  let originalStorageRoot: string | undefined;

  const experienceId = 'phase-fixture';
  const sessionId = 'session-1';

  beforeEach(async () => {
    storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'primer-ctx-test-'));
    originalStorageRoot = process.env.STORAGE_ROOT_PATH;
    process.env.STORAGE_ROOT_PATH = storageRoot;
  });

  afterEach(async () => {
    if (originalStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT_PATH;
    } else {
      process.env.STORAGE_ROOT_PATH = originalStorageRoot;
    }
    await fs.rm(storageRoot, { recursive: true, force: true });
  });

  async function writeFixture({
    workflowPhases,
    workflowPhaseState,
  }: {
    workflowPhases?: unknown;
    workflowPhaseState?: unknown;
  }): Promise<void> {
    const experienceFolder = path.join(storageRoot, experienceId);
    await fs.mkdir(experienceFolder, { recursive: true });
    const experiencePayload: Record<string, unknown> = {
      id: experienceId,
      name: 'Phase Fixture',
    };
    if (workflowPhases !== undefined) {
      experiencePayload.workflowPhases = workflowPhases;
    }
    await fs.writeFile(
      path.join(experienceFolder, 'experience.json'),
      JSON.stringify(experiencePayload),
      'utf-8',
    );

    const sessionFolder = path.join(experienceFolder, 'session_data', sessionId);
    await fs.mkdir(sessionFolder, { recursive: true });
    const metadataPayload: Record<string, unknown> = {
      sessionId,
      experienceId,
      startTime: new Date().toISOString(),
      events: [],
    };
    if (workflowPhaseState !== undefined) {
      metadataPayload.workflowPhaseState = workflowPhaseState;
    }
    await fs.writeFile(
      path.join(sessionFolder, 'session.json'),
      JSON.stringify(metadataPayload),
      'utf-8',
    );
  }

  it('returns the current phase computed from disk metadata + experience config', async () => {
    await writeFixture({
      workflowPhases: [
        { id: 'intake', title: 'Intake', allowedDelegates: [] },
        {
          id: 'designing',
          title: 'Designing',
          allowedDelegates: ['design-agent'],
        },
      ],
      workflowPhaseState: {
        currentPhase: 'designing',
        furthestPhase: 'designing',
        visited: ['intake', 'designing'],
        completedPhases: ['intake'],
        snapshots: {},
      },
    });

    const ctx = await createServerToolContext(experienceId, sessionId);

    expect(ctx.getWorkflowPhases?.()).toHaveLength(2);
    const current = ctx.getCurrentWorkflowPhase?.();
    expect(current).toBeTruthy();
    expect(current?.id).toBe('designing');
    expect(current?.index).toBe(1);
    expect(current?.total).toBe(2);
    expect(current?.isCompleted).toBe(false);
  });

  it('exposes allowedDelegates so the agent tool gate fires for backend callers', async () => {
    // Sanity: the gate logic in agent-tool.ts reads allowedDelegates off the
    // phase config returned by getWorkflowPhases. If the backend context
    // surfaces those values, the gate works without any agent-tool change.
    await writeFixture({
      workflowPhases: [
        {
          id: 'intake',
          title: 'Intake',
          allowedDelegates: ['intake-helper'],
        },
        {
          id: 'designing',
          title: 'Designing',
          allowedDelegates: ['design-agent'],
        },
      ],
      workflowPhaseState: {
        currentPhase: 'intake',
        furthestPhase: 'intake',
        visited: ['intake'],
        completedPhases: [],
        snapshots: {},
      },
    });

    const ctx = await createServerToolContext(experienceId, sessionId);
    const phases = ctx.getWorkflowPhases?.() ?? [];
    const intake = phases.find((p) => p.id === 'intake');
    expect(intake?.allowedDelegates).toEqual(['intake-helper']);
  });

  it('returns null current-phase when no phases are configured', async () => {
    await writeFixture({});
    const ctx = await createServerToolContext(experienceId, sessionId);
    expect(ctx.getCurrentWorkflowPhase?.()).toBeNull();
    expect(ctx.getWorkflowPhases?.()).toEqual([]);
  });

  it('returns null current-phase when the session metadata is missing state', async () => {
    await writeFixture({
      workflowPhases: [{ id: 'intake', title: 'Intake' }],
      // workflowPhaseState intentionally absent
    });
    const ctx = await createServerToolContext(experienceId, sessionId);
    expect(ctx.getCurrentWorkflowPhase?.()).toBeNull();
    // Phases still surface for `discover` listing purposes.
    expect(ctx.getWorkflowPhases?.()).toHaveLength(1);
  });

  it('does not throw when the experience.json file is missing', async () => {
    // No fixture written at all — both reads will fail.
    await expect(
      createServerToolContext(experienceId, sessionId),
    ).resolves.toBeDefined();
  });
});

describe('createServerToolContext "current" experience-id resolution', () => {
  let storageRoot: string;
  let originalStorageRoot: string | undefined;

  const experienceId = 'phase-fixture';
  const sessionId = 'session-1';

  beforeEach(async () => {
    storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'primer-ctx-cur-'));
    originalStorageRoot = process.env.STORAGE_ROOT_PATH;
    process.env.STORAGE_ROOT_PATH = storageRoot;
  });

  afterEach(async () => {
    if (originalStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT_PATH;
    } else {
      process.env.STORAGE_ROOT_PATH = originalStorageRoot;
    }
    await fs.rm(storageRoot, { recursive: true, force: true });
  });

  async function writeMinimalExperience(id: string): Promise<void> {
    const experienceFolder = path.join(storageRoot, id);
    await fs.mkdir(experienceFolder, { recursive: true });
    await fs.writeFile(
      path.join(experienceFolder, 'experience.json'),
      JSON.stringify({ id, name: id }, null, 2),
      'utf-8',
    );
  }

  it('after copyTemplate, getResourceContent("current", ...) reads from the new id', async () => {
    // Set up the source experience the agent will copy from.
    await writeMinimalExperience(experienceId);

    const ctx = await createServerToolContext(experienceId, sessionId);

    // Sanity: before any create/copy, "current" still falls through to the
    // literal lookup and surfaces the existing not-found path.
    await expect(
      ctx.getResourceContent!('current', 'experience.json'),
    ).rejects.toThrow();

    // The agent calls copyTemplate. We don't care about the surface result
    // here — only that the closure tracks the new id.
    const newId = await ctx.copyTemplate!(experienceId);
    expect(typeof newId).toBe('string');
    expect(newId).not.toBe(experienceId);

    // Now "current" should resolve to the newly-created experience.
    const content = await ctx.getResourceContent!(
      'current',
      'experience.json',
    );
    expect(content.isText).toBe(true);
    const parsed = JSON.parse(content.content);
    // copyTemplate seeds an id field — confirm we read the *new* one.
    expect(parsed.id).toBe(experienceId);
    // Also confirm that the file lives under the new folder by checking
    // we can write through "current" and the file shows up there.
    await ctx.createFile!('current', 'agent-wrote.txt', 'hello');
    const written = await fs.readFile(
      path.join(storageRoot, newId, 'agent-wrote.txt'),
      'utf-8',
    );
    expect(written).toBe('hello');
  });

  it('without prior create, "current" falls through to literal lookup and fails clearly', async () => {
    const ctx = await createServerToolContext(experienceId, sessionId);
    // Nothing has been created yet, so "current" is treated as a literal
    // experience id. The folder doesn't exist — we should see a clear error
    // rather than a silent success or a TypeError.
    await expect(
      ctx.getResourceContent!('current', 'experience.json'),
    ).rejects.toThrow(/Resource not found|Failed to get resource content|ENOENT/);
  });

  it('after createExperience, "current" resolves to the new id', async () => {
    const ctx = await createServerToolContext(experienceId, sessionId);
    const newId = await ctx.createExperience!();
    expect(typeof newId).toBe('string');

    // The freshly-created experience.json should be readable via "current".
    const content = await ctx.getResourceContent!(
      'current',
      'experience.json',
    );
    expect(content.isText).toBe(true);
    const parsed = JSON.parse(content.content);
    expect(parsed.id).toBe(newId);
  });
});

describe('createServerToolContext file-mutation methods', () => {
  let storageRoot: string;
  let originalStorageRoot: string | undefined;

  const experienceId = 'mut-fixture';
  const sessionId = 'session-mut';

  beforeEach(async () => {
    storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'primer-ctx-mut-'));
    originalStorageRoot = process.env.STORAGE_ROOT_PATH;
    process.env.STORAGE_ROOT_PATH = storageRoot;
  });

  afterEach(async () => {
    if (originalStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT_PATH;
    } else {
      process.env.STORAGE_ROOT_PATH = originalStorageRoot;
    }
    await fs.rm(storageRoot, { recursive: true, force: true });
  });

  async function writeExperienceWithFile(
    relativeFilePath: string,
    content = 'hello',
  ): Promise<void> {
    const experienceFolder = path.join(storageRoot, experienceId);
    const fullFilePath = path.join(experienceFolder, relativeFilePath);
    await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
    await fs.writeFile(fullFilePath, content, 'utf-8');
    const experienceJsonPath = path.join(experienceFolder, 'experience.json');
    try {
      await fs.access(experienceJsonPath);
    } catch {
      await fs.writeFile(
        experienceJsonPath,
        JSON.stringify({ id: experienceId, name: experienceId }),
        'utf-8',
      );
    }
  }

  async function fileExists(relPath: string): Promise<boolean> {
    try {
      await fs.access(path.join(storageRoot, experienceId, relPath));
      return true;
    } catch {
      return false;
    }
  }

  it('deleteFile removes an existing file', async () => {
    await writeExperienceWithFile('resources/img.png');
    const ctx = await createServerToolContext(experienceId, sessionId);

    await ctx.deleteFile!(experienceId, 'resources/img.png');

    expect(await fileExists('resources/img.png')).toBe(false);
  });

  it('deleteFile throws on a missing file', async () => {
    await writeExperienceWithFile('resources/img.png');
    const ctx = await createServerToolContext(experienceId, sessionId);

    await expect(
      ctx.deleteFile!(experienceId, 'resources/nonexistent.png'),
    ).rejects.toThrow(/Failed to delete file|ENOENT/);
  });

  it('deleteDirectory removes a directory and its contents', async () => {
    await writeExperienceWithFile('resources/scenes/mentor.png');
    const ctx = await createServerToolContext(experienceId, sessionId);

    await ctx.deleteDirectory!(experienceId, 'resources/scenes');

    expect(await fileExists('resources/scenes/mentor.png')).toBe(false);
    expect(await fileExists('resources/scenes')).toBe(false);
  });

  it('moveFile relocates a file to an existing destination directory', async () => {
    await writeExperienceWithFile('src/a.txt', 'content');
    const destDir = path.join(storageRoot, experienceId, 'dst');
    await fs.mkdir(destDir, { recursive: true });
    const ctx = await createServerToolContext(experienceId, sessionId);

    await ctx.moveFile!(experienceId, 'src/a.txt', 'dst/a.txt');

    expect(await fileExists('dst/a.txt')).toBe(true);
    expect(await fileExists('src/a.txt')).toBe(false);
    const moved = await fs.readFile(
      path.join(storageRoot, experienceId, 'dst/a.txt'),
      'utf-8',
    );
    expect(moved).toBe('content');
  });

  it('moveFile creates the destination directory when it does not exist', async () => {
    await writeExperienceWithFile('src/a.txt', 'content');
    const ctx = await createServerToolContext(experienceId, sessionId);

    await ctx.moveFile!(experienceId, 'src/a.txt', 'new-dst/subdir/a.txt');

    expect(await fileExists('new-dst/subdir/a.txt')).toBe(true);
    expect(await fileExists('src/a.txt')).toBe(false);
  });

  it('moveDirectory relocates a directory and its contents', async () => {
    await writeExperienceWithFile('src-dir/file.txt', 'data');
    const ctx = await createServerToolContext(experienceId, sessionId);

    await ctx.moveDirectory!(experienceId, 'src-dir', 'dst-dir');

    expect(await fileExists('dst-dir/file.txt')).toBe(true);
    expect(await fileExists('src-dir/file.txt')).toBe(false);
  });

  it('deleteFile respects the "current" id alias after createExperience', async () => {
    const ctx = await createServerToolContext(experienceId, sessionId);
    const newId = await ctx.createExperience!();

    // Write a file directly into the newly-created experience folder.
    const newExpFolder = path.join(storageRoot, newId);
    await fs.writeFile(path.join(newExpFolder, 'to-delete.txt'), 'bye', 'utf-8');

    // Delete via the "current" alias — should resolve to newId's folder.
    await ctx.deleteFile!('current', 'to-delete.txt');

    await expect(
      fs.access(path.join(newExpFolder, 'to-delete.txt')),
    ).rejects.toThrow();
  });
});

describe('createServerToolContext path-traversal protection', () => {
  let storageRoot: string;
  let originalStorageRoot: string | undefined;

  const experienceId = 'trav-fixture';
  const sessionId = 'session-trav';

  beforeEach(async () => {
    storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'primer-ctx-trav-'));
    originalStorageRoot = process.env.STORAGE_ROOT_PATH;
    process.env.STORAGE_ROOT_PATH = storageRoot;

    // Seed: the target experience folder + a sibling we'll try to attack,
    // plus a "secret" file above the storage root.
    await fs.mkdir(path.join(storageRoot, experienceId), { recursive: true });
    await fs.writeFile(
      path.join(storageRoot, experienceId, 'experience.json'),
      JSON.stringify({ id: experienceId }),
      'utf-8',
    );
    await fs.mkdir(path.join(storageRoot, 'sibling'), { recursive: true });
    await fs.writeFile(
      path.join(storageRoot, 'sibling', 'secret.txt'),
      'do not read',
      'utf-8',
    );
  });

  afterEach(async () => {
    if (originalStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT_PATH;
    } else {
      process.env.STORAGE_ROOT_PATH = originalStorageRoot;
    }
    await fs.rm(storageRoot, { recursive: true, force: true });
  });

  it('rejects traversal experienceId', async () => {
    await expect(
      createServerToolContext('../sibling', sessionId),
    ).resolves.toBeDefined();
    // Context creation tolerates IO failures (workflow-phase reads), but any
    // call that hits getExperienceFolder must throw.
    const ctx = await createServerToolContext(experienceId, sessionId);
    await expect(
      ctx.getResourceContent!('../sibling', 'secret.txt'),
    ).rejects.toThrow(/Invalid experience ID/);
  });

  const traversalPaths = [
    '../sibling/secret.txt',
    '../../escape.txt',
    '/etc/passwd',
    'foo/../../sibling/secret.txt',
  ];

  it.each(traversalPaths)('deleteFile rejects traversal: %s', async (badPath) => {
    const ctx = await createServerToolContext(experienceId, sessionId);
    await expect(ctx.deleteFile!(experienceId, badPath)).rejects.toThrow(
      /Invalid path|traversal/,
    );
    // Sibling secret still exists.
    await expect(
      fs.access(path.join(storageRoot, 'sibling', 'secret.txt')),
    ).resolves.toBeUndefined();
  });

  it.each(traversalPaths)('deleteDirectory rejects traversal: %s', async (badPath) => {
    const ctx = await createServerToolContext(experienceId, sessionId);
    await expect(
      ctx.deleteDirectory!(experienceId, badPath),
    ).rejects.toThrow(/Invalid path|traversal/);
    await expect(
      fs.access(path.join(storageRoot, 'sibling')),
    ).resolves.toBeUndefined();
  });

  it('deleteDirectory refuses to delete the experience root itself', async () => {
    const ctx = await createServerToolContext(experienceId, sessionId);
    await expect(ctx.deleteDirectory!(experienceId, '.')).rejects.toThrow(
      /Refusing to delete the experience root/,
    );
    await expect(
      fs.access(path.join(storageRoot, experienceId, 'experience.json')),
    ).resolves.toBeUndefined();
  });

  it.each(traversalPaths)('createFile rejects traversal: %s', async (badPath) => {
    const ctx = await createServerToolContext(experienceId, sessionId);
    await expect(
      ctx.createFile!(experienceId, badPath, 'pwned'),
    ).rejects.toThrow(/Invalid path|traversal/);
  });

  it.each(traversalPaths)('createDirectory rejects traversal: %s', async (badPath) => {
    const ctx = await createServerToolContext(experienceId, sessionId);
    await expect(
      ctx.createDirectory!(experienceId, badPath),
    ).rejects.toThrow(/Invalid path|traversal/);
  });

  it.each(traversalPaths)('getResourceContent rejects traversal: %s', async (badPath) => {
    const ctx = await createServerToolContext(experienceId, sessionId);
    await expect(
      ctx.getResourceContent!(experienceId, badPath),
    ).rejects.toThrow(/Invalid path|traversal/);
  });

  it('moveFile rejects traversal in source or destination', async () => {
    const ctx = await createServerToolContext(experienceId, sessionId);
    await fs.writeFile(
      path.join(storageRoot, experienceId, 'inside.txt'),
      'safe',
      'utf-8',
    );
    await expect(
      ctx.moveFile!(experienceId, '../sibling/secret.txt', 'stolen.txt'),
    ).rejects.toThrow(/Invalid path|traversal/);
    await expect(
      ctx.moveFile!(experienceId, 'inside.txt', '../sibling/leaked.txt'),
    ).rejects.toThrow(/Invalid path|traversal/);
    // Inside file still where it was.
    await expect(
      fs.access(path.join(storageRoot, experienceId, 'inside.txt')),
    ).resolves.toBeUndefined();
  });

  it('moveDirectory rejects traversal in source or destination', async () => {
    const ctx = await createServerToolContext(experienceId, sessionId);
    await fs.mkdir(path.join(storageRoot, experienceId, 'sub'), { recursive: true });
    await expect(
      ctx.moveDirectory!(experienceId, '../sibling', 'sub'),
    ).rejects.toThrow(/Invalid path|traversal/);
    await expect(
      ctx.moveDirectory!(experienceId, 'sub', '../sibling/leaked'),
    ).rejects.toThrow(/Invalid path|traversal/);
  });
});
