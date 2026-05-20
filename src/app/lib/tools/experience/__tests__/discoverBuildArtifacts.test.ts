import { discoverBuildArtifacts } from '../discoverBuildArtifacts';
import type { ToolContext } from '@/app/lib/tools/types';

interface FakeArtifact {
  id: string;
  name?: string;
  type?: string;
  metadata?: { tags?: string[] };
}

function makeContext(artifacts: FakeArtifact[], opts?: { omitList?: boolean }): ToolContext {
  const ctx: any = {};
  if (!opts?.omitList) {
    ctx.listArtifacts = jest.fn(async () => artifacts);
  }
  return ctx as ToolContext;
}

describe('discoverBuildArtifacts', () => {
  describe('happy path', () => {
    it('discovers all six canonical build artifacts and assigns deterministic destinations', async () => {
      const ctx = makeContext([
        { id: 'mentor_prompt' },
        { id: 'practice_prompt' },
        { id: 'feedback_prompt' },
        { id: 'mentor_scene', type: 'png' },
        { id: 'practice_scene', type: 'png' },
        { id: 'feedback_scene', type: 'png' },
        { id: 'design_document' },
        { id: 'phases_configuration' },
        { id: 'build_progress', metadata: { tags: ['phase:build'] } },
      ]);

      const result = await discoverBuildArtifacts(ctx);

      expect(result.prompts).toEqual([
        { artifactId: 'mentor_prompt',   destinationPath: 'resources/instructions/agent', fileName: 'mentor.md' },
        { artifactId: 'practice_prompt', destinationPath: 'resources/instructions/agent', fileName: 'practice.md' },
        { artifactId: 'feedback_prompt', destinationPath: 'resources/instructions/agent', fileName: 'feedback.md' },
      ]);
      expect(result.scenes).toEqual([
        { artifactId: 'mentor_scene',   destinationPath: 'resources/scenes', fileName: 'mentor-scene.png' },
        { artifactId: 'practice_scene', destinationPath: 'resources/scenes', fileName: 'practice-scene.png' },
        { artifactId: 'feedback_scene', destinationPath: 'resources/scenes', fileName: 'feedback-scene.png' },
      ]);
      expect(result.missing).toEqual([]);
    });

    it('ignores unrelated artifacts in the session', async () => {
      const ctx = makeContext([
        { id: 'design_document' },
        { id: 'mentor_prompt' },
        { id: 'practice_prompt' },
        { id: 'feedback_prompt' },
        { id: 'mentor_scene' },
        { id: 'practice_scene' },
        { id: 'feedback_scene' },
        { id: 'random_other_artifact' },
        { id: 'image_generation_process_notes' },
      ]);

      const result = await discoverBuildArtifacts(ctx);

      expect(result.prompts.map((p) => p.artifactId)).toEqual([
        'mentor_prompt', 'practice_prompt', 'feedback_prompt',
      ]);
      expect(result.scenes.map((p) => p.artifactId)).toEqual([
        'mentor_scene', 'practice_scene', 'feedback_scene',
      ]);
      expect(result.missing).toEqual([]);
    });
  });

  describe('missing artifacts', () => {
    it('reports each missing canonical slug with the role it would have filled', async () => {
      const ctx = makeContext([
        { id: 'mentor_prompt' },
        { id: 'feedback_prompt' },
        { id: 'mentor_scene' },
        { id: 'feedback_scene' },
      ]);

      const result = await discoverBuildArtifacts(ctx);

      expect(result.prompts.map((p) => p.artifactId)).toEqual(['mentor_prompt', 'feedback_prompt']);
      expect(result.scenes.map((p) => p.artifactId)).toEqual(['mentor_scene', 'feedback_scene']);
      expect(result.missing).toEqual(
        expect.arrayContaining([
          { artifactId: 'practice_prompt', kind: 'prompt' },
          { artifactId: 'practice_scene', kind: 'scene' },
        ]),
      );
      expect(result.missing).toHaveLength(2);
    });

    it('reports all six as missing when the session has no canonical artifacts', async () => {
      const ctx = makeContext([
        { id: 'design_document' },
        { id: 'random_other_artifact' },
      ]);

      const result = await discoverBuildArtifacts(ctx);

      expect(result.prompts).toEqual([]);
      expect(result.scenes).toEqual([]);
      expect(result.missing).toHaveLength(6);
    });
  });

  describe('context guard', () => {
    it('throws a descriptive error when listArtifacts is unavailable', async () => {
      const ctx = makeContext([], { omitList: true });

      await expect(discoverBuildArtifacts(ctx)).rejects.toThrow(/listArtifacts/i);
    });
  });

  describe('output ordering', () => {
    it('always returns prompts in mentor-practice-feedback order regardless of storage order', async () => {
      const ctx = makeContext([
        { id: 'feedback_prompt' },
        { id: 'mentor_prompt' },
        { id: 'practice_prompt' },
      ]);

      const result = await discoverBuildArtifacts(ctx);

      expect(result.prompts.map((p) => p.artifactId)).toEqual([
        'mentor_prompt', 'practice_prompt', 'feedback_prompt',
      ]);
    });

    it('always returns scenes in mentor-practice-feedback order regardless of storage order', async () => {
      const ctx = makeContext([
        { id: 'feedback_scene' },
        { id: 'mentor_scene' },
        { id: 'practice_scene' },
      ]);

      const result = await discoverBuildArtifacts(ctx);

      expect(result.scenes.map((p) => p.artifactId)).toEqual([
        'mentor_scene', 'practice_scene', 'feedback_scene',
      ]);
    });
  });
});
