/**
 * Tests for the pure workflow-phase transition logic.
 *
 * These tests cover the eight `TransitionOp` kinds documented in plan Task A6
 * plus the additional rules locked down during execution: nextPhaseOverride
 * gets cleared when the user redirects, finishExperience clears it too, rewind
 * is the inverse of finish, and trigger tagging propagates to every emitted
 * event.
 *
 * The test config is intentionally minimal — only `agents`, `workflowPhases`,
 * and `initialWorkflowPhase` matter — and gets cast through `as unknown as`
 * to keep the literals from drowning in unrelated required fields.
 */

import { SESSION_EVENTS } from '@/app/lib/file-utils';
import type { ExperienceConfig } from '@/app/lib/types';
import type {
  WorkflowPhaseConfig,
  WorkflowPhaseSnapshot,
  WorkflowPhaseState,
} from '@/app/lib/workflow-phases';
import {
  InvalidPhaseError,
  NoNextPhaseError,
  transition,
  evaluateSatisfiedBy,
} from '@/app/lib/workflow-phases/WorkflowPhaseManager';
import type { TransitionRequest } from '@/app/lib/workflow-phases/WorkflowPhaseManager';

function makeConfig(
  workflowPhases: WorkflowPhaseConfig[],
  extras: { initialWorkflowPhase?: string } = {},
): ExperienceConfig {
  return {
    agents: {},
    workflowPhases,
    ...extras,
  } as unknown as ExperienceConfig;
}

const PHASES: WorkflowPhaseConfig[] = [
  { id: 'intro', title: 'Intro' },
  { id: 'design', title: 'Design' },
  { id: 'review', title: 'Review' },
];

function makeState(overrides: Partial<WorkflowPhaseState> = {}): WorkflowPhaseState {
  return {
    currentPhase: 'intro',
    furthestPhase: 'intro',
    visited: ['intro'],
    completedPhases: [],
    snapshots: {},
    ...overrides,
  };
}

function makeSnapshot(
  overrides: Partial<WorkflowPhaseSnapshot> = {},
): WorkflowPhaseSnapshot {
  return {
    isSceneVisible: true,
    isDocumentVisible: false,
    documentTab: 'document',
    ...overrides,
  } as WorkflowPhaseSnapshot;
}

describe('transition - init', () => {
  it('emits WORKFLOW_PHASE_ENTERED with direction=initial and seeds state', () => {
    const config = makeConfig(PHASES);
    const result = transition(config, undefined, false, {
      op: { kind: 'init' },
      trigger: 'system',
    });

    expect(result.newState.currentPhase).toBe('intro');
    expect(result.newState.furthestPhase).toBe('intro');
    expect(result.newState.visited).toEqual(['intro']);
    expect(result.newState.completedPhases).toEqual([]);
    expect(result.experienceCompleted).toBe(false);

    expect(result.eventsToAppend).toHaveLength(1);
    expect(result.eventsToAppend[0].event).toBe(
      SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    );
    expect(result.eventsToAppend[0].data?.direction).toBe('initial');
    expect(result.eventsToAppend[0].data?.phase).toBe('intro');
    expect(result.eventsToAppend[0].data?.trigger).toBe('system');

    expect(result.systemMessage).not.toBeNull();
  });

  it('honors initialWorkflowPhase when set', () => {
    const config = makeConfig(PHASES, { initialWorkflowPhase: 'design' });
    const result = transition(config, undefined, false, {
      op: { kind: 'init' },
      trigger: 'system',
    });

    expect(result.newState.currentPhase).toBe('design');
    expect(result.newState.furthestPhase).toBe('design');
    expect(result.newState.visited).toEqual(['design']);
  });
});

describe('transition - complete', () => {
  it('adds currentPhase to completedPhases and emits PHASE_COMPLETED', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    const result = transition(config, state, false, {
      op: { kind: 'complete' },
      trigger: 'agent',
    });

    expect(result.newState.completedPhases).toEqual(['intro']);
    expect(result.newState.currentPhase).toBe('intro');
    expect(result.eventsToAppend).toHaveLength(1);
    expect(result.eventsToAppend[0].event).toBe(SESSION_EVENTS.PHASE_COMPLETED);
    expect(result.eventsToAppend[0].data?.phase).toBe('intro');
    expect(result.eventsToAppend[0].data?.trigger).toBe('agent');
    expect(result.systemMessage).toBeNull();
  });

  it('is idempotent - already-completed phase emits no event', () => {
    const config = makeConfig(PHASES);
    const state = makeState({ completedPhases: ['intro'] });
    const result = transition(config, state, false, {
      op: { kind: 'complete' },
      trigger: 'agent',
    });

    expect(result.newState.completedPhases).toEqual(['intro']);
    expect(result.eventsToAppend).toHaveLength(0);
    expect(result.systemMessage).toBeNull();
  });
});

describe('transition - nextPhase', () => {
  it('completes the current phase AND advances forward atomically', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    const result = transition(config, state, false, {
      op: { kind: 'nextPhase' },
      trigger: 'agent',
    });

    expect(result.newState.currentPhase).toBe('design');
    expect(result.newState.completedPhases).toEqual(['intro']);
    expect(result.newState.visited).toEqual(['intro', 'design']);
    const eventNames = result.eventsToAppend.map((e) => e.event);
    expect(eventNames).toEqual([
      SESSION_EVENTS.PHASE_COMPLETED,
      SESSION_EVENTS.WORKFLOW_PHASE_LEFT,
      SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    ]);
    expect(result.systemMessage).not.toBeNull();
  });

  it('honors requireEducatorAdvance — collapses to complete-only without navigating', () => {
    const phases: WorkflowPhaseConfig[] = [
      { id: 'intro', title: 'Intro', requireEducatorAdvance: true },
      { id: 'design', title: 'Design' },
    ];
    const config = makeConfig(phases);
    const state = makeState({ visited: ['intro'] });
    const result = transition(config, state, false, {
      op: { kind: 'nextPhase' },
      trigger: 'agent',
    });

    expect(result.newState.currentPhase).toBe('intro');
    expect(result.newState.completedPhases).toEqual(['intro']);
    expect(result.eventsToAppend).toHaveLength(1);
    expect(result.eventsToAppend[0].event).toBe(SESSION_EVENTS.PHASE_COMPLETED);
    expect(result.systemMessage).toBeNull();
  });

  it('throws NoNextPhaseError when on last phase with no override', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
      completedPhases: ['intro', 'design'],
    });
    expect(() =>
      transition(config, state, false, {
        op: { kind: 'nextPhase' },
        trigger: 'agent',
      }),
    ).toThrow(NoNextPhaseError);
  });
});

describe('transition - advance', () => {
  it('moves forward by one in config order with implicit completion', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    const result = transition(config, state, false, {
      op: { kind: 'advance' },
      trigger: 'user',
    });

    expect(result.newState.currentPhase).toBe('design');
    expect(result.newState.furthestPhase).toBe('design');
    expect(result.newState.visited).toEqual(['intro', 'design']);
    expect(result.newState.completedPhases).toEqual(['intro']);

    const eventNames = result.eventsToAppend.map((e) => e.event);
    expect(eventNames).toEqual([
      SESSION_EVENTS.PHASE_COMPLETED,
      SESSION_EVENTS.WORKFLOW_PHASE_LEFT,
      SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    ]);
    expect(result.systemMessage).not.toBeNull();
  });

  it('skips implicit completion when leaving phase already complete', () => {
    const config = makeConfig(PHASES);
    const state = makeState({ completedPhases: ['intro'] });
    const result = transition(config, state, false, {
      op: { kind: 'advance' },
      trigger: 'user',
    });

    const eventNames = result.eventsToAppend.map((e) => e.event);
    expect(eventNames).toEqual([
      SESSION_EVENTS.WORKFLOW_PHASE_LEFT,
      SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    ]);
  });

  it('honors nextPhaseOverride and clears it after consumption', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      completedPhases: ['intro'],
      nextPhaseOverride: 'review',
    });
    const result = transition(config, state, false, {
      op: { kind: 'advance' },
      trigger: 'user',
    });

    expect(result.newState.currentPhase).toBe('review');
    expect(result.newState.nextPhaseOverride).toBeUndefined();
    expect(result.newState.visited).toEqual(['intro', 'review']);
  });

  it('throws NoNextPhaseError when on last phase with no override', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
      completedPhases: ['intro', 'design'],
    });

    expect(() =>
      transition(config, state, false, {
        op: { kind: 'advance' },
        trigger: 'user',
      }),
    ).toThrow(NoNextPhaseError);
  });

  it('emits direction=forward on the entered event', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    const result = transition(config, state, false, {
      op: { kind: 'advance' },
      trigger: 'user',
    });
    const enteredEvent = result.eventsToAppend.find(
      (e) => e.event === SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    );
    expect(enteredEvent?.data?.direction).toBe('forward');
    expect(enteredEvent?.data?.from).toBe('intro');
  });
});

describe('transition - set', () => {
  it('jumps forward, emitting SKIPPED for intermediate phases', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    const result = transition(config, state, false, {
      op: { kind: 'set', targetPhase: 'review' },
      trigger: 'agent',
    });

    expect(result.newState.currentPhase).toBe('review');
    expect(result.newState.furthestPhase).toBe('review');
    expect(result.newState.visited).toEqual(['intro', 'review']);
    // intermediate skipped phases NOT auto-added to completedPhases
    expect(result.newState.completedPhases).toEqual(['intro']);

    const eventNames = result.eventsToAppend.map((e) => e.event);
    expect(eventNames).toContain(SESSION_EVENTS.WORKFLOW_PHASE_SKIPPED);
    const skipped = result.eventsToAppend.find(
      (e) => e.event === SESSION_EVENTS.WORKFLOW_PHASE_SKIPPED,
    );
    expect(skipped?.data?.phase).toBe('design');

    const enteredEvent = result.eventsToAppend.find(
      (e) => e.event === SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    );
    expect(enteredEvent?.data?.skipped).toEqual(['design']);
    expect(enteredEvent?.data?.direction).toBe('forward');
    expect(result.systemMessage).not.toBeNull();
  });

  it('rejects backward target with InvalidPhaseError', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
    });

    expect(() =>
      transition(config, state, false, {
        op: { kind: 'set', targetPhase: 'intro' },
        trigger: 'agent',
      }),
    ).toThrow(InvalidPhaseError);
  });

  it('rejects current target with InvalidPhaseError', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    expect(() =>
      transition(config, state, false, {
        op: { kind: 'set', targetPhase: 'intro' },
        trigger: 'agent',
      }),
    ).toThrow(InvalidPhaseError);
  });

  it('rejects unknown target with InvalidPhaseError', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    expect(() =>
      transition(config, state, false, {
        op: { kind: 'set', targetPhase: 'ghost' },
        trigger: 'agent',
      }),
    ).toThrow(InvalidPhaseError);
  });
});

describe('transition - setNext', () => {
  it('writes nextPhaseOverride and emits WORKFLOW_NEXT_OVERRIDDEN with no navigation', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    const result = transition(config, state, false, {
      op: { kind: 'setNext', targetPhase: 'review' },
      trigger: 'agent',
    });

    expect(result.newState.currentPhase).toBe('intro');
    expect(result.newState.nextPhaseOverride).toBe('review');
    expect(result.eventsToAppend).toHaveLength(1);
    expect(result.eventsToAppend[0].event).toBe(
      SESSION_EVENTS.WORKFLOW_NEXT_OVERRIDDEN,
    );
    expect(result.eventsToAppend[0].data?.targetPhase).toBe('review');
    expect(result.systemMessage).toBeNull();
  });

  it('rejects target = current phase', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    expect(() =>
      transition(config, state, false, {
        op: { kind: 'setNext', targetPhase: 'intro' },
        trigger: 'agent',
      }),
    ).toThrow(InvalidPhaseError);
  });

  it('rejects target not in phases', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    expect(() =>
      transition(config, state, false, {
        op: { kind: 'setNext', targetPhase: 'ghost' },
        trigger: 'agent',
      }),
    ).toThrow(InvalidPhaseError);
  });

  it('rejects backward index targets', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
    });
    expect(() =>
      transition(config, state, false, {
        op: { kind: 'setNext', targetPhase: 'intro' },
        trigger: 'agent',
      }),
    ).toThrow(InvalidPhaseError);
  });
});

describe('transition - goTo', () => {
  it('moves backward, emits LEFT + REVISITED + ENTERED with direction=backward', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
      completedPhases: ['intro', 'design'],
    });
    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intro' },
      trigger: 'user',
      currentSnapshot: makeSnapshot({ documentTab: 'transcript' }),
    });

    expect(result.newState.currentPhase).toBe('intro');
    expect(result.newState.furthestPhase).toBe('review');
    expect(result.newState.completedPhases).toEqual(['intro', 'design']);

    const eventNames = result.eventsToAppend.map((e) => e.event);
    expect(eventNames).toEqual([
      SESSION_EVENTS.WORKFLOW_PHASE_LEFT,
      SESSION_EVENTS.WORKFLOW_PHASE_REVISITED,
      SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    ]);
    const enteredEvent = result.eventsToAppend.find(
      (e) => e.event === SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    );
    expect(enteredEvent?.data?.direction).toBe('backward');

    // Saves leaving snapshot
    expect(result.newState.snapshots.review).toEqual(
      makeSnapshot({ documentTab: 'transcript' }),
    );
    expect(result.systemMessage).not.toBeNull();
  });

  it('restores target snapshot via restoredSnapshot', () => {
    const config = makeConfig(PHASES);
    const introSnap = makeSnapshot({ activeArtifactId: 'intro-doc' });
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
      snapshots: { intro: introSnap },
    });
    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intro' },
      trigger: 'user',
    });

    expect(result.restoredSnapshot).toEqual(introSnap);
  });

  it('treats goTo to current phase as a no-op (no events, no system message)', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intro' },
      trigger: 'user',
    });

    expect(result.eventsToAppend).toHaveLength(0);
    expect(result.systemMessage).toBeNull();
    expect(result.newState).toEqual(state);
  });

  it('forward goTo to a visited phase emits no SKIPPED events and preserves completedPhases', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'intro',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
      completedPhases: ['intro', 'design'],
    });
    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'design' },
      trigger: 'user',
    });

    expect(result.newState.currentPhase).toBe('design');
    expect(result.newState.furthestPhase).toBe('review');
    expect(result.newState.completedPhases).toEqual(['intro', 'design']);

    const eventNames = result.eventsToAppend.map((e) => e.event);
    expect(eventNames).not.toContain(SESSION_EVENTS.WORKFLOW_PHASE_SKIPPED);
    expect(eventNames).toContain(SESSION_EVENTS.WORKFLOW_PHASE_ENTERED);
  });

  it('clears experienceCompleted on backward nav and emits EXPERIENCE_REWOUND', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
      completedPhases: ['intro', 'design', 'review'],
    });
    const result = transition(config, state, true, {
      op: { kind: 'goTo', targetPhase: 'intro' },
      trigger: 'user',
    });

    expect(result.experienceCompleted).toBe(false);
    const eventNames = result.eventsToAppend.map((e) => e.event);
    expect(eventNames).toContain(SESSION_EVENTS.EXPERIENCE_REWOUND);
  });

  it('clears nextPhaseOverride on backward nav (user redirection)', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'design',
      furthestPhase: 'design',
      visited: ['intro', 'design'],
      nextPhaseOverride: 'review',
    });
    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intro' },
      trigger: 'user',
    });

    expect(result.newState.nextPhaseOverride).toBeUndefined();
  });

  it('throws InvalidPhaseError for unknown target', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    expect(() =>
      transition(config, state, false, {
        op: { kind: 'goTo', targetPhase: 'ghost' },
        trigger: 'user',
      }),
    ).toThrow(InvalidPhaseError);
  });
});

// ---------------------------------------------------------------------------
// resetOnReentry — backward goTo past a flagged phase clears its completion +
// objectives so approval gates re-lock when upstream changes happen.
// ---------------------------------------------------------------------------

describe('transition - goTo - resetOnReentry', () => {
  const RESET_PHASES: WorkflowPhaseConfig[] = [
    { id: 'intake', title: 'Intake' },
    { id: 'design', title: 'Design', resetOnReentry: true },
    { id: 'build', title: 'Build', resetOnReentry: true },
    { id: 'handoff', title: 'Handoff' },
  ];

  it('removes the leaving phase from completedPhases when it has resetOnReentry', () => {
    const config = makeConfig(RESET_PHASES);
    const state = makeState({
      currentPhase: 'design',
      furthestPhase: 'design',
      visited: ['intake', 'design'],
      completedPhases: ['intake', 'design'],
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intake' },
      trigger: 'user',
    });

    expect(result.newState.completedPhases).toEqual(['intake']);
  });

  it('wipes the leaving phase entry from completedObjectives', () => {
    const config = makeConfig(RESET_PHASES);
    const state = makeState({
      currentPhase: 'design',
      furthestPhase: 'design',
      visited: ['intake', 'design'],
      completedPhases: ['intake', 'design'],
      completedObjectives: {
        intake: ['domain-and-level'],
        design: ['design-shown', 'design-approved'],
      },
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intake' },
      trigger: 'user',
    });

    expect(result.newState.completedObjectives).toEqual({
      intake: ['domain-and-level'],
    });
  });

  it('cascade: jumping past multiple flagged phases resets all of them', () => {
    const config = makeConfig(RESET_PHASES);
    const state = makeState({
      currentPhase: 'handoff',
      furthestPhase: 'handoff',
      visited: ['intake', 'design', 'build', 'handoff'],
      completedPhases: ['intake', 'design', 'build'],
      completedObjectives: {
        intake: ['domain-and-level'],
        design: ['design-approved'],
        build: ['experience-built'],
      },
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intake' },
      trigger: 'user',
    });

    expect(result.newState.completedPhases).toEqual(['intake']);
    expect(result.newState.completedObjectives).toEqual({
      intake: ['domain-and-level'],
    });
  });

  it('preserves phases without the flag during a cascade reset', () => {
    // intake (no flag) → design (flag) → review (no flag) → handoff
    const phases: WorkflowPhaseConfig[] = [
      { id: 'intake', title: 'Intake' },
      { id: 'design', title: 'Design', resetOnReentry: true },
      { id: 'review', title: 'Review' },
      { id: 'handoff', title: 'Handoff' },
    ];
    const config = makeConfig(phases);
    const state = makeState({
      currentPhase: 'handoff',
      furthestPhase: 'handoff',
      visited: ['intake', 'design', 'review', 'handoff'],
      completedPhases: ['intake', 'design', 'review'],
      completedObjectives: {
        intake: ['intake-obj'],
        design: ['design-obj'],
        review: ['review-obj'],
      },
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intake' },
      trigger: 'user',
    });

    // design is wiped because it has resetOnReentry.
    // review stays because it does NOT have resetOnReentry (even though it
    // sits in the backward range too).
    expect(result.newState.completedPhases).toEqual(['intake', 'review']);
    expect(result.newState.completedObjectives).toEqual({
      intake: ['intake-obj'],
      review: ['review-obj'],
    });
  });

  it('does not reset the landing phase even if it has resetOnReentry', () => {
    const phases: WorkflowPhaseConfig[] = [
      { id: 'intake', title: 'Intake', resetOnReentry: true },
      { id: 'design', title: 'Design' },
    ];
    const config = makeConfig(phases);
    const state = makeState({
      currentPhase: 'design',
      furthestPhase: 'design',
      visited: ['intake', 'design'],
      completedPhases: ['intake'],
      completedObjectives: { intake: ['intake-obj'] },
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intake' },
      trigger: 'user',
    });

    expect(result.newState.completedPhases).toEqual(['intake']);
    expect(result.newState.completedObjectives).toEqual({
      intake: ['intake-obj'],
    });
  });

  it('forward goTo to a visited phase never triggers any reset', () => {
    const config = makeConfig(RESET_PHASES);
    const state = makeState({
      currentPhase: 'intake',
      furthestPhase: 'build',
      visited: ['intake', 'design', 'build'],
      completedPhases: ['intake', 'design', 'build'],
      completedObjectives: {
        intake: ['intake-obj'],
        design: ['design-approved'],
        build: ['experience-built'],
      },
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'design' },
      trigger: 'user',
    });

    expect(result.newState.completedPhases).toEqual([
      'intake',
      'design',
      'build',
    ]);
    expect(result.newState.completedObjectives).toEqual({
      intake: ['intake-obj'],
      design: ['design-approved'],
      build: ['experience-built'],
    });
  });

  it('system message lists the reset phase ids when phases are cleared', () => {
    const config = makeConfig(RESET_PHASES);
    const state = makeState({
      currentPhase: 'build',
      furthestPhase: 'build',
      visited: ['intake', 'design', 'build'],
      completedPhases: ['intake', 'design', 'build'],
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intake' },
      trigger: 'user',
    });

    expect(result.systemMessage).not.toBeNull();
    expect(result.systemMessage).toContain('WORKFLOW_PHASE_RESET');
    expect(result.systemMessage).toContain('design');
    expect(result.systemMessage).toContain('build');

    // Reset ids surface on WORKFLOW_PHASE_ENTERED so consumers (analytics,
    // realtime listeners) can react without re-parsing the system message.
    const enteredEvent = result.eventsToAppend.find(
      (e) => e.event === SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    );
    expect(enteredEvent?.data?.phasesReset).toEqual(['design', 'build']);
  });

  it('system message omits the reset notice when nothing was reset', () => {
    // PHASES has no resetOnReentry flags.
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
      completedPhases: ['intro', 'design'],
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intro' },
      trigger: 'user',
    });

    expect(result.systemMessage).not.toBeNull();
    expect(result.systemMessage).not.toContain('WORKFLOW_PHASE_RESET');
  });

  it('does NOT include the leaving phase in resetPhaseIds when it had no completion or objectives', () => {
    // The leaving phase declares resetOnReentry but the educator never
    // completed it or marked any objective — there's nothing to clear, so
    // the agent should not be told approvals were wiped.
    const config = makeConfig(RESET_PHASES);
    const state = makeState({
      currentPhase: 'design',
      furthestPhase: 'design',
      visited: ['intake', 'design'],
      completedPhases: ['intake'],
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intake' },
      trigger: 'user',
    });

    expect(result.systemMessage).not.toBeNull();
    expect(result.systemMessage).not.toContain('WORKFLOW_PHASE_RESET');

    const enteredEvent = result.eventsToAppend.find(
      (e) => e.event === SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    );
    expect(enteredEvent?.data?.phasesReset).toBeUndefined();
  });

  it("drops the leaving phase's snapshot when it gets reset", () => {
    // Saved snapshot for `design` could pin a stale `activeArtifactId` that
    // points at content the upstream phase will regenerate. Clear it so
    // re-entry renders fresh.
    const designSnap = makeSnapshot({ activeArtifactId: 'old-design-doc' });
    const config = makeConfig(RESET_PHASES);
    const state = makeState({
      currentPhase: 'design',
      furthestPhase: 'design',
      visited: ['intake', 'design'],
      completedPhases: ['intake', 'design'],
      completedObjectives: { design: ['design-approved'] },
      snapshots: { design: designSnap },
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intake' },
      trigger: 'user',
    });

    expect(result.newState.snapshots.design).toBeUndefined();
  });

  it("preserves the leaving phase's snapshot when it does NOT get reset", () => {
    // No-flag regression guard: backward navigation past a phase WITHOUT
    // resetOnReentry must still save the leaving phase's snapshot for later
    // restore. This is the core save-leaving-snapshot contract.
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
      completedPhases: ['intro', 'design', 'review'],
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intro' },
      trigger: 'user',
      currentSnapshot: makeSnapshot({ activeArtifactId: 'review-doc' }),
    });

    expect(result.newState.snapshots.review).toEqual(
      makeSnapshot({ activeArtifactId: 'review-doc' }),
    );
  });

  it('rewind inherits resetOnReentry from handleGoTo', () => {
    // `rewind` delegates to `handleGoTo`, so the cascade reset must fire on
    // EXPERIENCE_REWOUND just like a manual backward goTo would. Otherwise
    // the agent would resume a finished build without re-earning approvals.
    // Setup: build (flagged) is the leaving phase, so rewinding from build
    // → design lands on design and clears build's approvals.
    const phases: WorkflowPhaseConfig[] = [
      { id: 'intake', title: 'Intake' },
      { id: 'design', title: 'Design', resetOnReentry: true },
      { id: 'build', title: 'Build', resetOnReentry: true },
    ];
    const config = makeConfig(phases);
    const state = makeState({
      currentPhase: 'build',
      furthestPhase: 'build',
      visited: ['intake', 'design', 'build'],
      completedPhases: ['intake', 'design', 'build'],
      completedObjectives: {
        intake: ['intake-obj'],
        design: ['design-obj'],
        build: ['build-obj'],
      },
    });

    const result = transition(config, state, true, {
      op: { kind: 'rewind' },
      trigger: 'user',
    });

    // rewind: build → design. Range (design, build] = ['build']. `build`
    // has resetOnReentry and was completed, so it gets wiped. design is
    // the landing phase, so its completion + objectives are preserved.
    expect(result.newState.currentPhase).toBe('design');
    expect(result.newState.completedPhases).not.toContain('build');
    expect(result.newState.completedObjectives?.build).toBeUndefined();
    expect(result.experienceCompleted).toBe(false);

    // EXPERIENCE_REWOUND must still fire (rewind contract).
    const eventNames = result.eventsToAppend.map((e) => e.event);
    expect(eventNames).toContain(SESSION_EVENTS.EXPERIENCE_REWOUND);
  });

  it('preserves furthestPhase when phases are reset', () => {
    // Clearing completion + objectives must NOT rewind progress markers.
    // furthestPhase tracks how far the user has traveled; resets clear
    // approval gates, not history.
    const config = makeConfig(RESET_PHASES);
    const state = makeState({
      currentPhase: 'build',
      furthestPhase: 'build',
      visited: ['intake', 'design', 'build'],
      completedPhases: ['intake', 'design', 'build'],
      completedObjectives: {
        design: ['design-approved'],
        build: ['experience-built'],
      },
    });

    const result = transition(config, state, false, {
      op: { kind: 'goTo', targetPhase: 'intake' },
      trigger: 'user',
    });

    expect(result.newState.furthestPhase).toBe('build');
    // Progress markers must be preserved — design + build still appear in
    // visited even though their completion was wiped.
    expect(result.newState.visited).toContain('design');
    expect(result.newState.visited).toContain('build');
  });
});

describe('transition - finishExperience', () => {
  it('sets experienceCompleted, emits EXPERIENCE_COMPLETED, leaves currentPhase', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
    });
    const result = transition(config, state, false, {
      op: { kind: 'finishExperience' },
      trigger: 'agent',
    });

    expect(result.experienceCompleted).toBe(true);
    expect(result.newState.currentPhase).toBe('review');
    expect(result.eventsToAppend).toHaveLength(1);
    expect(result.eventsToAppend[0].event).toBe(
      SESSION_EVENTS.EXPERIENCE_COMPLETED,
    );
    expect(result.systemMessage).not.toBeNull();
  });

  it('clears nextPhaseOverride if set', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'design',
      furthestPhase: 'design',
      visited: ['intro', 'design'],
      nextPhaseOverride: 'review',
    });
    const result = transition(config, state, false, {
      op: { kind: 'finishExperience' },
      trigger: 'agent',
    });

    expect(result.newState.nextPhaseOverride).toBeUndefined();
  });

  it('is allowed from any phase, including the first one', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    const result = transition(config, state, false, {
      op: { kind: 'finishExperience' },
      trigger: 'agent',
    });
    expect(result.experienceCompleted).toBe(true);
  });
});

describe('transition - rewind', () => {
  it('requires experienceCompleted=true; throws otherwise', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
    });
    expect(() =>
      transition(config, state, false, {
        op: { kind: 'rewind' },
        trigger: 'user',
      }),
    ).toThrow(InvalidPhaseError);
  });

  it('navigates to previous visited phase, emits expected events, clears completion', () => {
    const config = makeConfig(PHASES);
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
      completedPhases: ['intro', 'design', 'review'],
    });
    const result = transition(config, state, true, {
      op: { kind: 'rewind' },
      trigger: 'user',
      currentSnapshot: makeSnapshot({ activeArtifactId: 'review-art' }),
    });

    expect(result.experienceCompleted).toBe(false);
    expect(result.newState.currentPhase).toBe('design');
    expect(result.newState.furthestPhase).toBe('review');

    const eventNames = result.eventsToAppend.map((e) => e.event);
    expect(eventNames).toContain(SESSION_EVENTS.EXPERIENCE_REWOUND);
    expect(eventNames).toContain(SESSION_EVENTS.WORKFLOW_PHASE_LEFT);
    expect(eventNames).toContain(SESSION_EVENTS.WORKFLOW_PHASE_REVISITED);
    expect(eventNames).toContain(SESSION_EVENTS.WORKFLOW_PHASE_ENTERED);

    // Saves leaving snapshot
    expect(result.newState.snapshots.review).toEqual(
      makeSnapshot({ activeArtifactId: 'review-art' }),
    );
    expect(result.systemMessage).not.toBeNull();
  });

  it('restores target snapshot via restoredSnapshot', () => {
    const config = makeConfig(PHASES);
    const designSnap = makeSnapshot({ activeArtifactId: 'design-doc' });
    const state = makeState({
      currentPhase: 'review',
      furthestPhase: 'review',
      visited: ['intro', 'design', 'review'],
      snapshots: { design: designSnap },
    });
    const result = transition(config, state, true, {
      op: { kind: 'rewind' },
      trigger: 'user',
    });
    expect(result.restoredSnapshot).toEqual(designSnap);
  });
});

describe('transition - trigger tagging', () => {
  it('every emitted event carries the request trigger', () => {
    const config = makeConfig(PHASES);
    const state = makeState({ completedPhases: [] });
    const triggers: TransitionRequest['trigger'][] = ['user', 'agent', 'system'];

    for (const trigger of triggers) {
      const result = transition(config, state, false, {
        op: { kind: 'advance' },
        trigger,
      });
      for (const event of result.eventsToAppend) {
        expect(event.data?.trigger).toBe(trigger);
      }
    }
  });

  it('trigger tagging applies to setNext events too', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    const result = transition(config, state, false, {
      op: { kind: 'setNext', targetPhase: 'review' },
      trigger: 'agent',
    });
    expect(result.eventsToAppend[0].data?.trigger).toBe('agent');
  });
});

// ---------------------------------------------------------------------------
// objective auto-mark — `complete` and `nextPhase` auto-mark any unmet
// objectives on the leaving phase, emit one OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE
// per id, and proceed instead of throwing. Earlier revisions hard-gated the
// transition until every objective was explicitly marked via a separate
// `markObjective` action; that surfaced a recover-after-rejection failure
// mode no amount of prompt engineering eliminated, so we deleted both the
// agent-facing action and the gate. Objectives are now documentation +
// telemetry; the events emitted here are the audit trail.
// ---------------------------------------------------------------------------

describe('transition - objective auto-mark on complete and nextPhase', () => {
  const PHASES_WITH_OBJECTIVES: WorkflowPhaseConfig[] = [
    {
      id: 'intro',
      title: 'Intro',
      objectives: [
        { id: 'obj-1', description: 'Establish goals' },
        { id: 'obj-2', description: 'Set expectations' },
      ],
    },
    { id: 'design', title: 'Design' },
  ];

  it('complete() auto-marks every unmet objective and emits one event per id', () => {
    const config = makeConfig(PHASES_WITH_OBJECTIVES);
    const state = makeState({ completedObjectives: {} });
    const result = transition(config, state, false, {
      op: { kind: 'complete' },
      trigger: 'agent',
    });

    expect(result.newState.completedPhases).toContain('intro');
    expect(result.newState.completedObjectives?.['intro']).toEqual([
      'obj-1',
      'obj-2',
    ]);

    const autoMarkEvents = result.eventsToAppend.filter(
      (e) => e.event === SESSION_EVENTS.OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE,
    );
    expect(autoMarkEvents).toHaveLength(2);
    expect(autoMarkEvents.map((e) => e.data?.objectiveId).sort()).toEqual([
      'obj-1',
      'obj-2',
    ]);
    for (const e of autoMarkEvents) {
      expect(e.data?.phase).toBe('intro');
      expect(e.data?.op).toBe('complete');
      expect(e.data?.trigger).toBe('agent');
    }

    // PHASE_COMPLETED still fires alongside the auto-mark events.
    expect(
      result.eventsToAppend.some(
        (e) => e.event === SESSION_EVENTS.PHASE_COMPLETED,
      ),
    ).toBe(true);
  });

  it('complete() only auto-marks the objectives that are missing (mixed-marked case)', () => {
    const config = makeConfig(PHASES_WITH_OBJECTIVES);
    const state = makeState({ completedObjectives: { intro: ['obj-1'] } });
    const result = transition(config, state, false, {
      op: { kind: 'complete' },
      trigger: 'agent',
    });

    expect(result.newState.completedObjectives?.['intro']).toEqual([
      'obj-1',
      'obj-2',
    ]);
    const autoMarkEvents = result.eventsToAppend.filter(
      (e) => e.event === SESSION_EVENTS.OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE,
    );
    expect(autoMarkEvents).toHaveLength(1);
    expect(autoMarkEvents[0].data?.objectiveId).toBe('obj-2');
  });

  it('complete() emits no auto-mark events when all objectives are already met', () => {
    const config = makeConfig(PHASES_WITH_OBJECTIVES);
    const state = makeState({
      completedObjectives: { intro: ['obj-1', 'obj-2'] },
    });
    const result = transition(config, state, false, {
      op: { kind: 'complete' },
      trigger: 'agent',
    });

    expect(result.newState.completedPhases).toContain('intro');
    const autoMarkEvents = result.eventsToAppend.filter(
      (e) => e.event === SESSION_EVENTS.OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE,
    );
    expect(autoMarkEvents).toHaveLength(0);
  });

  it('nextPhase() auto-marks unmet objectives and advances atomically (no gate)', () => {
    const config = makeConfig(PHASES_WITH_OBJECTIVES);
    const state = makeState({ completedObjectives: {} });
    const result = transition(config, state, false, {
      op: { kind: 'nextPhase' },
      trigger: 'agent',
    });

    expect(result.newState.currentPhase).toBe('design');
    expect(result.newState.completedPhases).toContain('intro');
    expect(result.newState.completedObjectives?.['intro']).toEqual([
      'obj-1',
      'obj-2',
    ]);

    // Auto-mark events are emitted during the implicit `complete` step
    // inside `nextPhase`; the `op` field carries through as the originating
    // op so analytics can distinguish bare `complete` from `nextPhase`.
    const autoMarkEvents = result.eventsToAppend.filter(
      (e) => e.event === SESSION_EVENTS.OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE,
    );
    expect(autoMarkEvents).toHaveLength(2);
    for (const e of autoMarkEvents) {
      expect(e.data?.op).toBe('nextPhase');
    }
  });

  it('nextPhase() succeeds with no auto-mark events when all objectives are met', () => {
    const config = makeConfig(PHASES_WITH_OBJECTIVES);
    const state = makeState({
      completedObjectives: { intro: ['obj-1', 'obj-2'] },
    });
    const result = transition(config, state, false, {
      op: { kind: 'nextPhase' },
      trigger: 'agent',
    });

    expect(result.newState.currentPhase).toBe('design');
    const autoMarkEvents = result.eventsToAppend.filter(
      (e) => e.event === SESSION_EVENTS.OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE,
    );
    expect(autoMarkEvents).toHaveLength(0);
  });

  it('phases without objectives advance with no auto-mark events (backward compat)', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    const result = transition(config, state, false, {
      op: { kind: 'complete' },
      trigger: 'agent',
    });

    expect(result.newState.completedPhases).toContain('intro');
    const autoMarkEvents = result.eventsToAppend.filter(
      (e) => e.event === SESSION_EVENTS.OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE,
    );
    expect(autoMarkEvents).toHaveLength(0);
  });

  it('idempotent: a second `complete` call on an already-completed phase emits nothing', () => {
    // After a successful `complete`, completedObjectives is fully populated
    // and the phase is in completedPhases. Calling `complete` again should
    // be a quiet no-op — no PHASE_COMPLETED, no auto-mark events.
    const config = makeConfig(PHASES_WITH_OBJECTIVES);
    const state = makeState({
      completedPhases: ['intro'],
      completedObjectives: { intro: ['obj-1', 'obj-2'] },
    });
    const result = transition(config, state, false, {
      op: { kind: 'complete' },
      trigger: 'agent',
    });
    expect(result.eventsToAppend).toHaveLength(0);
  });

  it('honors requireEducatorAdvance: nextPhase auto-marks but does NOT navigate', () => {
    // The educator-gated path collapses `nextPhase` to "mark complete only"
    // (the educator presses Next themselves). Auto-mark must still fire so
    // the audit trail is complete on the educator-gated phases too.
    const phases: WorkflowPhaseConfig[] = [
      {
        id: 'intro',
        title: 'Intro',
        requireEducatorAdvance: true,
        objectives: [{ id: 'obj-1', description: 'Goal' }],
      },
      { id: 'design', title: 'Design' },
    ];
    const config = makeConfig(phases);
    const state = makeState({ visited: ['intro'] });
    const result = transition(config, state, false, {
      op: { kind: 'nextPhase' },
      trigger: 'agent',
    });

    expect(result.newState.currentPhase).toBe('intro');
    expect(result.newState.completedPhases).toContain('intro');
    expect(result.newState.completedObjectives?.['intro']).toEqual(['obj-1']);
    const autoMarkEvents = result.eventsToAppend.filter(
      (e) => e.event === SESSION_EVENTS.OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE,
    );
    expect(autoMarkEvents).toHaveLength(1);
  });
});

describe('transition - unknown op kind hits exhaustive default', () => {
  // Passing a truly unknown op kind (not markObjective, which is now valid)
  // should still hit the exhaustive default and throw.
  it('throws when a completely unknown op.kind is passed (exhaustive default)', () => {
    const config = makeConfig(PHASES);
    const state = makeState();
    expect(() =>
      transition(config, state, false, {
        op: {
          kind: 'notARealOp',
        } as unknown as TransitionRequest['op'],
        trigger: 'agent',
      }),
    ).toThrow(/Unknown transition op/);
  });
});

describe('transition — markObjective op', () => {
  const config = {
    agents: { a: {} as any },
    initialWorkflowPhase: 'p1',
    workflowPhases: [
      {
        id: 'p1',
        title: 'P1',
        initialAgent: 'a',
        objectives: [
          { id: 'o1', description: 'd' },
          { id: 'o2', description: 'd', satisfiedBy: { kind: 'delegateSuccess', agentType: 'sub' } },
        ],
      },
    ],
  } as any;

  const state: any = {
    currentPhase: 'p1',
    furthestPhase: 'p1',
    visited: ['p1'],
    completedPhases: [],
    completedObjectives: {},
    snapshots: {},
  };

  test('appends id to completedObjectives + emits OBJECTIVE_MARKED', () => {
    const result = transition(config, state, false, {
      op: { kind: 'markObjective', id: 'o1' },
      trigger: 'agent',
    });
    expect(result.newState.completedObjectives?.['p1']).toContain('o1');
    expect(result.eventsToAppend.some((e: any) => e.event === 'objective_marked' && e.data.objectiveId === 'o1')).toBe(true);
    expect(result.systemMessage).toBeNull();
  });

  test('idempotent re-mark is a no-op success (no duplicate event)', () => {
    const preMarked: any = { ...state, completedObjectives: { p1: ['o1'] } };
    const result = transition(config, preMarked, false, {
      op: { kind: 'markObjective', id: 'o1' },
      trigger: 'agent',
    });
    expect(result.newState.completedObjectives?.['p1']).toEqual(['o1']);
    expect(result.eventsToAppend.filter((e: any) => e.event === 'objective_marked').length).toBe(0);
  });

  test('rejects unknown objective id with actionable error', () => {
    expect(() =>
      transition(config, state, false, {
        op: { kind: 'markObjective', id: 'does_not_exist' },
        trigger: 'agent',
      }),
    ).toThrow(/objective.*does_not_exist.*valid ids.*o1.*o2/i);
  });

  test('rejects when phase has no objectives', () => {
    const emptyConfig = {
      ...config,
      workflowPhases: [{ id: 'p1', title: 'P1', initialAgent: 'a' }],
    };
    expect(() =>
      transition(emptyConfig, state, false, {
        op: { kind: 'markObjective', id: 'anything' },
        trigger: 'agent',
      }),
    ).toThrow(/phase.*has no declared objectives/i);
  });

  test('system-triggered mark records trigger: system in event data', () => {
    const result = transition(config, state, false, {
      op: { kind: 'markObjective', id: 'o2' },
      trigger: 'system',
    });
    const ev = result.eventsToAppend.find((e: any) => e.event === 'objective_marked');
    expect(ev?.data?.trigger).toBe('system');
  });

  test('records note in event data when provided', () => {
    const result = transition(config, state, false, {
      op: { kind: 'markObjective', id: 'o1', note: 'covered during template pick' },
      trigger: 'agent',
    });
    const ev = result.eventsToAppend.find((e: any) => e.event === 'objective_marked');
    expect(ev?.data?.note).toBe('covered during template pick');
  });

  test('omits note from event data when not provided', () => {
    const result = transition(config, state, false, {
      op: { kind: 'markObjective', id: 'o1' },
      trigger: 'agent',
    });
    const ev = result.eventsToAppend.find((e: any) => e.event === 'objective_marked');
    expect(ev?.data).not.toHaveProperty('note');
  });
});

describe('evaluateSatisfiedBy', () => {

  const phase: WorkflowPhaseConfig = {
    id: 'p1',
    title: 'P1',
    objectives: [
      { id: 'unmarked', description: 'd' },
      { id: 'plain', description: 'd' },
      { id: 'd_match', description: 'd', satisfiedBy: { kind: 'delegateSuccess', agentType: 'sub' } },
      { id: 'd_other', description: 'd', satisfiedBy: { kind: 'delegateSuccess', agentType: 'different' } },
      { id: 'a_match', description: 'd', satisfiedBy: { kind: 'artifactPopulated', slug: 'doc' } },
      { id: 'a_other', description: 'd', satisfiedBy: { kind: 'artifactPopulated', slug: 'other' } },
    ],
  };

  const baseState = (completed: Record<string, string[]> = {}): WorkflowPhaseState => ({
    currentPhase: 'p1',
    furthestPhase: 'p1',
    visited: ['p1'],
    completedPhases: [],
    completedObjectives: completed,
    snapshots: {},
  });

  test('delegateSuccess matches the right objective by agentType', () => {
    expect(
      evaluateSatisfiedBy(baseState(), phase, { kind: 'delegateSuccess', resolvedAgentKey: 'sub' }),
    ).toEqual(['d_match']);
  });

  test('delegateSuccess ignores objectives with different agentType', () => {
    expect(
      evaluateSatisfiedBy(baseState(), phase, { kind: 'delegateSuccess', resolvedAgentKey: 'sub' }),
    ).not.toContain('d_other');
  });

  test('artifactWrite only fires when newlyPopulated is true', () => {
    expect(
      evaluateSatisfiedBy(baseState(), phase, { kind: 'artifactWrite', slug: 'doc', newlyPopulated: false }),
    ).toEqual([]);
    expect(
      evaluateSatisfiedBy(baseState(), phase, { kind: 'artifactWrite', slug: 'doc', newlyPopulated: true }),
    ).toEqual(['a_match']);
  });

  test('does not re-mark already-marked objectives', () => {
    expect(
      evaluateSatisfiedBy(
        baseState({ p1: ['d_match'] }),
        phase,
        { kind: 'delegateSuccess', resolvedAgentKey: 'sub' },
      ),
    ).toEqual([]);
  });

  test('ignores objectives without satisfiedBy', () => {
    expect(
      evaluateSatisfiedBy(baseState(), phase, { kind: 'delegateSuccess', resolvedAgentKey: 'plain' }),
    ).toEqual([]);
  });

  test('ignores signal kinds that do not match any trigger', () => {
    expect(
      evaluateSatisfiedBy(baseState(), phase, { kind: 'artifactWrite', slug: 'sub', newlyPopulated: true }),
    ).toEqual([]);
  });
});
