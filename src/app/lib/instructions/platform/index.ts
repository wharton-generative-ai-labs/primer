/**
 * Platform-level supplemental instruction content.
 *
 * These strings are merged into every experience's agent prompts,
 * keyed by supplemental name (the part that appears inside `{{...}}`).
 * Experience authors can extend or override per key via their own
 * `resources/instructions/supplemental/<key>.md` file — see
 * InstructionProcessor for the merge rules.
 *
 * `getPlatformSupplemental(config?)` selects phase-aware variants when
 * the experience declares `workflowPhases`. The selection happens once
 * at instruction load time; switching variants mid-session is not
 * supported (and is unnecessary — phase membership is dynamic, the
 * baseline guidance is not).
 */

import type { ExperienceConfig } from '@/app/lib/types';

import { tools } from './tools';
import { agent, agentPhased } from './agent';
import { errorHandling } from './errorHandling';
import { documentStyle } from './documentStyle';

export interface PlatformSupplementalOptions {
  hasWorkflowPhases?: boolean;
}

/**
 * Resolve the platform supplemental record for an experience.
 *
 * Pass either an `ExperienceConfig` (preferred — single source of truth)
 * or a `PlatformSupplementalOptions` shape for callers that already
 * computed `hasWorkflowPhases` themselves.
 */
export function getPlatformSupplemental(
  configOrOptions?: ExperienceConfig | PlatformSupplementalOptions,
): Record<string, string> {
  let hasWorkflowPhases = false;

  if (configOrOptions) {
    const maybeConfig = configOrOptions as ExperienceConfig;
    if (Array.isArray(maybeConfig.workflowPhases)) {
      hasWorkflowPhases = maybeConfig.workflowPhases.length > 0;
    } else {
      hasWorkflowPhases =
        (configOrOptions as PlatformSupplementalOptions).hasWorkflowPhases ===
        true;
    }
  }

  return {
    tools,
    agent: hasWorkflowPhases ? agentPhased : agent,
    errorHandling,
    documentStyle,
  };
}
