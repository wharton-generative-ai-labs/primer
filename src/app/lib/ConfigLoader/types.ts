/**
 * Type definitions for ConfigLoader module
 * 
 * These types define the internal data structures used during
 * configuration loading and validation.
 */

import { 
    ValidationReport, 
    ResourceLoadStatus, 
    ExperienceConfig,
    ToolDefinition 
} from '../types';

/**
 * Internal state for the ConfigLoader
 */
export interface ConfigLoaderState {
    instructionContent: Map<string, string>;
    experienceConfig: ExperienceConfig | null;
    toolDefinitions: Record<string, ToolDefinition>;
    baseUrl: string;
    validationReport: ValidationReport;
    artifactsLoaded: boolean;
}

/**
 * Options for creating artifacts from configuration
 */
export interface ArtifactCreationOptions {
    name: string;
    content: string;
    type: string;
    agents?: string[];
    metadata?: {
        description?: string;
        tags?: string[];
        presentation?: {
            type: 'slide' | 'editor' | 'checklist' | 'none';
            options?: Record<string, any>;
        };
    };
}

/**
 * Context for artifact creation API calls
 */
export interface ArtifactCreationContext {
    experienceId: string;
    sessionId: string;
    userName?: string;
    userEmail?: string;
}

/**
 * Result of instruction processing
 */
export interface InstructionProcessingResult {
    processedInstructions: string;
    errors: ResourceLoadStatus[];
}

/**
 * Options for tool registration
 */
export interface ToolRegistrationOptions {
    pluginName: string;
    groupName: string;
}

