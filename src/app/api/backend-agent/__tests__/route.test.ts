/**
 * Integration tests for /api/backend-agent route
 * Tests the full request/response cycle and manager orchestration
 * @jest-environment node
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';
import * as rateLimitModule from '@/app/lib/rate-limit';
import * as nextAuthJwt from 'next-auth/jwt';
import { ValidationManager } from '../managers/ValidationManager';
import { ExperienceConfigLoader } from '../managers/ExperienceConfigLoader';
import { ToolRegistrationManager } from '../managers/ToolRegistrationManager';
import { DelegationStatusManager } from '../managers/DelegationStatusManager';
import { ToolExecutionManager } from '../managers/ToolExecutionManager';
import { AIRequestHandler } from '../managers/AIRequestHandler';

// Mock dependencies
jest.mock('@/app/lib/rate-limit');
jest.mock('next-auth/jwt');
jest.mock('@/lib/audit-logger', () => ({
  auditBackendAgent: jest.fn()
}));
jest.mock('../utils/context', () => ({
  createServerToolContext: jest.fn().mockResolvedValue({
    experienceId: 'test-exp',
    sessionId: 'test-session',
    delegationId: 'test-delegation'
  })
}));

// Mock all managers
jest.mock('../managers/ValidationManager', () => ({
  ValidationManager: {
    validateRequest: jest.fn()
  }
}));
jest.mock('../managers/ExperienceConfigLoader', () => ({
  ExperienceConfigLoader: {
    loadExperience: jest.fn()
  }
}));
jest.mock('../managers/ToolRegistrationManager', () => ({
  ToolRegistrationManager: {
    initializeTools: jest.fn()
  }
}));
jest.mock('../managers/DelegationStatusManager', () => ({
  DelegationStatusManager: {
    sendStatusMessage: jest.fn(),
    sendToolExecution: jest.fn()
  }
}));
jest.mock('../managers/ToolExecutionManager', () => ({
  ToolExecutionManager: {
    executeToolCalls: jest.fn()
  }
}));
jest.mock('../managers/AIRequestHandler', () => ({
  AIRequestHandler: {
    getProviderConfig: jest.fn(),
    createTaskMessage: jest.fn(),
    sendInitialRequest: jest.fn(),
    initializeMessageHistory: jest.fn(),
    sendFollowUpRequest: jest.fn()
  }
}));

describe('POST /api/backend-agent - Integration Tests', () => {
  let mockRateLimit: jest.SpyInstance;
  let mockGetToken: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock rate limiting - allow by default
    mockRateLimit = jest.spyOn(rateLimitModule, 'rateLimit').mockReturnValue({
      allowed: true,
      remaining: 10,
      max: 10,
      resetTime: Date.now() + 60000,
      message: ''
    });

    jest.spyOn(rateLimitModule, 'getClientIdentifier').mockReturnValue('test-client');

    // Mock auth token
    mockGetToken = jest.spyOn(nextAuthJwt, 'getToken').mockResolvedValue({
      email: 'test@example.com',
      name: 'Test User'
    } as any);

    // Setup default successful manager responses
    (ValidationManager.validateRequest as jest.Mock).mockResolvedValue({
      valid: true,
      data: {
        agentType: 'test-agent',
        artifactIds: ['artifact-1'],
        taskDescription: 'Test task',
        experienceId: 'test-exp',
        imageNames: [],
        delegationId: 'test-delegation',
        sessionId: 'test-session'
      }
    });

    (ExperienceConfigLoader.loadExperience as jest.Mock).mockResolvedValue({
      agentConfig: {
        name: 'Test Agent',
        provider: 'openai',
        model: 'gpt-4',
        tools: []
      }
    });

    (ToolRegistrationManager.initializeTools as jest.Mock).mockResolvedValue([]);

    (AIRequestHandler.getProviderConfig as jest.Mock).mockReturnValue({
      provider: 'openai',
      model: 'gpt-4'
    });

    (AIRequestHandler.createTaskMessage as jest.Mock).mockReturnValue({
      role: 'user',
      content: 'Test task'
    });

    (AIRequestHandler.sendInitialRequest as jest.Mock).mockResolvedValue({
      role: 'assistant',
      content: 'Task completed',
      tool_calls: null
    });

    (AIRequestHandler.initializeMessageHistory as jest.Mock).mockReturnValue([
      { role: 'user', content: 'Test task' },
      { role: 'assistant', content: 'Task completed' }
    ]);

    (DelegationStatusManager.sendStatusMessage as jest.Mock).mockResolvedValue(undefined);
    (DelegationStatusManager.sendToolExecution as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Successful Request Flow', () => {
    it('should successfully process a simple backend agent request', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: ['artifact-1'],
          taskDescription: 'Test task',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        }),
        headers: {
          'content-type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Task completed');
      expect(data.agentType).toBe('test-agent');
      expect(data.sessionId).toBe('test-session');
    });

    it('should orchestrate all managers in correct order', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: [],
          taskDescription: 'Test',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      await POST(request);

      // Verify managers were called in correct order
      expect(ValidationManager.validateRequest).toHaveBeenCalled();
      expect(ExperienceConfigLoader.loadExperience).toHaveBeenCalledWith('test-exp', 'test-agent');
      expect(ToolRegistrationManager.initializeTools).toHaveBeenCalled();
      expect(AIRequestHandler.getProviderConfig).toHaveBeenCalled();
      expect(AIRequestHandler.createTaskMessage).toHaveBeenCalled();
      expect(AIRequestHandler.sendInitialRequest).toHaveBeenCalled();
    });

    it('should send delegation status updates', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: [],
          taskDescription: 'Test',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      await POST(request);

      expect(DelegationStatusManager.sendStatusMessage).toHaveBeenCalledWith(
        'test-session',
        'test-delegation',
        'Starting Test Agent',
        'Test Agent'
      );
      expect(DelegationStatusManager.sendStatusMessage).toHaveBeenCalledWith(
        'test-session',
        'test-delegation',
        'Thinking'
      );
    });

    it('should handle tool execution loop', async () => {
      // Mock initial response with tool calls
      (AIRequestHandler.sendInitialRequest as jest.Mock).mockResolvedValue({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call-1',
            function: { name: 'test-tool', arguments: '{}' }
          }
        ]
      });

      // Mock tool execution
      (ToolExecutionManager.executeToolCalls as jest.Mock).mockResolvedValue([
        {
          role: 'tool',
          tool_call_id: 'call-1',
          content: 'Tool result'
        }
      ]);

      // Mock follow-up response without tool calls
      (AIRequestHandler.sendFollowUpRequest as jest.Mock).mockResolvedValue({
        role: 'assistant',
        content: 'Final response',
        tool_calls: null
      });

      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: [],
          taskDescription: 'Test with tools',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Final response');
      expect(ToolExecutionManager.executeToolCalls).toHaveBeenCalled();
      expect(AIRequestHandler.sendFollowUpRequest).toHaveBeenCalled();
      // Check that sendToolExecution was called with the tool name
      expect(DelegationStatusManager.sendToolExecution).toHaveBeenCalledWith(
        'test-session',
        'test-delegation',
        'test-tool',
        'Test Agent',
        undefined // no action in the test tool arguments
      );
    });

    it('should handle multiple tool execution rounds', async () => {
      // Mock initial response with tool calls
      (AIRequestHandler.sendInitialRequest as jest.Mock).mockResolvedValue({
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call-1', function: { name: 'tool-1', arguments: '{}' } }]
      });

      // Mock tool execution
      (ToolExecutionManager.executeToolCalls as jest.Mock).mockResolvedValue([
        { role: 'tool', tool_call_id: 'call-1', content: 'Result 1' }
      ]);

      // Mock first follow-up with more tool calls
      (AIRequestHandler.sendFollowUpRequest as jest.Mock)
        .mockResolvedValueOnce({
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'call-2', function: { name: 'tool-2', arguments: '{}' } }]
        })
        .mockResolvedValueOnce({
          role: 'assistant',
          content: 'All done',
          tool_calls: null
        });

      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: [],
          taskDescription: 'Multi-step task',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('All done');
      expect(ToolExecutionManager.executeToolCalls).toHaveBeenCalledTimes(2);
      expect(AIRequestHandler.sendFollowUpRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 for invalid request', async () => {
      (ValidationManager.validateRequest as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Invalid request',
        status: 400
      });

      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should not proceed with managers if validation fails', async () => {
      (ValidationManager.validateRequest as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Missing required field',
        status: 400
      });

      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({})
      });

      await POST(request);

      expect(ExperienceConfigLoader.loadExperience).not.toHaveBeenCalled();
      expect(ToolRegistrationManager.initializeTools).not.toHaveBeenCalled();
      expect(AIRequestHandler.sendInitialRequest).not.toHaveBeenCalled();
    });
  });

  describe('Experience Loading Errors', () => {
    it('should return 404 when agent not found', async () => {
      (ExperienceConfigLoader.loadExperience as jest.Mock).mockRejectedValue(
        new Error('No agent found for type: test-agent')
      );

      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: [],
          taskDescription: 'Test',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('No agent found');
    });

    it('should return 500 for other experience loading errors', async () => {
      (ExperienceConfigLoader.loadExperience as jest.Mock).mockRejectedValue(
        new Error('Failed to load experience')
      );

      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: [],
          taskDescription: 'Test',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to load experience');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on backend agent requests', async () => {
      mockRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        max: 10,
        resetTime: Date.now() + 60000,
        message: 'Too many requests'
      });

      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: [],
          taskDescription: 'Test',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('Retry-After')).toBeDefined();
    });

    it('should use strict rate limit config for backend agent', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: [],
          taskDescription: 'Test',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      await POST(request);

      expect(mockRateLimit).toHaveBeenCalledWith(
        'test-client',
        expect.objectContaining({
          max: expect.any(Number),
          windowMs: expect.any(Number)
        })
      );
    });
  });

  describe('Authentication and Audit Logging', () => {
    it('should log authenticated user requests', async () => {
      const auditLogger = await import('@/lib/audit-logger');
      const { auditBackendAgent } = auditLogger;

      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: ['art-1', 'art-2'],
          taskDescription: 'Test task',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      await POST(request);

      // Verify audit logging was called
      expect(auditBackendAgent).toHaveBeenCalled();
      
      // Get the actual call arguments
      const callArgs = auditBackendAgent.mock.calls[0];
      
      // Verify user email
      expect(callArgs[0]).toBe('test@example.com');
      
      // Verify request object is passed (second argument)
      expect(callArgs[1]).toBeDefined();
      
      // Verify audit data (third argument)
      expect(callArgs[2]).toMatchObject({
        agentType: 'test-agent',
        experienceId: 'test-exp',
        sessionId: 'test-session',
        delegationId: 'test-delegation',
        hasTaskDescription: true
      });
      
      // Verify counts are numbers (they should be 1 and 2 based on the validated data)
      expect(typeof callArgs[2].artifactCount).toBe('number');
      expect(typeof callArgs[2].imageCount).toBe('number');
    });

    it('should log anonymous user requests', async () => {
      mockGetToken.mockResolvedValue(null);
      const auditLogger = await import('@/lib/audit-logger');
      const { auditBackendAgent } = auditLogger;

      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: [],
          taskDescription: 'Test',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      await POST(request);

      expect(auditBackendAgent).toHaveBeenCalledWith(
        'anonymous',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      (AIRequestHandler.sendInitialRequest as jest.Mock).mockRejectedValue(
        new Error('AI service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: [],
          taskDescription: 'Test',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('AI service unavailable');
    });

    it('should handle tool execution errors', async () => {
      (AIRequestHandler.sendInitialRequest as jest.Mock).mockResolvedValue({
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call-1', function: { name: 'failing-tool', arguments: '{}' } }]
      });

      (ToolExecutionManager.executeToolCalls as jest.Mock).mockRejectedValue(
        new Error('Tool execution failed')
      );

      const request = new NextRequest('http://localhost:3000/api/backend-agent', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'test-agent',
          artifactIds: [],
          taskDescription: 'Test',
          experienceId: 'test-exp',
          sessionId: 'test-session',
          delegationId: 'test-delegation'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Tool execution failed');
    });
  });
});
