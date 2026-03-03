/**
 * Tests for AIRequestHandler
 * 
 * Verifies AI request handling including:
 * - Provider configuration (OpenAI vs Anthropic)
 * - Task message formatting
 * - Message history initialization
 * - Error handling
 */

import { AIRequestHandler } from '../AIRequestHandler';
import type { LoadedExperience } from '../types';

// Mock the provider adapter utilities
jest.mock('../../utils/provider-adapter', () => ({
  shouldUseAnthropic: jest.fn(),
  getModelName: jest.fn(),
  convertOpenAIToolsToAnthropic: jest.fn(),
  convertMessagesToAnthropic: jest.fn(),
  convertAnthropicResponseToOpenAI: jest.fn(),
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock OpenAI and Anthropic SDKs
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');

describe('AIRequestHandler', () => {
  const mockExperience: LoadedExperience = {
    agentConfig: {
      name: 'Test Agent',
      description: 'Test description',
      instructions: 'Test instructions',
      toolGroups: ['builtin'],
    },
    instructions: 'System instructions for the agent',
    aiConfig: {
      provider: 'openai',
      model: 'gpt-4',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProviderConfig', () => {
    it('should configure OpenAI provider', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { shouldUseAnthropic, getModelName } = require('../../utils/provider-adapter');
      
      shouldUseAnthropic.mockReturnValue(false);
      getModelName.mockReturnValue('gpt-4o');

      const config = AIRequestHandler.getProviderConfig(mockExperience);

      expect(config).toEqual({
        useAnthropic: false,
        modelName: 'gpt-4o',
        providerName: 'OpenAI',
      });

      expect(shouldUseAnthropic).toHaveBeenCalledWith(mockExperience.aiConfig);
      expect(getModelName).toHaveBeenCalledWith(mockExperience.aiConfig, 'openai');
    });

    it('should configure Anthropic provider', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { shouldUseAnthropic, getModelName } = require('../../utils/provider-adapter');
      
      shouldUseAnthropic.mockReturnValue(true);
      getModelName.mockReturnValue('claude-3-5-sonnet-20241022');

      const config = AIRequestHandler.getProviderConfig(mockExperience);

      expect(config).toEqual({
        useAnthropic: true,
        modelName: 'claude-3-5-sonnet-20241022',
        providerName: 'Anthropic',
      });

      expect(shouldUseAnthropic).toHaveBeenCalledWith(mockExperience.aiConfig);
      expect(getModelName).toHaveBeenCalledWith(mockExperience.aiConfig, 'anthropic');
    });

    it('should handle missing AI config', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { shouldUseAnthropic, getModelName } = require('../../utils/provider-adapter');
      
      shouldUseAnthropic.mockReturnValue(false);
      getModelName.mockReturnValue('gpt-4o');

      const experienceWithoutAI = { ...mockExperience, aiConfig: undefined };
      const config = AIRequestHandler.getProviderConfig(experienceWithoutAI as any);

      expect(config.providerName).toBeTruthy();
      expect(config.modelName).toBeTruthy();
    });
  });

  describe('createTaskMessage', () => {
    it('should create message with task description and artifacts', () => {
      const taskDescription = 'Analyze the data';
      const artifactIds = ['artifact-1', 'artifact-2', 'artifact-3'];

      const message = AIRequestHandler.createTaskMessage(taskDescription, artifactIds);

      expect(message).toContain('I have been delegated the following task:');
      expect(message).toContain('Task: Analyze the data');
      expect(message).toContain('Available artifacts: artifact-1, artifact-2, artifact-3');
      expect(message).toContain('Please retrieve and analyze these artifacts');
    });

    it('should create message with only task description', () => {
      const taskDescription = 'Complete the analysis';
      const artifactIds: string[] = [];

      const message = AIRequestHandler.createTaskMessage(taskDescription, artifactIds);

      expect(message).toContain('I have been delegated the following task:');
      expect(message).toContain('Task: Complete the analysis');
      expect(message).toContain('Please begin working on the delegated task');
      expect(message).not.toContain('Available artifacts');
    });

    it('should create message with only artifacts', () => {
      const taskDescription = '';
      const artifactIds = ['doc-1', 'doc-2'];

      const message = AIRequestHandler.createTaskMessage(taskDescription, artifactIds);

      expect(message).toContain('I have been delegated the following task:');
      expect(message).toContain('Available artifacts: doc-1, doc-2');
      expect(message).toContain('Please retrieve and analyze these artifacts');
    });

    it('should create minimal message with no task or artifacts', () => {
      const taskDescription = '';
      const artifactIds: string[] = [];

      const message = AIRequestHandler.createTaskMessage(taskDescription, artifactIds);

      expect(message).toContain('I have been delegated the following task:');
      expect(message).toContain('Please begin working on the delegated task');
      expect(message).not.toContain('Available artifacts');
    });

    it('should handle single artifact', () => {
      const taskDescription = 'Review document';
      const artifactIds = ['single-artifact'];

      const message = AIRequestHandler.createTaskMessage(taskDescription, artifactIds);

      expect(message).toContain('Available artifacts: single-artifact');
    });

    it('should handle many artifacts', () => {
      const taskDescription = 'Process all files';
      const artifactIds = Array.from({ length: 10 }, (_, i) => `artifact-${i + 1}`);

      const message = AIRequestHandler.createTaskMessage(taskDescription, artifactIds);

      expect(message).toContain('Available artifacts:');
      artifactIds.forEach(id => {
        expect(message).toContain(id);
      });
    });

    it('should handle special characters in task description', () => {
      const taskDescription = 'Analyze "data" & <format> correctly';
      const artifactIds: string[] = [];

      const message = AIRequestHandler.createTaskMessage(taskDescription, artifactIds);

      expect(message).toContain('Task: Analyze "data" & <format> correctly');
    });

    it('should handle special characters in artifact IDs', () => {
      const taskDescription = 'Process files';
      const artifactIds = ['artifact-1', 'file_with_underscore', 'doc.with.dots'];

      const message = AIRequestHandler.createTaskMessage(taskDescription, artifactIds);

      expect(message).toContain('artifact-1, file_with_underscore, doc.with.dots');
    });

    it('should create properly formatted message structure', () => {
      const taskDescription = 'Test task';
      const artifactIds = ['art-1'];

      const message = AIRequestHandler.createTaskMessage(taskDescription, artifactIds);

      // Check for proper line breaks and structure
      expect(message).toMatch(/I have been delegated the following task:\n\n/);
      expect(message).toMatch(/Task: Test task\n\n/);
      expect(message).toMatch(/Available artifacts: art-1\n\n/);
    });
  });

  describe('initializeMessageHistory', () => {
    it('should create message history with system, user, and initial response', () => {
      const taskMessage = 'Complete this task';
      const initialResponse: any = {
        role: 'assistant',
        content: 'I will help with that',
      };
      
      const messages = AIRequestHandler.initializeMessageHistory(
        mockExperience,
        taskMessage,
        initialResponse
      );

      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({
        role: 'system',
        content: mockExperience.instructions,
      });
      expect(messages[1]).toEqual({
        role: 'user',
        content: taskMessage,
      });
      expect(messages[2]).toEqual(initialResponse);
    });

    it('should handle empty task message', () => {
      const taskMessage = '';
      const initialResponse: any = { role: 'assistant', content: 'Response' };
      
      const messages = AIRequestHandler.initializeMessageHistory(
        mockExperience,
        taskMessage,
        initialResponse
      );

      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('');
      expect(messages[2]).toEqual(initialResponse);
    });

    it('should handle empty instructions', () => {
      const experienceWithoutInstructions = {
        ...mockExperience,
        instructions: '',
      };
      const taskMessage = 'Test task';
      const initialResponse: any = { role: 'assistant', content: 'Response' };
      
      const messages = AIRequestHandler.initializeMessageHistory(
        experienceWithoutInstructions,
        taskMessage,
        initialResponse
      );

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('');
      expect(messages[1].content).toBe('Test task');
      expect(messages[2]).toEqual(initialResponse);
    });

    it('should handle long instructions', () => {
      const longInstructions = 'a'.repeat(10000);
      const experienceWithLongInstructions = {
        ...mockExperience,
        instructions: longInstructions,
      };
      const taskMessage = 'Task';
      const initialResponse: any = { role: 'assistant', content: 'Response' };
      
      const messages = AIRequestHandler.initializeMessageHistory(
        experienceWithLongInstructions,
        taskMessage,
        initialResponse
      );

      expect(messages[0].content).toBe(longInstructions);
      expect(messages[0].content.length).toBe(10000);
    });

    it('should handle multiline instructions', () => {
      const multilineInstructions = 'Line 1\nLine 2\nLine 3';
      const experienceWithMultiline = {
        ...mockExperience,
        instructions: multilineInstructions,
      };
      const taskMessage = 'Task';
      const initialResponse: any = { role: 'assistant', content: 'Response' };
      
      const messages = AIRequestHandler.initializeMessageHistory(
        experienceWithMultiline,
        taskMessage,
        initialResponse
      );

      expect(messages[0].content).toContain('Line 1');
      expect(messages[0].content).toContain('Line 2');
      expect(messages[0].content).toContain('Line 3');
    });

    it('should handle special characters in instructions', () => {
      const specialInstructions = 'Use <tags> and "quotes" & symbols';
      const experienceWithSpecial = {
        ...mockExperience,
        instructions: specialInstructions,
      };
      const taskMessage = 'Task';
      const initialResponse: any = { role: 'assistant', content: 'Response' };
      
      const messages = AIRequestHandler.initializeMessageHistory(
        experienceWithSpecial,
        taskMessage,
        initialResponse
      );

      expect(messages[0].content).toBe(specialInstructions);
    });
  });

  describe('Message History Structure', () => {
    it('should create messages with correct roles', () => {
      const taskMessage = 'Test';
      const initialResponse: any = { role: 'assistant', content: 'Response' };
      const messages = AIRequestHandler.initializeMessageHistory(
        mockExperience,
        taskMessage,
        initialResponse
      );

      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[2].role).toBe('assistant');
    });

    it('should create messages with correct content', () => {
      const instructions = 'System instructions';
      const taskMessage = 'User task';
      const experience = { ...mockExperience, instructions };
      const initialResponse: any = { role: 'assistant', content: 'Response' };
      
      const messages = AIRequestHandler.initializeMessageHistory(
        experience,
        taskMessage,
        initialResponse
      );

      expect(messages[0].content).toBe(instructions);
      expect(messages[1].content).toBe(taskMessage);
      expect(messages[2]).toEqual(initialResponse);
    });

    it('should maintain message order', () => {
      const initialResponse: any = { role: 'assistant', content: 'Response' };
      const messages = AIRequestHandler.initializeMessageHistory(
        mockExperience,
        'Task',
        initialResponse
      );

      // System message should always come first
      expect(messages[0].role).toBe('system');
      // User message should come second
      expect(messages[1].role).toBe('user');
      // Initial response should come third
      expect(messages[2].role).toBe('assistant');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined experience properties gracefully', () => {
      const minimalExperience = {
        agentConfig: mockExperience.agentConfig,
        instructions: 'Test',
      } as LoadedExperience;
      const initialResponse: any = { role: 'assistant', content: 'Response' };

      const messages = AIRequestHandler.initializeMessageHistory(
        minimalExperience,
        'Task',
        initialResponse
      );

      expect(messages).toHaveLength(3);
    });

    it('should handle very long task descriptions', () => {
      const longTask = 'Task: ' + 'a'.repeat(5000);
      const artifactIds = ['art-1'];

      const message = AIRequestHandler.createTaskMessage(longTask, artifactIds);

      expect(message).toContain(longTask);
      expect(message.length).toBeGreaterThan(5000);
    });

    it('should handle empty artifact array vs null', () => {
      const message1 = AIRequestHandler.createTaskMessage('Task', []);
      const message2 = AIRequestHandler.createTaskMessage('Task', null as any);

      expect(message1).toContain('Please begin working on the delegated task');
      // null should be handled gracefully (though type system prevents this)
      expect(message2).toContain('Please begin working on the delegated task');
    });

    it('should create consistent message format', () => {
      const message1 = AIRequestHandler.createTaskMessage('Task A', ['art-1']);
      const message2 = AIRequestHandler.createTaskMessage('Task B', ['art-2']);

      // Both should have the same structure
      expect(message1).toMatch(/I have been delegated the following task:/);
      expect(message2).toMatch(/I have been delegated the following task:/);
      expect(message1).toMatch(/Task:/);
      expect(message2).toMatch(/Task:/);
      
      // Verify both messages are properly formatted and different
      expect(message1.length).toBeGreaterThan(0);
      expect(message2.length).toBeGreaterThan(0);
      expect(message1).not.toBe(message2);
    });
  });

  describe('Provider Configuration Edge Cases', () => {
    it('should handle different AI config formats', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { shouldUseAnthropic, getModelName } = require('../../utils/provider-adapter');
      
      shouldUseAnthropic.mockReturnValue(false);
      getModelName.mockReturnValue('gpt-4o');

      const configs = [
        { provider: 'openai', model: 'gpt-4' },
        { provider: 'anthropic', model: 'claude-3-5-sonnet' },
        {},
      ];

      configs.forEach(aiConfig => {
        const exp = { ...mockExperience, aiConfig };
        const config = AIRequestHandler.getProviderConfig(exp as any);
        
        expect(config).toHaveProperty('useAnthropic');
        expect(config).toHaveProperty('modelName');
        expect(config).toHaveProperty('providerName');
      });
    });
  });
});
