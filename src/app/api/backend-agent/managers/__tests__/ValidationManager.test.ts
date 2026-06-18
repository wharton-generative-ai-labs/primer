/**
 * Tests for ValidationManager
 */

import { NextRequest } from 'next/server';
import { ValidationManager } from '../ValidationManager';

// Helper to create a mock NextRequest
function createMockRequest(body: any, headers: Record<string, string> = {}): NextRequest {
  const request = new NextRequest('http://localhost/api/backend-agent', {
    method: 'POST',
    headers: new Headers(headers),
    body: JSON.stringify(body),
  });
  return request;
}

describe('ValidationManager', () => {
  const validUserEmail = 'user@example.com';

  describe('validateRequest', () => {
    describe('Valid Requests', () => {
      it('should validate a complete valid request', async () => {
        const body = {
          agentType: 'test-agent',
          artifactIds: ['artifact1', 'artifact2'],
          taskDescription: 'Test task',
          experienceId: 'exp123',
          imageNames: ['image1.png', 'image2.jpg'],
          delegationId: 'delegation123',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.agentType).toBe('test-agent');
          expect(result.data.artifactIds).toEqual(['artifact1', 'artifact2']);
          expect(result.data.taskDescription).toBe('Test task');
          expect(result.data.experienceId).toBe('exp123');
          expect(result.data.imageNames).toEqual(['image1.png', 'image2.jpg']);
          expect(result.data.delegationId).toBe('delegation123');
          expect(result.data.sessionId).toBe('session123');
          expect(result.data.userEmail).toBe(validUserEmail);
        }
      });

      it('should validate request with minimal required fields', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.agentType).toBe('test-agent');
          expect(result.data.experienceId).toBe('exp123');
          expect(result.data.sessionId).toBe('session123');
          expect(result.data.artifactIds).toEqual([]);
          expect(result.data.imageNames).toEqual([]);
          expect(result.data.taskDescription).toBe('');
        }
      });

      it('should validate request with empty arrays', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
          artifactIds: [],
          imageNames: [],
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.artifactIds).toEqual([]);
          expect(result.data.imageNames).toEqual([]);
        }
      });

      it('should validate request with empty taskDescription', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
          taskDescription: '',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.taskDescription).toBe('');
        }
      });
    });

    describe('Missing Required Fields', () => {
      it('should reject request without experienceId', async () => {
        const body = {
          agentType: 'test-agent',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('Experience ID is required');
          expect(result.status).toBe(400);
        }
      });

      it('should reject request without sessionId header', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
        };

        const request = createMockRequest(body, {});

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('Session ID is required');
          expect(result.status).toBe(400);
        }
      });

      it('should reject request without agentType', async () => {
        const body = {
          experienceId: 'exp123',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('Agent type is required and must be a non-empty string');
          expect(result.status).toBe(400);
        }
      });
    });

    describe('Invalid Field Types', () => {
      it('should reject request with empty agentType', async () => {
        const body = {
          agentType: '',
          experienceId: 'exp123',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('Agent type is required and must be a non-empty string');
          expect(result.status).toBe(400);
        }
      });

      it('should reject request with whitespace-only agentType', async () => {
        const body = {
          agentType: '   ',
          experienceId: 'exp123',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('Agent type is required and must be a non-empty string');
          expect(result.status).toBe(400);
        }
      });

      it('should reject request with non-string agentType', async () => {
        const body = {
          agentType: 123,
          experienceId: 'exp123',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('Agent type is required and must be a non-empty string');
          expect(result.status).toBe(400);
        }
      });

      it('should reject request with non-array artifactIds', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
          artifactIds: 'not-an-array',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('artifactIds must be an array');
          expect(result.status).toBe(400);
        }
      });

      it('should reject request with non-array imageNames', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
          imageNames: 'not-an-array',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('imageNames must be an array');
          expect(result.status).toBe(400);
        }
      });
    });

    describe('Malformed Requests', () => {
      it('should reject request with invalid JSON', async () => {
        const request = new NextRequest('http://localhost/api/backend-agent', {
          method: 'POST',
          headers: new Headers({
            'x-session-id': 'session123',
            'content-type': 'application/json',
          }),
          body: 'invalid json{',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('Invalid request body');
          expect(result.status).toBe(400);
        }
      });

      it('should reject request with null body', async () => {
        const request = new NextRequest('http://localhost/api/backend-agent', {
          method: 'POST',
          headers: new Headers({
            'x-session-id': 'session123',
          }),
          body: null,
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('Invalid request body');
          expect(result.status).toBe(400);
        }
      });
    });

    describe('Edge Cases', () => {
      it('should handle very long agentType', async () => {
        const body = {
          agentType: 'a'.repeat(1000),
          experienceId: 'exp123',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.agentType).toBe('a'.repeat(1000));
        }
      });

      it('should handle special characters in agentType', async () => {
        const body = {
          agentType: 'test-agent_123!@#',
          experienceId: 'exp123',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.agentType).toBe('test-agent_123!@#');
        }
      });

      it('should handle large arrays', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
          artifactIds: Array(100).fill('artifact'),
          imageNames: Array(50).fill('image.png'),
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.artifactIds.length).toBe(100);
          expect(result.data.imageNames.length).toBe(50);
        }
      });

      it('should handle special characters in experienceId', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp-123_test',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session-456_test',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.experienceId).toBe('exp-123_test');
          expect(result.data.sessionId).toBe('session-456_test');
        }
      });

      it('should handle Unicode characters', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
          taskDescription: 'Task with 日本語 and émojis 🎉',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.taskDescription).toBe('Task with 日本語 and émojis 🎉');
        }
      });
    });

    describe('User Email Handling', () => {
      it('should include userEmail in validated data', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, 'test@example.com');

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.userEmail).toBe('test@example.com');
        }
      });

      it('should handle different email formats', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
        };

        const emails = [
          'user@example.com',
          'user+tag@example.com',
          'user.name@example.co.uk',
        ];

        for (const email of emails) {
          const request = createMockRequest(body, {
            'x-session-id': 'session123',
          });

          const result = await ValidationManager.validateRequest(request, email);

          expect(result.valid).toBe(true);
          if (result.valid) {
            expect(result.data.userEmail).toBe(email);
          }
        }
      });
    });

    describe('Optional Fields', () => {
      it('should handle missing delegationId', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.delegationId).toBeUndefined();
        }
      });

      it('should include delegationId when provided', async () => {
        const body = {
          agentType: 'test-agent',
          experienceId: 'exp123',
          delegationId: 'delegation123',
        };

        const request = createMockRequest(body, {
          'x-session-id': 'session123',
        });

        const result = await ValidationManager.validateRequest(request, validUserEmail);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.delegationId).toBe('delegation123');
        }
      });
    });
  });
});
