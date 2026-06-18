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
import {
  expandToolSets,
  getKnownPluginNames,
  getPresetToolSetNames,
  getToolNamesForGroup,
  pluginNamesToGroups,
} from './tools/groups';

const KNOWN_PROVIDERS = ['openai', 'anthropic', 'google'] as const;

/**
 * Model name patterns whose APIs reject any custom `temperature` value
 * (only the model default — typically 1 — is accepted). Authors who set
 * `temperature` on an agent that resolves to one of these models will hit
 * a 400 from the provider at delegation time.
 *
 * Remove or relax entries here once the upstream API permits a value.
 */
const MODELS_REQUIRING_DEFAULT_TEMPERATURE: RegExp[] = [
  /^gpt-5/i,           // gpt-5, gpt-5-mini, gpt-5-nano, ...
  /^o[1-9](-|$)/i,     // o1, o1-mini, o3, o3-mini, o4-mini, ...
];

function modelRequiresDefaultTemperature(model: string | undefined): boolean {
  if (!model) return false;
  return MODELS_REQUIRING_DEFAULT_TEMPERATURE.some(re => re.test(model));
}

/**
 * Model name patterns whose APIs only accept image-generation requests and
 * cannot serve as an agent's chat brain. Wiring one of these to an agent's
 * `aiConfiguration` produces a 500 from the provider as soon as the agent
 * tries to take a turn. The image-generation tool itself uses these models
 * via dedicated strategies — that's a separate path and is fine.
 */
const IMAGE_ONLY_MODELS: RegExp[] = [
  /^gpt-image/i,       // gpt-image-1, gpt-image-2, ...
  /^dall-?e/i,         // dall-e-2, dall-e-3, dalle-3, ...
  /^imagen/i,          // imagen-2, imagen-3, ...
  /^nano-?banana/i,    // nano-banana, nano-banana-2, nanobanana-3-pro, ...
];

function modelIsImageOnly(model: string | undefined): boolean {
  if (!model) return false;
  return IMAGE_ONLY_MODELS.some(re => re.test(model));
}

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
      // expandToolSets throws on an unknown name; the toolSet existence check
      // in validateConfig already records that as a structured issue, so swallow
      // here to keep `analyze()` from blowing up before validation runs.
      let resolvedTools: string[] = [];
      try {
        resolvedTools = expandToolSets(agentData.toolSets, config.toolSets);
      } catch {
        // Intentional: surfaced via validateConfig instead.
      }
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
      try {
        return expandToolSets(agentData.toolSets, config.toolSets);
      } catch {
        return [];
      }
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

    // Validate aiConfigurations have required fields and known providers
    for (const [name, ai] of Object.entries(config.aiConfigurations || {})) {
      if (!ai.provider) {
        issues.push({
          severity: 'error',
          category: 'configuration',
          message: `aiConfiguration '${name}' is missing 'provider'`,
          path: `aiConfigurations.${name}.provider`
        });
      } else if (!KNOWN_PROVIDERS.includes(ai.provider as typeof KNOWN_PROVIDERS[number])) {
        issues.push({
          severity: 'error',
          category: 'configuration',
          message: `aiConfiguration '${name}' uses unknown provider '${ai.provider}'`,
          path: `aiConfigurations.${name}.provider`,
          suggestion: `Known providers: ${KNOWN_PROVIDERS.join(', ')}`
        });
      }
      if (!ai.model) {
        issues.push({
          severity: 'error',
          category: 'configuration',
          message: `aiConfiguration '${name}' is missing 'model'`,
          path: `aiConfigurations.${name}.model`
        });
      }
      // Cross-check provider against model prefix to catch e.g. provider:google + model:gpt-4o
      if (ai.provider && ai.model) {
        const providerHints: Record<string, RegExp> = {
          openai: /^(gpt-|o\d)/i,
          anthropic: /^claude-/i,
          google: /^(gemini-|imagen-)/i,
        };
        const hint = providerHints[ai.provider];
        if (hint && !hint.test(ai.model)) {
          issues.push({
            severity: 'warning',
            category: 'configuration',
            message: `aiConfiguration '${name}' provider '${ai.provider}' does not match model name '${ai.model}'`,
            path: `aiConfigurations.${name}.model`,
            suggestion: `Models for '${ai.provider}' typically start with ${hint.source}`
          });
        }
      }
    }

    // Check for missing AI configurations
    for (const [key, agent] of Object.entries(config.agents || {})) {
      if (agent.aiConfiguration) {
        if (!config.aiConfigurations || !config.aiConfigurations[agent.aiConfiguration]) {
          issues.push({
            severity: 'error',
            category: 'references',
            message: `Agent '${key}' references undefined aiConfiguration '${agent.aiConfiguration}'`,
            path: `agents.${key}.aiConfiguration`
          });
        }
      } else {
        // No aiConfiguration set: a 'default' must exist in aiConfigurations
        if (!config.aiConfigurations || !config.aiConfigurations['default']) {
          issues.push({
            severity: 'warning',
            category: 'configuration',
            message: `Agent '${key}' has no aiConfiguration and no 'default' is defined`,
            path: `agents.${key}.aiConfiguration`,
            suggestion: `Set agents.${key}.aiConfiguration or add a 'default' to aiConfigurations`
          });
        }
      }
    }

    // Check temperature compatibility: gpt-5 and o-series only accept the
    // model default. A custom `temperature` on an agent resolving to one of
    // those models will 400 at the provider.
    for (const [key, agent] of Object.entries(config.agents || {})) {
      if (agent.temperature === undefined) continue;
      const aiConfig =
        agent.aiConfiguration && config.aiConfigurations
          ? config.aiConfigurations[agent.aiConfiguration]
          : undefined;
      const model = aiConfig?.model;
      if (modelRequiresDefaultTemperature(model)) {
        issues.push({
          severity: 'error',
          category: 'configuration',
          message: `Agent '${key}' sets temperature ${agent.temperature} but model '${model}' only accepts the default temperature (1). The provider will reject this with a 400.`,
          path: `agents.${key}.temperature`,
          suggestion: `Remove the 'temperature' field from agent '${key}', or switch this agent's aiConfiguration to a model that supports custom temperatures.`,
        });
      }
    }

    // Check that no agent's aiConfiguration uses an image-only model as its
    // chat brain (e.g., gpt-image-2, dall-e-3, imagen-3, nano-banana). The
    // image-generation tool uses these via dedicated strategies; agents
    // cannot.
    for (const [key, agent] of Object.entries(config.agents || {})) {
      const aiConfigName = agent.aiConfiguration;
      if (!aiConfigName) continue;
      const aiConfig = config.aiConfigurations?.[aiConfigName];
      const model = aiConfig?.model;
      if (modelIsImageOnly(model)) {
        issues.push({
          severity: 'error',
          category: 'configuration',
          message: `Agent '${key}' uses aiConfiguration '${aiConfigName}' whose model '${model}' is image-only and cannot serve as a chat brain. The provider will reject the agent's first turn.`,
          path: `aiConfigurations.${aiConfigName}.model`,
          suggestion: `Switch '${aiConfigName}' to a chat-capable model (e.g., gpt-5, gpt-4o, claude-opus-4-6). Image generation runs through the image tool, not the agent's chat model.`,
        });
      }
    }

    // Check that every agent has an instruction file mapped, and vice versa
    const agentKeys = Object.keys(config.agents || {});
    const instructionMap = config.resources?.instructions?.agent || {};
    const instructionKeys = Object.keys(instructionMap);
    for (const key of agentKeys) {
      if (!instructionMap[key]) {
        issues.push({
          severity: 'error',
          category: 'references',
          message: `Agent '${key}' has no instruction file in resources.instructions.agent`,
          path: `resources.instructions.agent.${key}`
        });
      }
    }
    for (const key of instructionKeys) {
      if (!config.agents?.[key]) {
        issues.push({
          severity: 'warning',
          category: 'references',
          message: `Instruction file for '${key}' has no matching agent`,
          path: `resources.instructions.agent.${key}`
        });
      }
    }

    // Validate initialAgent
    if (config.initialAgent && !config.agents?.[config.initialAgent]) {
      issues.push({
        severity: 'error',
        category: 'references',
        message: `initialAgent '${config.initialAgent}' is not a defined agent`,
        path: 'initialAgent'
      });
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

    // Validate plugin names against the known plugin registry
    if (config.tools?.plugins?.length) {
      const known = new Set(getKnownPluginNames());
      for (const pluginName of config.tools.plugins) {
        if (!known.has(pluginName)) {
          issues.push({
            severity: 'error',
            category: 'tools',
            message: `Unknown plugin '${pluginName}' in tools.plugins`,
            path: 'tools.plugins',
            suggestion: `Known plugins: ${[...known].join(', ')}`
          });
        }
      }
    }

    // Validate artifact references and tag/agents consistency
    for (const artifact of config.resources?.artifacts || []) {
      const path_ = `resources.artifacts[${artifact.name}]`;
      for (const agentKey of artifact.agents || []) {
        if (!config.agents?.[agentKey]) {
          issues.push({
            severity: 'error',
            category: 'references',
            message: `Artifact '${artifact.name}' references undefined agent '${agentKey}'`,
            path: `${path_}.agents`
          });
        }
      }
      const privateTag = artifact.metadata?.tags?.find(t => t.startsWith('private:'));
      if (privateTag && artifact.agents?.length) {
        const owner = privateTag.slice('private:'.length);
        if (!artifact.agents.includes(owner)) {
          issues.push({
            severity: 'warning',
            category: 'configuration',
            message: `Artifact '${artifact.name}' has tag '${privateTag}' but '${owner}' is not in its agents list`,
            path: `${path_}.metadata.tags`,
            suggestion: `Either add '${owner}' to agents or update the tag to a key that is in agents`
          });
        }
      }
    }

    // Check for toolSet references (configVersion 2+)
    if (config.configVersion && config.configVersion >= 2) {
      const presets = new Set(getPresetToolSetNames());
      const customSets = new Set(Object.keys(config.toolSets || {}));
      for (const [key, agent] of Object.entries(config.agents || {})) {
        if (agent.toolSets) {
          for (const toolSetName of agent.toolSets) {
            if (!presets.has(toolSetName) && !customSets.has(toolSetName)) {
              issues.push({
                severity: 'error',
                category: 'tools',
                message: `Agent '${key}' references undefined toolSet '${toolSetName}'`,
                path: `agents.${key}.toolSets`,
                suggestion: `Available presets: ${[...presets].join(', ')}${
                  customSets.size > 0
                    ? `; custom sets in this config: ${[...customSets].join(', ')}`
                    : ''
                }`
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
