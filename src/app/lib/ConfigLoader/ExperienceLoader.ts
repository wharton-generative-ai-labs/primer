/**
 * ExperienceLoader
 * 
 * Handles loading and parsing of experience.json files.
 * Transforms raw configuration into structured ExperienceConfig.
 */

import { ExperienceConfig, ContentLoader } from '../types';
import { ResourceManager } from './ResourceManager';
import { ValidationManager } from './ValidationManager';
import { ExperienceIdExtractor } from './ExperienceIdExtractor';

export class ExperienceLoader {
    private resourceManager: ResourceManager;
    private validationManager: ValidationManager;
    private contentLoader: ContentLoader;

    constructor(
        contentLoader: ContentLoader,
        resourceManager: ResourceManager,
        validationManager: ValidationManager
    ) {
        this.contentLoader = contentLoader;
        this.resourceManager = resourceManager;
        this.validationManager = validationManager;
    }

    /**
     * Load and parse an experience configuration file
     */
    async loadExperience(configPath: string): Promise<ExperienceConfig> {
        // Set base path if not already set
        if (!this.contentLoader.basePath) {
            this.contentLoader.basePath = configPath;
        }

        // Set base URL for resource resolution
        const baseUrl = configPath.substring(0, configPath.lastIndexOf('/'));
        this.resourceManager.setBaseUrl(baseUrl);

        // Load the config file
        const configResult = await this.resourceManager.loadResource(configPath, 'config');
        if (!configResult.content) {
            throw new Error(`Failed to load experience.json`);
        }

        // Parse JSON with enhanced error reporting
        let rawConfigObject: any;
        try {
            rawConfigObject = JSON.parse(configResult.content);
        } catch (error) {
            throw this.createJSONParseError(error, configPath, configResult.content);
        }

        // Extract experience ID from the config path
        const experienceId = ExperienceIdExtractor.extract(configPath);

        // Transform the raw config into our structured format
        const experienceConfig = this.transformRawConfig(rawConfigObject, experienceId, configPath);

        // Validate the configuration
        await this.validateExperienceConfig(experienceConfig);

        return experienceConfig;
    }

    /**
     * Create a detailed error message for JSON parsing failures
     */
    private createJSONParseError(error: unknown, configPath: string, content: string): Error {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Extract line and column information if available
        const lineMatch = errorMessage.match(/at position (\d+)|line (\d+)|column (\d+)/i);
        
        let detailedMessage = `Failed to parse experience.json\n\n`;
        detailedMessage += `JSON Parse Error: ${errorMessage}\n\n`;
        
        // Try to provide context about where the error occurred
        if (lineMatch) {
            const position = parseInt(lineMatch[1] || lineMatch[2] || lineMatch[3]);
            if (!isNaN(position)) {
                const contextStart = Math.max(0, position - 100);
                const contextEnd = Math.min(content.length, position + 100);
                const context = content.substring(contextStart, contextEnd);
                detailedMessage += `Context around error:\n${context}\n\n`;
            }
        }
        
        // Common JSON errors and suggestions
        if (errorMessage.includes('Unexpected token') || errorMessage.includes('Unexpected end')) {
            detailedMessage += 'Common causes:\n';
            detailedMessage += '  - Missing or extra commas\n';
            detailedMessage += '  - Unquoted property names\n';
            detailedMessage += '  - Trailing commas in arrays or objects\n';
            detailedMessage += '  - Unclosed brackets or braces\n';
            detailedMessage += '  - Single quotes instead of double quotes\n';
        }
        
        detailedMessage += '\nPlease check the JSON syntax and try again.';
        
        return new Error(detailedMessage);
    }

    /**
     * Transform raw JSON config into structured ExperienceConfig
     */
    private transformRawConfig(
        rawConfig: any,
        experienceId: string,
        configPath: string
    ): ExperienceConfig {
        // Validate critical structure before transformation
        this.validateConfigStructure(rawConfig, configPath);

        const experienceConfig: ExperienceConfig = {
            ...rawConfig,
            experienceId,
            logo: rawConfig.logo ? this.resourceManager.createResource(rawConfig.logo) : undefined,
            aiConfigurations: rawConfig.aiConfigurations || {
                default: {
                    provider: "openai",
                    api: "realtime",
                    model: "gpt-4o-realtime-preview",
                    streaming: true,
                    modalities: ["audio", "text"]
                }
            },
            resources: {
                scenes: this.transformResourceArray(rawConfig.resources?.scenes),
                sounds: this.transformResourceArray(rawConfig.resources?.sounds),
                artifacts: Array.isArray(rawConfig.resources?.artifacts)
                    ? rawConfig.resources.artifacts
                    : [],
                instructions: {
                    agent: this.transformInstructionMap(rawConfig.resources?.instructions?.agent),
                    supplemental: this.transformInstructionMap(rawConfig.resources?.instructions?.supplemental)
                }
            }
        };

        // Validate required arrays
        if (!Array.isArray(rawConfig.resources?.scenes)) {
            this.validationManager.addStatus({
                friendlyName: "Scenes",
                objectPath: 'resources.scenes',
                status: 'MISSING',
                statusDetail: 'Scenes array is required but was not found in configuration',
                path: configPath
            });
        }

        return experienceConfig;
    }

    /**
     * Validate the basic structure of the configuration
     */
    private validateConfigStructure(rawConfig: any, configPath: string): void {
        const errors: string[] = [];

        // Check if rawConfig is an object
        if (!rawConfig || typeof rawConfig !== 'object') {
            throw new Error(
                `Invalid experience configuration at ${configPath}.\n` +
                `Expected a JSON object, but got: ${typeof rawConfig}`
            );
        }

        // Validate required top-level fields
        if (!rawConfig.agents || typeof rawConfig.agents !== 'object') {
            errors.push('  - Missing or invalid "agents" object');
        }

        if (!rawConfig.resources || typeof rawConfig.resources !== 'object') {
            errors.push('  - Missing or invalid "resources" object');
        }

        if (!rawConfig.initialAgent) {
            errors.push('  - Missing "initialAgent" field');
        }

        // Validate toolSets structure if using configVersion 2+
        if (rawConfig.configVersion >= 2) {
            if (!rawConfig.toolSets || typeof rawConfig.toolSets !== 'object') {
                errors.push('  - Missing or invalid "toolSets" object (required for configVersion 2+)');
            } else {
                // Validate each toolSet is an array
                for (const [key, value] of Object.entries(rawConfig.toolSets)) {
                    if (!Array.isArray(value)) {
                        errors.push(`  - toolSets["${key}"] must be an array of tool names`);
                    }
                }
            }

            // Validate each agent has toolSets and downstreamAgents
            if (rawConfig.agents && typeof rawConfig.agents === 'object') {
                for (const [agentKey, agentData] of Object.entries(rawConfig.agents)) {
                    const agent = agentData as any;
                    if (!agent.toolSets || !Array.isArray(agent.toolSets)) {
                        errors.push(`  - Agent "${agentKey}" is missing "toolSets" array (required for configVersion 2+)`);
                    }
                    // Validate downstreamAgents if present
                    if (agent.downstreamAgents !== undefined && !Array.isArray(agent.downstreamAgents)) {
                        errors.push(`  - Agent "${agentKey}" has invalid "downstreamAgents" (must be an array)`);
                    }
                }
            }
        } else {
            // For configVersion 1, validate downstreamAgents structure
            if (rawConfig.agents && typeof rawConfig.agents === 'object') {
                for (const [agentKey, agentData] of Object.entries(rawConfig.agents)) {
                    const agent = agentData as any;
                    if (agent.downstreamAgents !== undefined && !Array.isArray(agent.downstreamAgents)) {
                        errors.push(`  - Agent "${agentKey}" has invalid "downstreamAgents" (must be an array)`);
                    }
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(
                `Invalid experience configuration structure at ${configPath}:\n\n` +
                errors.join('\n') +
                '\n\nPlease check the configuration file and ensure all required fields are present.'
            );
        }
    }

    /**
     * Transform an array of resource paths into Resource objects
     */
    private transformResourceArray(paths: any): Array<any> {
        if (!Array.isArray(paths)) {
            return [];
        }
        return paths.map((path: string) => this.resourceManager.createResource(path));
    }

    /**
     * Transform an instruction map (agent or supplemental) into Resource objects
     */
    private transformInstructionMap(instructionMap: any): Record<string, any> {
        if (!instructionMap || typeof instructionMap !== 'object') {
            return {};
        }

        return Object.entries(instructionMap).reduce((acc, [key, path]) => {
            acc[key] = this.resourceManager.createResource(path as string);
            return acc;
        }, {} as Record<string, any>);
    }

    /**
     * Validate all resources in the experience configuration
     */
    private async validateExperienceConfig(experienceConfig: ExperienceConfig): Promise<void> {
        const validatePromises: Promise<void>[] = [];

        // Validate scenes
        experienceConfig.resources.scenes.forEach((scene, index) => {
            validatePromises.push(
                this.resourceManager.validateResource(scene, `resources.scenes[${index}]`)
            );
        });

        // Validate sounds if they exist
        if (experienceConfig.resources.sounds.length > 0) {
            experienceConfig.resources.sounds.forEach((sound, index) => {
                validatePromises.push(
                    this.resourceManager.validateResource(sound, `resources.sounds[${index}]`)
                );
            });
        }

        // Validate logo if it exists
        if (experienceConfig.logo) {
            validatePromises.push(
                this.resourceManager.validateResource(experienceConfig.logo, 'resources.logo')
            );
        }

        // Validate artifacts if they exist
        if (experienceConfig.resources?.artifacts && experienceConfig.resources.artifacts.length > 0) {
            for (const artifact of experienceConfig.resources.artifacts) {
                if (artifact && artifact.file) {
                    validatePromises.push(
                        this.resourceManager.validateResource(
                            this.resourceManager.createResource(artifact.file),
                            `resources.artifacts[${artifact.name}]`
                        )
                    );
                }
            }
        }

        await Promise.all(validatePromises);
    }
}

