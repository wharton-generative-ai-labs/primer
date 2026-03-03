/**
 * ToolProcessor
 * 
 * Handles processing and registration of tools from experience configuration.
 * Manages plugin loading and tool definition population.
 */

import { ExperienceConfig, ToolDefinition } from '../types';
import { ToolRegistry } from '../ToolRegistry';
import { pluginNamesToGroups } from '../tools/groups';
import { ValidationManager } from './ValidationManager';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ToolProcessor');

export class ToolProcessor {
    private toolDefinitions: Record<string, ToolDefinition> = {};
    private toolRegistry: ToolRegistry;
    private validationManager: ValidationManager;

    constructor(validationManager: ValidationManager) {
        this.toolRegistry = ToolRegistry.getInstance();
        this.validationManager = validationManager;
    }

    /**
     * Get the tool definitions that have been loaded
     */
    getToolDefinitions(): Record<string, ToolDefinition> {
        return this.toolDefinitions;
    }

    /**
     * Process tools from the experience configuration
     * Supports both legacy (configVersion 1) and new (configVersion 2+) formats
     */
    async processTools(experienceConfig: ExperienceConfig): Promise<void> {
        const configVersion = experienceConfig.configVersion || 1;

        // Handle new format (configVersion 2+)
        if (configVersion >= 2) {
            logger.debug({ configVersion }, 'Processing tools using new toolSets format');
            // For configVersion 2+, we need to register all tools that might be used
            // by collecting unique tool names from all toolSets and determining which groups they belong to
            await this.processToolSetsFormat(experienceConfig);
            return;
        }

        // Handle legacy format (configVersion 1)
        logger.warn({ configVersion }, 'Processing tools using LEGACY plugins format. Consider migrating to configVersion 2.');

        if (!experienceConfig.tools) {
            logger.debug('No tools defined in experience config');
            return;
        }

        // Load plugins using centralized registration
        if (experienceConfig.tools.plugins) {
            logger.debug({ plugins: experienceConfig.tools.plugins }, 'Processing plugins');

            // Convert plugin names to groups
            const groups = pluginNamesToGroups(experienceConfig.tools.plugins);
            logger.debug({ groups }, 'Plugin groups');
            
            for (const pluginName of experienceConfig.tools.plugins) {
                await this.processPlugin(pluginName);
            }
        }
        
        logger.debug({ toolCount: Object.keys(this.toolDefinitions).length }, 'Final tool definitions');
    }

    /**
     * Process tools for configVersion 2+ format (toolSets)
     * Registers all tool groups that are referenced in the toolSets
     */
    private async processToolSetsFormat(experienceConfig: ExperienceConfig): Promise<void> {
        // Collect all unique tool names from all toolSets (both custom and agent-referenced)
        const allToolNames = new Set<string>();
        
        // Add tools from custom toolSets defined in the experience
        if (experienceConfig.toolSets) {
            try {
                Object.entries(experienceConfig.toolSets).forEach(([toolSetName, tools]) => {
                    if (!Array.isArray(tools)) {
                        throw new Error(
                            `Invalid toolSet "${toolSetName}": expected an array of tool names, ` +
                            `but got ${typeof tools}`
                        );
                    }
                    tools.forEach(tool => {
                        if (typeof tool !== 'string') {
                            throw new Error(
                                `Invalid tool name in toolSet "${toolSetName}": expected a string, ` +
                                `but got ${typeof tool}`
                            );
                        }
                        allToolNames.add(tool);
                    });
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(
                    `Error processing toolSets in experience configuration.\n` +
                    `Available toolSets: ${JSON.stringify(Object.keys(experienceConfig.toolSets || {}))}\n` +
                    `Error: ${errorMessage}`
                );
            }
        }
        
        // We need to determine which groups to register based on the tools
        // For now, let's register all common groups that are typically used
        // This is a pragmatic approach - we register the standard set of tool groups
        const groupsToRegister = [
            'builtin',      // Core tools (scene, information, file, etc.)
            'celebrate',    // Celebration effects
            'slide',        // Slide/presentation tools
            'sound',        // Sound tools
            'web-search',   // Research tools
            // 'delegation' is now handled as an action within the 'agent' builtin tool
            'session',      // Session events
            'custom-component' // Custom UI components
        ];
        
        logger.debug({ groupsToRegister, toolCount: allToolNames.size }, 'Registering tool groups for configVersion 2');
        
        for (const groupName of groupsToRegister) {
            try {
                const registrationFn = await this.getPluginRegistrationFunction(groupName);
                if (registrationFn) {
                    await registrationFn();
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error({ groupName, error: errorMessage }, 'Failed to register tool group');
                throw new Error(
                    `Failed to register tool group "${groupName}".\n` +
                    `Error: ${errorMessage}`
                );
            }
        }
        
        this.populateToolDefinitionsFromRegistry();
        logger.debug({ toolCount: Object.keys(this.toolDefinitions).length }, 'Registered tools for configVersion 2');
    }

    /**
     * Process a single plugin
     */
    private async processPlugin(pluginName: string): Promise<void> {
        try {
            const groupName = pluginName.split('/')[1].replace('-plugin', '');
            const registrationFn = await this.getPluginRegistrationFunction(groupName);
            
            if (registrationFn) {
                logger.debug({ pluginName, groupName }, 'Registering centralized tools');
                await registrationFn();
                
                // Get the registered tools from ToolRegistry to populate toolDefinitions
                this.populateToolDefinitionsFromRegistry();
                
                logger.debug({ pluginName }, 'Successfully registered centralized tools');
            } else {
                this.handleMissingPlugin(pluginName, groupName);
            }
        } catch (error) {
            this.handlePluginError(pluginName, error);
        }
    }

    /**
     * Get the registration function for a plugin
     */
    private async getPluginRegistrationFunction(
        groupName: string
    ): Promise<(() => Promise<void>) | null> {
        // Map of centralized tool registration functions
        const centralizedRegistration: Record<string, () => Promise<void>> = {
            'builtin': async () => {
                // Use client-safe registration on client, full registration on server
                if (typeof window === 'undefined') {
                    // Server-side: register all tools including server-only ones
                    const { registerBuiltinTools } = await import('../tools/builtin/register');
                    return registerBuiltinTools();
                } else {
                    // Client-side: register only client-safe tools
                    const { registerClientBuiltinTools } = await import('../tools/builtin/register-client');
                    return registerClientBuiltinTools();
                }
            },
            'celebrate': async () => {
                const { registerCelebrateTools } = await import('../tools/ui');
                return registerCelebrateTools();
            },
            'slide': async () => {
                const { registerSlideTools } = await import('../tools/ui');
                return registerSlideTools();
            },
            'notes': async () => {
                // Note tool is now backend-first - registerNotesTools handles stub registration
                const { registerNotesTools } = await import('../tools/ui');
                return registerNotesTools();
            },
            'mermaid': async () => {
                const { registerMermaidTools } = await import('../tools/ui');
                return registerMermaidTools();
            },
            'sound': async () => {
                const { registerSoundTools } = await import('../tools/sound');
                return registerSoundTools();
            },
            'web-search': async () => {
                const { registerWebSearchTools } = await import('../tools/research');
                return registerWebSearchTools();
            },
            'experience': async () => {
                const { registerExperienceTools } = await import('../tools/experience');
                return registerExperienceTools();
            },
            'matter-compiler': async () => {
                const { registerMatterCompilerTools } = await import('../tools/matter-compiler');
                return registerMatterCompilerTools();
            },
            'delegation': async () => {
                const { registerDelegationTools } = await import('../tools/delegation');
                return registerDelegationTools();
            },
            'image-generator': async () => {
                const { registerImageGeneratorTools } = await import('../tools/image-generator');
                return registerImageGeneratorTools();
            },
            'session': async () => {
                const { registerSessionTools } = await import('../tools/session');
                return registerSessionTools();
            },
            'custom-component': async () => {
                const { registerCustomComponentTools } = await import('../tools/ui');
                return registerCustomComponentTools();
            },
        };

        return centralizedRegistration[groupName] || null;
    }

    /**
     * Populate tool definitions from the ToolRegistry
     */
    private populateToolDefinitionsFromRegistry(): void {
        const allTools = this.toolRegistry.getAllTools();
        allTools.forEach(tool => {
            this.toolDefinitions[tool.name] = {
                id: tool.name,
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            };
        });
    }

    /**
     * Handle a missing plugin
     */
    private handleMissingPlugin(pluginName: string, groupName: string): void {
        logger.warn({ 
            pluginName, 
            groupName,
            availablePlugins: [
                'builtin', 'celebrate', 'slide', 'notes', 'mermaid',
                'sound', 'web-search', 'experience', 'matter-compiler',
                'delegation', 'image-generator', 'session'
            ]
        }, 'Plugin not found in centralized registration - SKIPPING');
        
        this.validationManager.addStatus({
            friendlyName: "Plugins",
            path: 'tools.plugins',
            objectPath: `tools.plugins[${pluginName}]`,
            status: 'MISSING',
            statusDetail: `Plugin ${pluginName} has not been migrated to centralized tools yet`
        });
    }

    /**
     * Handle a plugin loading error
     */
    private handlePluginError(pluginName: string, error: unknown): void {
        logger.error({ err: error, pluginName }, 'Failed to load plugin');
        this.validationManager.addStatus({
            friendlyName: "Plugins",
            path: 'tools.plugins',
            objectPath: `tools.plugins[${pluginName}]`,
            status: 'MISSING',
            statusDetail: `Failed to load plugin: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    }
}

