/**
 * ArtifactManager
 * 
 * Handles loading and creation of artifacts from experience configuration.
 * Manages artifact deduplication and API communication.
 */

import { ExperienceConfig } from '../types';
import { ResourceManager } from './ResourceManager';
import { generateUUID } from '../uuid';
import { createModuleLogger } from '@/lib/logger';
import { ArtifactCreationOptions, ArtifactCreationContext } from './types';

const logger = createModuleLogger('ArtifactManager');

export class ArtifactManager {
    private resourceManager: ResourceManager;
    private artifactsLoaded: boolean = false;

    constructor(resourceManager: ResourceManager) {
        this.resourceManager = resourceManager;
    }

    /**
     * Reset the artifacts loaded flag (used when loading a new experience)
     */
    reset(): void {
        this.artifactsLoaded = false;
    }

    /**
     * Load all artifacts defined in the experience configuration
     */
    async loadArtifacts(experienceConfig: ExperienceConfig): Promise<void> {
        // Prevent loading artifacts multiple times
        if (this.artifactsLoaded) {
            logger.debug('Artifacts already loaded, skipping');
            return;
        }

        const artifacts = experienceConfig.resources.artifacts;
        if (!artifacts?.length) {
            this.artifactsLoaded = true;
            return;
        }

        logger.debug({ count: artifacts.length }, 'Loading artifacts');
        
        for (const artifact of artifacts) {
            if (!artifact?.file) continue;

            try {
                const result = await this.resourceManager.loadResource(
                    artifact.file,
                    `resources.artifacts[${artifact.name}]`
                );
                
                if (result.content) {
                    await this.createArtifact(
                        experienceConfig.experienceId || '',
                        {
                            name: artifact.name,
                            content: result.content,
                            type: artifact.type || 'markdown',
                            agents: artifact.agents,
                            metadata: artifact.metadata
                        }
                    );
                }
            } catch (error) {
                logger.error({ err: error, artifactName: artifact.name }, 'Failed to load artifact');
            }
        }

        this.artifactsLoaded = true;
        logger.debug('Artifacts loading completed');
    }

    /**
     * Create an artifact via the API
     */
    private async createArtifact(
        experienceId: string,
        options: ArtifactCreationOptions
    ): Promise<void> {
        try {
            const context = this.getArtifactCreationContext(experienceId);
            
            // Check for duplicates
            const isDuplicate = await this.checkForDuplicate(options.name, context);
            if (isDuplicate) {
                logger.debug({ name: options.name }, 'Artifact already exists, skipping creation');
                return;
            }
            
            // Create the artifact
            await this.createArtifactViaAPI(options, context);
            logger.debug({ name: options.name }, 'Created artifact');
        } catch (error) {
            logger.error({ err: error, name: options.name }, 'Failed to create artifact');
        }
    }

    /**
     * Get the context needed for artifact creation (session ID, user info)
     */
    private getArtifactCreationContext(experienceId: string): ArtifactCreationContext {
        let sessionId: string;
        let userName: string | undefined;
        let userEmail: string | undefined;

        if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
            // Get or create session ID
            const existingSessionId = sessionStorage.getItem('primer:session-id');
            if (existingSessionId) {
                sessionId = existingSessionId;
            } else {
                sessionId = `sess_${generateUUID()}`;
                sessionStorage.setItem('primer:session-id', sessionId);
            }

            // Get user info
            userName = sessionStorage.getItem('primer:user-name') || undefined;
            userEmail = sessionStorage.getItem('primer:user-email') || undefined;
        } else {
            // Fallback for server-side (shouldn't happen in current flow)
            sessionId = `sess_${Date.now()}`;
        }

        return { experienceId, sessionId, userName, userEmail };
    }

    /**
     * Check if an artifact with the given name already exists
     */
    private async checkForDuplicate(
        name: string,
        context: ArtifactCreationContext
    ): Promise<boolean> {
        const listResponse = await fetch('/api/artifacts/list', {
            headers: {
                'x-experience-id': context.experienceId,
                'x-session-id': context.sessionId
            }
        });

        if (listResponse.ok) {
            const existingArtifacts = await listResponse.json();
            return existingArtifacts.some((artifact: any) => artifact.name === name);
        }

        return false;
    }

    /**
     * Create an artifact via the API
     */
    private async createArtifactViaAPI(
        options: ArtifactCreationOptions,
        context: ArtifactCreationContext
    ): Promise<void> {
        const response = await fetch('/api/artifacts/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-experience-id': context.experienceId,
                'x-session-id': context.sessionId
            },
            body: JSON.stringify({
                name: options.name,
                content: options.content,
                type: options.type,
                agents: options.agents,
                metadata: options.metadata,
                userName: context.userName,
                userEmail: context.userEmail
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to create artifact: ${response.statusText}`);
        }
    }
}

