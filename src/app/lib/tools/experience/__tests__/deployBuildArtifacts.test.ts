import { deployBuildArtifacts } from '../experience';
import type { Resource } from '../types';

interface FakeFile {
  path: string;
  content: string;
  encoding?: string;
}

interface FakeArtifact {
  id: string;
  name: string;
  type: string;
  content: string;
}

/**
 * Construct a minimal `ToolContext`-shaped object that supports both
 * `listArtifacts` (used by the discover helper inside
 * `deployBuildArtifacts`) AND the file/dir/artifact accessors used by
 * the inner `deployArtifact` calls.
 */
function makeContext(opts: {
  artifacts: FakeArtifact[];
  initialFiles?: string[];
}) {
  const files: FakeFile[] = (opts.initialFiles ?? []).map((p) => ({ path: p, content: 'placeholder' }));
  const deletedPaths: string[] = [];

  const artifactsById: Record<string, FakeArtifact> = {};
  for (const a of opts.artifacts) artifactsById[a.id] = a;

  const listSpy = jest.fn(async () => opts.artifacts.map((a) => ({ id: a.id, name: a.name, type: a.type })));

  return {
    files,
    deletedPaths,
    listSpy,
    context: {
      experienceId: 'parent-experience',
      listArtifacts: listSpy,
      getArtifact: jest.fn(async (id: string) => artifactsById[id] ?? null),
      createFile: jest.fn(async (_id: string, p: string, content: string, encoding?: string) => {
        const existing = files.findIndex((f) => f.path === p);
        if (existing >= 0) files[existing] = { path: p, content, encoding };
        else files.push({ path: p, content, encoding });
      }),
      createDirectory: jest.fn(async () => {}),
      deleteFile: jest.fn(async (_id: string, p: string) => {
        const idx = files.findIndex((f) => f.path === p);
        if (idx >= 0) files.splice(idx, 1);
        deletedPaths.push(p);
      }),
      listResources: jest.fn(async (): Promise<Resource[]> =>
        files.map((f) => ({ path: f.path, type: 'file' as const })),
      ),
    },
  };
}

const sixCanonicalArtifacts: FakeArtifact[] = [
  { id: 'mentor_prompt',   name: 'Mentor Prompt',   type: 'markdown', content: 'mentor body' },
  { id: 'practice_prompt', name: 'Practice Prompt', type: 'markdown', content: 'practice body' },
  { id: 'feedback_prompt', name: 'Feedback Prompt', type: 'markdown', content: 'feedback body' },
  { id: 'mentor_scene',    name: 'Mentor Scene',    type: 'png',      content: 'BASE64MENTOR' },
  { id: 'practice_scene',  name: 'Practice Scene',  type: 'png',      content: 'BASE64PRACTICE' },
  { id: 'feedback_scene',  name: 'Feedback Scene',  type: 'png',      content: 'BASE64FEEDBACK' },
];

describe('deployBuildArtifacts', () => {
  describe('happy path', () => {
    it('deploys all six canonical artifacts to deterministic destinations using slug ids', async () => {
      const { context, files } = makeContext({ artifacts: sixCanonicalArtifacts });

      const result = await deployBuildArtifacts(
        { experienceId: 'new-exp-slug' },
        context as any,
      );

      expect(result.status).toBe('success');
      expect(result.data.deployed).toHaveLength(6);
      expect(result.data.failed).toEqual([]);
      expect(result.data.missing).toEqual([]);

      expect(files.map((f) => f.path).sort()).toEqual([
        'resources/instructions/agent/feedback.md',
        'resources/instructions/agent/mentor.md',
        'resources/instructions/agent/practice.md',
        'resources/scenes/feedback-scene.png',
        'resources/scenes/mentor-scene.png',
        'resources/scenes/practice-scene.png',
      ]);
    });

    it('reads ids from listArtifacts (caller never passes ids)', async () => {
      const { context, listSpy } = makeContext({ artifacts: sixCanonicalArtifacts });

      await deployBuildArtifacts(
        { experienceId: 'new-exp-slug' },
        context as any,
      );

      expect(listSpy).toHaveBeenCalled();
    });

    it('uses the parent experienceId from context when args.experienceId is omitted', async () => {
      const { context, files } = makeContext({ artifacts: sixCanonicalArtifacts });

      const result = await deployBuildArtifacts({}, context as any);

      expect(result.status).toBe('success');
      // We don't track per-call experienceId in this fixture, but a successful
      // deploy proves it was resolved.
      expect(files).toHaveLength(6);
    });
  });

  describe('partial input — failure surface', () => {
    it('reports each missing canonical slug and still deploys the ones present', async () => {
      const { context } = makeContext({
        artifacts: [
          sixCanonicalArtifacts[0], // mentor_prompt
          sixCanonicalArtifacts[2], // feedback_prompt
          sixCanonicalArtifacts[3], // mentor_scene
        ],
      });

      const result = await deployBuildArtifacts(
        { experienceId: 'new-exp-slug' },
        context as any,
      );

      expect(result.status).toBe('error');
      expect(result.data.deployed).toHaveLength(3);
      // The missing list MUST identify the role and slug so the operator can
      // see which step of the build pipeline didn't publish its artifact.
      expect(result.data.missing).toEqual(
        expect.arrayContaining([
          { artifactId: 'practice_prompt', kind: 'prompt' },
          { artifactId: 'practice_scene', kind: 'scene' },
          { artifactId: 'feedback_scene', kind: 'scene' },
        ]),
      );
    });

    it('continues past a single deployArtifact failure and reports it in `failed`', async () => {
      const { context } = makeContext({ artifacts: sixCanonicalArtifacts });
      // Make the practice_prompt deploy fail.
      const original = (context as any).getArtifact;
      (context as any).getArtifact = jest.fn(async (id: string) => {
        if (id === 'practice_prompt') return null; // triggers "Artifact not found"
        return original(id);
      });

      const result = await deployBuildArtifacts(
        { experienceId: 'new-exp-slug' },
        context as any,
      );

      expect(result.status).toBe('error');
      expect(result.data.deployed).toHaveLength(5);
      expect(result.data.failed).toEqual([
        expect.objectContaining({ artifactId: 'practice_prompt' }),
      ]);
    });
  });

  describe('context guard', () => {
    it('errors when experienceId can be resolved from neither args nor context', async () => {
      const { context } = makeContext({ artifacts: sixCanonicalArtifacts });
      delete (context as any).experienceId;

      const result = await deployBuildArtifacts({}, context as any);

      expect(result.status).toBe('error');
      expect(result.data.error).toMatch(/experienceId/i);
    });
  });
});
