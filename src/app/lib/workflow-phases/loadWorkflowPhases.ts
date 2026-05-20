/**
 * Phase loader + validator for experience-config workflow phases.
 *
 * `loadWorkflowPhases` returns the ordered phase list when the config declares
 * one, throwing on duplicate ids, an unknown `initialWorkflowPhase`, or any
 * phase that names an `initialAgent`/`reentryAgent` not present in
 * `config.agents`. Experiences without `workflowPhases` (or with an empty
 * list) get back `[]`, signalling single-screen mode.
 *
 * `resolveInitialWorkflowPhase` picks the starting phase id, preferring the
 * explicit `initialWorkflowPhase` override and falling back to the first
 * declared phase.
 */

import type { ExperienceConfig } from '@/app/lib/types';

import { InvalidPhaseError } from './errors';
import type { WorkflowPhaseConfig } from './types';

/**
 * Validate and return the ordered workflow-phase list for an experience.
 *
 * Returns `[]` when no phases are declared. Throws when validation fails;
 * callers are expected to surface the message to the experience author.
 */
export function loadWorkflowPhases(
  config: ExperienceConfig,
): WorkflowPhaseConfig[] {
  const phases = config.workflowPhases;
  if (!phases || phases.length === 0) {
    return [];
  }

  const seenIds = new Set<string>();
  phases.forEach((phase, index) => {
    // Check the missing-id case BEFORE the dup check. Otherwise two
    // malformed phases both stringify their `undefined` id and the
    // dup-check fires first, producing the misleading
    // `Duplicate workflow phase id: "undefined".` error we used to see
    // when the build agent persisted phases without ids (see
    // `MatterCompiler.modifyExperience` validation for the upstream guard).
    if (typeof phase.id !== 'string' || phase.id.length === 0) {
      throw new InvalidPhaseError(
        `Workflow phase at index ${index} is missing required "id" field (must be a non-empty string).`,
      );
    }
    if (seenIds.has(phase.id)) {
      throw new InvalidPhaseError(
        `Duplicate workflow phase id: "${phase.id}".`,
      );
    }
    seenIds.add(phase.id);
  });

  if (
    config.initialWorkflowPhase !== undefined &&
    !seenIds.has(config.initialWorkflowPhase)
  ) {
    throw new InvalidPhaseError(
      `initialWorkflowPhase "${config.initialWorkflowPhase}" does not match any declared workflow phase id.`,
    );
  }

  const agentKeys = new Set(Object.keys(config.agents ?? {}));
  for (const phase of phases) {
    if (
      phase.initialAgent !== undefined &&
      !agentKeys.has(phase.initialAgent)
    ) {
      throw new InvalidPhaseError(
        `Workflow phase "${phase.id}" references unknown initialAgent "${phase.initialAgent}".`,
      );
    }
    if (
      phase.reentryAgent !== undefined &&
      !agentKeys.has(phase.reentryAgent)
    ) {
      throw new InvalidPhaseError(
        `Workflow phase "${phase.id}" references unknown reentryAgent "${phase.reentryAgent}".`,
      );
    }

    if (phase.objectives) {
      for (const objective of phase.objectives) {
        if (objective.satisfiedBy === undefined) continue;
        const trigger = objective.satisfiedBy as Record<string, unknown>;
        const kind = trigger.kind;
        if (kind === 'delegateSuccess') {
          if (typeof trigger.agentType !== 'string' || trigger.agentType.length === 0) {
            throw new InvalidPhaseError(
              `Workflow phase "${phase.id}" objective "${objective.id}": satisfiedBy.delegateSuccess requires a non-empty "agentType" string.`,
            );
          }
        } else if (kind === 'artifactPopulated') {
          if (typeof trigger.slug !== 'string' || trigger.slug.length === 0) {
            throw new InvalidPhaseError(
              `Workflow phase "${phase.id}" objective "${objective.id}": satisfiedBy.artifactPopulated requires a non-empty "slug" string.`,
            );
          }
        } else {
          throw new InvalidPhaseError(
            `Workflow phase "${phase.id}" objective "${objective.id}": unknown satisfiedBy kind "${String(kind)}" (expected "delegateSuccess" or "artifactPopulated").`,
          );
        }
      }
    }
  }

  return phases;
}

/**
 * Resolve the starting workflow phase id.
 *
 * Returns `undefined` when no phases are declared (single-screen mode).
 * Returns `config.initialWorkflowPhase` when set, else the first phase id.
 *
 * This function does **not** re-validate the config — callers that need
 * validation should call `loadWorkflowPhases` first (or in addition).
 */
export function resolveInitialWorkflowPhase(
  config: ExperienceConfig,
): string | undefined {
  const phases = config.workflowPhases;
  if (!phases || phases.length === 0) {
    return undefined;
  }
  if (config.initialWorkflowPhase !== undefined) {
    return config.initialWorkflowPhase;
  }
  return phases[0].id;
}
