/**
 * ExperienceConfigLoader
 * 
 * Handles loading and parsing of experience configurations including:
 * - Loading experience.json
 * - Finding agent configurations
 * - Loading agent instructions
 * - Resolving AI configurations
 */

import { createModuleLogger } from '@/lib/logger';
import type { ExperienceConfig, AgentConfig, LoadedExperience } from './types';

const logger = createModuleLogger('backend-agent-experience-loader');

export class ExperienceConfigLoader {
  /**
   * Load experience configuration from file system
   */
  static async loadExperienceConfig(experienceId: string): Promise<ExperienceConfig> {
    const { getExperienceFolder } = await import('@/app/lib/file-utils');
    const fs = await import('fs/promises');
    const path = await import('path');

    const experienceFolder = await getExperienceFolder(experienceId);
    const experienceFilePath = path.join(experienceFolder, 'experience.json');

    try {
      const experienceContent = await fs.readFile(experienceFilePath, 'utf-8');
      const config = JSON.parse(experienceContent);
      
      logger.debug({ experienceId, agentCount: Object.keys(config.agents || {}).length }, 'Experience config loaded');
      
      return config;
    } catch (error) {
      logger.error(error, 'Error loading experience config');
      throw new Error('Failed to load experience configuration');
    }
  }

  /**
   * Find agent configuration by agent type
   */
  static findAgentConfig(
    config: ExperienceConfig,
    agentType: string
  ): { agentKey: string; agentConfig: AgentConfig } | null {
    const agentKeys = Object.keys(config.agents || {});
    
    logger.debug({ agentKeys, agentType }, 'Searching for agent');

    const needle = agentType.toLowerCase();

    const agentKey =
      agentKeys.find(key => config.agents[key].name?.toLowerCase() === needle) ||
      agentKeys.find(key => key.toLowerCase() === needle);

    if (!agentKey) {
      logger.error({ agentType, availableKeys: agentKeys }, 'No matching agent found');
      return null;
    }

    const agentConfig = config.agents[agentKey];
    logger.debug({ agentKey, name: agentConfig.name }, 'Found agent config');

    return { agentKey, agentConfig };
  }

  /**
   * Load agent instructions from file system
   */
  static async loadAgentInstructions(
    experienceId: string,
    config: ExperienceConfig,
    agentKey: string
  ): Promise<string> {
    const { getExperienceFolder } = await import('@/app/lib/file-utils');
    const fs = await import('fs/promises');
    const path = await import('path');

    const instructionPath = config.resources?.instructions?.agent?.[agentKey];
    
    if (!instructionPath) {
      logger.error({ agentKey }, 'No instruction path found for agent');
      throw new Error(`No instructions found for agent "${agentKey}"`);
    }

    const experienceFolder = await getExperienceFolder(experienceId);
    const fullInstructionPath = path.join(experienceFolder, instructionPath);
    
    logger.debug({ path: fullInstructionPath }, 'Loading agent instructions');

    try {
      const instructions = await fs.readFile(fullInstructionPath, 'utf-8');
      logger.debug({ length: instructions.length }, 'Agent instructions loaded');
      return instructions;
    } catch (error) {
      logger.error(error, 'Error loading agent instructions');
      throw new Error('Failed to load agent instructions');
    }
  }

  /**
   * Get AI configuration for agent
   */
  static getAIConfiguration(config: ExperienceConfig, agentConfig: AgentConfig) {
    const aiConfigName = agentConfig.aiConfiguration || 'default';
    const aiConfig = config.aiConfigurations?.[aiConfigName];
    const temperature = agentConfig.temperature ?? 0.7;

    logger.debug({ aiConfigName, temperature, provider: aiConfig?.provider }, 'AI configuration resolved');

    return { aiConfig, temperature };
  }

  /**
   * Load complete experience data for backend agent
   */
  static async loadExperience(
    experienceId: string,
    agentType: string
  ): Promise<LoadedExperience> {
    // Load experience config
    const config = await this.loadExperienceConfig(experienceId);

    // Find agent
    const agentResult = this.findAgentConfig(config, agentType);
    if (!agentResult) {
      throw new Error(`No agent found matching "${agentType}"`);
    }

    const { agentKey, agentConfig } = agentResult;

    // Load instructions
    const instructions = await this.loadAgentInstructions(experienceId, config, agentKey);

    // Get AI config
    const { aiConfig, temperature } = this.getAIConfiguration(config, agentConfig);

    logger.info({
      experienceId,
      agentKey,
      agentName: agentConfig.name,
      instructionLength: instructions.length,
      temperature,
    }, 'Experience loaded successfully');

    return {
      config,
      agentKey,
      agentConfig,
      instructions,
      aiConfig,
      temperature
    };
  }
}

