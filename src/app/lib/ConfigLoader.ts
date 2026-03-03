/**
 * ConfigLoader - Legacy Export
 * 
 * This file maintains backward compatibility by re-exporting the refactored ConfigLoader.
 * All existing imports will continue to work without modification.
 * 
 * The ConfigLoader has been refactored into a modular structure in the ConfigLoader/ directory:
 * - ValidationManager: Tracks validation status and errors
 * - ResourceManager: Handles resource creation and validation
 * - ExperienceLoader: Loads and parses experience.json
 * - InstructionProcessor: Processes instruction files with placeholders
 * - ArtifactManager: Loads and creates artifacts
 * - ToolProcessor: Processes and registers tools
 * - AgentConfigBuilder: Builds agent configurations
 * 
 * For new code, consider importing from '@/app/lib/ConfigLoader' directly.
 */

export { ConfigLoader } from './ConfigLoader/ConfigLoader';
export type {
    ConfigLoaderState,
    ArtifactCreationOptions,
    ArtifactCreationContext,
    InstructionProcessingResult,
    ToolRegistrationOptions
} from './ConfigLoader/types';
