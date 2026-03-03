import { ContentLoader, LoadResult } from './types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('HttpLoader');

export class HttpLoader implements ContentLoader {
    basePath: string = '';
    private currentOrigin: string = typeof window !== 'undefined' ? window.location.origin : '';

    private isExternalUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.origin !== this.currentOrigin;
        } catch {
            return false;
        }
    }

    private resolveUrl(path: string): string {
        logger.debug({ path, currentOrigin: this.currentOrigin, basePath: this.basePath }, 'Resolving URL');

        // If it's already a full URL, return as is
        if (path.startsWith('http://') || path.startsWith('https://')) {
            logger.debug({ path }, 'Path is already a full URL, returning as is');
            return path;
        }

        // If it's a path starting with /, join it with current origin
        if (path.startsWith('/')) {
            const resolvedUrl = `${this.currentOrigin}${path}`;
            logger.debug({ path, resolvedUrl }, 'Path starts with /, joining with origin');
            return resolvedUrl;
        }

        // If it's a relative path and basePath starts with /, join with origin
        if (this.basePath.startsWith('/')) {
            const baseDir = this.basePath.substring(0, this.basePath.lastIndexOf('/'));
            const resolvedUrl = `${this.currentOrigin}${baseDir}/${path}`;
            logger.debug({ path, basePath: this.basePath, resolvedUrl }, 'Relative path with basePath starting with /, joining with origin');
            return resolvedUrl;
        }

        // For other cases (should not happen), return the path as is
        logger.debug({ path }, 'No special handling needed, returning path as is');
        return path;
    }

    async loadContent(path: string, objectPath: string): Promise<LoadResult> {
        const resolvedUrl = this.resolveUrl(path);
        logger.debug({ resolvedUrl, originalPath: path }, 'Loading content');

        try {
            // For external URLs, use our proxy
            const fetchUrl = this.isExternalUrl(resolvedUrl)
                ? `/api/proxy?url=${encodeURIComponent(resolvedUrl)}`
                : resolvedUrl;
            
            logger.debug({ fetchUrl }, 'Fetching content');
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
            logger.debug({ path, contentLength: content.length }, 'Successfully loaded content');
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