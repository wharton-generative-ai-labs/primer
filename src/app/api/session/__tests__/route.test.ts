/**
 * Integration tests for /api/session route
 * Tests OpenAI Realtime API session creation
 * @jest-environment node
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the env module before importing the route
jest.mock('@/config/env', () => ({
  env: {
    OPENAI_API_KEY: 'test-api-key',
    NODE_ENV: 'test'
  }
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('POST /api/session - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Successful Session Creation', () => {
    it('should create a realtime session with valid parameters', async () => {
      const mockSessionData = {
        id: 'sess_123',
        object: 'realtime.session',
        model: 'gpt-4o-realtime-preview-2024-12-17',
        modalities: ['text', 'audio'],
        voice: 'alloy',
        client_secret: {
          value: 'secret_123',
          expires_at: Date.now() + 60000
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionData)
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          modalities: ['text', 'audio'],
          voice: 'alloy'
        }),
        headers: {
          'content-type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockSessionData);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/realtime/sessions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json'
          }),
          body: expect.any(String)
        })
      );
    });

    it('should pass through all modalities correctly', async () => {
      const mockSessionData = {
        id: 'sess_456',
        modalities: ['text', 'audio']
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionData)
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          modalities: ['text', 'audio'],
          voice: 'shimmer'
        })
      });

      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody.modalities).toEqual(['text', 'audio']);
      expect(requestBody.voice).toBe('shimmer');
      expect(requestBody.model).toBe('gpt-4o-realtime-preview-2024-12-17');
    });

    it('should forward reasoning.effort when provided (gpt-realtime-2)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'sess_reasoning' })
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-realtime-2',
          modalities: ['text', 'audio'],
          voice: 'cedar',
          reasoning: { effort: 'low' }
        })
      });

      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.model).toBe('gpt-realtime-2');
      expect(requestBody.reasoning).toEqual({ effort: 'low' });
    });

    it('should omit reasoning when caller does not provide it (gpt-realtime-1.5)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'sess_no_reasoning' })
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-realtime',
          modalities: ['text', 'audio'],
          voice: 'cedar'
        })
      });

      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.model).toBe('gpt-realtime');
      expect('reasoning' in requestBody).toBe(false);
    });

    it('should support different voice options', async () => {
      const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

      for (const voice of voices) {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ id: 'sess_test', voice })
        });

        const request = new NextRequest('http://localhost:3000/api/session', {
          method: 'POST',
          body: JSON.stringify({
            model: 'gpt-4o-realtime-preview-2024-12-17',
            modalities: ['audio'],
            voice
          })
        });

        await POST(request);

        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        const requestBody = JSON.parse(fetchCall[1].body);
        expect(requestBody.voice).toBe(voice);

        jest.clearAllMocks();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: {
            message: 'Invalid API key',
            type: 'invalid_request_error'
          }
        })
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          modalities: ['audio'],
          voice: 'alloy'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      // The route passes through the OpenAI response
      expect(data.error).toBeDefined();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          modalities: ['audio'],
          voice: 'alloy'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
    });

    it('should handle malformed request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
    });

    it('should handle missing API key', async () => {
      // Temporarily mock env with undefined API key
      jest.resetModules();
      jest.doMock('@/config/env', () => ({
        env: {
          OPENAI_API_KEY: undefined,
          NODE_ENV: 'test'
        }
      }));

      // Re-import the route with the new mock
      const { POST: POSTWithoutKey } = await import('../route');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: { message: 'Missing API key' }
        })
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          modalities: ['audio'],
          voice: 'alloy'
        })
      });

      await POSTWithoutKey(request);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/realtime/sessions',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer undefined'
          })
        })
      );
      
      // Restore the original mock
      jest.resetModules();
      jest.doMock('@/config/env', () => ({
        env: {
          OPENAI_API_KEY: 'test-api-key',
          NODE_ENV: 'test'
        }
      }));
    });
  });

  describe('Request Validation', () => {
    it('should send request with correct headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'sess_test' })
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          modalities: ['audio'],
          voice: 'alloy'
        })
      });

      await POST(request);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/realtime/sessions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should correctly serialize request body', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'sess_test' })
      });

      const requestData = {
        model: 'gpt-4o-realtime-preview-2024-12-17',
        modalities: ['text', 'audio'],
        voice: 'nova'
      };

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const sentBody = JSON.parse(fetchCall[1].body);
      
      expect(sentBody).toEqual(requestData);
    });
  });

  describe('Response Handling', () => {
    it('should return complete session data from OpenAI', async () => {
      const mockSessionData = {
        id: 'sess_789',
        object: 'realtime.session',
        model: 'gpt-4o-realtime-preview-2024-12-17',
        modalities: ['text', 'audio'],
        instructions: '',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: null,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        tools: [],
        tool_choice: 'auto',
        temperature: 0.8,
        max_response_output_tokens: 'inf',
        client_secret: {
          value: 'secret_xyz',
          expires_at: 1234567890
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionData)
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          modalities: ['text', 'audio'],
          voice: 'alloy'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toEqual(mockSessionData);
      expect(data.client_secret).toBeDefined();
      expect(data.client_secret.value).toBe('secret_xyz');
    });

    it('should preserve all response fields from OpenAI', async () => {
      const mockResponse = {
        id: 'sess_custom',
        custom_field: 'custom_value',
        nested: {
          data: 'test'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          modalities: ['audio'],
          voice: 'alloy'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toEqual(mockResponse);
    });
  });
});
