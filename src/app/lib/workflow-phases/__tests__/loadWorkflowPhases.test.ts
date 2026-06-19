/**
 * Tests for the phase loader / validator.
 *
 * These tests cover both `loadWorkflowPhases` (the validating loader) and
 * `resolveInitialWorkflowPhase` (the starting-phase resolver). They use
 * minimal `ExperienceConfig` literals — only `agents`, `workflowPhases`, and
 * `initialWorkflowPhase` are exercised — and cast through `as` to keep the
 * literals from drowning in unrelated required fields.
 */

import {
  loadWorkflowPhases,
  resolveInitialWorkflowPhase,
} from '@/app/lib/workflow-phases';
import { InvalidPhaseError } from '@/app/lib/workflow-phases/errors';
import type { ExperienceConfig } from '@/app/lib/types';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases';

function makeConfig(overrides: {
  agents?: ExperienceConfig['agents'];
  workflowPhases?: WorkflowPhaseConfig[];
  initialWorkflowPhase?: string;
  toolSets?: Record<string, string[]>;
}): ExperienceConfig {
  return {
    agents: {},
    ...overrides,
  } as unknown as ExperienceConfig;
}

describe('loadWorkflowPhases', () => {
  it('returns [] when workflowPhases is undefined', () => {
    const config = makeConfig({});
    expect(loadWorkflowPhases(config)).toEqual([]);
  });

  it('returns [] when workflowPhases is empty', () => {
    const config = makeConfig({ workflowPhases: [] });
    expect(loadWorkflowPhases(config)).toEqual([]);
  });

  it('returns the array unchanged when valid', () => {
    const phases: WorkflowPhaseConfig[] = [
      { id: 'intro', title: 'Intro', initialAgent: 'guide' },
      { id: 'design', title: 'Design', reentryAgent: 'designer' },
    ];
    const config = makeConfig({
      agents: {
        guide: { name: 'Guide' },
        designer: { name: 'Designer' },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: phases,
    });

    expect(loadWorkflowPhases(config)).toBe(phases);
  });

  it('throws on duplicate phase ids', () => {
    const config = makeConfig({
      workflowPhases: [
        { id: 'intro', title: 'Intro' },
        { id: 'intro', title: 'Intro Again' },
      ],
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /duplicate workflow phase id: "intro"/i,
    );
  });

  it('throws a clear error when a phase is missing its id', () => {
    // The exact malformed shape we observed in `lql5wxo2lea` and
    // `b84c2mhxpi9` (design-agent emitted phases without `id` and the
    // experience-builder persisted them). Previously this surfaced as
    // `Duplicate workflow phase id: "undefined".` because the dup check
    // ran first against two phases that both stringified `undefined`.
    // The error must now name the missing-id case so on-call debugging
    // doesn't waste time chasing a phantom duplicate.
    const config = makeConfig({
      workflowPhases: [
        // @ts-expect-error - deliberately malformed: id missing
        { title: 'Mentor Phase' },
        // @ts-expect-error - deliberately malformed: id missing
        { title: 'Practice Phase' },
      ],
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /Workflow phase at index 0 is missing required "id" field/,
    );
    expect(() => loadWorkflowPhases(config)).not.toThrow(
      /Duplicate workflow phase id/,
    );
  });

  it('throws a clear error when a phase id is the empty string', () => {
    const config = makeConfig({
      workflowPhases: [
        { id: '', title: 'Anonymous' },
      ],
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /Workflow phase at index 0 is missing required "id" field/,
    );
  });

  it('throws when initialWorkflowPhase references an unknown phase id', () => {
    const config = makeConfig({
      workflowPhases: [{ id: 'intro', title: 'Intro' }],
      initialWorkflowPhase: 'design',
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /initialWorkflowPhase "design"/,
    );
    // Pin the constructor too — the transition route distinguishes
    // InvalidPhaseError (400 with the real message) from generic Error
    // (500 "Failed to perform workflow-phase transition"). A regression
    // here would silently downgrade the response to a 500.
    expect(() => loadWorkflowPhases(config)).toThrow(InvalidPhaseError);
  });

  it('throws when initialAgent references an unknown agent key', () => {
    const config = makeConfig({
      agents: {
        guide: { name: 'Guide' },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [
        { id: 'intro', title: 'Intro', initialAgent: 'ghost' },
      ],
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /unknown initialAgent "ghost"/,
    );
  });

  it('throws when reentryAgent references an unknown agent key', () => {
    const config = makeConfig({
      agents: {
        guide: { name: 'Guide' },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [
        { id: 'intro', title: 'Intro', reentryAgent: 'phantom' },
      ],
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /unknown reentryAgent "phantom"/,
    );
  });
});

describe('loadWorkflowPhases — allowedDelegates validation', () => {
  it('accepts allowedDelegates that reference declared agents', () => {
    const config = makeConfig({
      agents: {
        guide: { name: 'Guide' },
        builder: { name: 'Builder', type: 'backend' },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [
        { id: 'p1', title: 'P1', initialAgent: 'guide', allowedDelegates: ['builder'] },
      ],
    });

    expect(() => loadWorkflowPhases(config)).not.toThrow();
  });

  it('throws when allowedDelegates names an unknown agent', () => {
    const config = makeConfig({
      agents: {
        guide: { name: 'Guide' },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [
        { id: 'p1', title: 'P1', initialAgent: 'guide', allowedDelegates: ['ghost'] },
      ],
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /allowedDelegates references unknown agent "ghost"/,
    );
    expect(() => loadWorkflowPhases(config)).toThrow(InvalidPhaseError);
  });
});

describe('loadWorkflowPhases — phase-anchor tool availability', () => {
  it('accepts a frontend anchor whose availableTools include the nav tools', () => {
    const config = makeConfig({
      agents: {
        guide: {
          name: 'Guide',
          type: 'frontend',
          availableTools: ['scene', 'workflowPhase', 'finishExperience'],
        },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [{ id: 'p1', title: 'P1', initialAgent: 'guide' }],
    });

    expect(() => loadWorkflowPhases(config)).not.toThrow();
  });

  it('throws when a frontend anchor is missing workflowPhase', () => {
    const config = makeConfig({
      agents: {
        guide: {
          name: 'Guide',
          type: 'frontend',
          availableTools: ['scene', 'finishExperience'],
        },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [{ id: 'p1', title: 'P1', initialAgent: 'guide' }],
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /anchor agent "guide" is missing the "workflowPhase" tool/,
    );
    expect(() => loadWorkflowPhases(config)).toThrow(InvalidPhaseError);
  });

  it('throws when a frontend anchor is missing finishExperience', () => {
    const config = makeConfig({
      agents: {
        guide: {
          name: 'Guide',
          type: 'frontend',
          availableTools: ['scene', 'workflowPhase'],
        },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [{ id: 'p1', title: 'P1', initialAgent: 'guide' }],
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /anchor agent "guide" is missing the "finishExperience" tool/,
    );
  });

  it('also validates reentryAgent anchors', () => {
    const config = makeConfig({
      agents: {
        guide: {
          name: 'Guide',
          type: 'frontend',
          availableTools: ['workflowPhase', 'finishExperience'],
        },
        stale: {
          name: 'Stale',
          type: 'frontend',
          availableTools: ['scene'],
        },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [
        { id: 'p1', title: 'P1', initialAgent: 'guide', reentryAgent: 'stale' },
      ],
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /anchor agent "stale" is missing the "workflowPhase" tool/,
    );
  });

  it('exempts backend anchor agents (they never drive an interactive phase)', () => {
    const config = makeConfig({
      agents: {
        worker: { name: 'Worker', type: 'backend', availableTools: ['scene'] },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [{ id: 'p1', title: 'P1', initialAgent: 'worker' }],
    });

    expect(() => loadWorkflowPhases(config)).not.toThrow();
  });

  it('exempts anchors with no explicit tool restriction (inherit full registry)', () => {
    const config = makeConfig({
      agents: {
        guide: { name: 'Guide', type: 'frontend' },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [{ id: 'p1', title: 'P1', initialAgent: 'guide' }],
    });

    expect(() => loadWorkflowPhases(config)).not.toThrow();
  });

  it('resolves the nav tools through toolSets expansion', () => {
    // `frontend-default` is a preset toolSet that includes both nav tools.
    const config = makeConfig({
      agents: {
        guide: { name: 'Guide', type: 'frontend', toolSets: ['frontend-default'] },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [{ id: 'p1', title: 'P1', initialAgent: 'guide' }],
    });

    expect(() => loadWorkflowPhases(config)).not.toThrow();
  });

  it('throws when an expanded custom toolSet omits a nav tool', () => {
    const config = makeConfig({
      agents: {
        guide: { name: 'Guide', type: 'frontend', toolSets: ['restricted'] },
      } as unknown as ExperienceConfig['agents'],
      toolSets: { restricted: ['scene', 'workflowPhase'] },
      workflowPhases: [{ id: 'p1', title: 'P1', initialAgent: 'guide' }],
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /anchor agent "guide" is missing the "finishExperience" tool/,
    );
  });

  it('resolves the nav tools through legacy toolGroups expansion', () => {
    // The `builtin` group includes both nav tools. This pins the fix for a
    // blind spot where toolGroups-restricted anchors were wrongly exempted.
    const config = makeConfig({
      agents: {
        guide: { name: 'Guide', type: 'frontend', toolGroups: ['builtin'] },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [{ id: 'p1', title: 'P1', initialAgent: 'guide' }],
    });

    expect(() => loadWorkflowPhases(config)).not.toThrow();
  });

  it('throws when a toolGroups-restricted anchor omits the nav tools', () => {
    // `celebrate` expands to just `['celebrate']` — no navigation tools — so a
    // frontend anchor restricted to it would strand the learner.
    const config = makeConfig({
      agents: {
        guide: { name: 'Guide', type: 'frontend', toolGroups: ['celebrate'] },
      } as unknown as ExperienceConfig['agents'],
      workflowPhases: [{ id: 'p1', title: 'P1', initialAgent: 'guide' }],
    });

    expect(() => loadWorkflowPhases(config)).toThrow(
      /anchor agent "guide" is missing the "workflowPhase" tool/,
    );
  });
});

describe('loadWorkflowPhases — satisfiedBy validation', () => {
  const baseConfig = {
    agents: { 'a': {} as any },
    initialWorkflowPhase: 'p1',
  } as any;

  test('accepts delegateSuccess satisfiedBy', () => {
    const phases = [
      {
        id: 'p1',
        title: 'P1',
        initialAgent: 'a',
        objectives: [
          { id: 'o1', description: 'd', satisfiedBy: { kind: 'delegateSuccess', agentType: 'sub' } },
        ],
      },
    ];
    expect(() => loadWorkflowPhases({ ...baseConfig, workflowPhases: phases })).not.toThrow();
  });

  test('accepts artifactPopulated satisfiedBy', () => {
    const phases = [
      {
        id: 'p1',
        title: 'P1',
        initialAgent: 'a',
        objectives: [
          { id: 'o1', description: 'd', satisfiedBy: { kind: 'artifactPopulated', slug: 'my_slug' } },
        ],
      },
    ];
    expect(() => loadWorkflowPhases({ ...baseConfig, workflowPhases: phases })).not.toThrow();
  });

  test('rejects unknown satisfiedBy kind', () => {
    const phases = [
      {
        id: 'p1',
        title: 'P1',
        initialAgent: 'a',
        objectives: [
          { id: 'o1', description: 'd', satisfiedBy: { kind: 'mystery', foo: 'x' } as any },
        ],
      },
    ];
    expect(() => loadWorkflowPhases({ ...baseConfig, workflowPhases: phases })).toThrow(
      /unknown satisfiedBy kind/i,
    );
  });

  test('rejects delegateSuccess missing agentType', () => {
    const phases = [
      {
        id: 'p1',
        title: 'P1',
        initialAgent: 'a',
        objectives: [
          { id: 'o1', description: 'd', satisfiedBy: { kind: 'delegateSuccess' } as any },
        ],
      },
    ];
    expect(() => loadWorkflowPhases({ ...baseConfig, workflowPhases: phases })).toThrow(
      /delegateSuccess.*agentType/i,
    );
  });

  test('rejects artifactPopulated missing slug', () => {
    const phases = [
      {
        id: 'p1',
        title: 'P1',
        initialAgent: 'a',
        objectives: [
          { id: 'o1', description: 'd', satisfiedBy: { kind: 'artifactPopulated' } as any },
        ],
      },
    ];
    expect(() => loadWorkflowPhases({ ...baseConfig, workflowPhases: phases })).toThrow(
      /artifactPopulated.*slug/i,
    );
  });

  test('back-compat: configs without satisfiedBy still load', () => {
    const phases = [
      {
        id: 'p1',
        title: 'P1',
        initialAgent: 'a',
        objectives: [{ id: 'o1', description: 'd' }],
      },
    ];
    expect(() => loadWorkflowPhases({ ...baseConfig, workflowPhases: phases })).not.toThrow();
  });
});

describe('resolveInitialWorkflowPhase', () => {
  it('returns undefined when no phases are declared', () => {
    const config = makeConfig({});
    expect(resolveInitialWorkflowPhase(config)).toBeUndefined();
  });

  it('returns explicit initialWorkflowPhase when set', () => {
    const config = makeConfig({
      workflowPhases: [
        { id: 'intro', title: 'Intro' },
        { id: 'design', title: 'Design' },
      ],
      initialWorkflowPhase: 'design',
    });
    expect(resolveInitialWorkflowPhase(config)).toBe('design');
  });

  it('falls back to phases[0].id when initialWorkflowPhase is not set', () => {
    const config = makeConfig({
      workflowPhases: [
        { id: 'intro', title: 'Intro' },
        { id: 'design', title: 'Design' },
      ],
    });
    expect(resolveInitialWorkflowPhase(config)).toBe('intro');
  });
});
