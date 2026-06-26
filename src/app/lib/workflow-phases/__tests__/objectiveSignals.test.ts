/**
 * Tests for the fireObjectiveSignal shared hook helper.
 *
 * Verifies: delegateSuccess matching, no-op on no match, no-op on
 * artifactWrite with newlyPopulated:false, non-phased experience short-circuit,
 * and the best-effort contract (never throws).
 *
 * We mock `mutateSessionMetadata` and `loadExperienceConfigById` to keep
 * tests pure and disk-free.
 */

jest.mock('@/app/lib/sessions/mutateSessionMetadata');
jest.mock('@/app/lib/workflow-phases/loadExperienceConfigById');

import { fireObjectiveSignal } from '@/app/lib/workflow-phases/objectiveSignals';
import { mutateSessionMetadata } from '@/app/lib/sessions/mutateSessionMetadata';
import { loadExperienceConfigById } from '@/app/lib/workflow-phases/loadExperienceConfigById';

const mockMutate = mutateSessionMetadata as jest.Mock;
const mockLoadConfig = loadExperienceConfigById as jest.Mock;

const config = {
  agents: { a: {} },
  initialWorkflowPhase: 'p1',
  workflowPhases: [
    {
      id: 'p1',
      title: 'P1',
      initialAgent: 'a',
      objectives: [
        {
          id: 'o_delegate',
          description: 'd',
          satisfiedBy: { kind: 'delegateSuccess', agentType: 'sub' },
        },
        {
          id: 'o_pop',
          description: 'd',
          satisfiedBy: { kind: 'artifactPopulated', slug: 'doc' },
        },
      ],
    },
  ],
};

function seedMetadata() {
  return {
    sessionId: 'sid',
    experienceId: 'exp',
    startTime: new Date().toISOString(),
    events: [] as any[],
    workflowPhaseState: {
      currentPhase: 'p1',
      furthestPhase: 'p1',
      visited: ['p1'],
      completedPhases: [],
      completedObjectives: {},
      snapshots: {},
    },
  };
}

describe('fireObjectiveSignal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadConfig.mockResolvedValue(config);
  });

  test('marks the matching objective on delegateSuccess', async () => {
    let captured: any;
    mockMutate.mockImplementation(async (_exp: string, _sid: string, fn: (metadata: any) => Promise<unknown>) => {
      captured = seedMetadata();
      return await fn(captured);
    });

    await fireObjectiveSignal({
      experienceId: 'exp',
      sessionId: 'sid',
      signal: { kind: 'delegateSuccess', resolvedAgentKey: 'sub' },
    });

    expect(mockMutate).toHaveBeenCalled();
    expect(captured.workflowPhaseState.completedObjectives.p1).toContain('o_delegate');
    expect(captured.events.some((e: any) => e.event === 'objective_marked')).toBe(true);
  });

  test('no-op when signal matches nothing', async () => {
    let captured: any;
    mockMutate.mockImplementation(async (_exp: string, _sid: string, fn: (metadata: any) => Promise<unknown>) => {
      captured = seedMetadata();
      return await fn(captured);
    });

    await fireObjectiveSignal({
      experienceId: 'exp',
      sessionId: 'sid',
      signal: { kind: 'delegateSuccess', resolvedAgentKey: 'no_match' },
    });

    // Either mutate was not called (early-exit optimization), OR the mutation
    // function ran but emitted no events. Both are acceptable.
    if (captured) {
      expect(captured.events).toEqual([]);
      expect(captured.workflowPhaseState.completedObjectives).toEqual({});
    }
  });

  test('artifactWrite with newlyPopulated: false does not mark', async () => {
    let captured: any;
    mockMutate.mockImplementation(async (_exp: string, _sid: string, fn: (metadata: any) => Promise<unknown>) => {
      captured = seedMetadata();
      return await fn(captured);
    });

    await fireObjectiveSignal({
      experienceId: 'exp',
      sessionId: 'sid',
      signal: { kind: 'artifactWrite', slug: 'doc', newlyPopulated: false },
    });

    if (captured) {
      expect(captured.events).toEqual([]);
      expect(captured.workflowPhaseState.completedObjectives).toEqual({});
    }
  });

  test('non-phased experiences are a no-op', async () => {
    mockLoadConfig.mockResolvedValue({ ...config, workflowPhases: [] });

    await fireObjectiveSignal({
      experienceId: 'exp',
      sessionId: 'sid',
      signal: { kind: 'delegateSuccess', resolvedAgentKey: 'sub' },
    });

    expect(mockMutate).not.toHaveBeenCalled();
  });

  test('best-effort: never throws when config load fails', async () => {
    mockLoadConfig.mockRejectedValue(new Error('config load failed'));

    await expect(
      fireObjectiveSignal({
        experienceId: 'exp',
        sessionId: 'sid',
        signal: { kind: 'delegateSuccess', resolvedAgentKey: 'sub' },
      }),
    ).resolves.toBeUndefined();
  });
});
