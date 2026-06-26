/**
 * InstructionProcessor
 * 
 * Handles loading and processing of instruction files.
 * Manages placeholder replacement and validation.
 */

import { Resource, ExperienceConfig } from '../types';
import { ResourceManager } from './ResourceManager';
import { ValidationManager } from './ValidationManager';
import { getPlatformSupplemental } from '@/app/lib/instructions/platform';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('InstructionProcessor');

/**
 * Separator inserted between platform and experience supplemental content
 * when both are present for the same key. A visible heading makes the
 * layering obvious to anyone inspecting a rendered prompt.
 */
const EXPERIENCE_APPENDIX_HEADING =
    '\n\n---\n\n## Experience-specific additions\n\n';

export class InstructionProcessor {
    private instructionContent: Map<string, string> = new Map();
    private resourceManager: ResourceManager;
    private validationManager: ValidationManager;

    constructor(
        resourceManager: ResourceManager,
        validationManager: ValidationManager
    ) {
        this.resourceManager = resourceManager;
        this.validationManager = validationManager;
    }

    /**
     * Clear all loaded instruction content
     */
    clear(): void {
        this.instructionContent.clear();
    }

    /**
     * Load all instruction files for an experience
     */
    async loadInstructions(experienceConfig: ExperienceConfig): Promise<void> {
        logger.debug('Starting to load instructions');
        const loadPromises: Promise<void>[] = [];

        // Seed the map with platform supplemental content first, so when
        // experience supplemental loads it can merge on top (or replace, per
        // experienceConfig.instructionOverrides). Platform keys that aren't
        // overridden by an experience file remain available as-is.
        // Pass the config so the platform layer can pick phase-aware
        // variants (e.g. the `agent` supplemental swaps in handoff guidance
        // that points at `workflowPhase.nextPhase` for cross-phase moves).
        const platform = getPlatformSupplemental(experienceConfig);
        for (const [key, content] of Object.entries(platform)) {
            this.instructionContent.set(`supplemental:${key}`, content.trim());
        }
        logger.debug(
            { platformKeys: Object.keys(platform) },
            'Seeded platform supplemental instructions'
        );

        // Load agent instructions
        const agentInstructions = experienceConfig.resources.instructions.agent;
        logger.debug({ agentKeys: Object.keys(agentInstructions) }, 'Agent instruction files to load');

        for (const [key, resource] of Object.entries(agentInstructions)) {
            const promise = this.loadAgentInstruction(key, resource);
            loadPromises.push(promise);
        }

        // Load supplemental instructions (may merge with or replace platform
        // content depending on experienceConfig.instructionOverrides).
        const supplementalInstructions = experienceConfig.resources.instructions.supplemental;
        const overrides = experienceConfig.instructionOverrides ?? {};
        logger.debug(
            { supplementalKeys: Object.keys(supplementalInstructions), overrides },
            'Supplemental instruction files to load'
        );

        for (const [key, resource] of Object.entries(supplementalInstructions)) {
            const shouldReplace = overrides[key]?.replace === true;
            const promise = this.loadSupplementalInstruction(key, resource, shouldReplace);
            loadPromises.push(promise);
        }

        await Promise.all(loadPromises);
        logger.debug({ keys: Array.from(this.instructionContent.keys()) }, 'Finished loading all instructions');
    }

    /**
     * Load a single agent instruction file
     */
    private async loadAgentInstruction(key: string, resource: Resource): Promise<void> {
        const result = await this.resourceManager.loadResource(
            resource.path,
            `resources.instructions.agent.${key}`
        );
        if (result.content) {
            this.instructionContent.set(`agent:${key}`, result.content.trim());
        } else {
            logger.warn({ key, path: resource.path }, 'No content loaded for agent');
        }
    }

    /**
     * Load a single supplemental instruction file.
     *
     * Merge behaviour when the same key was already seeded from the platform
     * baseline: concatenate platform + '\n\n---\n\n' + experience so the
     * model sees both layers. When `replace` is true, the experience content
     * fully supplants the platform baseline for this key (escape hatch for
     * experiences that need to contradict the defaults).
     */
    private async loadSupplementalInstruction(
        key: string,
        resource: Resource,
        replace: boolean = false
    ): Promise<void> {
        const result = await this.resourceManager.loadResource(
            resource.path,
            `resources.instructions.supplemental.${key}`
        );
        if (!result.content) {
            logger.warn({ key, path: resource.path }, 'No content loaded for supplemental');
            return;
        }

        const experienceContent = result.content.trim();
        const mapKey = `supplemental:${key}`;
        const platformContent = replace ? undefined : this.instructionContent.get(mapKey);

        if (platformContent && experienceContent) {
            const merged = platformContent + EXPERIENCE_APPENDIX_HEADING + experienceContent;
            this.instructionContent.set(mapKey, merged);
        } else {
            this.instructionContent.set(mapKey, experienceContent);
        }
    }

    /**
     * Process instructions for a specific agent, replacing placeholders
     */
    async processInstructions(agentKey: string): Promise<string> {
        const agentInstructions = this.instructionContent.get(`agent:${agentKey}`);
        if (!agentInstructions) {
            logger.warn({ agentKey }, 'No instructions found for agent');
            
            // Only add to validation if we haven't already recorded a 404 for this instruction
            if (!this.validationManager.hasStatusForPath(`resources.instructions.agent.${agentKey}`)) {
                this.validationManager.addStatus({
                    friendlyName: `Agent '${agentKey}'`,
                    path: `agents[${agentKey}]`,
                    objectPath: `resources.instructions.agent.${agentKey}`,
                    status: 'MISSING',
                    statusDetail: 'Instructions not loaded'
                });
            }
            return ''; // Return empty string, the config loading will fail later due to validation
        }

        let processedInstructions = agentInstructions;

        // Get all available supplemental keys
        const supplementalKeys = this.getAvailableSupplementalKeys();

        // Find all placeholders in the instructions
        const placeholdersInInstructions = this.findPlaceholders(agentInstructions);

        // Validate placeholders
        this.validatePlaceholders(agentKey, placeholdersInInstructions, supplementalKeys);

        // Replace placeholders with supplemental content
        processedInstructions = this.replacePlaceholders(processedInstructions, supplementalKeys);

        return processedInstructions;
    }

    /**
     * Get all available supplemental instruction keys
     */
    private getAvailableSupplementalKeys(): Set<string> {
        return new Set(
            Array.from(this.instructionContent.keys())
                .filter(key => key.startsWith('supplemental:'))
                .map(key => key.replace('supplemental:', ''))
        );
    }

    /**
     * Find all placeholders in instruction text
     * Only matches double-brace placeholders (no newlines between braces)
     */
    private findPlaceholders(instructions: string): Set<string> {
        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        return new Set(
            Array.from(instructions.matchAll(placeholderRegex))
                .map(match => match[1])
        );
    }

    /**
     * Validate that all placeholders have corresponding supplemental files
     */
    private validatePlaceholders(
        agentKey: string,
        placeholders: Set<string>,
        supplementalKeys: Set<string>
    ): void {
        for (const placeholder of placeholders) {
            if (!supplementalKeys.has(placeholder)) {
                this.validationManager.addStatus({
                    friendlyName: `Agent '${agentKey}'`,
                    path: `agents[${agentKey}]`,
                    objectPath: `resources.instructions.agent.${agentKey}`,
                    status: 'INVALID_PLACEHOLDER',
                    statusDetail: `Found placeholder {{${placeholder}}}. Available placeholders are: {{${Array.from(supplementalKeys).join('}}, {{')}}`
                });
            }
        }
    }

    /**
     * Replace all placeholders with supplemental content
     */
    private replacePlaceholders(instructions: string, _supplementalKeys: Set<string>): string {
        let processedInstructions = instructions;

        for (const [key, content] of this.instructionContent.entries()) {
            if (key.startsWith('supplemental:')) {
                const placeholderKey = key.replace('supplemental:', '');
                
                if (!content) {
                    const objectPath = `resources.instructions.supplemental.${placeholderKey}`;
                    if (!this.validationManager.hasStatusForPath(objectPath)) {
                        this.validationManager.addStatus({
                            friendlyName: `Supplemental instructions: ${key}`,
                            path: key,
                            objectPath,
                            status: 'MISSING',
                            statusDetail: 'Supplemental content not loaded'
                        });
                    }
                    continue;
                }
                
                processedInstructions = processedInstructions.replace(
                    new RegExp(`\\{\\{${placeholderKey}\\}\\}`, 'g'),
                    content
                );
            }
        }

        return processedInstructions;
    }
}

