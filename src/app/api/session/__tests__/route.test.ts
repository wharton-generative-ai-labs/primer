/**
 * Integration tests for /api/session route
 * Tests OpenAI GA Realtime API session bootstrap (POST /v1/realtime/client_secrets)
 * @jest-environment node
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/config/env', () => ({
  env: {
    OPENAI_API_KEY: 'test-api-key',
    NODE_ENV: 'test'
  }
}));

global.fetch = jest.fn();

const GA_ENDPOINT = 'https://api.openai.com/v1/realtime/client_secrets';

// What OpenAI's GA /v1/realtime/client_secrets returns: ephemeral key at top
// level under `value`, plus an `expires_at` and the effective `session` config.
const buildGaResponse = (overrides: Record<string, unknown> = {}) => ({
  value: 'ek_test_value',
  expires_at: 1756310470,
  session: {
    id: 'sess_test',
    object: 'realtime.session',
    type: 'realtime',
    model: 'gpt-realtime-2',
    output_modalities: ['audio'],
    audio: { output: { voice: 'cedar' } },
  },
  ...overrides,
});

describe('POST /api/session - GA Realtime client_secrets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Successful Session Creation', () => {
    it('hits the GA /v1/realtime/client_secrets endpoint with bearer auth', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(buildGaResponse())
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-realtime-2',
          modalities: ['text', 'audio'],
          voice: 'cedar'
        }),
        headers: { 'content-type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(global.fetch).toHaveBeenCalledWith(
        GA_ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json'
          },
          body: expect.any(String)
        })
      );
    });

    it('wraps caller fields in the GA `session` shape (model, audio.output.voice, output_modalities)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(buildGaResponse())
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-realtime-2',
          modalities: ['text', 'audio'],
          voice: 'shimmer'
        })
      });

      await POST(request);

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody).toEqual({
        session: {
          type: 'realtime',
          model: 'gpt-realtime-2',
          audio: { output: { voice: 'shimmer' } },
          output_modalities: ['text', 'audio']
        }
      });
    });

    it('forwards reasoning.effort to GA endpoint for reasoning-capable models (gpt-realtime-2)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(buildGaResponse())
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

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody.session.reasoning).toEqual({ effort: 'low' });
    });

    it('omits reasoning when caller does not provide it (non-reasoning models)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(buildGaResponse())
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-realtime-1.5',
          modalities: ['text', 'audio'],
          voice: 'cedar'
        })
      });

      await POST(request);

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect('reasoning' in sentBody.session).toBe(false);
    });

    it('supports different voice options', async () => {
      const voices = ['alloy', 'echo', 'cedar', 'marin', 'shimmer'];

      for (const voice of voices) {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(buildGaResponse())
        });

        const request = new NextRequest('http://localhost:3000/api/session', {
          method: 'POST',
          body: JSON.stringify({
            model: 'gpt-realtime-2',
            modalities: ['audio'],
            voice
          })
        });

        await POST(request);

        const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
        expect(sentBody.session.audio.output.voice).toBe(voice);

        jest.clearAllMocks();
      }
    });

    it('omits audio.output when no voice is provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(buildGaResponse())
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-realtime-2' })
      });

      await POST(request);

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect('audio' in sentBody.session).toBe(false);
      expect('output_modalities' in sentBody.session).toBe(false);
    });
  });

  describe('Response normalization', () => {
    // useRealtimeConnection (and any other legacy callers) read
    // `data.client_secret.value`. The GA endpoint puts the key at top-level
    // `data.value`; the route maps the GA shape back so callers don't break.
    it('maps GA `value` onto legacy `client_secret.value` for backward compatibility', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(buildGaResponse({
          value: 'ek_abc123',
          expires_at: 999
        }))
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-realtime-2' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.value).toBe('ek_abc123');
      expect(data.client_secret).toEqual({
        value: 'ek_abc123',
        expires_at: 999
      });
    });

    it('preserves the full session config from the GA response', async () => {
      const gaResponse = buildGaResponse();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(gaResponse)
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-realtime-2' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.session).toEqual(gaResponse.session);
    });
  });

  describe('Error Handling', () => {
    it('passes OpenAI errors through without injecting a fake client_secret', async () => {
      const errorPayload = {
        error: {
          message: 'Invalid API key',
          type: 'invalid_request_error'
        }
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve(errorPayload)
      });

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-realtime-2' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.error).toBeDefined();
      expect(data.client_secret).toBeUndefined();
    });

    it('handles network errors with a 500', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-realtime-2' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
    });

    it('handles malformed request body with a 500', async () => {
      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
    });
  });
});
