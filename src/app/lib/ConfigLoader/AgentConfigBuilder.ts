/**
 * AgentConfigBuilder
 * 
 * Builds agent configurations with processed instructions.
 * Assembles the final AgentConfig objects.
 */

import { AgentConfig, ExperienceConfig } from '../types';
import { InstructionProcessor } from './InstructionProcessor';
import { expandToolSets, getToolNamesForGroup } from '../tools/groups';

export class AgentConfigBuilder {
    private instructionProcessor: InstructionProcessor;

    constructor(instructionProcessor: InstructionProcessor) {
        this.instructionProcessor = instructionProcessor;
    }

    /**
     * Build a complete agent configuration
     */
    async buildAgentConfig(
        agentKey: string,
        agentData: ExperienceConfig['agents'][string],
        experienceConfig: ExperienceConfig
    ): Promise<AgentConfig> {
        const instructions = await this.instructionProcessor.processInstructions(agentKey);

        const config: AgentConfig = {
            name: agentData.name,
            voice: agentData.voice,
            publicDescription: agentData.publicDescription,
            instructions: instructions,
            temperature: agentData.temperature ?? 0.8,
            tools: [],
            toolLogic: {},
            downstreamAgents: this.buildDownstreamAgents(agentData, experienceConfig)
        };

        // Compute availableTools based on configuration version and available fields
        config.availableTools = this.computeAvailableTools(agentData, experienceConfig);

        // Add toolGroups if defined in the agent configuration (legacy - for backend agents)
        if (agentData.toolGroups) {
            config.toolGroups = agentData.toolGroups;
        }

        // Add toolSets if defined in the agent configuration (configVersion 2+)
        if (agentData.toolSets) {
            config.toolSets = agentData.toolSets;
        }

        // Add aiConfiguration if defined in the agent configuration
        if (agentData.aiConfiguration) {
            config.aiConfiguration = agentData.aiConfiguration;
        }

        // Add type if defined in the agent configuration
        if (agentData.type) {
            config.type = agentData.type;
        }

        // Add maximumToolCalls if defined in the agent configuration
        if (agentData.maximumToolCalls !== undefined) {
            config.maximumToolCalls = agentData.maximumToolCalls;
        }

        return config;
    }

    /**
     * Compute availableTools for an agent based on the configuration.
     * Priority order:
     * 1. Explicit availableTools (legacy)
     * 2. toolSets (configVersion 2+)
     * 3. toolGroups (legacy - rarely used for frontend)
     * 4. undefined (will fallback to all tools in useSessionManagement)
     */
    private computeAvailableTools(
        agentData: ExperienceConfig['agents'][string],
        experienceConfig: ExperienceConfig
    ): string[] | undefined {
        // 1. Explicit availableTools (legacy configVersion 1)
        if (agentData.availableTools) {
            return agentData.availableTools;
        }

        // 2. toolSets (configVersion 2+)
        if (agentData.toolSets && agentData.toolSets.length > 0) {
            try {
                const toolNames = expandToolSets(
                    agentData.toolSets,
                    experienceConfig.toolSets
                );
                return toolNames;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(
                    `Failed to expand toolSets for agent "${agentData.name}".\n` +
                    `ToolSets requested: ${JSON.stringify(agentData.toolSets)}\n` +
                    `Available custom toolSets: ${JSON.stringify(Object.keys(experienceConfig.toolSets || {}))}\n` +
                    `Error: ${errorMessage}`
                );
            }
        }

        // 3. toolGroups (legacy - mainly for backend agents, but support for frontend too)
        if (agentData.toolGroups && agentData.toolGroups.length > 0) {
            try {
                const toolNames = agentData.toolGroups.flatMap(group => 
                    getToolNamesForGroup(group)
                );
                return [...new Set(toolNames)]; // Deduplicate
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(
                    `Failed to expand toolGroups for agent "${agentData.name}".\n` +
                    `ToolGroups requested: ${JSON.stringify(agentData.toolGroups)}\n` +
                    `Error: ${errorMessage}`
                );
            }
        }

        // 4. No explicit tool configuration - return undefined
        // This will cause useSessionManagement to fall back to all registered tools
        return undefined;
    }

    /**
     * Build downstream agent references
     */
    private buildDownstreamAgents(
        agentData: ExperienceConfig['agents'][string],
        experienceConfig: ExperienceConfig
    ): Array<{ name: string; publicDescription: string }> {
        // Handle missing or invalid downstreamAgents
        if (!agentData.downstreamAgents || !Array.isArray(agentData.downstreamAgents)) {
            return [];
        }

        return agentData.downstreamAgents.map(downstreamKey => {
            if (!experienceConfig.agents[downstreamKey]) {
                throw new Error(
                    `Invalid downstream agent reference in agent "${agentData.name}".\n` +
                    `Referenced agent "${downstreamKey}" does not exist in the configuration.\n` +
                    `Available agents: ${Object.keys(experienceConfig.agents).join(', ')}`
                );
            }
            return {
                name: experienceConfig.agents[downstreamKey].name,
                publicDescription: experienceConfig.agents[downstreamKey].publicDescription
            };
        });
    }

    /**
     * Build all agent configurations for an experience
     */
    async buildAllAgentConfigs(
        experienceConfig: ExperienceConfig
    ): Promise<Record<string, AgentConfig>> {
        const agents = await Promise.all(
            Object.entries(experienceConfig.agents).map(async ([key, data]) => {
                const config = await this.buildAgentConfig(key, data, experienceConfig);
                return [key, config] as const;
            })
        );

        return Object.fromEntries(agents);
    }
}

