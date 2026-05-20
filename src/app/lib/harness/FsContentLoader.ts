import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ContentLoader, LoadResult } from '../types';

// Maps paths like `/api/storage/<id>/resources/...` (or relative joins the
// ConfigLoader produces internally) to files under a local storage root.
export class FsContentLoader implements ContentLoader {
  basePath: string = '';

  constructor(private storageRoot: string) {}

  private resolveDiskPath(p: string): string {
    // Relative path (the usual case from ResourceManager) → join to the
    // directory of configPath in basePath. Absolute API path → strip prefix.
    let resolved: string;
    if (p.startsWith('/api/storage/')) {
      resolved = p.slice('/api/storage/'.length);
    } else if (p.startsWith('/')) {
      resolved = p.replace(/^\/+/, '');
    } else {
      const baseDir = this.basePath.startsWith('/api/storage/')
        ? this.basePath.slice('/api/storage/'.length).replace(/\/[^/]*$/, '')
        : this.basePath.replace(/\/[^/]*$/, '').replace(/^\/+/, '');
      resolved = baseDir ? `${baseDir}/${p}` : p;
    }
    return path.join(this.storageRoot, resolved);
  }

  async loadContent(p: string, objectPath: string): Promise<LoadResult> {
    const diskPath = this.resolveDiskPath(p);
    try {
      const content = await fs.readFile(diskPath, 'utf8');
      return {
        content,
        status: { friendlyName: p, path: p, objectPath, status: 'OK' },
      };
    } catch (err) {
      return {
        status: {
          friendlyName: `Resource missing (${objectPath})`,
          path: p,
          objectPath,
          status: 'MISSING',
          statusDetail: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }
}
