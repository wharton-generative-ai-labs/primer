/**
 * Workflow Phase Management Tool
 *
 * Agent-facing actions:
 * - `discover` lists every phase with its current/visited/completed state.
 * - `current` returns metadata about the active phase.
 * - `nextPhase` is the SINGLE forward op available to the agent. It marks
 *   the current phase complete AND advances forward by one, atomically. If
 *   the phase declares `requireEducatorAdvance: true`, the server collapses
 *   this to "mark complete only" and the educator presses Next.
 * - `set` jumps forward to a named phase. Backward jumps are refused — the
 *   user owns backward navigation.
 * - `setNext` records a forward override that the next `nextPhase` consumes.
 * - `suggestReturn` surfaces a UI prompt asking the user if they'd like to
 *   revisit a phase. The agent never transitions backward itself.
 *
 * Note: the low-level `complete` and `advance` primitives still exist on the
 * transition manager (used by the educator's Next button via the client
 * context) but are intentionally NOT exposed to the agent here. Forcing the
 * agent through `nextPhase` removes a frequent footgun where the model
 * called `complete` and stopped, leaving the workflow stuck.
 *
 * Phase `objectives` have two marking paths feeding `state.completedObjectives`:
 * (1) the agent's `markObjective` action (this file), and (2) declarative
 * `satisfiedBy` triggers on each objective that the server auto-marks at
 * delegate-success and artifact-populated hook points. Neither path gates
 * advance — when `nextPhase` is called the server auto-marks any still-unmarked
 * objectives and emits an OBJECTIVE_AUTO_MARKED_ON_NEXTPHASE event per
 * objective. The prior `markObjective` design that DID gate `nextPhase` was
 * removed because of a recover-after-rejection failure mode no amount of
 * prompt engineering eliminated; this revision is structurally non-gating.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';

/**
 * Machine-readable description shown to the LLM. The first sentence is the
 * confirmation guardrail and is snapshot-tested — keep it verbatim.
 */
/**
 * Canonical action union for the `workflowPhase` tool. Single source of truth
 * shared by the handler (the `switch` in this file), the type alias below,
 * and both tool registrations (`register.ts` + `register-client.ts`) so the
 * schema enum the LLM sees can't drift from the surface the handler accepts.
 */
export const WORKFLOW_PHASE_ACTIONS = [
    'discover',
    'current',
    'nextPhase',
    'set',
    'setNext',
    'suggestReturn',
    'markObjective',
] as const;

export type WorkflowPhaseAction = (typeof WORKFLOW_PHASE_ACTIONS)[number];

export const WORKFLOW_PHASE_DESCRIPTION =
    'Before calling `nextPhase` or `set` to move the workflow forward, verbally check that the user is ready. The user expects to be asked. ' +
    'Actions: ' +
    "`discover` lists the experience's phases in order with each phase's state (current/furthest/visited/completed). " +
    '`current` returns metadata for the active phase, including any `nextPhaseOverride` and the resolved next-phase id. ' +
    '`nextPhase` is the ONLY forward op. A single call marks the current phase complete AND advances to the next phase atomically. If the phase declares `requireEducatorAdvance: true` the server collapses this to "mark complete only" and the educator presses Next themselves. There is no separate `complete` or `advance` action available — use `nextPhase` whenever you want to move on. Errors on the last phase (call `finishExperience` instead). ' +
    '`set { phase }` jumps forward to the named phase. Backward jumps are refused — only the user can navigate backward, via the Back button. ' +
    '`setNext { phase }` records a forward override the next `nextPhase` will consume. Forward-only: rejects backward, current, or unknown targets. Does not navigate. ' +
    '`suggestReturn { phase, reason }` surfaces a UI prompt suggesting the user revisit a previous phase. Does NOT transition. ' +
    '`markObjective { id }` records that the named objective on the current phase has been covered in conversation. Idempotent (re-marking the same id is a no-op success). Never gates anything — it surfaces in advance-request messages and `current` output as MARKED. Fail-soft: if you forget to mark an objective and the user clicks Next, the advance-request message will show it UNMARKED and you can mark it then. Mark in passing — like a brief aside in the same response turn where the objective was covered — not as a separate checklist beat.';

export interface WorkflowPhaseToolArgs {
    action: WorkflowPhaseAction;
    phase?: string;
    reason?: string;
    id?: string;
    note?: string;
}

export async function workflowPhase(
    args: WorkflowPhaseToolArgs,
    context: ToolContext,
): Promise<ToolResponse> {
    switch (args.action) {
        case 'discover': {
            if (!context.getCurrentWorkflowPhase || !context.getWorkflowPhases) {
                return {
                    status: 'error',
                    data: { error: 'Workflow phases are not available in this context' },
                };
            }
            const phases = context.getWorkflowPhases();
            const current = context.getCurrentWorkflowPhase();
            const state = context.getWorkflowPhaseState
                ? context.getWorkflowPhaseState()
                : null;
            const visited = new Set(state?.visited ?? []);
            const completed = new Set(state?.completedPhases ?? []);
            const furthestId = state?.furthestPhase;
            return {
                status: 'success',
                data: {
                    phases: phases.map((p) => ({
                        id: p.id,
                        title: p.title,
                        current: current ? p.id === current.id : false,
                        furthest: furthestId ? p.id === furthestId : false,
                        visited: visited.has(p.id),
                        completed: completed.has(p.id),
                    })),
                },
            };
        }

        case 'current': {
            if (!context.getCurrentWorkflowPhase) {
                return {
                    status: 'error',
                    data: { error: 'getCurrentWorkflowPhase not available in context' },
                };
            }
            const current = context.getCurrentWorkflowPhase();
            if (!current) {
                return {
                    status: 'success',
                    data: { current: null },
                };
            }
            return {
                status: 'success',
                data: { current },
            };
        }

        case 'nextPhase': {
            if (!context.setWorkflowPhase) {
                return {
                    status: 'error',
                    data: { error: 'setWorkflowPhase not available in context' },
                };
            }
            const result = await context.setWorkflowPhase(
                { kind: 'nextPhase' },
                { trigger: 'agent' },
            );
            if (!result.result) {
                return {
                    status: 'error',
                    data: { error: result.message ?? 'Failed to advance to next phase' },
                };
            }
            return {
                status: 'success',
                data: {
                    result: true,
                    currentPhase: result.currentPhase,
                },
            };
        }

        case 'set': {
            if (!context.setWorkflowPhase) {
                return {
                    status: 'error',
                    data: { error: 'setWorkflowPhase not available in context' },
                };
            }
            if (!args.phase) {
                return {
                    status: 'error',
                    data: { error: 'phase parameter is required for set action' },
                };
            }
            // Forward-only refusal is enforced server-side, but we also reject
            // here when we have enough local context to detect a backward jump.
            // The server is the source of truth — this is a fast-path message.
            if (context.getCurrentWorkflowPhase && context.getWorkflowPhases) {
                const phases = context.getWorkflowPhases();
                const current = context.getCurrentWorkflowPhase();
                if (current) {
                    const currentIdx = phases.findIndex((p) => p.id === current.id);
                    const targetIdx = phases.findIndex((p) => p.id === args.phase);
                    if (currentIdx >= 0 && targetIdx >= 0 && targetIdx <= currentIdx) {
                        return {
                            status: 'error',
                            data: {
                                error: 'Agents cannot navigate backward; use suggestReturn',
                            },
                        };
                    }
                }
            }
            const result = await context.setWorkflowPhase(
                { kind: 'set', targetPhase: args.phase },
                { trigger: 'agent' },
            );
            if (!result.result) {
                return {
                    status: 'error',
                    data: { error: result.message ?? 'Failed to set workflow phase' },
                };
            }
            return {
                status: 'success',
                data: {
                    result: true,
                    currentPhase: result.currentPhase,
                },
            };
        }

        case 'setNext': {
            if (!context.setWorkflowPhase) {
                return {
                    status: 'error',
                    data: { error: 'setWorkflowPhase not available in context' },
                };
            }
            if (!args.phase) {
                return {
                    status: 'error',
                    data: { error: 'phase parameter is required for setNext action' },
                };
            }
            // Local validation: forward-only and not the current phase.
            if (context.getCurrentWorkflowPhase && context.getWorkflowPhases) {
                const phases = context.getWorkflowPhases();
                const current = context.getCurrentWorkflowPhase();
                const targetIdx = phases.findIndex((p) => p.id === args.phase);
                if (targetIdx < 0) {
                    return {
                        status: 'error',
                        data: { error: `Unknown phase: ${args.phase}` },
                    };
                }
                if (current) {
                    const currentIdx = phases.findIndex((p) => p.id === current.id);
                    if (currentIdx >= 0 && args.phase === current.id) {
                        return {
                            status: 'error',
                            data: { error: 'setNext target cannot be the current phase' },
                        };
                    }
                    if (currentIdx >= 0 && targetIdx <= currentIdx) {
                        return {
                            status: 'error',
                            data: {
                                error: 'setNext is forward-only; backward targets are not allowed',
                            },
                        };
                    }
                }
            }
            const result = await context.setWorkflowPhase(
                { kind: 'setNext', targetPhase: args.phase },
                { trigger: 'agent' },
            );
            if (!result.result) {
                return {
                    status: 'error',
                    data: { error: result.message ?? 'Failed to set next workflow phase' },
                };
            }
            return {
                status: 'success',
                data: {
                    result: true,
                    nextPhaseOverride: result.nextPhaseOverride ?? args.phase,
                },
            };
        }

        case 'suggestReturn': {
            if (!context.suggestWorkflowPhaseReturn) {
                return {
                    status: 'error',
                    data: {
                        error: 'suggestWorkflowPhaseReturn not available in context',
                    },
                };
            }
            if (!args.phase) {
                return {
                    status: 'error',
                    data: {
                        error: 'phase parameter is required for suggestReturn action',
                    },
                };
            }
            if (!args.reason) {
                return {
                    status: 'error',
                    data: {
                        error: 'reason parameter is required for suggestReturn action',
                    },
                };
            }
            context.suggestWorkflowPhaseReturn(args.phase, args.reason);
            return {
                status: 'success',
                data: { result: true },
            };
        }

        case 'markObjective': {
            if (!context.setWorkflowPhase) {
                return {
                    status: 'error',
                    data: { error: 'setWorkflowPhase not available in context' },
                };
            }
            if (!args.id) {
                return {
                    status: 'error',
                    data: { error: 'id parameter is required for markObjective action' },
                };
            }
            const result = await context.setWorkflowPhase(
                { kind: 'markObjective', id: args.id, ...(args.note ? { note: args.note } : {}) },
                { trigger: 'agent' },
            );
            if (!result.result) {
                return {
                    status: 'error',
                    data: { error: result.message ?? 'Failed to mark objective' },
                };
            }
            return {
                status: 'success',
                data: { result: true, id: args.id },
            };
        }

        default:
            return {
                status: 'error',
                data: {
                    error: `Invalid action: ${(args as WorkflowPhaseToolArgs).action}. Valid actions are: discover, current, nextPhase, set, setNext, suggestReturn, markObjective`,
                },
            };
    }
}
