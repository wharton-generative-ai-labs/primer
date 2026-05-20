import { ContentLoader, LoadResult } from './types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('HttpLoader');

export class HttpLoader implements ContentLoader {
    basePath: string = '';
    private currentOrigin: string = typeof window !== 'undefined' ? window.location.origin : '';
    /**
     * In-memory cache of pre-fetched content keyed by the path string callers
     * pass to {@link loadContent}. Lets the RSC seed `experience.json` so the
     * client doesn't refetch a payload the server already parsed.
     */
    private contentCache: Map<string, string> = new Map();

    /**
     * Pre-populate the loader's cache for a given path. Subsequent
     * {@link loadContent} calls for the same path resolve from memory and skip
     * the network round trip entirely.
     */
    seed(path: string, content: string): void {
        this.contentCache.set(path, content);
    }

    private isExternalUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.origin !== this.currentOrigin;
        } catch {
            return false;
        }
    }

    private resolveUrl(path: string): string {
        // If it's already a full URL, return as is
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }

        // If it's a path starting with /, join it with current origin
        if (path.startsWith('/')) {
            return `${this.currentOrigin}${path}`;
        }

        // If it's a relative path and basePath starts with /, join with origin
        if (this.basePath.startsWith('/')) {
            const baseDir = this.basePath.substring(0, this.basePath.lastIndexOf('/'));
            return `${this.currentOrigin}${baseDir}/${path}`;
        }

        return path;
    }

    async loadContent(path: string, objectPath: string): Promise<LoadResult> {
        const cached = this.contentCache.get(path);
        if (cached !== undefined) {
            return {
                content: cached,
                status: {
                    friendlyName: path,
                    path,
                    objectPath,
                    status: 'OK',
                },
            };
        }

        const resolvedUrl = this.resolveUrl(path);

        try {
            // For external URLs, use our proxy
            const fetchUrl = this.isExternalUrl(resolvedUrl)
                ? `/api/proxy?url=${encodeURIComponent(resolvedUrl)}`
                : resolvedUrl;

            const response = await fetch(fetchUrl);

            if (!response.ok) {
                const errorDetail = `Failed to load resource at "${objectPath}"\n` +
                    `Path: ${path}\n` +
                    `Resolved URL: ${resolvedUrl}\n` +
                    `HTTP Status: ${response.status} ${response.statusText}`;
                
                logger.warn({ 
                    status: response.status, 
                    statusText: response.statusText, 
                    path,
                    objectPath 
                }, 'Failed to load content');
                
                return {
                    status: {
                        friendlyName: `Resource not available (${objectPath})`,
                        path,
                        objectPath,
                        status: 'MISSING',
                        statusDetail: errorDetail
                    }
                };
            }

            const content = await response.text();
            return {
                content,
                status: {
                    friendlyName: path,
                    path,
                    objectPath,
                    status: 'OK'
                }
            };

        } catch (error) {
            const errorDetail = `Failed to load resource at "${objectPath}"\n` +
                `Path: ${path}\n` +
                `Resolved URL: ${resolvedUrl}\n` +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            
            logger.error(error, `Error loading content from ${path}`);
            return {
                status: {
                    friendlyName: `Resource missing (${objectPath})`,
                    path,
                    objectPath,
                    status: 'MISSING',
                    statusDetail: errorDetail
                }
            };
        }
    }
}