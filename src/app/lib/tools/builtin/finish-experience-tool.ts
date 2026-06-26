/**
 * Finish-Experience Tool
 *
 * A separate, intentionally minimal tool for marking the entire experience
 * complete. Lives alongside `workflowPhase` but is its own registration so the
 * LLM can't accidentally conflate it with phase-level `complete` (which only
 * unlocks the forward button for the current phase).
 *
 * Single action: `finishExperience({ reason?: string })`.
 *
 * Behavior:
 * - Routes through `context.finishExperience(reason)` which (depending on the
 *   wiring site) either POSTs to the workflow-phase transition endpoint with
 *   `op: { kind: 'finishExperience' }` (realtime path) or invokes the manager
 *   directly via `mutateSessionMetadata` (backend-agent path).
 * - Idempotent: the manager swallows the second call (no new event), but this
 *   tool still returns `{ result: true }` either way.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';

/**
 * Machine-readable description shown to the LLM. The first sentence is the
 * agreement-gate guardrail and is snapshot-tested — keep it verbatim.
 */
export const FINISH_EXPERIENCE_DESCRIPTION =
    "Call this only after the user has explicitly agreed that the entire experience is complete and ready to wrap up. The user will be shown a closing dialog and the workflow will lock to read-only-ish (forward navigation hidden until they rewind). This is irreversible from the agent's side; only the user can rewind. " +
    'This tool is distinct from `workflowPhase.nextPhase`, which only advances to the next phase and does not end the experience.';

export interface FinishExperienceToolArgs {
    reason?: string;
}

export async function finishExperience(
    args: FinishExperienceToolArgs,
    context: ToolContext,
): Promise<ToolResponse> {
    if (!context.finishExperience) {
        return {
            status: 'error',
            data: { error: 'finishExperience not available in context' },
        };
    }

    try {
        const result = await context.finishExperience(args.reason);
        if (!result.result) {
            return {
                status: 'error',
                data: { error: 'Failed to finish experience' },
            };
        }
        return {
            status: 'success',
            data: { result: true },
        };
    } catch (error) {
        return {
            status: 'error',
            data: {
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to finish experience',
            },
        };
    }
}
