/**
 * @jest-environment node
 *
 * Tests that executeBackendAgent fires fireObjectiveSignal on successful exit
 * and does NOT fire it when an error is thrown.
 */

import { fireObjectiveSignal } from '@/app/lib/workflow-phases/objectiveSignals';

jest.mock('@/app/lib/workflow-phases/objectiveSignals', () => ({
  fireObjectiveSignal: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/api/backend-agent/managers', () => ({
  ExperienceConfigLoader: {
    loadExperience: jest.fn().mockResolvedValue({
      config: { agents: { 'design-agent': { name: 'Design Agent' } }, toolSets: {} },
      agentKey: 'design-agent',
      agentConfig: { name: 'Design Agent', maximumToolCalls: 10 },
      instructions: 'You are a helpful agent.',
      aiConfig: {},
      temperature: undefined,
    }),
  },
  ToolRegistrationManager: {
    initializeTools: jest.fn().mockResolvedValue([]),
  },
  ToolExecutionManager: {
    executeToolCalls: jest.fn().mockResolvedValue([]),
  },
  AIRequestHandler: {
    getProviderConfig: jest.fn().mockReturnValue({
      useAnthropic: false,
      modelName: 'gpt-4o',
      providerName: 'OpenAI',
    }),
    createTaskMessage: jest.fn().mockReturnValue('task message'),
    sendInitialRequest: jest.fn().mockResolvedValue({
      role: 'assistant',
      content: 'Task completed!',
      tool_calls: [],
    }),
    initializeMessageHistory: jest.fn().mockReturnValue([]),
    sendFollowUpRequest: jest.fn(),
  },
  elideStaleToolResults: jest.fn(),
}));

import { executeBackendAgent } from '@/app/lib/backend-agent-core';

const mockFire = fireObjectiveSignal as jest.Mock;

describe('executeBackendAgent — objective signal hook', () => {
  beforeEach(() => {
    mockFire.mockClear();
  });

  it('fires fireObjectiveSignal with delegateSuccess + resolved agent key on success', async () => {
    await executeBackendAgent({
      experienceId: 'exp',
      sessionId: 'sid',
      agentKey: 'design-agent',
      taskDescription: 'test task',
      artifactIds: [],
      toolContext: {} as any,
    });

    expect(mockFire).toHaveBeenCalledWith({
      experienceId: 'exp',
      sessionId: 'sid',
      signal: { kind: 'delegateSuccess', resolvedAgentKey: 'design-agent' },
    });
  });

  it('does NOT fire fireObjectiveSignal when executeBackendAgent throws', async () => {
    const managers = jest.requireMock<typeof import('@/app/api/backend-agent/managers')>('@/app/api/backend-agent/managers');
    managers.AIRequestHandler.sendInitialRequest.mockRejectedValueOnce(new Error('boom'));

    await expect(
      executeBackendAgent({
        experienceId: 'exp',
        sessionId: 'sid',
        agentKey: 'design-agent',
        taskDescription: 'test task',
        artifactIds: [],
        toolContext: {} as any,
      }),
    ).rejects.toThrow('boom');

    expect(mockFire).not.toHaveBeenCalled();
  });
});
