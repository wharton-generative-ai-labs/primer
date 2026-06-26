/**
 * ConfigLoader Module
 * 
 * Exports the main ConfigLoader class and related types.
 * This module provides a modular, maintainable approach to loading
 * and processing experience configurations.
 */

export { ConfigLoader } from './ConfigLoader';
export type { LoadPhase, LoadPhaseCallback } from './ConfigLoader';
export type {
    ConfigLoaderState,
    ArtifactCreationOptions,
    ArtifactCreationContext,
    InstructionProcessingResult,
    ToolRegistrationOptions
} from './types';

// Export managers for advanced use cases or testing
export { ValidationManager } from './ValidationManager';
export { ResourceManager } from './ResourceManager';
export { ExperienceLoader } from './ExperienceLoader';
export { InstructionProcessor } from './InstructionProcessor';
export { ArtifactManager } from './ArtifactManager';
export { ToolProcessor } from './ToolProcessor';
export { AgentConfigBuilder } from './AgentConfigBuilder';
export { ExperienceIdExtractor } from './ExperienceIdExtractor';

