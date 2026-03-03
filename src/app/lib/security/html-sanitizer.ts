/**
 * Simple HTML sanitizer to prevent XSS attacks when using dangerouslySetInnerHTML
 * 
 * This is a basic sanitizer for trusted content (like SVG from mermaid or CSS).
 * For production use with untrusted content, consider using DOMPurify.
 */

/**
 * Sanitizes HTML content by removing script tags and event handlers
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') {
    return '';
  }

  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol in attributes
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove data URLs that could contain scripts
  sanitized = sanitized.replace(/data:text\/html/gi, '');
  
  return sanitized;
}

/**
 * Sanitizes CSS content to prevent injection attacks
 * @param css - CSS string to sanitize
 * @returns Sanitized CSS string
 */
export function sanitizeCss(css: string): string {
  if (typeof css !== 'string') {
    return '';
  }

  // Remove any script-like content
  let sanitized = css.replace(/expression\s*\(/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/@import/gi, '');
  
  // Remove potentially dangerous CSS functions
  sanitized = sanitized.replace(/url\s*\(\s*["']?data:/gi, '');
  
  return sanitized;
}
