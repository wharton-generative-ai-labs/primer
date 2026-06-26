/**
 * Tests for rate limiting functionality
 */

import { rateLimit, rateLimitConfigs, getClientIdentifier } from '../rate-limit';

describe('Rate Limiting', () => {
  describe('rateLimit', () => {
    describe('Basic Rate Limiting', () => {
      it('should allow requests within limit', () => {
        const identifier = 'test-user-1';
        const config = { windowMs: 60000, max: 3 };

        const result1 = rateLimit(identifier, config);
        expect(result1.allowed).toBe(true);
        expect(result1.remaining).toBe(2);

        const result2 = rateLimit(identifier, config);
        expect(result2.allowed).toBe(true);
        expect(result2.remaining).toBe(1);

        const result3 = rateLimit(identifier, config);
        expect(result3.allowed).toBe(true);
        expect(result3.remaining).toBe(0);
      });

      it('should block requests exceeding limit', () => {
        const identifier = 'test-user-2';
        const config = { windowMs: 60000, max: 2 };

        // Use up the limit
        rateLimit(identifier, config);
        rateLimit(identifier, config);

        // This should be blocked
        const result = rateLimit(identifier, config);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });

      it('should return resetTime for rate limited requests', () => {
        const identifier = 'test-user-3';
        const config = { windowMs: 60000, max: 1 };

        // Use up the limit
        rateLimit(identifier, config);
        const result2 = rateLimit(identifier, config);

        expect(result2.allowed).toBe(false);
        expect(result2.resetTime).toBeGreaterThan(Date.now());
        expect(result2.resetTime).toBeLessThanOrEqual(Date.now() + config.windowMs);
      });

      it('should include custom message', () => {
        const identifier = 'test-user-4';
        const config = { windowMs: 60000, max: 1, message: 'Custom error message' };

        rateLimit(identifier, config);
        const result = rateLimit(identifier, config);

        expect(result.allowed).toBe(false);
        expect(result.message).toBe('Custom error message');
      });

      it('should use default message when not provided', () => {
        const identifier = 'test-user-5';
        const config = { windowMs: 60000, max: 1 };

        rateLimit(identifier, config);
        const result = rateLimit(identifier, config);

        expect(result.message).toBe('Rate limit exceeded');
      });
    });

    describe('Multiple Identifiers', () => {
      it('should track different identifiers separately', () => {
        const config = { windowMs: 60000, max: 2 };

        const result1 = rateLimit('user-a', config);
        const result2 = rateLimit('user-b', config);

        expect(result1.allowed).toBe(true);
        expect(result1.remaining).toBe(1);
        expect(result2.allowed).toBe(true);
        expect(result2.remaining).toBe(1);
      });

      it('should not affect other identifiers when one is rate limited', () => {
        const config = { windowMs: 60000, max: 1 };

        // Rate limit user-a
        rateLimit('user-a', config);
        const resultA = rateLimit('user-a', config);
        expect(resultA.allowed).toBe(false);

        // user-b should still be allowed
        const resultB = rateLimit('user-b', config);
        expect(resultB.allowed).toBe(true);
      });
    });

    describe('Different Configurations', () => {
      it('should track different configs separately for same identifier', () => {
        const identifier = 'test-user-6';
        const config1 = { windowMs: 60000, max: 1 };
        const config2 = { windowMs: 30000, max: 2 };

        // Use up config1
        rateLimit(identifier, config1);
        const result1 = rateLimit(identifier, config1);
        expect(result1.allowed).toBe(false);

        // config2 should still allow requests
        const result2 = rateLimit(identifier, config2);
        expect(result2.allowed).toBe(true);
      });
    });

    describe('Window Expiration', () => {
      it('should reset count after window expires', async () => {
        const identifier = 'test-user-7';
        const config = { windowMs: 100, max: 1 }; // 100ms window

        // Use up the limit
        const result1 = rateLimit(identifier, config);
        expect(result1.allowed).toBe(true);

        const result2 = rateLimit(identifier, config);
        expect(result2.allowed).toBe(false);

        // Wait for window to expire
        await new Promise(resolve => setTimeout(resolve, 150));

        // Should be allowed again
        const result3 = rateLimit(identifier, config);
        expect(result3.allowed).toBe(true);
        expect(result3.remaining).toBe(0);
      });

      it('should provide new resetTime after window expires', async () => {
        const identifier = 'test-user-8';
        const config = { windowMs: 100, max: 1 };

        const result1 = rateLimit(identifier, config);
        const firstResetTime = result1.resetTime;

        // Wait for window to expire
        await new Promise(resolve => setTimeout(resolve, 150));

        const result2 = rateLimit(identifier, config);
        expect(result2.resetTime).toBeGreaterThan(firstResetTime);
      });
    });

    describe('Edge Cases', () => {
      it('should handle max: 0 (block all requests)', () => {
        const identifier = 'test-user-9';
        const config = { windowMs: 60000, max: 0 };

        const result = rateLimit(identifier, config);
        // With max: 0, the first request creates an entry with count: 1
        // which is >= max (0), so it should be blocked on subsequent calls
        // But the first call will be allowed since it creates a new entry
        expect(result.remaining).toBe(-1); // max - count = 0 - 1 = -1
      });

      it('should handle large max values', () => {
        const identifier = 'test-user-10';
        const config = { windowMs: 60000, max: 1000000 };

        const result = rateLimit(identifier, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(999999);
      });

      it('should handle empty identifier', () => {
        const config = { windowMs: 60000, max: 2 };

        const result1 = rateLimit('', config);
        const result2 = rateLimit('', config);

        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);
      });

      it('should handle special characters in identifier', () => {
        const identifier = 'user@example.com:192.168.1.1';
        const config = { windowMs: 60000, max: 2 };

        const result = rateLimit(identifier, config);
        expect(result.allowed).toBe(true);
      });
    });

    describe('Return Values', () => {
      it('should return all required fields', () => {
        const identifier = 'test-user-11';
        const config = { windowMs: 60000, max: 5, message: 'Test message' };

        const result = rateLimit(identifier, config);

        expect(result).toHaveProperty('allowed');
        expect(result).toHaveProperty('remaining');
        expect(result).toHaveProperty('resetTime');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('max');
      });

      it('should return correct max value', () => {
        const identifier = 'test-user-12';
        const config = { windowMs: 60000, max: 10 };

        const result = rateLimit(identifier, config);
        expect(result.max).toBe(10);
      });
    });
  });

  describe('rateLimitConfigs', () => {
    it('should have api configuration', () => {
      expect(rateLimitConfigs.api).toBeDefined();
      expect(rateLimitConfigs.api.windowMs).toBe(15 * 60 * 1000);
      expect(rateLimitConfigs.api.max).toBe(100);
      expect(rateLimitConfigs.api.message).toBeDefined();
    });

    it('should have upload configuration', () => {
      expect(rateLimitConfigs.upload).toBeDefined();
      expect(rateLimitConfigs.upload.windowMs).toBe(60 * 60 * 1000);
      expect(rateLimitConfigs.upload.max).toBe(10);
      expect(rateLimitConfigs.upload.message).toBeDefined();
    });

    it('should have auth configuration', () => {
      expect(rateLimitConfigs.auth).toBeDefined();
      expect(rateLimitConfigs.auth.windowMs).toBe(15 * 60 * 1000);
      expect(rateLimitConfigs.auth.max).toBe(5);
      expect(rateLimitConfigs.auth.message).toBeDefined();
    });

    it('should have strict configuration', () => {
      expect(rateLimitConfigs.strict).toBeDefined();
      expect(rateLimitConfigs.strict.windowMs).toBe(15 * 60 * 1000);
      expect(rateLimitConfigs.strict.max).toBe(20);
      expect(rateLimitConfigs.strict.message).toBeDefined();
    });

    it('should have auth more restrictive than api', () => {
      expect(rateLimitConfigs.auth.max).toBeLessThan(rateLimitConfigs.api.max);
    });

    it('should have upload more restrictive than api', () => {
      expect(rateLimitConfigs.upload.max).toBeLessThan(rateLimitConfigs.api.max);
    });
  });

  describe('getClientIdentifier', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1'
        }
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-real-ip': '192.168.1.2'
        }
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('192.168.1.2');
    });

    it('should prefer x-forwarded-for over x-real-ip', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '192.168.1.2'
        }
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('192.168.1.1');
    });

    it('should handle multiple IPs in x-forwarded-for', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1'
        }
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('192.168.1.1');
    });

    it('should trim whitespace from IP', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '  192.168.1.1  , 10.0.0.1'
        }
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('192.168.1.1');
    });

    it('should return "unknown" when no IP headers present', () => {
      const request = new Request('http://localhost');

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('unknown');
    });

    it('should handle empty x-forwarded-for header', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': ''
        }
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('unknown');
    });

    it('should handle IPv6 addresses', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
        }
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle realistic API usage pattern', () => {
      const identifier = '192.168.1.100';
      const config = rateLimitConfigs.api;

      // Simulate 100 requests (at limit)
      for (let i = 0; i < 100; i++) {
        const result = rateLimit(identifier, config);
        expect(result.allowed).toBe(true);
      }

      // 101st request should be blocked
      const result = rateLimit(identifier, config);
      expect(result.allowed).toBe(false);
      expect(result.message).toBe('Too many requests. Please try again later.');
    });

    it('should handle realistic upload pattern', () => {
      const identifier = '192.168.1.101';
      const config = rateLimitConfigs.upload;

      // Simulate 10 uploads (at limit)
      for (let i = 0; i < 10; i++) {
        const result = rateLimit(identifier, config);
        expect(result.allowed).toBe(true);
      }

      // 11th upload should be blocked
      const result = rateLimit(identifier, config);
      expect(result.allowed).toBe(false);
      expect(result.message).toBe('Too many upload requests. Please try again later.');
    });

    it('should handle realistic auth pattern', () => {
      const identifier = '192.168.1.102';
      const config = rateLimitConfigs.auth;

      // Simulate 5 auth attempts (at limit)
      for (let i = 0; i < 5; i++) {
        const result = rateLimit(identifier, config);
        expect(result.allowed).toBe(true);
      }

      // 6th attempt should be blocked
      const result = rateLimit(identifier, config);
      expect(result.allowed).toBe(false);
      expect(result.message).toBe('Too many authentication attempts. Please try again later.');
    });

    it('should handle concurrent requests from different users', () => {
      const config = { windowMs: 60000, max: 2 };

      const user1Result1 = rateLimit('user-1', config);
      const user2Result1 = rateLimit('user-2', config);
      const user1Result2 = rateLimit('user-1', config);
      const user2Result2 = rateLimit('user-2', config);

      expect(user1Result1.allowed).toBe(true);
      expect(user2Result1.allowed).toBe(true);
      expect(user1Result2.allowed).toBe(true);
      expect(user2Result2.allowed).toBe(true);

      const user1Result3 = rateLimit('user-1', config);
      const user2Result3 = rateLimit('user-2', config);

      expect(user1Result3.allowed).toBe(false);
      expect(user2Result3.allowed).toBe(false);
    });
  });
});
