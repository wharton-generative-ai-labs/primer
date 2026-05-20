/**
 * Pure formatter for the `[SYSTEM/USER_ADVANCE_REQUEST]` system message.
 *
 * The strip's Next button (`WorkflowPhaseStrip.handleNext`) calls this at
 * click time when the current phase is not yet in `completedPhases`. The
 * resulting text is dispatched via a `workflow-phase-change` window event
 * and injected into the realtime conversation as a `system`-role item by
 * `useAgentSwitching`.
 *
 * Provenance (agent-marked vs system-marked) is NOT surfaced — the agent
 * doesn't need it to decide, and storing it would require widening
 * `state.completedObjectives`. Provenance is available in the
 * `OBJECTIVE_MARKED` event log for replay/debug.
 */

import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases';

const PREFIX = '[SYSTEM/USER_ADVANCE_REQUEST]';

const DIRECTIVE_ALL_MARKED =
  'All objectives are marked. Advance now: call `workflowPhase nextPhase` in this same turn (or `finishExperience` if this is the last phase).';

const DIRECTIVE_WITH_UNMARKED =
  'If any objective is not marked, judge from the conversation whether it has actually been covered. If you genuinely covered it, mark it now via `workflowPhase markObjective { id }` and then advance in the same turn. If it is genuinely unmet, skip the tool call and tell the user in one short line which objective is missing and what is still needed — name the objective id. Do not veto for stylistic polish, optional extras, or because you had more to say.';

const DIRECTIVE_NO_OBJECTIVES =
  'This phase has no declared objectives. Advance now: call `workflowPhase nextPhase` in this same turn (or `finishExperience` if this is the last phase).';

export function buildAdvanceRequestMessage(
  phase: WorkflowPhaseConfig,
  completedObjectiveIds: readonly string[],
): string {
  const lines: string[] = [];
  lines.push(PREFIX);
  lines.push(
    'The user just pressed the Next button. They consider this phase done.',
  );
  lines.push('');
  lines.push(`Current phase: ${phase.id}`);

  const objectives = phase.objectives ?? [];
  if (objectives.length === 0) {
    lines.push('');
    lines.push(DIRECTIVE_NO_OBJECTIVES);
    return lines.join('\n');
  }

  const marked = new Set(completedObjectiveIds);
  lines.push('Phase objectives:');
  for (const objective of objectives) {
    const label = marked.has(objective.id) ? 'MARKED' : 'UNMARKED';
    lines.push(`  - ${objective.id}: ${label} — ${objective.description}`);
  }
  lines.push('');

  // If all objectives are marked, use the simpler directive
  const allMarked = objectives.every(obj => marked.has(obj.id));
  const directive = allMarked ? DIRECTIVE_ALL_MARKED : DIRECTIVE_WITH_UNMARKED;
  lines.push(directive);

  return lines.join('\n');
}
