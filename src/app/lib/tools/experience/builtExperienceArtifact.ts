import type { ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('built-experience-artifact');

const BUILT_EXPERIENCE_TAG = 'result:experience-id';

/**
 * Server-side write of the freshly-provisioned experienceId into the
 * `Built Experience` artifact (tagged `result:experience-id`).
 *
 * The artifact is the bridge between "creation finished" and "the
 * playable experience is at this slug" — the result-phase tile in
 * `experience-creator` reads from it. Previously the agent was
 * responsible for writing it, but in two QA rounds the agent fabricated
 * UUIDs and broke the bridge. This helper takes the agent out of the
 * loop: whichever tool actually mints the new slug calls this with the
 * `ToolContext` and slug, and the platform writes it deterministically.
 *
 * Behavior:
 * - Always overwrites. Last write wins. Idempotent for genuine retries
 *   and correct for the "agent re-provisions with a different template"
 *   case.
 * - Silent (warn-logged) no-op when the experience config has no
 *   artifact tagged `result:experience-id` (e.g. experiences that don't
 *   use this convention).
 * - Silent (warn-logged) no-op when the context lacks artifact
 *   capabilities (e.g. tests, harness contexts, legacy callers).
 *
 * Diagnostic logging covers all four branches so a QA run can show
 * which path executed: missing capabilities, no tagged artifact found,
 * write attempt, write completion (or failure).
 */
export async function writeBuiltExperienceArtifact(
  context: ToolContext,
  experienceId: string,
): Promise<void> {
  if (!context.listArtifacts || !context.updateArtifact) {
    logger.warn(
      {
        hasListArtifacts: Boolean(context.listArtifacts),
        hasUpdateArtifact: Boolean(context.updateArtifact),
        experienceId,
      },
      'skipped: context missing listArtifacts or updateArtifact capability',
    );
    return;
  }

  const artifacts = await context.listArtifacts();
  const tagged = artifacts.find((artifact: any) =>
    artifact?.metadata?.tags?.includes(BUILT_EXPERIENCE_TAG),
  );

  if (!tagged) {
    logger.warn(
      {
        artifactCount: artifacts.length,
        tagSamples: artifacts
          .map((a: any) => ({ id: a?.id, tags: a?.metadata?.tags }))
          .slice(0, 20),
        experienceId,
      },
      `skipped: no artifact tagged ${BUILT_EXPERIENCE_TAG} in this session`,
    );
    return;
  }

  logger.debug({ taggedId: tagged.id, experienceId }, 'writing experienceId into Built Experience artifact');

  try {
    await context.updateArtifact(tagged.id, experienceId);
  } catch (error) {
    logger.error(
      { taggedId: tagged.id, experienceId, err: error },
      'failed to write experienceId into Built Experience artifact',
    );
    throw error;
  }

  logger.debug({ taggedId: tagged.id, experienceId }, 'wrote experienceId into Built Experience artifact');
}
