/**
 * ConfigAnalyzer
 * 
 * Analyzes experience.json configurations to provide insights about:
 * - Configuration validity
 * - Runtime tool assignments
 * - Upgrade recommendations
 * - Agent structure
 */

import { ExperienceConfig } from './types';
import { expandToolSets, getToolNamesForGroup, pluginNamesToGroups } from './tools/groups';

export interface ToolConfigSource {
  type: 'explicit' | 'toolSets' | 'toolGroups' | 'plugins' | 'fallback';
  details: {
    // For explicit
    explicitTools?: string[];
    // For toolSets
    toolSetNames?: string[];
    resolvedTools?: string[];
    // For toolGroups
    groupNames?: string[];
    // For plugins (experience-level legacy)
    pluginNames?: string[];
    mappedGroups?: string[];
    // For fallback
    fallbackReason?: string;
  };
}

export interface AgentAnalysis {
  key: string;
  name: string;
  type: 'frontend' | 'backend' | undefined;
  aiConfiguration?: string;
  model?: string;
  imageModel?: string;
  provider?: string;
  temperature?: number;
  toolSource: ToolConfigSource;
  availableTools: string[];
  toolCount: number;
  downstreamAgents: string[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'structure' | 'references' | 'tools' | 'configuration';
  message: string;
  path?: string;
  suggestion?: string;
}

export interface ExperienceAnalysis {
  // Basic info
  version: string;
  configVersion: number;
  kind?: string;
  title: string;
  description: string;
  author?: string;
  created?: string;
  lastModified?: string;

  // Statistics
  stats: {
    agentCount: number;
    frontendAgentCount: number;
    backendAgentCount: number;
    sceneCount: number;
    soundCount: number;
    artifactCount: number;
    componentCount: number;
    totalUniqueTools: number;
  };

  // Agents with tool analysis
  agents: AgentAnalysis[];

  // Validation
  validation: {
    isValid: boolean;
    issues: ValidationIssue[];
  };

  // Upgrade info
  upgrade: {
    canUpgrade: boolean;
    currentVersion: number;
    targetVersion: number;
    changes: string[];
  };
}

export class ConfigAnalyzer {
  /**
   * Analyze an experience configuration
   */
  async analyze(configJson: string): Promise<ExperienceAnalysis> {
    try {
      const config: ExperienceConfig = JSON.parse(configJson);
      
      const configVersion = config.configVersion || 1;
      const agents = await this.analyzeAgents(config);
      const validation = this.validateConfig(config);
      const upgrade = this.analyzeUpgrade(config);

      // Calculate statistics
      const allTools = new Set<string>();
      agents.forEach(agent => agent.availableTools.forEach(tool => allTools.add(tool)));

      const stats = {
        agentCount: Object.keys(config.agents || {}).length,
        frontendAgentCount: agents.filter(a => a.type === 'frontend').length,
        backendAgentCount: agents.filter(a => a.type === 'backend').length,
        sceneCount: config.resources?.scenes?.length || 0,
        soundCount: config.resources?.sounds?.length || 0,
        artifactCount: config.resources?.artifacts?.length || 0,
        componentCount: config.resources?.components?.length || 0,
        totalUniqueTools: allTools.size
      };

      return {
        version: config.version,
        configVersion,
        kind: config.kind,
        title: config.title,
        description: config.description,
        author: config.author,
        created: config.created,
        lastModified: config.lastModified,
        stats,
        agents,
        validation,
        upgrade
      };
    } catch (error) {
      throw new Error(`Failed to analyze configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze all agents in the configuration
   */
  private async analyzeAgents(config: ExperienceConfig): Promise<AgentAnalysis[]> {
    const analyses: AgentAnalysis[] = [];

    for (const [key, agentData] of Object.entries(config.agents || {})) {
      const toolSource = this.determineToolSource(agentData, config);
      const availableTools = this.computeAvailableTools(agentData, config);

      // Get AI configuration details
      let model: string | undefined;
      let imageModel: string | undefined;
      let provider: string | undefined;
      if (agentData.aiConfiguration && config.aiConfigurations) {
        const aiConfig = config.aiConfigurations[agentData.aiConfiguration];
        if (aiConfig) {
          model = aiConfig.model;
          imageModel = aiConfig.imageModel;
          provider = aiConfig.provider;
        }
      }

      analyses.push({
        key,
        name: agentData.name,
        type: agentData.type,
        aiConfiguration: agentData.aiConfiguration,
        model,
        imageModel,
        provider,
        temperature: agentData.temperature,
        toolSource,
        availableTools,
        toolCount: availableTools.length,
        downstreamAgents: agentData.downstreamAgents || []
      });
    }

    return analyses;
  }

  /**
   * Determine where an agent's tools come from
   */
  private determineToolSource(
    agentData: ExperienceConfig['agents'][string],
    config: ExperienceConfig
  ): ToolConfigSource {
    // 1. Explicit availableTools (legacy)
    if (agentData.availableTools) {
      return {
        type: 'explicit',
        details: {
          explicitTools: agentData.availableTools
        }
      };
    }

    // 2. toolSets (configVersion 2+)
    if (agentData.toolSets && agentData.toolSets.length > 0) {
      const resolvedTools = expandToolSets(agentData.toolSets, config.toolSets);
      return {
        type: 'toolSets',
        details: {
          toolSetNames: agentData.toolSets,
          resolvedTools
        }
      };
    }

    // 3. toolGroups (legacy - agent level)
    if (agentData.toolGroups && agentData.toolGroups.length > 0) {
      return {
        type: 'toolGroups',
        details: {
          groupNames: agentData.toolGroups
        }
      };
    }

    // 4. plugins (legacy - experience level)
    if (config.tools?.plugins && config.tools.plugins.length > 0) {
      const groups = pluginNamesToGroups(config.tools.plugins);
      return {
        type: 'plugins',
        details: {
          pluginNames: config.tools.plugins,
          mappedGroups: groups
        }
      };
    }

    // 5. Fallback
    return {
      type: 'fallback',
      details: {
        fallbackReason: 'No tool configuration found - will use all registered tools'
      }
    };
  }

  /**
   * Compute the actual tools an agent will have at runtime
   */
  private computeAvailableTools(
    agentData: ExperienceConfig['agents'][string],
    config: ExperienceConfig
  ): string[] {
    // 1. Explicit availableTools
    if (agentData.availableTools) {
      return agentData.availableTools;
    }

    // 2. toolSets (configVersion 2+)
    if (agentData.toolSets && agentData.toolSets.length > 0) {
      return expandToolSets(agentData.toolSets, config.toolSets);
    }

    // 3. toolGroups (agent-level legacy)
    if (agentData.toolGroups && agentData.toolGroups.length > 0) {
      const toolNames = agentData.toolGroups.flatMap(group => 
        getToolNamesForGroup(group)
      );
      return [...new Set(toolNames)];
    }

    // 4. plugins (experience-level legacy)
    if (config.tools?.plugins && config.tools.plugins.length > 0) {
      const groups = pluginNamesToGroups(config.tools.plugins);
      const toolNames = groups.flatMap(group => getToolNamesForGroup(group));
      return [...new Set(toolNames)];
    }

    // 5. Fallback - would get all registered tools at runtime
    return ['(all registered tools)'];
  }

  /**
   * Validate the configuration
   */
  private validateConfig(config: ExperienceConfig): { isValid: boolean; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];

    // Check basic structure
    if (!config.title) {
      issues.push({
        severity: 'error',
        category: 'structure',
        message: 'Missing required field: title',
        path: 'title'
      });
    }

    if (!config.agents || Object.keys(config.agents).length === 0) {
      issues.push({
        severity: 'error',
        category: 'structure',
        message: 'No agents defined',
        path: 'agents'
      });
    }

    // Check for legacy configuration
    if (!config.configVersion || config.configVersion < 2) {
      issues.push({
        severity: 'info',
        category: 'configuration',
        message: 'Using legacy configuration format (configVersion 1)',
        suggestion: 'Consider upgrading to configVersion 2 for better tool management'
      });
    }

    // Check for missing AI configurations
    for (const [key, agent] of Object.entries(config.agents || {})) {
      if (agent.aiConfiguration && config.aiConfigurations) {
        if (!config.aiConfigurations[agent.aiConfiguration]) {
          issues.push({
            severity: 'error',
            category: 'references',
            message: `Agent '${key}' references undefined aiConfiguration '${agent.aiConfiguration}'`,
            path: `agents.${key}.aiConfiguration`
          });
        }
      }
    }

    // Check for downstream agent references
    for (const [key, agent] of Object.entries(config.agents || {})) {
      for (const downstreamKey of agent.downstreamAgents || []) {
        if (!config.agents[downstreamKey]) {
          issues.push({
            severity: 'error',
            category: 'references',
            message: `Agent '${key}' references undefined downstream agent '${downstreamKey}'`,
            path: `agents.${key}.downstreamAgents`
          });
        }
      }
    }

    // Check for toolSet references (configVersion 2+)
    if (config.configVersion && config.configVersion >= 2) {
      for (const [key, agent] of Object.entries(config.agents || {})) {
        if (agent.toolSets) {
          for (const toolSetName of agent.toolSets) {
            if (config.toolSets && !config.toolSets[toolSetName]) {
              issues.push({
                severity: 'warning',
                category: 'tools',
                message: `Agent '${key}' references undefined toolSet '${toolSetName}' (may be a preset)`,
                path: `agents.${key}.toolSets`
              });
            }
          }
        }
      }
    }

    const isValid = !issues.some(issue => issue.severity === 'error');

    return { isValid, issues };
  }

  // Tool mappings are now inline in groups.ts, no async loading needed

  /**
   * Analyze upgrade possibilities
   */
  private analyzeUpgrade(config: ExperienceConfig): {
    canUpgrade: boolean;
    currentVersion: number;
    targetVersion: number;
    changes: string[];
  } {
    const currentVersion = config.configVersion || 1;
    const targetVersion = 2;
    const canUpgrade = currentVersion < targetVersion;

    const changes: string[] = [];

    if (canUpgrade) {
      changes.push('Add configVersion: 2');
      
      if (config.tools?.plugins) {
        changes.push(`Convert ${config.tools.plugins.length} plugin(s) to toolSets`);
      }

      const agentCount = Object.keys(config.agents || {}).length;
      changes.push(`Add toolSets configuration to ${agentCount} agent(s)`);

      const backendCount = Object.values(config.agents || {}).filter(a => a.type === 'backend').length;
      if (backendCount > 0) {
        changes.push(`Create backend-default toolSet for ${backendCount} backend agent(s)`);
      }

      changes.push('Remove legacy tools.plugins configuration');
    }

    return {
      canUpgrade,
      currentVersion,
      targetVersion,
      changes
    };
  }
}
