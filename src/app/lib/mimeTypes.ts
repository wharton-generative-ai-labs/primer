export function getContentType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.json': 'application/json',
    '.js': 'application/javascript',
    '.jsx': 'application/javascript',
    '.ts': 'application/typescript',
    '.tsx': 'application/typescript',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.css': 'text/css',
    '.html': 'text/html',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.zip': 'application/zip'
  };

  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
} 