/**
 * Server-side guard for `modifyExperience`.
 *
 * QA-observed failure mode: the design-agent occasionally emits a
 * Phases Configuration artifact with phases shaped like
 *   { title, description, objectives, prompts, activities }
 * (no `id`, no `initialAgent`, no `promptFragments`). The
 * experience-builder JSON.parses the artifact and passes it through to
 * `modifyExperience`. The compiler used to do `{ ...experience,
 * ...operation.data }` with no validation, silently overwriting the
 * template's correctly-shaped phases with garbage. The next time the
 * server tried to load the experience, `loadWorkflowPhases` blew up with:
 *
 *   Error: Duplicate workflow phase id: "undefined".
 *
 * after both `b84c2mhxpi9` and `lql5wxo2lea` had already been corrupted on
 * disk. These tests pin the guard so that regression can't happen again.
 */

import { MatterCompiler } from '../MatterCompiler';
import type { Experience, MatterCompilerContext } from '../types';

function makeContext(initial: Experience): {
  context: MatterCompilerContext;
  saved: { path: string; content: string }[];
} {
  const saved: { path: string; content: string }[] = [];
  let current = initial;

  const context = {
    getResourceContent: jest.fn(async (_id: string, path: string) => {
      if (path === 'experience.json') {
        return {
          content: JSON.stringify(current),
          contentType: 'application/json',
          isText: true,
        };
      }
      throw new Error(`unexpected resource ${path}`);
    }),
    createFile: jest.fn(async (_id: string, path: string, content: string) => {
      saved.push({ path, content });
      if (path === 'experience.json') {
        current = JSON.parse(content);
      }
    }),
    createDirectory: jest.fn(),
    listResources: jest.fn(),
  } as unknown as MatterCompilerContext;

  return { context, saved };
}

function emptyExperience(): Experience {
  return {
    version: '1',
    title: 'Test',
    description: '',
    resources: { scenes: [] },
    agents: {
      mentor: {
        name: 'Mentor',
        voice: 'shimmer',
        publicDescription: '',
        downstreamAgents: [],
      },
      practice: {
        name: 'Practice',
        voice: 'ash',
        publicDescription: '',
        downstreamAgents: [],
      },
      feedback: {
        name: 'Feedback',
        voice: 'marin',
        publicDescription: '',
        downstreamAgents: [],
      },
    },
    initialAgent: 'mentor',
  };
}

/**
 * Like {@link emptyExperience}, but seeded with workflow phases and an
 * `initialWorkflowPhase` that matches one of those phase ids. Mirrors the
 * shape the roleplay-template ships with — the regression
 * started from this baseline before the build agent renamed the phase ids.
 *
 * `workflowPhases` and `initialWorkflowPhase` aren't on the local
 * {@link Experience} type yet, so the literals get cast through `unknown`
 * the same way the production-shape tests below do.
 */
function experienceWithPhases(): Experience {
  return {
    ...emptyExperience(),
    ...({
      workflowPhases: [
        { id: 'mentor', title: 'Mentor', initialAgent: 'mentor' },
        { id: 'practice', title: 'Practice', initialAgent: 'practice' },
        { id: 'feedback', title: 'Feedback', initialAgent: 'feedback' },
      ],
      initialWorkflowPhase: 'mentor',
    } as unknown as Partial<Experience>),
  };
}

describe('MatterCompiler.modifyExperience workflowPhases validation', () => {
  let compiler: MatterCompiler;

  beforeEach(() => {
    compiler = MatterCompiler.getInstance();
  });

  it('rejects workflowPhases entries missing the required "id" field', async () => {
    const { context, saved } = makeContext(emptyExperience());

    // Exact shape produced by the design-agent for `lql5wxo2lea` —
    // `title/description/objectives/prompts/activities` with no `id`,
    // `initialAgent`, or `promptFragments`.
    const badPhases = [
      {
        title: 'Mentor Phase',
        description: 'Mentor guides the student.',
        objectives: ['Understand the STAR method'],
        prompts: ['Tell me about a time...'],
        activities: ['Discuss situation'],
      },
      {
        title: 'Practice Phase',
        description: 'Student practices.',
        objectives: ['Deliver story'],
        prompts: ['Please describe...'],
        activities: ['Practice delivery'],
      },
    ] as any;

    await expect(
      compiler.modifyExperience(context, 'exp-1', {
        type: 'modify',
        data: { workflowPhases: badPhases },
      }),
    ).rejects.toThrow(/Workflow phase at index 0 is missing required "id"/);

    expect(saved).toHaveLength(0);
  });

  it('rejects workflowPhases with duplicate ids', async () => {
    const { context, saved } = makeContext(emptyExperience());

    await expect(
      compiler.modifyExperience(context, 'exp-1', {
        type: 'modify',
        data: {
          workflowPhases: [
            { id: 'mentor', title: 'A', initialAgent: 'mentor' },
            { id: 'mentor', title: 'B', initialAgent: 'practice' },
          ] as any,
        },
      }),
    ).rejects.toThrow(/Duplicate workflow phase id "mentor"/);

    expect(saved).toHaveLength(0);
  });

  it('rejects workflowPhases when initialAgent references an unknown agent', async () => {
    const { context, saved } = makeContext(emptyExperience());

    await expect(
      compiler.modifyExperience(context, 'exp-1', {
        type: 'modify',
        data: {
          workflowPhases: [
            { id: 'mentor', title: 'Mentor', initialAgent: 'mentor' },
            { id: 'practice', title: 'Practice', initialAgent: 'ghost' },
          ] as any,
        },
      }),
    ).rejects.toThrow(
      /Workflow phase "practice" references unknown initialAgent "ghost"/,
    );

    expect(saved).toHaveLength(0);
  });

  it('rejects workflowPhases when reentryAgent references an unknown agent', async () => {
    const { context, saved } = makeContext(emptyExperience());

    await expect(
      compiler.modifyExperience(context, 'exp-1', {
        type: 'modify',
        data: {
          workflowPhases: [
            {
              id: 'mentor',
              title: 'Mentor',
              initialAgent: 'mentor',
              reentryAgent: 'phantom',
            },
          ] as any,
        },
      }),
    ).rejects.toThrow(
      /Workflow phase "mentor" references unknown reentryAgent "phantom"/,
    );

    expect(saved).toHaveLength(0);
  });

  it('rejects workflowPhases that is set but is not an array', async () => {
    const { context, saved } = makeContext(emptyExperience());

    await expect(
      compiler.modifyExperience(context, 'exp-1', {
        type: 'modify',
        // @ts-expect-error - deliberately wrong type
        data: { workflowPhases: { mentor: {} } },
      }),
    ).rejects.toThrow(/workflowPhases must be an array/);

    expect(saved).toHaveLength(0);
  });

  it('accepts a well-shaped workflowPhases modify', async () => {
    const { context, saved } = makeContext(emptyExperience());

    const goodPhases = [
      { id: 'mentor', title: 'Mentor', initialAgent: 'mentor' },
      { id: 'practice', title: 'Practice', initialAgent: 'practice' },
      {
        id: 'feedback',
        title: 'Feedback',
        initialAgent: 'feedback',
        reentryAgent: 'feedback',
      },
    ];

    await compiler.modifyExperience(context, 'exp-1', {
      type: 'modify',
      data: {
        // Cast through unknown — the test fixture skips the optional fields
        // (heading/description/promptFragments) that the production type
        // requires, but those are unrelated to the validation we're pinning.
        workflowPhases: goodPhases as unknown as Experience['workflowPhases'],
        initialWorkflowPhase: 'mentor',
      },
    });

    expect(saved).toHaveLength(1);
    const persisted = JSON.parse(saved[0].content) as Experience;
    expect(persisted.workflowPhases).toHaveLength(3);
    expect(persisted.workflowPhases?.map((p) => p.id)).toEqual([
      'mentor',
      'practice',
      'feedback',
    ]);
  });

  it('does not block modify operations that omit workflowPhases', async () => {
    // Title-only edits are the most common modifyExperience call. Those
    // must keep working without any phase-related validation surface.
    const { context, saved } = makeContext(emptyExperience());

    await compiler.modifyExperience(context, 'exp-1', {
      type: 'modify',
      data: { title: 'Renamed Experience' },
    });

    expect(saved).toHaveLength(1);
    const persisted = JSON.parse(saved[0].content) as Experience;
    expect(persisted.title).toBe('Renamed Experience');
  });

  // The regression: the build agent renamed the template's
  // phase ids (`mentor` → `mentor-phase`, …) without also updating
  // `initialWorkflowPhase`. The patch was accepted, the corrupted file was
  // persisted, and every subsequent `nextPhase` blew up at runtime. The
  // validator now catches this at write time so the file never lands.
  it('rejects a workflowPhases rename that orphans the existing initialWorkflowPhase', async () => {
    const { context, saved } = makeContext(experienceWithPhases());

    const renamedPhases = [
      { id: 'mentor-phase', title: 'Mentor', initialAgent: 'mentor' },
      { id: 'practice-phase', title: 'Practice', initialAgent: 'practice' },
      { id: 'feedback-phase', title: 'Feedback', initialAgent: 'feedback' },
    ];

    await expect(
      compiler.modifyExperience(context, 'exp-1', {
        type: 'modify',
        data: {
          workflowPhases:
            renamedPhases as unknown as Experience['workflowPhases'],
          // Crucially: initialWorkflowPhase is NOT included in the patch, so
          // the merged value remains the template's "mentor" — which no
          // longer matches any of the renamed ids.
        },
      }),
    ).rejects.toThrow(/initialWorkflowPhase "mentor" does not match/);

    expect(saved).toHaveLength(0);
  });

  it('rejects a patch that sets initialWorkflowPhase to a non-existent phase id', async () => {
    const { context, saved } = makeContext(experienceWithPhases());

    await expect(
      compiler.modifyExperience(context, 'exp-1', {
        type: 'modify',
        data: {
          // The phases on disk are mentor/practice/feedback; "ghost" is a
          // typo / agent confusion, not a real phase.
          ...({ initialWorkflowPhase: 'ghost' } as unknown as Partial<Experience>),
        },
      }),
    ).rejects.toThrow(/initialWorkflowPhase "ghost" does not match/);

    expect(saved).toHaveLength(0);
  });

  it('accepts a rename when initialWorkflowPhase is updated in the same patch', async () => {
    const { context, saved } = makeContext(experienceWithPhases());

    const renamedPhases = [
      { id: 'mentor-phase', title: 'Mentor', initialAgent: 'mentor' },
      { id: 'practice-phase', title: 'Practice', initialAgent: 'practice' },
      { id: 'feedback-phase', title: 'Feedback', initialAgent: 'feedback' },
    ];

    await compiler.modifyExperience(context, 'exp-1', {
      type: 'modify',
      data: {
        workflowPhases:
          renamedPhases as unknown as Experience['workflowPhases'],
        ...({ initialWorkflowPhase: 'mentor-phase' } as unknown as Partial<Experience>),
      },
    });

    expect(saved).toHaveLength(1);
    const persisted = JSON.parse(saved[0].content) as Record<string, unknown>;
    expect(persisted.initialWorkflowPhase).toBe('mentor-phase');
    expect(
      (persisted.workflowPhases as Array<{ id: string }>).map((p) => p.id),
    ).toEqual(['mentor-phase', 'practice-phase', 'feedback-phase']);
  });

  it('accepts a workflowPhases patch when neither merged nor patched config sets initialWorkflowPhase', async () => {
    // No initialWorkflowPhase anywhere — runtime falls back to phases[0].id,
    // which is the documented behavior.
    const { context, saved } = makeContext(emptyExperience());

    const goodPhases = [
      { id: 'intro', title: 'Intro', initialAgent: 'mentor' },
      { id: 'outro', title: 'Outro', initialAgent: 'mentor' },
    ];

    await compiler.modifyExperience(context, 'exp-1', {
      type: 'modify',
      data: {
        workflowPhases: goodPhases as unknown as Experience['workflowPhases'],
      },
    });

    expect(saved).toHaveLength(1);
    const persisted = JSON.parse(saved[0].content) as Record<string, unknown>;
    expect(persisted.initialWorkflowPhase).toBeUndefined();
    expect(
      (persisted.workflowPhases as Array<{ id: string }>).map((p) => p.id),
    ).toEqual(['intro', 'outro']);
  });
});

describe('assertValidWorkflowPhasesPatch — satisfiedBy', () => {
  let compiler: MatterCompiler;

  beforeEach(() => {
    compiler = MatterCompiler.getInstance();
  });

  test('rejects workflowPhases patch with unknown satisfiedBy kind', async () => {
    const { context, saved } = makeContext(emptyExperience());

    await expect(
      compiler.modifyExperience(context, 'exp', {
        type: 'modify',
        data: {
          workflowPhases: [
            {
              id: 'p1',
              title: 'P1',
              initialAgent: 'mentor',
              objectives: [
                { id: 'o1', description: 'd', satisfiedBy: { kind: 'mystery' } },
              ],
            },
          ],
        } as any,
      }),
    ).rejects.toThrow(/unknown satisfiedBy kind/i);

    expect(saved).toHaveLength(0);
  });

  test('rejects delegateSuccess missing agentType in patch', async () => {
    const { context, saved } = makeContext(emptyExperience());

    await expect(
      compiler.modifyExperience(context, 'exp', {
        type: 'modify',
        data: {
          workflowPhases: [
            {
              id: 'p1',
              title: 'P1',
              initialAgent: 'mentor',
              objectives: [
                { id: 'o1', description: 'd', satisfiedBy: { kind: 'delegateSuccess' } },
              ],
            },
          ],
        } as any,
      }),
    ).rejects.toThrow(/delegateSuccess.*agentType/i);

    expect(saved).toHaveLength(0);
  });

  test('accepts well-formed satisfiedBy in patch', async () => {
    const { context, saved } = makeContext(emptyExperience());

    await expect(
      compiler.modifyExperience(context, 'exp', {
        type: 'modify',
        data: {
          workflowPhases: [
            {
              id: 'p1',
              title: 'P1',
              initialAgent: 'mentor',
              objectives: [
                { id: 'o1', description: 'd', satisfiedBy: { kind: 'delegateSuccess', agentType: 'sub' } },
                { id: 'o2', description: 'd', satisfiedBy: { kind: 'artifactPopulated', slug: 'my_slug' } },
              ],
            },
          ],
        } as any,
      }),
    ).resolves.not.toThrow();

    expect(saved).toHaveLength(1);
  });
});
