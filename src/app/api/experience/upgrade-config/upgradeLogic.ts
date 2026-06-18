/**
 * Shared upgrade logic for experience.json configurations
 * Can be used by both the API endpoint and migration scripts
 */

import { ExperienceConfig } from '@/app/lib/types';
import { pluginNamesToGroups, getToolNamesForGroup, getPresetToolSet } from '@/app/lib/tools/groups';

export function upgradeConfig(config: ExperienceConfig): ExperienceConfig {
  const currentVersion = config.configVersion || 1;

  if (currentVersion >= 2) {
    return config; // Already upgraded
  }

  // Create a deep copy to avoid mutating the original
  const upgraded: ExperienceConfig = JSON.parse(JSON.stringify(config));

  // Set the new config version
  upgraded.configVersion = 2;

  // Initialize toolSets if not already present
  if (!upgraded.toolSets) {
    upgraded.toolSets = {};
  }

  // Convert legacy plugins to toolSets if they exist
  if (config.tools?.plugins && Array.isArray(config.tools.plugins)) {
    const pluginNames = config.tools.plugins;
    
    // Step 1: Convert plugin names to group names (deduplicates automatically)
    const groupNames = pluginNamesToGroups(pluginNames);
    
    // Step 2: For each group, get its tools and collect all unique tools
    const allTools = new Set<string>();
    groupNames.forEach(groupName => {
      const tools = getToolNamesForGroup(groupName);
      if (tools && tools.length > 0) {
        tools.forEach(tool => allTools.add(tool));
      }
    });
    
    // Step 3: Create a "default" toolSet with all the tools from the legacy plugins
    // This preserves the specific tool configuration from the legacy setup
    if (allTools.size > 0) {
      upgraded.toolSets['default'] = Array.from(allTools).sort();
    }
  }
  
  // Always include the backend-default preset for backend agents
  const backendDefault = getPresetToolSet('backend-default');
  if (backendDefault && backendDefault.length > 0) {
    upgraded.toolSets['backend-default'] = backendDefault;
  }

  // If no 'default' toolSet was created from plugins, create one from frontend-default preset
  if (!upgraded.toolSets['default']) {
    const frontendDefault = getPresetToolSet('frontend-default');
    if (frontendDefault && frontendDefault.length > 0) {
      upgraded.toolSets['default'] = frontendDefault;
    }
  }

  // Process agents
  if (upgraded.agents) {
    Object.entries(upgraded.agents).forEach(([agentKey, agent]) => {
      // If agent has toolGroups, convert them to a custom toolSet
      if (agent.toolGroups && Array.isArray(agent.toolGroups) && agent.toolGroups.length > 0) {
        // Collect all tools from the agent's toolGroups
        const agentTools = new Set<string>();
        agent.toolGroups.forEach(groupName => {
          const tools = getToolNamesForGroup(groupName);
          if (tools && tools.length > 0) {
            tools.forEach(tool => agentTools.add(tool));
          }
        });
        
        // Create a custom toolSet for this agent with its specific tools
        if (agentTools.size > 0) {
          const toolSetName = `${agentKey}-tools`;
          if (!upgraded.toolSets) {
            upgraded.toolSets = {};
          }
          upgraded.toolSets[toolSetName] = Array.from(agentTools).sort();
          agent.toolSets = [toolSetName];
        }
      } else {
        // No agent-level toolGroups, determine toolSet based on agent type
        const agentType = agent.type;
        
        if (agentType === 'backend') {
          // Backend agents get the backend-default preset
          agent.toolSets = ['backend-default'];
        } else {
          // Frontend agents get the "default" toolSet which contains
          // the tools from the legacy plugins configuration
          agent.toolSets = ['default'];
        }
      }

      // Remove deprecated fields
      delete agent.toolGroups;
      delete agent.availableTools;
    });
  }

  // Remove the legacy tools.plugins array
  if (upgraded.tools) {
    delete upgraded.tools.plugins;
    // If tools object is now empty, remove it entirely
    if (Object.keys(upgraded.tools).length === 0) {
      delete upgraded.tools;
    }
  }

  return upgraded;
}
