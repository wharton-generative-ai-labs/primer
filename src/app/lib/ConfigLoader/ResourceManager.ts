/**
 * ResourceManager
 * 
 * Handles resource creation, validation, and loading.
 * Manages scenes, sounds, logos, and other experience resources.
 */

import { Resource, LoadResult, ContentLoader } from '../types';
import { PathResolver } from '../PathResolver';
import { ValidationManager } from './ValidationManager';

export class ResourceManager {
    private pathResolver: PathResolver;
    private contentLoader: ContentLoader;
    private validationManager: ValidationManager;
    private baseUrl: string = '';

    constructor(
        contentLoader: ContentLoader,
        validationManager: ValidationManager
    ) {
        this.pathResolver = new PathResolver();
        this.contentLoader = contentLoader;
        this.validationManager = validationManager;
    }

    /**
     * Set the base URL for resource resolution
     */
    setBaseUrl(url: string): void {
        this.baseUrl = url;
    }

    /**
     * Create a Resource object from a path
     */
    createResource(path: string): Resource {
        const { path: resolvedPath, isAbsolute } = this.pathResolver.resolvePath(path);
        return {
            path: resolvedPath,
            url: isAbsolute ? resolvedPath : `${this.baseUrl}/${resolvedPath}`
        };
    }

    /**
     * Load resource content and track validation status
     */
    async loadResource(path: string, objectPath: string): Promise<LoadResult> {
        const result = await this.contentLoader.loadContent(path, objectPath);
        this.validationManager.addStatus(result.status);
        return result;
    }

    /**
     * Validate that a resource exists and is loadable
     */
    async validateResource(resource: Resource, objectPath: string): Promise<void> {
        await this.loadResource(resource.path, objectPath);
    }

    /**
     * Validate an array of resources in parallel
     */
    async validateResources(
        resources: Array<{ resource: Resource; objectPath: string }>
    ): Promise<void> {
        await Promise.all(
            resources.map(({ resource, objectPath }) =>
                this.validateResource(resource, objectPath)
            )
        );
    }
}

