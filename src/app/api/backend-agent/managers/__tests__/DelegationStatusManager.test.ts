/**
 * Tests for DelegationStatusManager
 * 
 * Tests sending delegation status updates via socket including:
 * - Status update messages
 * - Socket communication
 * - Error handling for status updates
 */

import { DelegationStatusManager } from '../DelegationStatusManager';

// Mock the env module
jest.mock('@/config/env', () => ({
  env: {
    PORT: '3000',
    NODE_ENV: 'test'
  }
}));

// Mock fetch globally
global.fetch = jest.fn();

jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('DelegationStatusManager', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
  });


  describe('sendStatusMessage', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });
    });

    it('should send status message', async () => {
      await DelegationStatusManager.sendStatusMessage(
        'session-123',
        'delegation-456',
        'Thinking'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/socket-delegation-status',
        expect.objectContaining({
          body: JSON.stringify({
            sessionId: 'session-123',
            delegationId: 'delegation-456',
            status: 'Thinking',
            agentName: undefined,
          }),
        })
      );
    });

    it('should send status message with agent name', async () => {
      await DelegationStatusManager.sendStatusMessage(
        'session-123',
        'delegation-456',
        'Starting Agent',
        'Test Agent'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/socket-delegation-status',
        expect.objectContaining({
          body: JSON.stringify({
            sessionId: 'session-123',
            delegationId: 'delegation-456',
            status: 'Starting Agent',
            agentName: 'Test Agent',
          }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        DelegationStatusManager.sendStatusMessage(
          'session-123',
          'delegation-456',
          'Thinking'
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('sendToolExecution', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });
    });

    it('should send tool execution without action', async () => {
      await DelegationStatusManager.sendToolExecution(
        'session-123',
        'delegation-456',
        'validateComponent'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/socket-delegation-status',
        expect.objectContaining({
          body: JSON.stringify({
            sessionId: 'session-123',
            delegationId: 'delegation-456',
            status: '',
            agentName: undefined,
            toolName: 'validateComponent',
            action: undefined,
          }),
        })
      );
    });

    it('should send tool execution with action', async () => {
      await DelegationStatusManager.sendToolExecution(
        'session-123',
        'delegation-456',
        'artifact',
        'Test Agent',
        'create'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/socket-delegation-status',
        expect.objectContaining({
          body: JSON.stringify({
            sessionId: 'session-123',
            delegationId: 'delegation-456',
            status: '',
            agentName: 'Test Agent',
            toolName: 'artifact',
            action: 'create',
          }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        DelegationStatusManager.sendToolExecution(
          'session-123',
          'delegation-456',
          'artifact'
        )
      ).resolves.toBeUndefined();
    });
  });
});
