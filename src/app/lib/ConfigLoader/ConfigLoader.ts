/**
 * ConfigLoader
 * 
 * Main orchestrator for loading and processing experience configurations.
 * Coordinates validation, resource loading, instruction processing, and tool registration.
 * 
 * This is a refactored version that delegates responsibilities to specialized managers:
 * - ValidationManager: Tracks validation status and errors
 * - ResourceManager: Handles resource creation and validation
 * - ExperienceLoader: Loads and parses experience.json
 * - InstructionProcessor: Processes instruction files with placeholders
 * - ArtifactManager: Loads and creates artifacts
 * - ToolProcessor: Processes and registers tools
 * - AgentConfigBuilder: Builds agent configurations
 */

import { ConfigResponse, ExperienceConfig, ValidationReport, ContentLoader } from '../types';
import { ValidationManager } from './ValidationManager';
import { ResourceManager } from './ResourceManager';
import { ExperienceLoader } from './ExperienceLoader';
import { InstructionProcessor } from './InstructionProcessor';
import { ArtifactManager } from './ArtifactManager';
import { ToolProcessor } from './ToolProcessor';
import { AgentConfigBuilder } from './AgentConfigBuilder';

export class ConfigLoader {
    private experienceConfig: ExperienceConfig | null = null;
    
    // Specialized managers
    private validationManager: ValidationManager;
    private resourceManager: ResourceManager;
    private experienceLoader: ExperienceLoader;
    private instructionProcessor: InstructionProcessor;
    private artifactManager: ArtifactManager;
    private toolProcessor: ToolProcessor;
    private agentConfigBuilder: AgentConfigBuilder;

    constructor(private contentLoader: ContentLoader) {
        // Initialize managers in dependency order
        this.validationManager = new ValidationManager();
        this.resourceManager = new ResourceManager(contentLoader, this.validationManager);
        this.experienceLoader = new ExperienceLoader(
            contentLoader,
            this.resourceManager,
            this.validationManager
        );
        this.instructionProcessor = new InstructionProcessor(
            this.resourceManager,
            this.validationManager
        );
        this.artifactManager = new ArtifactManager(this.resourceManager);
        this.toolProcessor = new ToolProcessor(this.validationManager);
        this.agentConfigBuilder = new AgentConfigBuilder(this.instructionProcessor);
    }

    /**
     * Load an experience from a configuration path
     * 
     * This is the main entry point for loading an experience.
     * It orchestrates all the loading, validation, and processing steps.
     */
    async loadExperience(configPath: string): Promise<void> {
        // Reset state for new experience
        this.resetState();

        // Load and parse the experience configuration
        this.experienceConfig = await this.experienceLoader.loadExperience(configPath);

        // Load all resources in parallel
        await Promise.all([
            this.instructionProcessor.loadInstructions(this.experienceConfig),
            this.artifactManager.loadArtifacts(this.experienceConfig)
        ]);

        // Process tools from the experience config
        await this.toolProcessor.processTools(this.experienceConfig);
    }

    /**
     * Load the final configuration response
     * 
     * Assembles all the loaded data into a ConfigResponse object.
     * Throws an error if there are validation errors.
     */
    async loadConfig(): Promise<ConfigResponse> {
        if (!this.experienceConfig) {
            throw new Error('Experience not loaded');
        }

        // Build all agent configurations
        const agents = await this.agentConfigBuilder.buildAllAgentConfigs(this.experienceConfig);

        // Check for validation errors
        if (this.validationManager.hasErrors()) {
            this.validationManager.logReport();
            throw new Error(this.validationManager.getErrorMessage());
        }

        // Assemble the final configuration response
        const response: ConfigResponse = {
            agents,
            resources: {
                scenes: this.experienceConfig.resources.scenes,
                sounds: this.experienceConfig.resources.sounds
            },
            metadata: {
                version: this.experienceConfig.version,
                title: this.experienceConfig.title,
                logo: this.experienceConfig.logo,
                description: this.experienceConfig.description,
                authorEmail: this.experienceConfig.authorEmail
            },
            aiConfigurations: this.experienceConfig.aiConfigurations || {
                default: {
                    provider: "openai",
                    api: "realtime",
                    model: "gpt-4o-realtime-preview",
                    streaming: true,
                    modalities: ["audio", "text"]
                }
            }
        };

        // Add tools if they exist
        const toolDefinitions = this.toolProcessor.getToolDefinitions();
        if (toolDefinitions && Object.keys(toolDefinitions).length > 0) {
            response.tools = toolDefinitions;
        }

        return response;
    }

    /**
     * Get the current validation report
     */
    getValidationReport(): ValidationReport {
        return this.validationManager.getReport();
    }

    /**
     * Reset state when loading a new experience
     */
    private resetState(): void {
        this.instructionProcessor.clear();
        this.artifactManager.reset();
        this.validationManager.reset();
        this.experienceConfig = null;
    }
}

