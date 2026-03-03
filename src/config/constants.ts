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
 * Supported MIME types for user file uploads
 */
export const SUPPORTED_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

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
