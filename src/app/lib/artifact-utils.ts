/**
 * Utility functions for artifact management
 */
import path from 'path';

/**
 * Converts a display name into a safe filename
 * - Converts to lowercase
 * - Replaces spaces with underscores
 * - Removes or replaces special characters
 * - Limits length to reasonable filesystem limits
 */
export function createSafeFilename(name: string, maxLength: number = 100): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')  // Replace spaces and whitespace with underscores
    .replace(/[^a-z0-9_\-\.]/g, '_')  // Replace any non-alphanumeric, underscore, hyphen, or period with underscore
    .replace(/_{2,}/g, '_')  // Replace multiple underscores with single underscore
    .replace(/^_+|_+$/g, '')  // Remove leading/trailing underscores
    .substring(0, maxLength)  // Limit length
    .replace(/^$/, 'untitled');  // Fallback if empty after cleaning
}

/**
 * Normalizes a content type to a canonical short form
 * Converts MIME types to short names (e.g., 'text/jsx' -> 'jsx')
 */
export function normalizeContentType(type: string): string {
  const normalized = type.toLowerCase().trim();
  
  // Handle MIME types by extracting the subtype
  if (normalized.includes('/')) {
    const parts = normalized.split('/');
    const subtype = parts[1];
    
    // Map common MIME subtypes to our canonical names
    switch (subtype) {
      case 'jsx':
        return 'jsx';
      case 'tsx':
        return 'tsx';
      case 'javascript':
      case 'x-javascript':
        return 'javascript';
      case 'typescript':
      case 'x-typescript':
        return 'typescript';
      case 'markdown':
      case 'x-markdown':
        return 'markdown';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      case 'xml':
        return 'xml';
      case 'yaml':
      case 'x-yaml':
        return 'yaml';
      case 'plain':
        return 'text';
      case 'png':
        return 'png';
      case 'jpeg':
        return 'jpeg';
      case 'gif':
        return 'gif';
      case 'svg+xml':
        return 'svg';
      case 'pdf':
        return 'pdf';
      case 'zip':
        return 'zip';
      case 'x-python':
        return 'python';
      default:
        // If we don't recognize it, use the subtype as-is
        return subtype;
    }
  }
  
  // Return as-is if not a MIME type
  return normalized;
}

/**
 * Maps content types to file extensions
 * Supports both short forms ('jsx') and MIME types ('text/jsx')
 */
export function getFileExtensionForType(type: string): string {
  const normalized = normalizeContentType(type);
  
  switch (normalized) {
    case 'markdown':
    case 'md':
      return 'md';
    case 'javascript':
    case 'js':
      return 'js';
    case 'jsx':
      return 'jsx';
    case 'typescript':
    case 'ts':
      return 'ts';
    case 'tsx':
      return 'tsx';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'python':
    case 'py':
      return 'py';
    case 'text':
    case 'txt':
      return 'txt';
    case 'xml':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yml';
    case 'checklist':
      return 'md'; // Checklists are markdown with checkboxes
    // Binary file types
    case 'png':
      return 'png';
    case 'jpg':
    case 'jpeg':
      return 'jpg';
    case 'gif':
      return 'gif';
    case 'svg':
      return 'svg';
    case 'pdf':
      return 'pdf';
    case 'zip':
      return 'zip';
    default:
      return 'txt'; // Default fallback
  }
}

/**
 * Generates the content filename for an artifact
 * If meaningfulName is provided, uses it; otherwise falls back to id-based naming
 */
export function getContentFilename(id: string, type: string, meaningfulName?: string): string {
  const extension = getFileExtensionForType(type);
  
  if (meaningfulName) {
    const safeName = createSafeFilename(meaningfulName);
    return `${safeName}.${extension}`;
  }
  
  return `${id}.${extension}`;
}

/**
 * Generates the metadata filename for an artifact based on the content filename
 * @param contentFilename The content filename (e.g., "design_document.md")
 * @returns The metadata filename (e.g., "design_document.json")
 */
export function getMetadataFilename(contentFilename: string): string {
  const parsed = path.parse(contentFilename);
  return `${parsed.name}.json`;
}

/**
 * @deprecated Use getMetadataFilename with contentFilename instead
 * Legacy function that generates metadata filename from UUID
 */
export function getMetadataFilenameFromId(id: string): string {
  return `${id}.json`;
}

/**
 * Determines if a file type is binary (needs special handling)
 * Supports both short forms and MIME types
 */
export function isBinaryFileType(type: string): boolean {
  const normalized = normalizeContentType(type);
  const binaryTypes = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'pdf', 'zip'];
  return binaryTypes.includes(normalized);
}

/**
 * Gets the MIME type for a file type
 * If input is already a MIME type, returns it normalized
 * If input is a short form, converts to proper MIME type
 */
export function getMimeTypeForType(type: string): string {
  // If it's already a MIME type, validate and return it
  if (type.includes('/')) {
    const normalized = type.toLowerCase().trim();
    // Validate it's a reasonable MIME type format
    if (/^[a-z]+\/[a-z0-9\-\+\.]+$/.test(normalized)) {
      return normalized;
    }
  }
  
  // Convert short form to MIME type
  const normalized = normalizeContentType(type);
  
  switch (normalized) {
    case 'markdown':
    case 'md':
      return 'text/markdown';
    case 'javascript':
    case 'js':
      return 'application/javascript';
    case 'jsx':
      return 'text/jsx';
    case 'typescript':
    case 'ts':
      return 'application/typescript';
    case 'tsx':
      return 'text/tsx';
    case 'html':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'json':
      return 'application/json';
    case 'python':
    case 'py':
      return 'text/x-python';
    case 'text':
    case 'txt':
      return 'text/plain';
    case 'xml':
      return 'application/xml';
    case 'yaml':
    case 'yml':
      return 'application/x-yaml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'pdf':
      return 'application/pdf';
    case 'zip':
      return 'application/zip';
    case 'checklist':
      return 'text/markdown'; // Checklists are markdown
    default:
      return 'text/plain';
  }
} 