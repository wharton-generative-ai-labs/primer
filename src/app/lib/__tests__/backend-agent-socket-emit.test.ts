/**
 * @jest-environment node
 *
 * Backend agent → frontend write propagation.
 *
 * `createSocketToolContext` wraps `createServerToolContext`'s artifact
 * mutators so every successful create / update / delete emits a socket
 * event the frontend can listen to. Without these wrappers the doc panel
 * banner / version switcher / library are blind to backend agent activity.
 *
 * These tests stub `createServerToolContext` and the storage helpers it
 * calls during the post-write fan-out, then drive the wrappers and assert
 * the right socket payloads land on the wire.
 *
 * Runs under the `node` environment because `backend-agent-socket.ts`
 * transitively imports the OpenAI client, which throws under the default
 * JSDOM env to keep API keys out of browsers.
 */

const mockBaseContext: {
  createArtifact: jest.Mock;
  updateArtifact: jest.Mock;
  deleteArtifact: jest.Mock;
} = {
  createArtifact: jest.fn(),
  updateArtifact: jest.fn(),
  deleteArtifact: jest.fn(),
};

jest.mock('@/app/api/backend-agent/utils/context', () => ({
  createServerToolContext: jest.fn(async () => mockBaseContext),
}));

jest.mock('@/app/lib/artifacts/storage', () => ({
  readArtifactHead: jest.fn(),
  listArtifactRevisions: jest.fn(),
}));

import { createSocketToolContext } from '@/app/lib/backend-agent-socket';
import { readArtifactHead, listArtifactRevisions } from '@/app/lib/artifacts/storage';

const mockReadHead = readArtifactHead as jest.Mock;
const mockListRevs = listArtifactRevisions as jest.Mock;

const HEAD_FIXTURE = {
  id: 'art-1',
  name: 'Demo',
  type: 'markdown',
  filename: 'demo.md',
  createdAt: '2026-04-28T12:00:00.000Z',
  updatedAt: '2026-04-28T12:01:00.000Z',
  currentRev: 2,
  lastAuthor: { kind: 'user', email: 'a@x', name: 'Alice' },
  content: '# v2',
};

const REVS_FIXTURE = {
  currentRev: 2,
  revisions: [
    {
      rev: 1,
      artifactId: 'art-1',
      contentHash: 'h1',
      author: { kind: 'user', email: 'a@x', name: 'Alice' },
      parentRev: null,
      createdAt: '2026-04-28T12:00:00.000Z',
    },
    {
      rev: 2,
      artifactId: 'art-1',
      contentHash: 'h2',
      author: { kind: 'user', email: 'a@x', name: 'Alice' },
      parentRev: 1,
      createdAt: '2026-04-28T12:01:00.000Z',
    },
  ],
};

function freshSocket() {
  return { emit: jest.fn() };
}

beforeEach(() => {
  mockBaseContext.createArtifact.mockReset();
  mockBaseContext.updateArtifact.mockReset();
  mockBaseContext.deleteArtifact.mockReset();
  mockReadHead.mockReset();
  mockListRevs.mockReset();
});

describe('createSocketToolContext artifact write fan-out', () => {
  it('emits artifact.changed after createArtifact with head + revisions', async () => {
    mockBaseContext.createArtifact.mockResolvedValue({ id: 'art-1' });
    mockReadHead.mockResolvedValue(HEAD_FIXTURE);
    mockListRevs.mockResolvedValue(REVS_FIXTURE);

    const socket = freshSocket();
    const ctx = await createSocketToolContext({
      experienceId: 'exp-1',
      sessionId: 'sess-1',
      delegationId: 'del-1',
      socket,
      requestManager: {},
    });

    await ctx.createArtifact!({ name: 'Demo', content: '# v1', type: 'markdown' } as any);

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('artifact.changed', {
      sessionId: 'sess-1',
      artifactId: 'art-1',
      artifact: HEAD_FIXTURE,
      revisions: REVS_FIXTURE.revisions,
    });
  });

  it('emits artifact.changed after updateArtifact with the freshly-read head', async () => {
    mockBaseContext.updateArtifact.mockResolvedValue(undefined);
    mockReadHead.mockResolvedValue(HEAD_FIXTURE);
    mockListRevs.mockResolvedValue(REVS_FIXTURE);

    const socket = freshSocket();
    const ctx = await createSocketToolContext({
      experienceId: 'exp-1',
      sessionId: 'sess-1',
      delegationId: 'del-1',
      socket,
      requestManager: {},
    });

    await ctx.updateArtifact!('art-1', '# v2');

    expect(mockBaseContext.updateArtifact).toHaveBeenCalledWith('art-1', '# v2');
    expect(socket.emit).toHaveBeenCalledTimes(1);
    const [event, payload] = socket.emit.mock.calls[0];
    expect(event).toBe('artifact.changed');
    expect(payload.artifactId).toBe('art-1');
    expect(payload.artifact).toEqual(HEAD_FIXTURE);
    expect(payload.revisions).toEqual(REVS_FIXTURE.revisions);
  });

  it('emits artifact.deleted after deleteArtifact (no head/revisions read)', async () => {
    mockBaseContext.deleteArtifact.mockResolvedValue(undefined);

    const socket = freshSocket();
    const ctx = await createSocketToolContext({
      experienceId: 'exp-1',
      sessionId: 'sess-1',
      delegationId: 'del-1',
      socket,
      requestManager: {},
    });

    await ctx.deleteArtifact!('art-1');

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('artifact.deleted', {
      sessionId: 'sess-1',
      artifactId: 'art-1',
    });
    // The deleted path doesn't need to refetch — the id is enough.
    expect(mockReadHead).not.toHaveBeenCalled();
    expect(mockListRevs).not.toHaveBeenCalled();
  });

  it('skips emit when readArtifactHead returns null (artifact vanished mid-write)', async () => {
    mockBaseContext.updateArtifact.mockResolvedValue(undefined);
    mockReadHead.mockResolvedValue(null);
    mockListRevs.mockResolvedValue(REVS_FIXTURE);

    const socket = freshSocket();
    const ctx = await createSocketToolContext({
      experienceId: 'exp-1',
      sessionId: 'sess-1',
      delegationId: 'del-1',
      socket,
      requestManager: {},
    });

    await ctx.updateArtifact!('art-1', '# v2');

    // Best-effort guarantee: storage write happened, but no head means we
    // can't build a complete payload, so we don't emit a partial event.
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('does not let an emit failure surface to the agent (best-effort fan-out)', async () => {
    mockBaseContext.updateArtifact.mockResolvedValue(undefined);
    mockReadHead.mockRejectedValue(new Error('disk unplugged'));

    const socket = freshSocket();
    const ctx = await createSocketToolContext({
      experienceId: 'exp-1',
      sessionId: 'sess-1',
      delegationId: 'del-1',
      socket,
      requestManager: {},
    });

    // The wrapper must swallow the post-write fetch error so the agent's
    // turn doesn't fail just because the UI fan-out couldn't run.
    await expect(ctx.updateArtifact!('art-1', '# v2')).resolves.toBeUndefined();
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
