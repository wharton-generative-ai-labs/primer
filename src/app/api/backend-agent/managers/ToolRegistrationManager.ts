/**
 * ToolRegistrationManager
 * 
 * Handles tool registration and retrieval for backend agents including:
 * - Registering all backend tool groups
 * - Getting tools for specific agent tool groups
 * - Formatting tools for AI providers
 */

import {
  registerBuiltinTools,
  registerExperienceTools,
  registerMatterCompilerTools,
  registerImageGeneratorTools,
  registerAnalyticsTools
} from '@/app/lib/tools';
import { createModuleLogger } from '@/lib/logger';
import type { AgentConfig, ToolDefinition } from './types';

const logger = createModuleLogger('backend-agent-tool-registration');

export class ToolRegistrationManager {
  /**
   * Register all backend tools with ToolRegistry
   * These are the tools that backend agents have access to
   */
  static async registerAllBackendTools(): Promise<void> {
    logger.debug('Registering backend tools with ToolRegistry');
    
    await registerBuiltinTools();
    await registerExperienceTools();
    await registerMatterCompilerTools();
    await registerImageGeneratorTools();
    await registerAnalyticsTools();
    // Note: Delegation tools are not needed for backend agents themselves
    
    logger.debug('Backend tools registered successfully');
  }

  /**
   * Get tools for the specified agent based on its tool configuration.
   * Supports both legacy (toolGroups) and new (toolSets) formats.
   */
  static async getToolsForAgent(agentConfig: AgentConfig): Promise<ToolDefinition[]> {
    const { getToolsForGroups, getToolsForNames, expandToolSets, getPresetToolSet } = await import('@/app/lib/tools/groups');
    
    let allowedTools;

    // New format: toolSets (configVersion 2+)
    if (agentConfig.toolSets && agentConfig.toolSets.length > 0) {
      logger.debug({ toolSets: agentConfig.toolSets }, 'Using toolSets configuration');
      
      // Expand toolSets to tool names
      // Note: We don't have access to the full experience config here, so we can only use preset toolSets
      // Custom toolSets from experience.json would need to be passed through if needed
      const toolNames = expandToolSets(agentConfig.toolSets);
      allowedTools = getToolsForNames(toolNames);
      
      logger.debug({ toolNames, toolCount: allowedTools.length }, 'Tools from toolSets');
    }
    // Legacy format: toolGroups
    else if (agentConfig.toolGroups && agentConfig.toolGroups.length > 0) {
      logger.debug({ toolGroups: agentConfig.toolGroups }, 'Using legacy toolGroups configuration');
      allowedTools = getToolsForGroups(agentConfig.toolGroups);
    }
    // Fallback: Use backend-default preset for backend agents
    else {
      logger.debug('No toolSets or toolGroups specified, using backend-default preset');
      const defaultTools = getPresetToolSet('backend-default') || [];
      allowedTools = getToolsForNames(defaultTools);
    }

    logger.debug({ tools: allowedTools.map(t => t.name) }, 'Allowed tools');

    // Format tools for AI (OpenAI format with type: 'function')
    const tools: ToolDefinition[] = allowedTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));

    logger.info({ 
      toolCount: tools.length, 
      toolSets: agentConfig.toolSets,
      toolGroups: agentConfig.toolGroups 
    }, 'Tools prepared for agent');
    
    // Debug: Log image-related tools
    const imageTools = tools.filter(t => t.function.name.toLowerCase().includes('image'));
    if (imageTools.length > 0) {
      console.log('[BACKEND-AGENT] Image-related tools available to agent:', imageTools.map(t => t.function.name));
    }

    return tools;
  }

  /**
   * Initialize tools for backend agent execution
   * Registers all tools and returns tools for the specific agent
   */
  static async initializeTools(agentConfig: AgentConfig): Promise<ToolDefinition[]> {
    await this.registerAllBackendTools();
    return this.getToolsForAgent(agentConfig);
  }
}

