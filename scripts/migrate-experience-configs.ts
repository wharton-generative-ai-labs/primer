#!/usr/bin/env tsx
/**
 * Experience Configuration Migration Script
 * 
 * Migrates experience.json files from configVersion 1 (legacy plugins format)
 * to configVersion 2 (new toolSets format).
 * 
 * Usage:
 *   npm run migrate:configs [-- --dry-run] [-- --storage-path <path>]
 * 
 * Options:
 *   --dry-run       Preview changes without writing files
 *   --storage-path  Root storage path to search (defaults to ./storage)
 */

import fs from 'fs';
import path from 'path';
import { ExperienceConfig, ToolMappingsConfig } from '../src/app/lib/types';

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  files: {
    path: string;
    status: 'migrated' | 'skipped' | 'error';
    reason?: string;
  }[];
}

const stats: MigrationStats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  errors: 0,
  files: []
};

/**
 * Load tool mappings configuration
 * Always loads from the root storage/config directory
 */
function loadToolMappings(): ToolMappingsConfig {
  // Always use ./storage/config for the tool mappings, regardless of search path
  const configPath = path.resolve('./storage/config/tool-mappings.json');
  
  if (!fs.existsSync(configPath)) {
    console.error(`❌ tool-mappings.json not found at: ${configPath}`);
    console.error(`   Make sure you're running this script from the project root.`);
    process.exit(1);
  }

  const configData = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configData) as ToolMappingsConfig;
}

/**
 * Recursively find all experience.json files
 */
function findExperienceFiles(dir: string): string[] {
  const results: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      results.push(...findExperienceFiles(fullPath));
    } else if (entry.isFile() && entry.name === 'experience.json') {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Convert legacy plugins to toolSets
 */
function convertPluginsToToolSets(
  plugins: string[],
  mappings: ToolMappingsConfig
): { toolSets: Record<string, string[]>; agentToolSets: string[] } {
  // Convert plugins to groups
  const groups = new Set<string>();
  for (const plugin of plugins) {
    const group = mappings.pluginToGroup[plugin];
    if (group) {
      groups.add(group);
    } else {
      console.warn(`  ⚠️  Unknown plugin: ${plugin}`);
    }
  }

  // Collect all unique tool names from these groups
  const allToolNames = new Set<string>();
  for (const group of groups) {
    const tools = mappings.groupToTools[group];
    if (tools) {
      tools.forEach(tool => allToolNames.add(tool));
    }
  }

  // Create a toolSet with these tools
  const toolSets: Record<string, string[]> = {
    'default': Array.from(allToolNames).sort()
  };

  return {
    toolSets,
    agentToolSets: ['default']
  };
}

/**
 * Migrate a single experience.json file
 */
function migrateExperience(
  filePath: string,
  mappings: ToolMappingsConfig,
  dryRun: boolean
): void {
  stats.total++;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content) as ExperienceConfig;

    // Check if already migrated
    if (config.configVersion && config.configVersion >= 2) {
      console.log(`⏭️  Skipping (already migrated): ${filePath}`);
      stats.skipped++;
      stats.files.push({ path: filePath, status: 'skipped', reason: 'Already configVersion 2+' });
      return;
    }

    // Check if has legacy plugins
    if (!config.tools?.plugins || config.tools.plugins.length === 0) {
      console.log(`⏭️  Skipping (no plugins to migrate): ${filePath}`);
      stats.skipped++;
      stats.files.push({ path: filePath, status: 'skipped', reason: 'No plugins defined' });
      return;
    }

    console.log(`\n🔄 Migrating: ${filePath}`);
    console.log(`   Plugins: ${config.tools.plugins.join(', ')}`);

    // Convert plugins to toolSets
    const { toolSets, agentToolSets } = convertPluginsToToolSets(config.tools.plugins, mappings);
    
    console.log(`   Created toolSet 'default' with ${toolSets.default.length} tools`);

    // Create backend-specific toolSet if there are backend agents
    const hasBackendAgents = Object.values(config.agents).some(agent => agent.type === 'backend');
    if (hasBackendAgents) {
      const backendTools = mappings.presetToolSets['backend-default'];
      if (backendTools) {
        toolSets['backend-default'] = backendTools;
        console.log(`   Created toolSet 'backend-default' with ${backendTools.length} tools`);
      }
    }

    // Update the config
    const migratedConfig: ExperienceConfig = {
      ...config,
      configVersion: 2,
      toolSets,
      agents: Object.fromEntries(
        Object.entries(config.agents).map(([key, agent]) => {
          // Determine which toolSets to use for this agent
          let toolSetsForAgent: string[];
          
          if (agent.type === 'backend') {
            toolSetsForAgent = ['backend-default'];
          } else {
            toolSetsForAgent = agentToolSets;
          }

          return [
            key,
            {
              ...agent,
              toolSets: toolSetsForAgent,
              // Remove deprecated fields
              toolGroups: undefined,
              availableTools: undefined
            }
          ];
        })
      )
    };

    // Remove the legacy tools.plugins
    delete migratedConfig.tools?.plugins;
    if (migratedConfig.tools && Object.keys(migratedConfig.tools).length === 0) {
      delete migratedConfig.tools;
    }

    // Write the migrated config
    if (dryRun) {
      console.log(`   ✅ Would migrate (dry-run mode)`);
      console.log(`   Preview of changes:`);
      console.log(`     - Added configVersion: 2`);
      console.log(`     - Added toolSets: ${Object.keys(toolSets).join(', ')}`);
      Object.entries(migratedConfig.agents).forEach(([key, agent]) => {
        console.log(`     - Agent '${key}': toolSets = [${agent.toolSets?.join(', ')}]`);
      });
    } else {
      const prettyJson = JSON.stringify(migratedConfig, null, 2);
      fs.writeFileSync(filePath, prettyJson + '\n', 'utf-8');
      console.log(`   ✅ Migrated successfully`);
    }

    stats.migrated++;
    stats.files.push({ path: filePath, status: 'migrated' });

  } catch (error) {
    console.error(`❌ Error migrating ${filePath}:`, error);
    stats.errors++;
    stats.files.push({ 
      path: filePath, 
      status: 'error', 
      reason: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * Main migration function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  const storagePathIndex = args.indexOf('--storage-path');
  const storageRoot = storagePathIndex >= 0 && args[storagePathIndex + 1]
    ? path.resolve(args[storagePathIndex + 1])
    : path.resolve('./storage');

  console.log('🚀 Experience Configuration Migration Tool');
  console.log('==========================================\n');
  console.log(`Storage root: ${storageRoot}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (files will be modified)'}\n`);

  // Load tool mappings
  console.log('📖 Loading tool mappings...');
  const mappings = loadToolMappings();
  console.log(`   Loaded mappings version ${mappings.version}\n`);

  // Find all experience.json files
  console.log('🔍 Searching for experience.json files...');
  const experienceFiles = findExperienceFiles(storageRoot);
  console.log(`   Found ${experienceFiles.length} experience.json file(s)\n`);

  if (experienceFiles.length === 0) {
    console.log('No experience files found. Exiting.');
    return;
  }

  // Migrate each file
  for (const filePath of experienceFiles) {
    migrateExperience(filePath, mappings, dryRun);
  }

  // Print summary
  console.log('\n\n📊 Migration Summary');
  console.log('===================');
  console.log(`Total files found:    ${stats.total}`);
  console.log(`✅ Migrated:          ${stats.migrated}`);
  console.log(`⏭️  Skipped:           ${stats.skipped}`);
  console.log(`❌ Errors:            ${stats.errors}`);

  if (dryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
  }

  if (stats.errors > 0) {
    console.log('\n⚠️  Some files had errors. Please review the output above.');
    process.exit(1);
  }

  console.log('\n✨ Migration complete!');
}

// Run the migration
main();
