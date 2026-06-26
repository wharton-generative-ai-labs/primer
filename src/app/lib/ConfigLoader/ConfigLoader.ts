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

/**
 * Coarse-grained progress milestones the loader emits at natural join points.
 * Consumed by the play loading flow's checklist UI (see ExperienceBuildSequence
 * — Slice 3+) so the user-facing steps are tied to real signals instead of a
 * synthetic timer.
 *
 * Real firing order: `experience-data` → `media` → `tools-plugins` →
 * `ai-models`. The design-driven checklist may render these in a different
 * visual order; consumers should batch the events to their preferred display
 * order rather than expecting a 1:1 mapping.
 */
export type LoadPhase =
    | 'experience-data'
    | 'media'
    | 'tools-plugins'
    | 'ai-models';

export type LoadPhaseCallback = (phase: LoadPhase) => void;

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
     *
     * @param configPath URL of the experience.json to load.
     * @param onPhase Optional progress callback fired after each natural join
     *   point. Errors thrown by the callback are swallowed so a misbehaving
     *   subscriber can never block the load.
     */
    async loadExperience(configPath: string, onPhase?: LoadPhaseCallback): Promise<void> {
        const emit = (phase: LoadPhase) => {
            if (!onPhase) return;
            try {
                onPhase(phase);
            } catch {
                // Subscriber callbacks must never block the load pipeline.
            }
        };

        // Reset state for new experience
        this.resetState();

        // Load and parse the experience configuration
        this.experienceConfig = await this.experienceLoader.loadExperience(configPath);
        emit('experience-data');

        // Run instructions+artifacts and tool processing in parallel:
        // toolProcessor only needs experienceConfig, so there's no reason
        // to block it behind the instruction/artifact fetch. media and
        // tools-plugins now fire independently as each leg completes.
        await Promise.all([
            (async () => {
                await Promise.all([
                    this.instructionProcessor.loadInstructions(this.experienceConfig!),
                    this.artifactManager.loadArtifacts(this.experienceConfig!),
                ]);
                emit('media');
            })(),
            (async () => {
                await this.toolProcessor.processTools(this.experienceConfig!);
                emit('tools-plugins');
            })(),
        ]);
    }

    /**
     * Load the final configuration response
     * 
     * Assembles all the loaded data into a ConfigResponse object.
     * Throws an error if there are validation errors.
     *
     * @param onPhase Optional progress callback. Fires `ai-models` once agent
     *   configurations are built and validation has passed (callers can use
     *   it to drive the final checklist tick before resolving the promise).
     */
    async loadConfig(onPhase?: LoadPhaseCallback): Promise<ConfigResponse> {
        if (!this.experienceConfig) {
            throw new Error('Experience not loaded');
        }

        // Build all agent configurations
        const agents = await this.agentConfigBuilder.buildAllAgentConfigs(this.experienceConfig);
        if (onPhase) {
            try {
                onPhase('ai-models');
            } catch {
                // Subscriber callbacks must never block the load pipeline.
            }
        }

        // Check for validation errors
        if (this.validationManager.hasErrors()) {
            this.validationManager.logReport();
            throw new Error(this.validationManager.getErrorMessage());
        }

        // Assemble the final configuration response
        const metadata: ConfigResponse['metadata'] = {
            version: this.experienceConfig.version,
            title: this.experienceConfig.title,
            logo: this.experienceConfig.logo,
            description: this.experienceConfig.description,
            authorEmail: this.experienceConfig.authorEmail
        };
        // Only set the new fields when present on the source config so the
        // returned metadata stays minimal for single-screen experiences.
        if (this.experienceConfig.initialAgent) {
            metadata.initialAgent = this.experienceConfig.initialAgent;
        }
        if (this.experienceConfig.workflowPhases) {
            metadata.workflowPhases = this.experienceConfig.workflowPhases;
        }
        if (this.experienceConfig.initialWorkflowPhase) {
            metadata.initialWorkflowPhase = this.experienceConfig.initialWorkflowPhase;
        }
        if (this.experienceConfig.showPhaseCount !== undefined) {
            metadata.showPhaseCount = this.experienceConfig.showPhaseCount;
        }
        if (this.experienceConfig.autoTranscript !== undefined) {
            metadata.autoTranscript = this.experienceConfig.autoTranscript;
        }

        const response: ConfigResponse = {
            agents,
            resources: {
                scenes: this.experienceConfig.resources.scenes,
                sounds: this.experienceConfig.resources.sounds
            },
            metadata,
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

