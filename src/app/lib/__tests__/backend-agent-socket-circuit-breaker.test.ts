/**
 * @jest-environment node
 *
 * Track D — delegation circuit breaker.
 *
 * Background: in QA Round 3 the orchestrator delegated to the
 * `experience-builder` 3 times in rapid succession. Each delegation
 * loaded ~7.5 MB of base64 PNGs into agent context, all 6
 * `deployArtifact` calls failed with fabricated UUIDs, the agent loop
 * aborted, and the orchestrator immediately re-delegated. Three rounds
 * of this and Node's heap (4 GB) blew up — `FATAL ERROR: Ineffective
 * mark-compacts near heap limit Allocation failed`.
 *
 * The circuit breaker caps consecutive (sessionId, agentType)
 * delegation failures at 2. The 3rd attempt is refused with a
 * destructive toast (which `useHandleServerEvent` converts into a
 * `phase-failure` window event for `BuildPhaseSurface` to render its
 * reload tile) and a structured error response to the orchestrator.
 *
 * On a successful run, the counter resets — if Track A + B do their
 * job and the agent succeeds, the breaker is dead code.
 */

const mockToolContext = {
  experienceId: 'experience-creator',
  sessionId: 'sess_test',
};

const mockBaseContext = {
  createArtifact: jest.fn(),
  updateArtifact: jest.fn(),
  deleteArtifact: jest.fn(),
};

jest.mock('@/app/api/backend-agent/utils/context', () => ({
  createServerToolContext: jest.fn(async () => mockBaseContext),
}));

jest.mock('@/app/lib/artifacts/storage', () => ({
  readArtifactHead: jest.fn(),
  listArtifactRevisions: jest.fn(),
}));

const mockExecuteBackendAgent = jest.fn();

jest.mock('@/app/lib/backend-agent-core', () => ({
  executeBackendAgent: (...args: unknown[]) => mockExecuteBackendAgent(...args),
}));

import {
  executeBackendAgentViaSocket,
  __resetDelegationCircuitBreakerForTests,
} from '@/app/lib/backend-agent-socket';

function freshSocket() {
  return {
    emit: jest.fn(),
    handshake: { auth: {} },
  };
}

const baseParams = {
  callId: 'call-1',
  agentType: 'experience-builder',
  artifactIds: [] as string[],
  taskDescription: 'build it',
  experienceId: mockToolContext.experienceId,
  sessionId: mockToolContext.sessionId,
  delegationId: 'del-1',
};

describe('delegation circuit breaker', () => {
  beforeEach(() => {
    __resetDelegationCircuitBreakerForTests();
    mockExecuteBackendAgent.mockReset();
  });

  it('allows the 1st failure through and emits the regular tool.response error', async () => {
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 1'));
    const socket = freshSocket();

    await executeBackendAgentViaSocket({ ...baseParams, socket, requestManager: {} });

    expect(mockExecuteBackendAgent).toHaveBeenCalledTimes(1);
    const errorResponses = socket.emit.mock.calls.filter(
      (c) => c[0] === 'tool.response' && c[1]?.status === 'error',
    );
    expect(errorResponses).toHaveLength(1);
    expect(errorResponses[0][1].data.error).toMatch(/boom 1/);

    // No destructive toast yet — failure 1 is treated normally.
    const toastCalls = socket.emit.mock.calls.filter(
      (c) => c[0] === 'server:message' && c[1]?.type === 'toast.show'
        && c[1]?.data?.type === 'destructive',
    );
    expect(toastCalls).toHaveLength(0);
  });

  it('allows the 2nd failure through with the regular error response', async () => {
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 1'));
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 2'));
    const socket = freshSocket();

    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c1', socket, requestManager: {} });
    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c2', socket, requestManager: {} });

    expect(mockExecuteBackendAgent).toHaveBeenCalledTimes(2);
    const c2Errors = socket.emit.mock.calls.filter(
      (c) => c[0] === 'tool.response' && c[1]?.callId === 'c2' && c[1]?.status === 'error',
    );
    expect(c2Errors).toHaveLength(1);
  });

  it('refuses the 3rd attempt without invoking the agent', async () => {
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 1'));
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 2'));
    const socket = freshSocket();

    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c1', socket, requestManager: {} });
    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c2', socket, requestManager: {} });

    // 3rd attempt — should not invoke the agent at all.
    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c3', socket, requestManager: {} });

    expect(mockExecuteBackendAgent).toHaveBeenCalledTimes(2);

    // Structured error response goes back to the orchestrator.
    const c3Errors = socket.emit.mock.calls.filter(
      (c) => c[0] === 'tool.response' && c[1]?.callId === 'c3' && c[1]?.status === 'error',
    );
    expect(c3Errors).toHaveLength(1);
    expect(c3Errors[0][1].data.error).toMatch(/circuit/i);
  });

  it('emits a destructive toast on the 3rd attempt so the client renders the reload tile', async () => {
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 1'));
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 2'));
    const socket = freshSocket();

    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c1', socket, requestManager: {} });
    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c2', socket, requestManager: {} });
    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c3', socket, requestManager: {} });

    const destructiveToasts = socket.emit.mock.calls.filter(
      (c) => c[0] === 'server:message'
        && c[1]?.type === 'toast.show'
        && c[1]?.data?.type === 'destructive',
    );
    expect(destructiveToasts).toHaveLength(1);
    // Message must mention the agent so the operator sees what tripped.
    expect(destructiveToasts[0][1].data.message).toMatch(/experience-builder/i);
  });

  it('isolates counters per agentType in the same session', async () => {
    mockExecuteBackendAgent.mockRejectedValue(new Error('always fails'));
    const socket = freshSocket();

    await executeBackendAgentViaSocket({ ...baseParams, agentType: 'experience-builder', callId: 'a1', socket, requestManager: {} });
    await executeBackendAgentViaSocket({ ...baseParams, agentType: 'experience-builder', callId: 'a2', socket, requestManager: {} });
    // experience-builder is now at 2 failures — its 3rd would trip.
    // But a different agentType in the SAME session must still be allowed.
    await executeBackendAgentViaSocket({ ...baseParams, agentType: 'casting-director', callId: 'b1', socket, requestManager: {} });

    expect(mockExecuteBackendAgent).toHaveBeenCalledTimes(3);
  });

  it('isolates counters per session for the same agentType', async () => {
    mockExecuteBackendAgent.mockRejectedValue(new Error('always fails'));
    const socket = freshSocket();

    await executeBackendAgentViaSocket({ ...baseParams, sessionId: 'sess_A', callId: 'a1', socket, requestManager: {} });
    await executeBackendAgentViaSocket({ ...baseParams, sessionId: 'sess_A', callId: 'a2', socket, requestManager: {} });
    // sess_A at 2 failures. sess_B should still be free to attempt.
    await executeBackendAgentViaSocket({ ...baseParams, sessionId: 'sess_B', callId: 'b1', socket, requestManager: {} });

    expect(mockExecuteBackendAgent).toHaveBeenCalledTimes(3);
  });

  it('resets the counter after a successful run', async () => {
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 1'));
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 2'));
    // 3rd is the breaker trip — agent NOT invoked.
    // Then we explicitly call resetDelegationFailures (e.g. on phase reset)
    // and the next failure starts fresh.
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 4'));

    const socket = freshSocket();

    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c1', socket, requestManager: {} });
    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c2', socket, requestManager: {} });
    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c3', socket, requestManager: {} });
    expect(mockExecuteBackendAgent).toHaveBeenCalledTimes(2);

    __resetDelegationCircuitBreakerForTests();

    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c4', socket, requestManager: {} });
    expect(mockExecuteBackendAgent).toHaveBeenCalledTimes(3);
  });

  it('resets the counter after a successful execution', async () => {
    // 1 failure, then a success → counter back to 0. After that we should
    // be able to absorb 2 more failures without tripping; only the 4th
    // attempt total (3rd post-success) trips.
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 1'));
    mockExecuteBackendAgent.mockResolvedValueOnce({ message: 'ok!' });
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 3'));
    mockExecuteBackendAgent.mockRejectedValueOnce(new Error('boom 4'));

    const socket = freshSocket();

    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c1', socket, requestManager: {} }); // fail → counter=1
    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c2', socket, requestManager: {} }); // success → counter cleared
    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c3', socket, requestManager: {} }); // fail → counter=1
    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c4', socket, requestManager: {} }); // fail → counter=2

    // All four attempts ran the agent — the breaker did not trip because
    // the success at c2 cleared the prior failure.
    expect(mockExecuteBackendAgent).toHaveBeenCalledTimes(4);

    // A 5th attempt at this point would trip (counter is 2). Verify.
    await executeBackendAgentViaSocket({ ...baseParams, callId: 'c5', socket, requestManager: {} });
    expect(mockExecuteBackendAgent).toHaveBeenCalledTimes(4);
  });
});
