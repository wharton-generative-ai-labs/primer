/**
 * Tool Groups and ToolSets
 * 
 * Primary API (v2 experience format):
 * - expandToolSets() - expand toolSet names to tool names
 * - getToolsForNames() - get Tool objects from registry for tool names
 * - getPresetToolSet() - get a preset toolSet by name
 * 
 * Legacy API (v1 experience format - kept for upgrade support):
 * - pluginNamesToGroups() - convert plugin names to groups
 * - getToolNamesForGroup() - get tool names for a group
 */

import { Tool } from '@/app/lib/types';
import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('tool-groups');

// ============================================================================
// PRESET TOOL SETS (v2 format)
// ============================================================================

/**
 * Preset toolSets that can be referenced by name in experience configs.
 * Experiences can also define custom toolSets that override or extend these.
 */
const PRESET_TOOL_SETS: Record<string, string[]> = {
  'default': [
    'scene', 'information', 'file', 'artifact', 'checklist', 'agent', 'toast',
    'observe', 'present', 'slide', 'celebrate', 'note', 'diagram',
    'sound', 'research', 'customComponent', 'sessionEvent'
  ],
  'frontend-default': [
    'scene', 'information', 'file', 'artifact', 'checklist', 'agent', 'toast',
    'observe', 'present', 'slide', 'celebrate', 'note', 'diagram',
    'sound', 'research', 'customComponent', 'sessionEvent'
  ],
  'backend-default': [
    'scene', 'information', 'file', 'artifact', 'checklist', 'agent', 'toast',
    'observe', 'present', 'slide',
    // Experience management
    'createExperience', 'copyTemplate', 'createDirectory', 'createFile',
    'deleteDirectory', 'deleteFile', 'moveFile', 'moveDirectory',
    'listResources', 'getResourceContent', 'deployArtifact',
    'validateComponent', 'generateComponentStyles',
    'getTemplateAgentInstructions', 'listTemplateExperiences',
    // Matter compiler
    'modifyExperience', 'modifyAgent', 'modifyScene', 'getExperience',
    'createAgentPrompt', 'createSupplementalFile', 'addSound',
    'listAgentPrompts', 'getAgentPrompt', 'listSupplementalFiles', 'getSupplementalFile',
    // Image generation
    'generateImages'
  ],
  'minimal': ['scene', 'information', 'toast']
};

// ============================================================================
// PRIMARY API (v2 format)
// ============================================================================

/**
 * Get a preset toolSet by name.
 */
export function getPresetToolSet(toolSetName: string): string[] | undefined {
  return PRESET_TOOL_SETS[toolSetName];
}

/**
 * Get all preset toolSet names.
 */
export function getPresetToolSetNames(): string[] {
  return Object.keys(PRESET_TOOL_SETS);
}

/**
 * Expand toolSet names to tool names.
 * Supports both preset toolSets and custom toolSets from experience config.
 * 
 * @param toolSetNames - Array of toolSet names to expand
 * @param customToolSets - Custom toolSets defined in the experience config
 * @returns Deduplicated array of tool names
 */
export function expandToolSets(
  toolSetNames: string[],
  customToolSets?: Record<string, string[]>
): string[] {
  const allToolNames: string[] = [];
  const notFoundToolSets: string[] = [];

  for (const toolSetName of toolSetNames) {
    // Check custom toolSets first (they can override presets)
    if (customToolSets && customToolSets[toolSetName]) {
      allToolNames.push(...customToolSets[toolSetName]);
    }
    // Then check preset toolSets
    else if (PRESET_TOOL_SETS[toolSetName]) {
      allToolNames.push(...PRESET_TOOL_SETS[toolSetName]);
    }
    // Track not found toolSets
    else {
      notFoundToolSets.push(toolSetName);
      logger.warn({ 
        toolSetName,
        availablePresets: Object.keys(PRESET_TOOL_SETS),
        availableCustom: Object.keys(customToolSets || {})
      }, 'ToolSet not found');
    }
  }

  // If any toolSets were not found, provide a helpful error
  if (notFoundToolSets.length > 0) {
    const availablePresets = Object.keys(PRESET_TOOL_SETS);
    const availableCustom = Object.keys(customToolSets || {});
    
    throw new Error(
      `ToolSet(s) not found: ${notFoundToolSets.join(', ')}\n\n` +
      `Available preset toolSets:\n  - ${availablePresets.join('\n  - ')}\n\n` +
      (availableCustom.length > 0 
        ? `Available custom toolSets:\n  - ${availableCustom.join('\n  - ')}\n\n`
        : '') +
      'Check the toolSet names in your agent configuration.'
    );
  }

  // Deduplicate
  return [...new Set(allToolNames)];
}

/**
 * Get Tool definitions for specific tool names using the ToolRegistry.
 * 
 * @param toolNames - Array of tool names
 * @returns Array of Tool definitions from the registry (deduplicated, nulls filtered)
 */
export function getToolsForNames(toolNames: string[]): Tool[] {
  const registry = ToolRegistry.getInstance();
  const uniqueToolNames = [...new Set(toolNames)];
  
  return uniqueToolNames
    .map(name => registry.getTool(name))
    .filter((tool): tool is Tool => tool !== null);
}

// ============================================================================
// LEGACY API (v1 format - kept for upgrade support)
// ============================================================================

/**
 * Maps v1 plugin names to group names.
 * @deprecated Only used for upgrading v1 configs to v2
 */
const PLUGIN_TO_GROUP: Record<string, string> = {
  '@primer/builtin-plugin': 'builtin',
  '@primer/celebrate-plugin': 'celebrate',
  '@primer/delegation-plugin': 'delegation',
  '@primer/slide-plugin': 'builtin',
  '@primer/notes-plugin': 'notes',
  '@primer/mermaid-plugin': 'mermaid',
  '@primer/sound-plugin': 'sound',
  '@primer/web-search-plugin': 'web-search',
  '@primer/experience-plugin': 'experience',
  '@primer/matter-compiler-plugin': 'matter-compiler',
  '@primer/image-generator-plugin': 'image-generator',
  '@primer/analytics-plugin': 'analytics',
  '@primer/session-plugin': 'session',
  '@primer/custom-component-plugin': 'custom-component'
};

/**
 * Maps v1 group names to tool arrays.
 * @deprecated Only used for upgrading v1 configs to v2
 */
const GROUP_TO_TOOLS: Record<string, string[]> = {
  'builtin': ['scene', 'information', 'file', 'artifact', 'checklist', 'agent', 'toast', 'observe', 'present', 'slide', 'note'],
  'celebrate': ['celebrate'],
  'delegation': [],
  'notes': ['note'],
  'mermaid': ['diagram'],
  'sound': ['sound'],
  'web-search': ['research'],
  'custom-component': ['customComponent'],
  'experience': [
    'createExperience', 'copyTemplate', 'createDirectory', 'createFile',
    'deleteDirectory', 'deleteFile', 'moveFile', 'moveDirectory',
    'listResources', 'getResourceContent', 'deployArtifact',
    'validateComponent', 'generateComponentStyles',
    'getTemplateAgentInstructions', 'listTemplateExperiences'
  ],
  'matter-compiler': [
    'modifyExperience', 'modifyAgent', 'modifyScene', 'getExperience',
    'createAgentPrompt', 'createSupplementalFile', 'addSound',
    'listAgentPrompts', 'getAgentPrompt', 'listSupplementalFiles', 'getSupplementalFile'
  ],
  'image-generator': ['generateImages'],
  'analytics': [
    'listClassSessions', 'readSessionFile', 'writeSessionFile',
    'listSessionFiles', 'readClassData', 'writeClassData', 'batchReadSessionFiles'
  ],
  'session': ['sessionEvent']
};

/**
 * Convert v1 plugin names to group names.
 * @deprecated Only used for upgrading v1 configs to v2
 */
export function pluginNamesToGroups(pluginNames: string[]): string[] {
  const groups = pluginNames
    .map(name => PLUGIN_TO_GROUP[name])
    .filter((group): group is string => group !== undefined);
  
  return [...new Set(groups)];
}

/**
 * Get tool names for a v1 group.
 * @deprecated Only used for upgrading v1 configs to v2
 */
export function getToolNamesForGroup(groupName: string): string[] {
  return GROUP_TO_TOOLS[groupName] || [];
}

/**
 * Get all v1 group names.
 * @deprecated Only used for upgrading v1 configs to v2
 */
export function getAllGroups(): string[] {
  return Object.keys(GROUP_TO_TOOLS);
}

/**
 * Get Tool definitions for v1 groups.
 * @deprecated Only used for upgrading v1 configs to v2
 */
export function getToolsForGroups(groupNames: string[]): Tool[] {
  const toolNames = groupNames.flatMap(group => GROUP_TO_TOOLS[group] || []);
  return getToolsForNames(toolNames);
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// These proxy objects maintain the old API while using the new internal structure
// ============================================================================

/**
 * @deprecated Use getPresetToolSet() or expandToolSets() instead
 */
export const PLUGIN_NAME_TO_GROUP: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    return PLUGIN_TO_GROUP[prop];
  },
  ownKeys() {
    return Object.keys(PLUGIN_TO_GROUP);
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (prop in PLUGIN_TO_GROUP) {
      return { enumerable: true, configurable: true };
    }
    return undefined;
  }
});

/**
 * @deprecated Use getPresetToolSet() or expandToolSets() instead
 */
export const TOOL_GROUPS: Record<string, string[]> = new Proxy({} as Record<string, string[]>, {
  get(_target, prop: string) {
    return GROUP_TO_TOOLS[prop];
  },
  ownKeys() {
    return Object.keys(GROUP_TO_TOOLS);
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (prop in GROUP_TO_TOOLS) {
      return { enumerable: true, configurable: true };
    }
    return undefined;
  }
});

// ============================================================================
// REMOVED: External config file loading
// The tool-mappings.json approach was over-engineered. All mappings are now
// inline in this file. If custom toolSets are needed, define them in the
// experience.json config directly.
// ============================================================================
