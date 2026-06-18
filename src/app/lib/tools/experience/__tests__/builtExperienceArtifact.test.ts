import { writeBuiltExperienceArtifact } from '../builtExperienceArtifact';
import type { ToolContext } from '@/app/lib/tools/types';

jest.mock('@/lib/logger', () => {
  const log = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return { createModuleLogger: () => log };
});

const mockLogger = jest.requireMock('@/lib/logger').createModuleLogger();

interface FakeArtifact {
  id: string;
  name: string;
  type: string;
  content: string;
  metadata?: { tags?: string[] };
}

interface FakeContextHandle {
  artifacts: FakeArtifact[];
  context: ToolContext;
  listSpy: jest.Mock;
  updateSpy: jest.Mock;
}

function makeContext(artifacts: FakeArtifact[], opts?: { omitList?: boolean; omitUpdate?: boolean }): FakeContextHandle {
  const store = artifacts.map((a) => ({ ...a }));
  const listSpy = jest.fn(async () =>
    store.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      content: a.content,
      metadata: a.metadata,
    })),
  );
  const updateSpy = jest.fn(async (id: string, content: string) => {
    const target = store.find((a) => a.id === id);
    if (!target) throw new Error(`Artifact ${id} not found`);
    target.content = content;
  });

  const context: ToolContext = {};
  if (!opts?.omitList) (context as any).listArtifacts = listSpy;
  if (!opts?.omitUpdate) (context as any).updateArtifact = updateSpy;

  return { artifacts: store, context, listSpy, updateSpy };
}

describe('writeBuiltExperienceArtifact', () => {
  beforeEach(() => {
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  describe('happy path', () => {
    it('writes the experienceId into the artifact tagged result:experience-id', async () => {
      const handle = makeContext([
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: '', metadata: { tags: ['result:experience-id'] } },
      ]);

      await writeBuiltExperienceArtifact(handle.context, 'm6ivyzgxhtm');

      expect(handle.artifacts[0].content).toBe('m6ivyzgxhtm');
      expect(handle.updateSpy).toHaveBeenCalledTimes(1);
      expect(handle.updateSpy).toHaveBeenCalledWith('art-built', 'm6ivyzgxhtm');
    });

    it('ignores other tagged artifacts and writes only into the result:experience-id one', async () => {
      const handle = makeContext([
        { id: 'art-design', name: 'Design Document', type: 'markdown', content: 'design body', metadata: { tags: ['design'] } },
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: '', metadata: { tags: ['result:experience-id'] } },
        { id: 'art-checklist', name: 'Build Progress', type: 'checklist', content: '[]', metadata: { tags: ['phase:build'] } },
      ]);

      await writeBuiltExperienceArtifact(handle.context, 'newexp123');

      expect(handle.artifacts.find((a) => a.id === 'art-design')?.content).toBe('design body');
      expect(handle.artifacts.find((a) => a.id === 'art-built')?.content).toBe('newexp123');
      expect(handle.artifacts.find((a) => a.id === 'art-checklist')?.content).toBe('[]');
      expect(handle.updateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('idempotence', () => {
    it('called twice with the same slug leaves the artifact at that slug', async () => {
      const handle = makeContext([
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: '', metadata: { tags: ['result:experience-id'] } },
      ]);

      await writeBuiltExperienceArtifact(handle.context, 'sameSlug');
      await writeBuiltExperienceArtifact(handle.context, 'sameSlug');

      expect(handle.artifacts[0].content).toBe('sameSlug');
    });
  });

  describe('different slug overwrite', () => {
    it('writing slug A then slug B leaves the artifact at slug B (last-write-wins)', async () => {
      const handle = makeContext([
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: '', metadata: { tags: ['result:experience-id'] } },
      ]);

      await writeBuiltExperienceArtifact(handle.context, 'slugA');
      await writeBuiltExperienceArtifact(handle.context, 'slugB');

      expect(handle.artifacts[0].content).toBe('slugB');
    });

    it('overwrites a non-empty existing slug', async () => {
      const handle = makeContext([
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: 'oldSlug', metadata: { tags: ['result:experience-id'] } },
      ]);

      await writeBuiltExperienceArtifact(handle.context, 'newSlug');

      expect(handle.artifacts[0].content).toBe('newSlug');
    });
  });

  describe('missing tagged artifact', () => {
    it('returns silently without calling updateArtifact when no artifact has the result:experience-id tag', async () => {
      const handle = makeContext([
        { id: 'art-design', name: 'Design Document', type: 'markdown', content: 'design body', metadata: { tags: ['design'] } },
      ]);

      await expect(writeBuiltExperienceArtifact(handle.context, 'someExp')).resolves.toBeUndefined();

      expect(handle.updateSpy).not.toHaveBeenCalled();
    });

    it('returns silently when the artifact list is empty', async () => {
      const handle = makeContext([]);

      await expect(writeBuiltExperienceArtifact(handle.context, 'someExp')).resolves.toBeUndefined();

      expect(handle.updateSpy).not.toHaveBeenCalled();
    });

    it('returns silently when an artifact has metadata without tags', async () => {
      const handle = makeContext([
        { id: 'art-x', name: 'No Tags', type: 'markdown', content: '', metadata: {} },
      ]);

      await expect(writeBuiltExperienceArtifact(handle.context, 'someExp')).resolves.toBeUndefined();

      expect(handle.updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('missing capabilities', () => {
    it('returns silently when listArtifacts is unavailable', async () => {
      const handle = makeContext([
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: '', metadata: { tags: ['result:experience-id'] } },
      ], { omitList: true });

      await expect(writeBuiltExperienceArtifact(handle.context, 'someExp')).resolves.toBeUndefined();

      expect(handle.updateSpy).not.toHaveBeenCalled();
    });

    it('returns silently when updateArtifact is unavailable', async () => {
      const handle = makeContext([
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: '', metadata: { tags: ['result:experience-id'] } },
      ], { omitUpdate: true });

      await expect(writeBuiltExperienceArtifact(handle.context, 'someExp')).resolves.toBeUndefined();

      expect(handle.listSpy).not.toHaveBeenCalled();
    });
  });

  // Track G diagnostic logging — until we observe a real run we don't know
  // why writeBuiltExperienceArtifact silently no-ops in production. These
  // tests pin the logger contract so the next QA run produces actionable
  // evidence in dev logs.
  describe('diagnostic logging', () => {
    it('warns when capabilities are missing', async () => {
      const handle = makeContext([], { omitList: true });

      await writeBuiltExperienceArtifact(handle.context, 'exp');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ hasListArtifacts: false, hasUpdateArtifact: true }),
        expect.stringMatching(/skipped/i),
      );
    });

    it('warns with artifact count + tag summary when no tagged artifact found', async () => {
      const handle = makeContext([
        { id: 'art-design', name: 'Design Document', type: 'markdown', content: '', metadata: { tags: ['design'] } },
      ]);

      await writeBuiltExperienceArtifact(handle.context, 'exp');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          artifactCount: 1,
          // Surface the tag distribution so the operator can see which tags
          // ARE present vs. the missing result:experience-id tag.
          tagSamples: expect.any(Array),
        }),
        expect.stringMatching(/no artifact.*result:experience-id/i),
      );
    });

    it('logs a debug line before + after a successful write', async () => {
      const handle = makeContext([
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: '', metadata: { tags: ['result:experience-id'] } },
      ]);

      await writeBuiltExperienceArtifact(handle.context, 'newexp');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ taggedId: 'art-built', experienceId: 'newexp' }),
        expect.stringMatching(/writing/i),
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ taggedId: 'art-built' }),
        expect.stringMatching(/wrote/i),
      );
    });

    it('logs and rethrows when updateArtifact fails', async () => {
      const handle = makeContext([
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: '', metadata: { tags: ['result:experience-id'] } },
      ]);
      handle.updateSpy.mockRejectedValueOnce(new Error('disk full'));

      await expect(writeBuiltExperienceArtifact(handle.context, 'exp')).rejects.toThrow('disk full');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ taggedId: 'art-built' }),
        expect.stringMatching(/failed/i),
      );
    });
  });
});
