/**
 * Centralized configuration constants
 * 
 * This file contains all magic numbers and configuration values that were previously
 * scattered across the codebase. Centralizing these values makes them easier to
 * maintain, test, and modify.
 */

/**
 * File upload size limits (in bytes)
 */
export const FILE_UPLOAD_LIMITS = {
  /** Maximum size for experience ZIP uploads */
  EXPERIENCE_MAX_SIZE: 25 * 1024 * 1024, // 25MB (reduced from 100MB for security)
  
  /** Maximum decompressed size for ZIP files (ZIP bomb protection) */
  EXPERIENCE_MAX_DECOMPRESSED_SIZE: 500 * 1024 * 1024, // 500MB
  
  /** Maximum size for user file uploads */
  USER_UPLOAD_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  
  /** Maximum size for text resource files */
  RESOURCE_MAX_SIZE: 1024 * 1024, // 1MB
} as const;

/**
 * MIME types accepted for user file uploads, mapped to their canonical file
 * extensions. Single source of truth for both:
 *   1. Server-side validation — by MIME type via `SUPPORTED_MIME_TYPES`.
 *   2. Client-side picker filtering — via `SUPPORTED_UPLOAD_ACCEPT`, fed to
 *      `<input type="file" accept="...">` so the OS picker greys out files
 *      we can't accept.
 *
 * Note: `<input accept>` is UX guidance, not a security boundary — users can
 * still bypass it (and some browsers don't honor it perfectly). Server-side
 * MIME validation is the authoritative check.
 *
 * Browser quirks worth knowing:
 * - `.md` is reported as `text/markdown` by modern Chromium browsers and as
 *   `text/plain` by some others; both are covered here.
 * - Some Windows browsers send an empty `file.type` for `.md` when no app
 *   claims the extension. We deliberately don't allow `''` — that would let
 *   any unknown type through.
 */
export const USER_UPLOAD_ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** MIME types accepted by the user-upload endpoint. */
export const SUPPORTED_MIME_TYPES: readonly string[] = Object.keys(
  USER_UPLOAD_ACCEPTED_TYPES
);

/**
 * Comma-separated value for `<input type="file" accept="...">`. Includes both
 * MIME types and extensions because OSes vary in which they honor (macOS/iOS
 * prefer MIME; Windows/Linux often need extensions).
 */
export const SUPPORTED_UPLOAD_ACCEPT: string = [
  ...Object.keys(USER_UPLOAD_ACCEPTED_TYPES),
  ...Object.values(USER_UPLOAD_ACCEPTED_TYPES).flat(),
].join(',');

/**
 * Allowed file types for experience uploads
 */
export const EXPERIENCE_UPLOAD_TYPES = [
  'application/zip'
] as const;

/**
 * Delegation/Agent timeout settings (in milliseconds)
 */
export const DELEGATION_SETTINGS = {
  /** 
   * Timeout for backend agent delegation tasks (default: 15 minutes)
   * Can be overridden via NEXT_PUBLIC_DELEGATION_TIMEOUT_MS environment variable
   */
  get TIMEOUT_MS(): number {
    const envTimeout = typeof process !== 'undefined' 
      ? process.env.NEXT_PUBLIC_DELEGATION_TIMEOUT_MS 
      : undefined;
    if (envTimeout) {
      const parsed = parseInt(envTimeout, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return 15 * 60 * 1000; // 15 minutes default
  },
  
  /** Human-readable timeout for error messages */
  get TIMEOUT_DESCRIPTION(): string {
    const ms = this.TIMEOUT_MS;
    const minutes = Math.round(ms / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
} as const;
