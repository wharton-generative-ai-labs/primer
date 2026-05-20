/**
 * Type-shape tests for workflow-phase types.
 *
 * These tests exist to lock the shape of the types defined in
 * `src/app/lib/workflow-phases/types.ts`. They construct a literal of each
 * type via `satisfies` so that any future rename or removal of a documented
 * field will fail to compile here, surfacing the breakage at the boundary.
 *
 * Runtime assertions are present so Jest reports executable tests rather than
 * an empty file — the real value is in the `satisfies` checks above them.
 */

import {
  WorkflowPhaseConfig,
  WorkflowPhaseObjective,
  WorkflowPhaseSnapshot,
  WorkflowPhaseState,
} from '@/app/lib/workflow-phases';

describe('workflow-phase type shapes', () => {
  it('WorkflowPhaseObjective accepts the documented fields', () => {
    const objective = {
      id: 'identify-stakeholders',
      description: 'Identify the project stakeholders.',
    } satisfies WorkflowPhaseObjective;

    expect(objective).not.toBeNull();
    expect(objective.id).toBe('identify-stakeholders');
  });

  it('WorkflowPhaseConfig accepts a fully populated literal', () => {
    const config = {
      id: 'design',
      title: 'Design',
      heading: "Here's what works (and what doesn't).",
      description: 'Sketch the experience flow.',
      initialAgent: 'designer',
      reentryAgent: 'designer',
      requireEducatorAdvance: true,
      resetOnReentry: true,
      objectives: [
        { id: 'goal-1', description: 'Outline the design.' },
      ],
      promptFragments: {
        coldStart: 'Welcome to design.',
        reentry: 'Welcome back to design.',
        afterSkip: 'You skipped ahead — here is what design covered.',
      },
    } satisfies WorkflowPhaseConfig;

    expect(config).not.toBeNull();
    expect(config.objectives?.[0].id).toBe('goal-1');
    expect(config.promptFragments?.coldStart).toBeDefined();
    expect(config.heading).toBe("Here's what works (and what doesn't).");
    expect(config.resetOnReentry).toBe(true);
  });

  it('WorkflowPhaseConfig accepts the minimal required shape', () => {
    const minimal = {
      id: 'intro',
      title: 'Intro',
    } satisfies WorkflowPhaseConfig;

    expect(minimal).not.toBeNull();
    expect(minimal.description).toBeUndefined();
  });

  it('WorkflowPhaseSnapshot accepts the documented fields', () => {
    const snapshot = {
      isSceneVisible: true,
      isDocumentVisible: false,
      documentTab: 'active',
      activeArtifactId: 'artifact-123',
      selectedAgentKey: 'designer',
    } satisfies WorkflowPhaseSnapshot;

    expect(snapshot).not.toBeNull();
    expect(snapshot.documentTab).toBe('active');
  });

  it('WorkflowPhaseSnapshot accepts the minimal required shape', () => {
    const snapshot = {
      isSceneVisible: false,
      isDocumentVisible: true,
      documentTab: 'notes',
    } satisfies WorkflowPhaseSnapshot;

    expect(snapshot).not.toBeNull();
    expect(snapshot.activeArtifactId).toBeUndefined();
  });

  it('WorkflowPhaseState accepts a fully populated literal', () => {
    const state = {
      currentPhase: 'design',
      furthestPhase: 'design',
      visited: ['intro', 'design'],
      completedPhases: ['intro'],
      nextPhaseOverride: 'review',
      snapshots: {
        intro: {
          isSceneVisible: true,
          isDocumentVisible: false,
          documentTab: 'active',
        },
      },
    } satisfies WorkflowPhaseState;

    expect(state).not.toBeNull();
    expect(state.visited).toHaveLength(2);
    expect(state.snapshots.intro.documentTab).toBe('active');
  });

  it('WorkflowPhaseState accepts the minimal required shape', () => {
    const state = {
      visited: [],
      completedPhases: [],
      snapshots: {},
    } satisfies WorkflowPhaseState;

    expect(state).not.toBeNull();
    expect(state.currentPhase).toBeUndefined();
  });
});
