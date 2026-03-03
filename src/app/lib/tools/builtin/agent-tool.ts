/**
 * Agent Management Tool
 * 
 * Manages agent discovery, transfers, and delegation.
 * - discover: list all agents with their capabilities
 * - transfer: permanently hand off frontend control to another frontend agent
 * - delegate: temporarily delegate a task to a backend agent
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('agent-tool');

/**
 * @tool agent
 * @description Manage agents. Use 'discover' to list all available agents and what you can do with them, 'transfer' to permanently hand off to a frontend agent, 'delegate' to send a task to a backend agent that returns results to you.
 * @param {string} args.action - The action to perform: 'discover', 'transfer', or 'delegate'
 * @param {string} args.destination - Destination agent name (required for transfer)
 * @param {string} args.rationale - Reasoning for transfer (required for transfer)
 * @param {string} args.conversationContext - Context to pass to destination agent (required for transfer)
 * @param {string} args.agentType - Name or key of the backend agent to delegate to (required for delegate)
 * @param {string[]} args.artifactIds - Array of artifact IDs to pass to the delegate (optional for delegate)
 * @param {string} args.taskDescription - Description of the task to delegate (optional for delegate)
 * @param {string[]} args.imageNames - Array of image names for image generation (optional for delegate)
 */
export async function agent(args: {
    action: 'discover' | 'transfer' | 'delegate';
    destination?: string;
    rationale?: string;
    conversationContext?: string;
    agentType?: string;
    artifactIds?: string[];
    taskDescription?: string;
    imageNames?: string[];
}, context: ToolContext): Promise<ToolResponse> {
    switch (args.action) {
        case 'discover': {
            if (!context.agents || !context.selectedAgentKey) {
                return {
                    status: 'error',
                    data: { error: 'agents or selectedAgentKey not available in context' }
                };
            }

            const currentAgent = context.agents[context.selectedAgentKey];
            const downstreamRefs = new Set(
                (currentAgent?.downstreamAgents || []).map((a: string | { name: string }) =>
                    (typeof a === 'string' ? a : a.name)?.toLowerCase()
                )
            );

            const agentList = Object.entries(context.agents as Record<string, {
                name: string;
                publicDescription?: string;
                type?: string;
            }>).map(([key, agentConfig]) => {
                const isSelf = key === context.selectedAgentKey;
                const isBackend = agentConfig.type === 'backend';
                const isTransferTarget = !isSelf && !isBackend && (
                    downstreamRefs.has(key.toLowerCase()) || downstreamRefs.has(agentConfig.name?.toLowerCase())
                );

                const available_actions: string[] = [];
                if (isTransferTarget) available_actions.push('transfer');
                if (isBackend) available_actions.push('delegate');

                return {
                    key,
                    name: agentConfig.name,
                    type: agentConfig.type || 'frontend',
                    description: agentConfig.publicDescription || 'No description',
                    is_current: isSelf,
                    available_actions,
                };
            });

            return {
                status: 'success',
                data: {
                    current_agent: context.selectedAgentKey,
                    agents: agentList,
                    count: agentList.length
                }
            };
        }

        case 'transfer': {
            if (!context.agents || !context.selectedAgentKey) {
                return {
                    status: 'error',
                    data: { error: 'agents or selectedAgentKey not available in context' }
                };
            }

            if (!args.destination || !args.rationale || !args.conversationContext) {
                return {
                    status: 'error',
                    data: { error: 'destination, rationale, and conversationContext are required for transfer action' }
                };
            }

            logger.debug({ destination: args.destination }, 'agent transfer executing');
            const currentAgent = context.agents[context.selectedAgentKey];

            if (!currentAgent?.downstreamAgents || currentAgent.downstreamAgents.length === 0) {
                logger.warn('agent transfer error: Current agent has no downstream agents');
                return {
                    status: 'error',
                    data: {
                        did_transfer: false,
                        destination_agent: null,
                        rationale: args.rationale,
                        context: args.conversationContext,
                        error: 'Current agent has no downstream agents'
                    }
                };
            }

            const needle = args.destination!.toLowerCase();
            const agentEntries = Object.entries(context.agents as Record<string, { name: string }>);
            const destinationAgentKey =
                agentEntries.find(([, cfg]) => cfg.name?.toLowerCase() === needle)?.[0] ||
                agentEntries.find(([key]) => key.toLowerCase() === needle)?.[0];

            if (!destinationAgentKey) {
                logger.warn({ destination: args.destination }, 'agent transfer error: Could not find agent');
                return {
                    status: 'error',
                    data: {
                        did_transfer: false,
                        destination_agent: null,
                        rationale: args.rationale,
                        context: args.conversationContext,
                        error: `Could not find agent with name: ${args.destination}`
                    }
                };
            }

            const destinationName = (context.agents as Record<string, { name: string }>)[destinationAgentKey]?.name;
            const isValidDownstreamAgent = currentAgent.downstreamAgents.some(
                (agentItem: string | { name: string }) => {
                    const itemName = typeof agentItem === 'string' ? agentItem : agentItem.name;
                    return itemName?.toLowerCase() === destinationAgentKey.toLowerCase()
                        || itemName?.toLowerCase() === destinationName?.toLowerCase();
                }
            );

            if (!isValidDownstreamAgent) {
                logger.warn({ destination: args.destination }, 'agent transfer error: Invalid downstream agent');
                return {
                    status: 'error',
                    data: {
                        did_transfer: false,
                        destination_agent: null,
                        rationale: args.rationale,
                        context: args.conversationContext,
                        error: `Invalid downstream agent: ${args.destination}`
                    }
                };
            }

            const fromName = context.agents[context.selectedAgentKey]?.name;
            const toName = context.agents[destinationAgentKey]?.name;

            // If client-side callbacks are available (direct invocation), use them.
            // In backend-first mode, the server orchestrates these side effects.
            if (context.setQueuedAgentTransfer) {
                context.setQueuedAgentTransfer(destinationAgentKey);
            }
            if (context.addTranscriptBreadcrumb) {
                context.addTranscriptBreadcrumb(
                    "Agent transfer queued",
                    { from: fromName, to: toName, rationale: args.rationale }
                );
            }

            logger.debug({ destinationAgentKey }, 'agent transfer successful');
            return {
                status: 'success',
                data: {
                    did_transfer: true,
                    destination_agent: destinationAgentKey,
                    from_agent: context.selectedAgentKey,
                    from_name: fromName,
                    to_name: toName,
                    rationale: args.rationale,
                    context: args.conversationContext
                }
            };
        }

        case 'delegate': {
            if (!args.agentType) {
                return {
                    status: 'error',
                    data: { error: 'agentType is required for delegate action' }
                };
            }

            const { delegate } = await import('@/app/lib/tools/delegation/delegate');
            return delegate(
                {
                    agentType: args.agentType,
                    artifactIds: args.artifactIds,
                    taskDescription: args.taskDescription,
                    imageNames: args.imageNames,
                },
                context
            );
        }

        default:
            return {
                status: 'error',
                data: { error: `Invalid action: ${args.action}. Valid actions are: discover, transfer, delegate` }
            };
    }
}
