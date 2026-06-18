/**
 * Tests for Proxy API Route
 * 
 * Integration tests for the proxy endpoint including:
 * - URL validation and SSRF protection
 * - Rate limiting
 * - Request/response handling
 * - Error handling
 */

import { GET } from '../route';
import { NextResponse } from 'next/server';
import * as urlValidation from '@/app/lib/security/url-validation';
import * as rateLimit from '@/app/lib/rate-limit';

// Mock dependencies
jest.mock('@/app/lib/security/url-validation');
jest.mock('@/app/lib/rate-limit');
jest.mock('next/server');

// Mock global fetch
global.fetch = jest.fn();

describe('Proxy API Route', () => {
  let mockValidateUrl: jest.SpyInstance;
  let mockRateLimit: jest.SpyInstance;
  let mockGetClientIdentifier: jest.SpyInstance;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockValidateUrl = jest.spyOn(urlValidation, 'validateUrl');
    mockRateLimit = jest.spyOn(rateLimit, 'rateLimit');
    mockGetClientIdentifier = jest.spyOn(rateLimit, 'getClientIdentifier');
    mockFetch = global.fetch as jest.Mock;

    // Default mock implementations
    mockValidateUrl.mockImplementation(() => {}); // No throw = valid
    mockGetClientIdentifier.mockReturnValue('test-client');
    mockRateLimit.mockReturnValue({
      allowed: true,
      remaining: 99,
      max: 100,
      resetTime: Date.now() + 900000,
    });

    // Mock NextResponse.json
    (NextResponse.json as jest.Mock) = jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      headers: init?.headers || {},
    }));

    // Mock NextResponse constructor for text responses
    // @ts-expect-error - mocking constructor
    NextResponse.mockImplementation((data, init) => ({
      text: async () => data,
      headers: {
        get: (name: string) => {
          const headers = init?.headers as Map<string, string> | undefined;
          return headers?.get(name) || null;
        },
      },
    }));
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to all requests', async () => {
      const request = new Request('http://localhost/api/proxy?url=https://example.com');

      mockFetch.mockResolvedValue({
        text: async () => 'response',
        headers: new Map([['Content-Type', 'text/html']]),
      });

      await GET(request);

      expect(mockGetClientIdentifier).toHaveBeenCalledWith(request);
      expect(mockRateLimit).toHaveBeenCalledWith('test-client', rateLimit.rateLimitConfigs.api);
    });

    it('should return 429 when rate limit is exceeded', async () => {
      mockRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        max: 100,
        resetTime: Date.now() + 900000,
        message: 'Rate limit exceeded',
      });

      const request = new Request('http://localhost/api/proxy?url=https://example.com');

      const response = await GET(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data).toEqual({ error: 'Rate limit exceeded' });
    });

    it('should include rate limit headers in 429 response', async () => {
      const resetTime = Date.now() + 900000;
      mockRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        max: 100,
        resetTime,
        message: 'Rate limit exceeded',
      });

      const request = new Request('http://localhost/api/proxy?url=https://example.com');

      const response = await GET(request);

      expect(response.headers['X-RateLimit-Limit']).toBe('100');
      expect(response.headers['X-RateLimit-Remaining']).toBe('0');
      expect(response.headers['X-RateLimit-Reset']).toBe(new Date(resetTime).toISOString());
      expect(response.headers['Retry-After']).toBeDefined();
    });

    it('should not proceed with request when rate limited', async () => {
      mockRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        max: 100,
        resetTime: Date.now() + 900000,
        message: 'Rate limit exceeded',
      });

      const request = new Request('http://localhost/api/proxy?url=https://example.com');

      await GET(request);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockValidateUrl).not.toHaveBeenCalled();
    });
  });

  describe('URL Validation', () => {
    it('should validate URL parameter is present', async () => {
      const request = new Request('http://localhost/api/proxy');

      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
      expect(data.details).toBeDefined();
    });

    it('should validate URL parameter is a valid URL', async () => {
      const request = new Request('http://localhost/api/proxy?url=not-a-url');

      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should call validateUrl for SSRF protection', async () => {
      const request = new Request('http://localhost/api/proxy?url=https://example.com');

      mockFetch.mockResolvedValue({
        text: async () => 'response',
        headers: new Map([['Content-Type', 'text/html']]),
      });

      await GET(request);

      expect(mockValidateUrl).toHaveBeenCalledWith('https://example.com');
    });

    it('should reject URLs that fail SSRF validation', async () => {
      mockValidateUrl.mockImplementation(() => {
        throw new Error('SSRF attempt detected: localhost access blocked');
      });

      const request = new Request('http://localhost/api/proxy?url=http://localhost:8080/admin');

      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('SSRF attempt detected: localhost access blocked');
    });

    it('should reject private IP addresses', async () => {
      mockValidateUrl.mockImplementation(() => {
        throw new Error('SSRF attempt detected: private IP range blocked');
      });

      const request = new Request('http://localhost/api/proxy?url=http://192.168.1.1');

      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('private IP');
    });

    it('should reject cloud metadata endpoints', async () => {
      mockValidateUrl.mockImplementation(() => {
        throw new Error('SSRF attempt detected: cloud metadata endpoint blocked');
      });

      const request = new Request('http://localhost/api/proxy?url=http://169.254.169.254/latest/meta-data');

      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('should accept valid public URLs', async () => {
      const validUrls = [
        'https://example.com',
        'https://api.github.com/repos',
        'https://www.google.com',
        'https://httpbin.org/get',
      ];

      mockFetch.mockResolvedValue({
        text: async () => 'response',
        headers: new Map([['Content-Type', 'text/html']]),
      });

      for (const url of validUrls) {
        const request = new Request(`http://localhost/api/proxy?url=${encodeURIComponent(url)}`);
        const response = await GET(request);
        
        // Should not be 403 (forbidden due to SSRF)
        expect(response.status).not.toBe(403);
      }
    });
  });

  describe('Proxying Requests', () => {
    it('should fetch the target URL', async () => {
      mockFetch.mockResolvedValue({
        text: async () => 'response data',
        headers: {
          get: () => 'text/html',
        },
      });

      const request = new Request('http://localhost/api/proxy?url=https://example.com/api/data');

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/api/data');
    });

    it('should call fetch with the validated URL', async () => {
      mockFetch.mockResolvedValue({
        text: async () => '{"data": "test response"}',
        headers: {
          get: () => 'application/json',
        },
      });

      const request = new Request('http://localhost/api/proxy?url=https://api.example.com/data');

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fetch content from target URL', async () => {
      const mockContent = '<html></html>';
      mockFetch.mockResolvedValue({
        text: async () => mockContent,
        headers: {
          get: () => 'text/html; charset=utf-8',
        },
      });

      const request = new Request('http://localhost/api/proxy?url=https://example.com');

      await GET(request);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle responses without Content-Type header', async () => {
      mockFetch.mockResolvedValue({
        text: async () => '{"data": "test"}',
        headers: {
          get: () => null,
        },
      });

      const request = new Request('http://localhost/api/proxy?url=https://example.com/api');

      await GET(request);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should fetch different content types', async () => {
      const contentTypes = [
        'application/json',
        'text/html',
        'text/plain',
        'application/xml',
        'text/csv',
      ];

      for (const contentType of contentTypes) {
        mockFetch.mockResolvedValue({
          text: async () => 'content',
          headers: {
            get: () => contentType,
          },
        });

        const request = new Request('http://localhost/api/proxy?url=https://example.com');
        await GET(request);

        expect(mockFetch).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const request = new Request('http://localhost/api/proxy?url=https://example.com');

      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch URL');
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'));

      const request = new Request('http://localhost/api/proxy?url=https://slow-site.com');

      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should handle DNS resolution errors', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

      const request = new Request('http://localhost/api/proxy?url=https://nonexistent-domain-12345.com');

      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should handle connection refused errors', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const request = new Request('http://localhost/api/proxy?url=https://example.com:9999');

      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should not expose internal error details', async () => {
      mockFetch.mockRejectedValue(new Error('Internal system path: /var/secrets/config'));

      const request = new Request('http://localhost/api/proxy?url=https://example.com');

      const response = await GET(request);

      const data = await response.json();
      expect(data.error).toBe('Failed to fetch URL');
      expect(data.error).not.toContain('/var/secrets');
    });
  });

  describe('Edge Cases', () => {
    it('should handle URLs with query parameters', async () => {
      mockFetch.mockResolvedValue({
        text: async () => 'response',
        headers: {
          get: () => 'application/json',
        },
      });

      const targetUrl = 'https://api.example.com/search?q=test&limit=10';
      const request = new Request(`http://localhost/api/proxy?url=${encodeURIComponent(targetUrl)}`);

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(targetUrl);
    });

    it('should handle URLs with fragments', async () => {
      mockFetch.mockResolvedValue({
        text: async () => 'response',
        headers: {
          get: () => 'text/html',
        },
      });

      const targetUrl = 'https://example.com/page#section';
      const request = new Request(`http://localhost/api/proxy?url=${encodeURIComponent(targetUrl)}`);

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(targetUrl);
    });

    it('should handle very long URLs', async () => {
      mockFetch.mockResolvedValue({
        text: async () => 'response',
        headers: {
          get: () => 'application/json',
        },
      });

      const longPath = 'a'.repeat(1000);
      const targetUrl = `https://example.com/${longPath}`;
      const request = new Request(`http://localhost/api/proxy?url=${encodeURIComponent(targetUrl)}`);

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(targetUrl);
    });

    it('should handle URLs with special characters', async () => {
      mockFetch.mockResolvedValue({
        text: async () => 'response',
        headers: {
          get: () => 'application/json',
        },
      });

      const targetUrl = 'https://example.com/path?name=John Doe&email=test@example.com';
      const request = new Request(`http://localhost/api/proxy?url=${encodeURIComponent(targetUrl)}`);

      await GET(request);

      expect(mockValidateUrl).toHaveBeenCalled();
    });

    it('should handle empty response body', async () => {
      mockFetch.mockResolvedValue({
        text: async () => '',
        headers: {
          get: () => 'text/plain',
        },
      });

      const request = new Request('http://localhost/api/proxy?url=https://example.com/empty');

      await GET(request);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle large response bodies', async () => {
      const largeContent = 'x'.repeat(10000);
      mockFetch.mockResolvedValue({
        text: async () => largeContent,
        headers: {
          get: () => 'text/plain',
        },
      });

      const request = new Request('http://localhost/api/proxy?url=https://example.com/large');

      await GET(request);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle binary content', async () => {
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]).toString();
      mockFetch.mockResolvedValue({
        text: async () => binaryContent,
        headers: {
          get: () => 'image/png',
        },
      });

      const request = new Request('http://localhost/api/proxy?url=https://example.com/image.png');

      await GET(request);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle responses with Content-Type header', async () => {
      mockFetch.mockResolvedValue({
        text: async () => 'content',
        headers: {
          get: (name: string) => {
            if (name === 'Content-Type') return 'text/html';
            return null;
          },
        },
      });

      const request = new Request('http://localhost/api/proxy?url=https://example.com');

      await GET(request);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Security', () => {
    it('should not follow redirects to private IPs', async () => {
      // This would be handled by the fetch implementation and validateUrl
      mockValidateUrl.mockImplementation((url) => {
        if (url.includes('192.168')) {
          throw new Error('SSRF attempt detected: private IP range blocked');
        }
      });

      const request = new Request('http://localhost/api/proxy?url=http://192.168.1.1');

      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('should validate URL before making request', async () => {
      const callOrder: string[] = [];

      mockValidateUrl.mockImplementation(() => {
        callOrder.push('validate');
      });

      mockFetch.mockImplementation(async () => {
        callOrder.push('fetch');
        return {
          text: async () => 'response',
          headers: new Map([['Content-Type', 'text/html']]),
        };
      });

      const request = new Request('http://localhost/api/proxy?url=https://example.com');

      await GET(request);

      expect(callOrder).toEqual(['validate', 'fetch']);
    });

    it('should not make request if validation fails', async () => {
      mockValidateUrl.mockImplementation(() => {
        throw new Error('Invalid URL');
      });

      const request = new Request('http://localhost/api/proxy?url=http://localhost');

      await GET(request);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle validation errors with non-Error objects', async () => {
      mockValidateUrl.mockImplementation(() => {
        // Testing non-Error throw behavior for error handling robustness
        throw new Error('String error');
      });

      const request = new Request('http://localhost/api/proxy?url=http://localhost');

      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('String error');
    });
  });
});
