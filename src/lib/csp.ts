/**
 * Content Security Policy (CSP) Configuration
 * 
 * This module provides CSP headers to protect against XSS, clickjacking, and other code injection attacks.
 * 
 * Key security considerations:
 * - External fonts from gail.wharton.upenn.edu
 * - Socket.io for WebSocket connections (same-origin)
 * - Mermaid diagrams using dangerouslySetInnerHTML (sanitized SVG)
 * - AI-generated images stored as artifacts (not external URLs)
 * - Next.js development mode requires 'unsafe-eval' for HMR
 * 
 * IMPORTANT: This module is used in Next.js middleware which runs in Edge Runtime.
 * Edge Runtime has limited Node.js API support, so we cannot use the logger here
 * (logger depends on pino, env module, and other Node.js APIs).
 * Console methods are acceptable here because:
 * 1. This runs in Edge Runtime where structured logging isn't available
 * 2. CSP configuration errors are critical and rare
 * 3. Errors must be visible immediately for security debugging
 */

export interface CSPConfig {
  isDevelopment: boolean;
  productionUrl?: string; // Production domain for WebSocket connections
}

/**
 * Generates a Content Security Policy header value
 */
export function generateCSP(config: CSPConfig): string {
  const { isDevelopment, productionUrl } = config;

  // Parse production URL to get WebSocket URLs
  const productionWsUrls: string[] = [];
  if (productionUrl && !isDevelopment) {
    try {
      const url = new URL(productionUrl);
      const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${url.host}`;
      productionWsUrls.push(wsUrl);
      // Also add the https/http URL for Socket.io polling fallback
      productionWsUrls.push(productionUrl);
    } catch (_e) {
      // Using console.warn because this module runs in Edge Runtime (see header comment)
      console.warn('Invalid productionUrl for CSP:', productionUrl);
    }
  }

  // Base directives that apply to both dev and production
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    
    // Scripts: Next.js bundles, inline scripts for hydration, custom components
    // In dev: unsafe-eval needed for HMR and webpack
    // In prod: unsafe-eval needed for Babel (custom components JSX compilation)
    // Note: unsafe-eval for custom components is mitigated by:
    // - Components only loaded from trusted storage
    // - Babel runs in isolated scope with blocked APIs (fetch, localStorage, etc.)
    // - Components cannot access dangerous globals
    'script-src': [
      "'self'",
      "'unsafe-eval'", // Required for Babel (custom components) and dev HMR
      "'unsafe-inline'", // Required for Next.js inline scripts
      "https://cdnjs.cloudflare.com", // CDN for Babel, MathJS, Lodash, Recharts
      "https://cdn.jsdelivr.net", // CDN for Three.js ES modules (dynamic imports)
    ].filter(Boolean),
    
    // Script elements: External script tags (separate from inline/eval)
    'script-src-elem': [
      "'self'",
      "'unsafe-inline'",
      "https://cdnjs.cloudflare.com", // CDN for Babel, MathJS, Lodash, Recharts
      "https://cdn.jsdelivr.net", // CDN for Three.js ES modules (dynamic imports)
    ],
    
    // Styles: Tailwind, inline styles, external fonts CSS
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind and dynamic styles
      "https://gail.wharton.upenn.edu", // External font stylesheets
    ],
    
    // Style attributes: For Three.js and other dynamic styling
    'style-src-attr': [
      "'unsafe-inline'", // Required for Three.js canvas styling
    ],
    
    // Fonts: Local fonts + Wharton fonts
    'font-src': [
      "'self'",
      "data:", // For inline font data
      "https://gail.wharton.upenn.edu", // Wharton brand fonts
    ],
    
    // Images: Self-hosted, data URIs for AI-generated images, blob for dynamic content
    'img-src': [
      "'self'",
      "data:", // Base64 encoded images
      "blob:", // Blob URLs for dynamic content
    ],
    
    // Connect: API calls, WebSocket (Socket.io), OpenAI API
    'connect-src': [
      "'self'",
      "https://api.openai.com", // OpenAI Realtime API, Responses API, etc.
      "https://cdnjs.cloudflare.com", // CDN for Babel source maps and other resources
      "https://cdn.jsdelivr.net", // CDN for Three.js source maps and other resources
      ...productionWsUrls, // Production WebSocket URLs
      isDevelopment ? "ws://localhost:*" : "", // WebSocket in dev
      isDevelopment ? "wss://localhost:*" : "", // Secure WebSocket in dev
      isDevelopment ? "http://localhost:*" : "", // HMR in dev
    ].filter(Boolean),
    
    // Media: Self-hosted only
    'media-src': ["'self'"],
    
    // Objects: Block plugins like Flash
    'object-src': ["'none'"],
    
    // Base URI: Restrict base tag
    'base-uri': ["'self'"],
    
    // Forms: Only submit to same origin
    'form-action': ["'self'"],
    
    // Frame ancestors: Prevent clickjacking (already have X-Frame-Options)
    'frame-ancestors': ["'none'"],
    
    // Frame src: Block iframes (unless needed for specific features)
    'frame-src': ["'none'"],
    
    // Worker src: For web workers if needed (Three.js may use workers)
    'worker-src': ["'self'", "blob:", "data:"],
    
    // Manifest: PWA manifest
    'manifest-src': ["'self'"],
  };

  // Build CSP string
  const cspString = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');

  return cspString;
}

/**
 * Generates CSP header for Next.js middleware or API routes
 */
export function getCSPHeaders(config: CSPConfig): Record<string, string> {
  return {
    'Content-Security-Policy': generateCSP(config),
  };
}

/**
 * Helper to check if we're in development mode
 */
export function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Helper to get production URL from environment
 */
export function getProductionUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
}
