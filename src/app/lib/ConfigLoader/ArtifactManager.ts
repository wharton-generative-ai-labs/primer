/**
 * ArtifactManager
 * 
 * Handles loading and creation of artifacts from experience configuration.
 * Manages artifact deduplication and API communication.
 */

import { ExperienceConfig } from '../types';
import { ResourceManager } from './ResourceManager';
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

        // Wait for the server-issued session id to land in sessionStorage
        // before posting any artifacts. The /play/[id] RSC and the
        // recovery dialog (chooseSessionAction) own session creation;
        // ArtifactManager must NOT mint its own id here. Doing so used
        // to silently bisect a fresh session into two folders — the
        // generated id received the resource-bootstrapped artifacts,
        // and the server-issued id (which arrives shortly after via
        // socket auth) became the agent's session, where listArtifacts
        // returned empty.
        const sessionId = await this.waitForSessionId();
        if (!sessionId) {
            logger.warn(
                'ArtifactManager: no session id available; skipping resource-artifact bootstrap. The agent will see an empty artifact list until the page reloads with a session id.',
            );
            // Mark loaded anyway so we don't infinite-retry; the caller
            // will retry on next experience load.
            this.artifactsLoaded = true;
            return;
        }

        logger.debug({ count: artifacts.length, sessionId }, 'Loading artifacts');

        // Create all declared artifacts in parallel so the disk has them
        // available before the agent's first tool call. The previous
        // sequential loop meant artifact N could be missing while artifact
        // N-1 was still being written, racing any agent that asked
        // `checklist({action:'get'})` before all writes settled. Promise.all
        // with per-artifact error handling preserves the prior tolerance: a
        // single artifact failure logs but doesn't block the others.
        await Promise.all(
            artifacts.map(async (artifact) => {
                if (!artifact?.file) return;
                try {
                    const result = await this.resourceManager.loadResource(
                        artifact.file,
                        `resources.artifacts[${artifact.name}]`,
                    );
                    // Always seed declared artifacts, even when the source
                    // file is empty. Placeholder artifacts (e.g.
                    // `built-experience-id.md`) ship as 0-byte files whose
                    // entire purpose is to carry declared `metadata.tags`
                    // (`result:experience-id`, etc.) until the orchestrator
                    // writes the real value. Skipping empty content here
                    // dropped those tags and broke result-tag lookups.
                    await this.createArtifact(
                        experienceConfig.experienceId || '',
                        {
                            name: artifact.name,
                            content: result.content ?? '',
                            type: artifact.type || 'markdown',
                            agents: artifact.agents,
                            metadata: artifact.metadata,
                        },
                    );
                } catch (error) {
                    logger.error(
                        { err: error, artifactName: artifact.name },
                        'Failed to load artifact',
                    );
                }
            }),
        );

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
     * Get the context needed for artifact creation (session ID, user info).
     * Caller must have already confirmed via {@link waitForSessionId} that
     * a server-issued session id is present in sessionStorage; this method
     * never mints one.
     */
    private getArtifactCreationContext(experienceId: string): ArtifactCreationContext {
        const sessionId =
            typeof window !== 'undefined' && typeof sessionStorage !== 'undefined'
                ? sessionStorage.getItem('primer:session-id')
                : null;

        if (!sessionId) {
            // Should be unreachable when callers respect waitForSessionId.
            throw new Error(
                'ArtifactManager: no session id available — must call after a session is established',
            );
        }

        const userName =
            typeof sessionStorage !== 'undefined'
                ? sessionStorage.getItem('primer:user-name') || undefined
                : undefined;
        const userEmail =
            typeof sessionStorage !== 'undefined'
                ? sessionStorage.getItem('primer:user-email') || undefined
                : undefined;

        return { experienceId, sessionId, userName, userEmail };
    }

    /**
     * Poll sessionStorage for the server-issued session id. Returns the id
     * once it lands, or `null` if the timeout expires (e.g., loaded outside
     * a play context). Default budget is generous — page bootstrap is not
     * latency-critical and a slow session creation should not silently
     * skip artifact loading.
     */
    private async waitForSessionId(timeoutMs = 10_000, intervalMs = 50): Promise<string | null> {
        if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
            return null;
        }
        const deadline = Date.now() + timeoutMs;
        // First read is synchronous so the common case (id already present)
        // doesn't even hit setTimeout.
        const initial = sessionStorage.getItem('primer:session-id');
        if (initial) return initial;
        return await new Promise(resolve => {
            const tick = () => {
                const value = sessionStorage.getItem('primer:session-id');
                if (value) {
                    resolve(value);
                    return;
                }
                if (Date.now() >= deadline) {
                    resolve(null);
                    return;
                }
                setTimeout(tick, intervalMs);
            };
            setTimeout(tick, intervalMs);
        });
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

