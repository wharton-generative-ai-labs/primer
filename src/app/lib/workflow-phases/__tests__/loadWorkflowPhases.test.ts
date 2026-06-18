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
