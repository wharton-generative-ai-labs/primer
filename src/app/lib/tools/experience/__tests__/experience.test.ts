import { copyTemplate, createExperience } from '../experience';
import type { ToolContext } from '@/app/lib/tools/types';

interface FakeArtifact {
  id: string;
  name: string;
  type: string;
  content: string;
  metadata?: { tags?: string[] };
}

function makeContext(opts: {
  newExperienceId: string;
  artifacts: FakeArtifact[];
  fail?: boolean;
}) {
  const store = opts.artifacts.map((a) => ({ ...a }));
  const updateSpy = jest.fn(async (id: string, content: string) => {
    const target = store.find((a) => a.id === id);
    if (!target) throw new Error(`Artifact ${id} not found`);
    target.content = content;
  });

  const context: ToolContext = {
    listArtifacts: jest.fn(async () =>
      store.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        content: a.content,
        metadata: a.metadata,
      })),
    ),
    updateArtifact: updateSpy,
    createExperience: jest.fn(async () => {
      if (opts.fail) throw new Error('boom');
      return opts.newExperienceId;
    }),
    copyTemplate: jest.fn(async (_template: string) => {
      if (opts.fail) throw new Error('boom');
      return opts.newExperienceId;
    }),
  };

  return { context, store, updateSpy };
}

describe('createExperience tool', () => {
  it('writes the new experienceId into the result:experience-id artifact on success', async () => {
    const { context, store } = makeContext({
      newExperienceId: 'created-slug-123',
      artifacts: [
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: '', metadata: { tags: ['result:experience-id'] } },
      ],
    });

    const result = await createExperience({}, context);

    expect(result.status).toBe('success');
    expect(result.data.experienceId).toBe('created-slug-123');
    expect(store.find((a) => a.id === 'art-built')?.content).toBe('created-slug-123');
  });

  it('does not touch the result artifact when createExperience fails', async () => {
    const { context, store, updateSpy } = makeContext({
      newExperienceId: 'unused',
      fail: true,
      artifacts: [
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: 'previous', metadata: { tags: ['result:experience-id'] } },
      ],
    });

    const result = await createExperience({}, context);

    expect(result.status).toBe('error');
    expect(updateSpy).not.toHaveBeenCalled();
    expect(store.find((a) => a.id === 'art-built')?.content).toBe('previous');
  });

  it('succeeds silently when there is no result:experience-id artifact in the session', async () => {
    const { context, updateSpy } = makeContext({
      newExperienceId: 'created-slug-456',
      artifacts: [
        { id: 'art-other', name: 'Some Other Artifact', type: 'markdown', content: '', metadata: { tags: ['unrelated'] } },
      ],
    });

    const result = await createExperience({}, context);

    expect(result.status).toBe('success');
    expect(result.data.experienceId).toBe('created-slug-456');
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

describe('copyTemplate tool', () => {
  it('writes the new experienceId into the result:experience-id artifact on success', async () => {
    const { context, store } = makeContext({
      newExperienceId: 'copied-slug-789',
      artifacts: [
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: '', metadata: { tags: ['result:experience-id'] } },
      ],
    });

    const result = await copyTemplate({ templateExperienceId: 'roleplay-template' }, context);

    expect(result.status).toBe('success');
    expect(result.data.experienceId).toBe('copied-slug-789');
    expect(store.find((a) => a.id === 'art-built')?.content).toBe('copied-slug-789');
  });

  it('overwrites an existing slug in the artifact (last-write-wins)', async () => {
    const { context, store } = makeContext({
      newExperienceId: 'second-slug',
      artifacts: [
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: 'first-slug', metadata: { tags: ['result:experience-id'] } },
      ],
    });

    const result = await copyTemplate({ templateExperienceId: 'roleplay-template' }, context);

    expect(result.status).toBe('success');
    expect(store.find((a) => a.id === 'art-built')?.content).toBe('second-slug');
  });

  it('does not touch the result artifact when copyTemplate fails', async () => {
    const { context, store, updateSpy } = makeContext({
      newExperienceId: 'unused',
      fail: true,
      artifacts: [
        { id: 'art-built', name: 'Built Experience', type: 'markdown', content: 'previous', metadata: { tags: ['result:experience-id'] } },
      ],
    });

    const result = await copyTemplate({ templateExperienceId: 'roleplay-template' }, context);

    expect(result.status).toBe('error');
    expect(updateSpy).not.toHaveBeenCalled();
    expect(store.find((a) => a.id === 'art-built')?.content).toBe('previous');
  });
});
