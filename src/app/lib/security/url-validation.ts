/**
 * Security utility for validating URLs to prevent SSRF attacks
 * Blocks access to internal/private IP ranges and cloud metadata endpoints
 */

/**
 * Validates that a URL is safe to fetch (not an internal/private IP)
 * @param urlString - The URL string to validate
 * @returns true if URL is safe, throws Error if unsafe
 * @throws Error if URL is invalid or points to internal/private network
 */
export function validateUrl(urlString: string): void {
  let url: URL;
  
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow http and https protocols
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS protocols are allowed');
  }

  const hostname = url.hostname.toLowerCase();

  // Block localhost variations
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  ) {
    throw new Error('Access to localhost is not allowed');
  }

  // Block AWS metadata endpoint
  if (hostname === '169.254.169.254') {
    throw new Error('Access to cloud metadata endpoints is not allowed');
  }

  // Block private IP ranges (RFC 1918)
  // 10.0.0.0/8
  if (hostname.match(/^10\./)) {
    throw new Error('Access to private IP ranges is not allowed');
  }

  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
    throw new Error('Access to private IP ranges is not allowed');
  }

  // 192.168.0.0/16
  if (hostname.match(/^192\.168\./)) {
    throw new Error('Access to private IP ranges is not allowed');
  }

  // Block link-local addresses (169.254.0.0/16)
  if (hostname.match(/^169\.254\./)) {
    throw new Error('Access to link-local addresses is not allowed');
  }

  // Block multicast addresses (224.0.0.0/4)
  if (hostname.match(/^22[4-9]\./) || hostname.match(/^2[3-5][0-9]\./)) {
    throw new Error('Access to multicast addresses is not allowed');
  }

  // Block IPv6 localhost and private ranges
  // Note: URL.hostname for IPv6 includes brackets, e.g., "[::1]"
  const ipv6Hostname = hostname.replace(/^\[|\]$/g, ''); // Remove brackets
  if (
    ipv6Hostname === '::' ||
    ipv6Hostname === '::1' ||
    ipv6Hostname.startsWith('::1') ||
    ipv6Hostname.startsWith('fc00:') ||
    ipv6Hostname.startsWith('fd00:') ||
    ipv6Hostname.startsWith('fe80:')
  ) {
    throw new Error('Access to private IPv6 addresses is not allowed');
  }

  // URL is safe
  return;
}

/**
 * Validates URL and returns the validated URL object
 * @param urlString - The URL string to validate
 * @returns Validated URL object
 * @throws Error if URL is invalid or unsafe
 */
export function validateAndParseUrl(urlString: string): URL {
  validateUrl(urlString);
  return new URL(urlString);
}
