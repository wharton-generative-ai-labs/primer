/**
 * Agent Management Tool
 * 
 * Manages agent discovery, transfers, and delegation.
 * - discover: list all agents with their capabilities
 * - transfer: permanently hand off frontend control to another frontend agent
 * - delegate: temporarily delegate a task to a backend agent
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import {
  computePhaseMemberships,
  findContainingPhase,
  isAgentInPhase,
} from '@/app/lib/workflow-phases';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('agent-tool');

/**
 * Build phase-membership info for the current request, or `null` when the
 * experience has no phases / context lacks the phase accessors. When `null`,
 * transfer behaves exactly as it did pre-phases (no phase-based filtering).
 */
function getPhaseGate(context: ToolContext): {
  currentPhaseId: string;
  memberships: ReturnType<typeof computePhaseMemberships>;
  phases: ReturnType<NonNullable<ToolContext['getWorkflowPhases']>>;
} | null {
  if (!context.getWorkflowPhases || !context.getCurrentWorkflowPhase) {
    return null;
  }
  const phases = context.getWorkflowPhases();
  if (!phases || phases.length === 0) return null;
  const current = context.getCurrentWorkflowPhase();
  if (!current?.id) return null;
  if (!context.agents) return null;
  const memberships = computePhaseMemberships(phases, context.agents);
  return { currentPhaseId: current.id, memberships, phases };
}

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

            const phaseGate = getPhaseGate(context);

            const agentList = Object.entries(context.agents as Record<string, {
                name: string;
                publicDescription?: string;
                delegationContract?: string;
                type?: string;
            }>).map(([key, agentConfig]) => {
                const isSelf = key === context.selectedAgentKey;
                const isBackend = agentConfig.type === 'backend';
                const isDownstream = !isSelf && !isBackend && (
                    downstreamRefs.has(key.toLowerCase()) || downstreamRefs.has(agentConfig.name?.toLowerCase())
                );
                const inPhase = phaseGate
                    ? isAgentInPhase(phaseGate.memberships, phaseGate.currentPhaseId, key)
                    : true;
                const isTransferTarget = isDownstream && inPhase;

                const available_actions: string[] = [];
                if (isTransferTarget) available_actions.push('transfer');
                if (isBackend) available_actions.push('delegate');

                const entry: Record<string, unknown> = {
                    key,
                    name: agentConfig.name,
                    type: agentConfig.type || 'frontend',
                    description: agentConfig.publicDescription || 'No description',
                    is_current: isSelf,
                    available_actions,
                };

                // Backend agents may declare a delegationContract — the contract
                // for invoking them via `agent({ action: 'delegate' })`. Surface
                // it here so orchestrators read the call shape from the agent's
                // own config instead of carrying duplicate prose in their prompt.
                if (isBackend && agentConfig.delegationContract) {
                    entry.delegation_contract = agentConfig.delegationContract;
                }

                // Phase hint: when phases are active and this downstream agent is
                // gated out by phase boundary, point the LLM at the right tool.
                if (phaseGate && isDownstream && !inPhase) {
                    const containingPhaseId = findContainingPhase(
                        phaseGate.phases,
                        phaseGate.memberships,
                        key,
                    );
                    entry.outside_current_phase = true;
                    entry.transfer_blocked_reason = containingPhaseId
                        ? `${key} belongs to phase "${containingPhaseId}". Use workflowPhase.set with phase="${containingPhaseId}" to move there.`
                        : `${key} is outside the current phase. Use workflowPhase.nextPhase to move forward.`;
                }

                return entry;
            });

            const data: Record<string, unknown> = {
                current_agent: context.selectedAgentKey,
                agents: agentList,
                count: agentList.length,
            };
            if (phaseGate) {
                data.current_phase = phaseGate.currentPhaseId;
                data.phase_filtered = true;
            }

            return {
                status: 'success',
                data,
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

            const agentEntries = Object.entries(context.agents as Record<string, { name: string }>);
            // Normalise by lowercasing and collapsing whitespace/underscores
            // so "Adam Ingram", "adam_ingram", and "adam-ingram" all resolve
            // to the same key. The AI tends to mix these up (scene filenames
            // use underscores; the agent's display name uses a space).
            const normalize = (s: string | undefined) =>
                (s ?? '').toLowerCase().replace(/[\s_-]+/g, '_').replace(/^_|_$/g, '');
            const needle = normalize(args.destination);
            const destinationAgentKey =
                agentEntries.find(([, cfg]) => normalize(cfg.name) === needle)?.[0] ||
                agentEntries.find(([key]) => normalize(key) === needle)?.[0];

            if (!destinationAgentKey) {
                const validDestinations = (currentAgent.downstreamAgents || [])
                    .map((a: string | { name: string }) =>
                        typeof a === 'string' ? a : a.name
                    )
                    .filter(Boolean);
                logger.warn(
                    { destination: args.destination, validDestinations },
                    'agent transfer error: Could not find agent'
                );
                return {
                    status: 'error',
                    data: {
                        did_transfer: false,
                        destination_agent: null,
                        rationale: args.rationale,
                        context: args.conversationContext,
                        error: `Could not find agent "${args.destination}". Valid downstream agents from here: ${validDestinations.join(', ') || '(none)'}`
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
                const validDestinations = (currentAgent.downstreamAgents || [])
                    .map((a: string | { name: string }) =>
                        typeof a === 'string' ? a : a.name
                    )
                    .filter(Boolean);
                logger.warn(
                    { destination: args.destination, validDestinations },
                    'agent transfer error: Invalid downstream agent'
                );
                return {
                    status: 'error',
                    data: {
                        did_transfer: false,
                        destination_agent: null,
                        rationale: args.rationale,
                        context: args.conversationContext,
                        error: `"${args.destination}" is not a downstream agent from here. Valid downstream agents: ${validDestinations.join(', ') || '(none)'}`
                    }
                };
            }

            // Phase-boundary check: in a phased experience, refuse transfers
            // that would cross into another phase. The agent should call
            // `workflowPhase.set` (or `nextPhase` if the destination has no
            // discoverable phase) instead, which also drives the proper agent
            // switch as a side effect.
            const phaseGate = getPhaseGate(context);
            if (
                phaseGate &&
                !isAgentInPhase(phaseGate.memberships, phaseGate.currentPhaseId, destinationAgentKey)
            ) {
                const containingPhaseId = findContainingPhase(
                    phaseGate.phases,
                    phaseGate.memberships,
                    destinationAgentKey,
                );
                const pointer = containingPhaseId
                    ? `Use workflowPhase.set with phase="${containingPhaseId}" to move there.`
                    : 'Use workflowPhase.nextPhase to move forward instead.';
                logger.warn(
                    {
                        destinationAgentKey,
                        currentPhase: phaseGate.currentPhaseId,
                        destinationPhase: containingPhaseId,
                    },
                    'agent transfer error: cross-phase target'
                );
                return {
                    status: 'error',
                    data: {
                        did_transfer: false,
                        destination_agent: null,
                        rationale: args.rationale,
                        context: args.conversationContext,
                        error: `"${destinationAgentKey}" is outside the current workflow phase ("${phaseGate.currentPhaseId}"). ${pointer}`,
                        suggested_tool: 'workflowPhase',
                        suggested_action: containingPhaseId ? 'set' : 'nextPhase',
                        suggested_phase: containingPhaseId,
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
            if (context.addTranscriptHandoff) {
                context.addTranscriptHandoff(fromName, toName, args.rationale);
            } else if (context.addTranscriptBreadcrumb) {
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

            // Backend-context refusal. The actual delegate() implementation
            // depends on browser globals (sessionStorage, the socket.io
            // client). When the agent tool runs inside a backend agent (Node,
            // no browser globals) we reject up-front with a clear pointer so
            // the calling agent gets a useful tool result rather than a
            // misleading "no active session" failure deep in delegate().
            if (typeof sessionStorage === 'undefined') {
                return {
                    status: 'error',
                    data: {
                        error: 'agent.delegate is only callable from the frontend orchestrator. Backend agents cannot spawn sub-delegations; return a result and let the orchestrator drive the next step.',
                        suggested_pattern: 'Return a result; the orchestrator will drive the next step.',
                    },
                };
            }

            // Phase-scoped delegate gating. When the current phase declares
            // `allowedDelegates`, only those agent keys may be invoked. This
            // prevents earlier-phase agents from triggering later-phase
            // subagents before the workflow has reached the right phase.
            //
            // Fail-closed semantics: if the experience declares phases at all
            // but the context can't resolve a current phase, the client-side
            // phase state isn't healthy (e.g. a stale tab whose
            // WorkflowPhaseProvider didn't hydrate). Refuse delegation in that
            // unhealthy state rather than silently bypass the gate. Without
            // this, a tab in a bad state lets every delegate through and the
            // orchestrator skips phase mechanics entirely.
            if (context.getWorkflowPhases && context.getCurrentWorkflowPhase) {
                const phases = context.getWorkflowPhases();
                const current = context.getCurrentWorkflowPhase();

                if (phases.length > 0 && !current?.id) {
                    return {
                        status: 'error',
                        data: {
                            error: 'Workflow phase state is not loaded — refusing delegation to fail-closed. Reload the page so the WorkflowPhaseProvider can hydrate before retrying.',
                            phases_declared: phases.length,
                            current_phase: null,
                            suggested_action: 'reload',
                        },
                    };
                }

                if (current?.id) {
                    const phaseConfig = phases.find((p) => p.id === current.id);
                    const allowed = phaseConfig?.allowedDelegates;
                    if (allowed && !allowed.includes(args.agentType)) {
                        const allowedList = allowed.length > 0
                            ? allowed.join(', ')
                            : '(none)';
                        return {
                            status: 'error',
                            data: {
                                error: `Delegation to "${args.agentType}" is not allowed in phase "${current.id}". Allowed delegates here: ${allowedList}. To run this agent, advance the workflow to the phase where it belongs (workflowPhase nextPhase).`,
                                current_phase: current.id,
                                allowed_delegates: allowed,
                                suggested_tool: 'workflowPhase',
                                suggested_action: 'nextPhase',
                            },
                        };
                    }
                }
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
