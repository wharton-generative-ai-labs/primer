/**
 * AgentConfigBuilder
 * 
 * Builds agent configurations with processed instructions.
 * Assembles the final AgentConfig objects.
 */

import { AgentConfig, ExperienceConfig } from '../types';
import { InstructionProcessor } from './InstructionProcessor';
import { resolveAgentToolNames } from '../tools/groups';

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

        // Compute availableTools based on configuration version and available fields.
        // Delegates to the shared resolver so the loader and the phase-anchor
        // validator (loadWorkflowPhases) agree on tool resolution.
        config.availableTools = resolveAgentToolNames(agentData, experienceConfig);

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

        // Pass through the optional delegation contract (backend agents only,
        // surfaced via `agent discover`).
        if (agentData.delegationContract) {
            config.delegationContract = agentData.delegationContract;
        }

        return config;
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

