/**
 * Shared hook helper. Callers (artifact storage write boundary,
 * backend-agent-core, HTTP-route delegate exit) invoke `fireObjectiveSignal`
 * with the runtime signal; the helper handles config load, state read,
 * evaluation, persistence, and event emission.
 *
 * Best-effort: never throws. A failure to evaluate signals must not break
 * artifact writes or delegate completions. Failures are logged at warn
 * level and swallowed.
 */

import { createModuleLogger } from '@/lib/logger';
import { SESSION_EVENTS } from '@/app/lib/file-utils';
import { mutateSessionMetadata } from '@/app/lib/sessions/mutateSessionMetadata';
import { loadWorkflowPhases } from '@/app/lib/workflow-phases/loadWorkflowPhases';
import {
  evaluateSatisfiedBy,
  type ObjectiveSignal,
} from '@/app/lib/workflow-phases/WorkflowPhaseManager';
import { loadExperienceConfigById } from '@/app/lib/workflow-phases/loadExperienceConfigById';

const logger = createModuleLogger('objective-signals');

export async function fireObjectiveSignal(params: {
  experienceId: string;
  sessionId: string;
  signal: ObjectiveSignal;
}): Promise<void> {
  const { experienceId, sessionId, signal } = params;
  try {
    const config = await loadExperienceConfigById(experienceId);
    const phases = loadWorkflowPhases(config);
    if (phases.length === 0) return; // non-phased experience: nothing to do

    await mutateSessionMetadata(experienceId, sessionId, async (metadata) => {
      const state = metadata.workflowPhaseState;
      if (!state || !state.currentPhase) return metadata;

      const currentPhase = phases.find((p) => p.id === state.currentPhase);
      if (!currentPhase) return metadata;

      const toMark = evaluateSatisfiedBy(state, currentPhase, signal);
      if (toMark.length === 0) return metadata;

      const existing = state.completedObjectives?.[state.currentPhase] ?? [];
      state.completedObjectives = {
        ...(state.completedObjectives ?? {}),
        [state.currentPhase]: [...existing, ...toMark],
      };

      const ts = new Date().toISOString();
      const via =
        signal.kind === 'delegateSuccess'
          ? `delegateSuccess ${signal.resolvedAgentKey}`
          : `artifactPopulated ${signal.slug}`;

      for (const objectiveId of toMark) {
        metadata.events.push({
          event: SESSION_EVENTS.OBJECTIVE_MARKED,
          agent: 'system',
          timestamp: ts,
          data: {
            phase: state.currentPhase,
            objectiveId,
            trigger: 'system',
            via,
          },
        });
      }

      return metadata;
    });
  } catch (err) {
    logger.warn(
      { err, experienceId, sessionId, signalKind: signal.kind },
      'fireObjectiveSignal failed — swallowing to keep caller path healthy',
    );
  }
}
