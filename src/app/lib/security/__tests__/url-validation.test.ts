/**
 * Tests for URL validation and SSRF protection
 */

import { validateUrl, validateAndParseUrl } from '../url-validation';

describe('URL Validation - SSRF Protection', () => {
  describe('validateUrl', () => {
    describe('Valid URLs', () => {
      it('should allow valid HTTP URLs', () => {
        expect(() => validateUrl('http://example.com')).not.toThrow();
        expect(() => validateUrl('http://example.com/path')).not.toThrow();
        expect(() => validateUrl('http://example.com:8080')).not.toThrow();
      });

      it('should allow valid HTTPS URLs', () => {
        expect(() => validateUrl('https://example.com')).not.toThrow();
        expect(() => validateUrl('https://api.example.com')).not.toThrow();
        expect(() => validateUrl('https://example.com/api/v1')).not.toThrow();
      });

      it('should allow public IP addresses', () => {
        expect(() => validateUrl('http://8.8.8.8')).not.toThrow();
        expect(() => validateUrl('http://1.1.1.1')).not.toThrow();
        expect(() => validateUrl('http://93.184.216.34')).not.toThrow(); // example.com IP
      });

      it('should allow URLs with query parameters', () => {
        expect(() => validateUrl('https://example.com?foo=bar')).not.toThrow();
        expect(() => validateUrl('https://example.com?foo=bar&baz=qux')).not.toThrow();
      });

      it('should allow URLs with fragments', () => {
        expect(() => validateUrl('https://example.com#section')).not.toThrow();
        expect(() => validateUrl('https://example.com/page#top')).not.toThrow();
      });
    });

    describe('Invalid URL Format', () => {
      it('should reject malformed URLs', () => {
        expect(() => validateUrl('not a url')).toThrow('Invalid URL format');
        expect(() => validateUrl('http://')).toThrow('Invalid URL format');
        expect(() => validateUrl('')).toThrow('Invalid URL format');
      });

      it('should reject URLs with invalid protocols', () => {
        expect(() => validateUrl('ftp://example.com')).toThrow('Only HTTP and HTTPS protocols are allowed');
        expect(() => validateUrl('file:///etc/passwd')).toThrow('Only HTTP and HTTPS protocols are allowed');
        expect(() => validateUrl('javascript:alert(1)')).toThrow('Only HTTP and HTTPS protocols are allowed');
        expect(() => validateUrl('data:text/html,<script>alert(1)</script>')).toThrow('Only HTTP and HTTPS protocols are allowed');
      });
    });

    describe('Localhost Protection', () => {
      it('should block localhost by name', () => {
        expect(() => validateUrl('http://localhost')).toThrow('Access to localhost is not allowed');
        expect(() => validateUrl('http://localhost:8080')).toThrow('Access to localhost is not allowed');
        expect(() => validateUrl('https://localhost/api')).toThrow('Access to localhost is not allowed');
      });

      it('should block IPv4 localhost', () => {
        expect(() => validateUrl('http://127.0.0.1')).toThrow('Access to localhost is not allowed');
        expect(() => validateUrl('http://127.0.0.1:3000')).toThrow('Access to localhost is not allowed');
        expect(() => validateUrl('http://0.0.0.0')).toThrow('Access to localhost is not allowed');
      });

      it('should block IPv6 localhost', () => {
        // Note: URL parsing may normalize IPv6 addresses
        // The validation checks the hostname after URL parsing
        expect(() => validateUrl('http://[::1]')).toThrow();
        expect(() => validateUrl('http://[::1]:8080')).toThrow();
      });
    });

    describe('Cloud Metadata Endpoint Protection', () => {
      it('should block AWS metadata endpoint', () => {
        expect(() => validateUrl('http://169.254.169.254')).toThrow('Access to cloud metadata endpoints is not allowed');
        expect(() => validateUrl('http://169.254.169.254/latest/meta-data')).toThrow('Access to cloud metadata endpoints is not allowed');
      });
    });

    describe('Private IP Range Protection (RFC 1918)', () => {
      it('should block 10.0.0.0/8 range', () => {
        expect(() => validateUrl('http://10.0.0.1')).toThrow('Access to private IP ranges is not allowed');
        expect(() => validateUrl('http://10.1.1.1')).toThrow('Access to private IP ranges is not allowed');
        expect(() => validateUrl('http://10.255.255.255')).toThrow('Access to private IP ranges is not allowed');
      });

      it('should block 172.16.0.0/12 range', () => {
        expect(() => validateUrl('http://172.16.0.1')).toThrow('Access to private IP ranges is not allowed');
        expect(() => validateUrl('http://172.20.0.1')).toThrow('Access to private IP ranges is not allowed');
        expect(() => validateUrl('http://172.31.255.255')).toThrow('Access to private IP ranges is not allowed');
      });

      it('should allow 172.x.x.x outside private range', () => {
        expect(() => validateUrl('http://172.15.0.1')).not.toThrow(); // Before range
        expect(() => validateUrl('http://172.32.0.1')).not.toThrow(); // After range
      });

      it('should block 192.168.0.0/16 range', () => {
        expect(() => validateUrl('http://192.168.0.1')).toThrow('Access to private IP ranges is not allowed');
        expect(() => validateUrl('http://192.168.1.1')).toThrow('Access to private IP ranges is not allowed');
        expect(() => validateUrl('http://192.168.255.255')).toThrow('Access to private IP ranges is not allowed');
      });
    });

    describe('Link-Local Address Protection', () => {
      it('should block 169.254.0.0/16 range', () => {
        expect(() => validateUrl('http://169.254.0.1')).toThrow('Access to link-local addresses is not allowed');
        expect(() => validateUrl('http://169.254.1.1')).toThrow('Access to link-local addresses is not allowed');
        expect(() => validateUrl('http://169.254.255.255')).toThrow('Access to link-local addresses is not allowed');
      });
    });

    describe('Multicast Address Protection', () => {
      it('should block 224.0.0.0/4 range', () => {
        expect(() => validateUrl('http://224.0.0.1')).toThrow('Access to multicast addresses is not allowed');
        expect(() => validateUrl('http://239.255.255.255')).toThrow('Access to multicast addresses is not allowed');
        expect(() => validateUrl('http://230.0.0.1')).toThrow('Access to multicast addresses is not allowed');
      });
    });

    describe('IPv6 Private Address Protection', () => {
      it('should block IPv6 localhost variations', () => {
        // IPv6 addresses are blocked by the validation logic
        expect(() => validateUrl('http://[::]')).toThrow();
        expect(() => validateUrl('http://[::1]')).toThrow();
      });

      it('should block IPv6 unique local addresses (fc00::/7)', () => {
        expect(() => validateUrl('http://[fc00::1]')).toThrow();
        expect(() => validateUrl('http://[fd00::1]')).toThrow();
      });

      it('should block IPv6 link-local addresses (fe80::/10)', () => {
        expect(() => validateUrl('http://[fe80::1]')).toThrow();
      });
    });

    describe('Case Sensitivity', () => {
      it('should handle case-insensitive hostnames', () => {
        expect(() => validateUrl('http://LOCALHOST')).toThrow('Access to localhost is not allowed');
        expect(() => validateUrl('http://LocalHost')).toThrow('Access to localhost is not allowed');
      });
    });
  });

  describe('validateAndParseUrl', () => {
    it('should return URL object for valid URLs', () => {
      const url = validateAndParseUrl('https://example.com/path');
      expect(url).toBeInstanceOf(URL);
      expect(url.hostname).toBe('example.com');
      expect(url.pathname).toBe('/path');
    });

    it('should throw for invalid URLs', () => {
      expect(() => validateAndParseUrl('http://localhost')).toThrow('Access to localhost is not allowed');
      expect(() => validateAndParseUrl('http://10.0.0.1')).toThrow('Access to private IP ranges is not allowed');
    });

    it('should preserve URL components', () => {
      const url = validateAndParseUrl('https://example.com:8080/api/v1?foo=bar#section');
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('example.com');
      expect(url.port).toBe('8080');
      expect(url.pathname).toBe('/api/v1');
      expect(url.search).toBe('?foo=bar');
      expect(url.hash).toBe('#section');
    });
  });

  describe('Edge Cases', () => {
    it('should handle URLs with userinfo', () => {
      expect(() => validateUrl('http://user:pass@example.com')).not.toThrow();
    });

    it('should handle URLs with encoded characters', () => {
      expect(() => validateUrl('https://example.com/path%20with%20spaces')).not.toThrow();
    });

    it('should handle international domain names', () => {
      expect(() => validateUrl('https://例え.jp')).not.toThrow();
    });
  });
});
