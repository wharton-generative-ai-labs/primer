import type { ToolContext } from '@/app/lib/tools/types';

/**
 * Track B — platform-side resolution of the canonical build artifacts.
 *
 * Background: in QA Round 3 the orchestrator delegated to
 * `experience-builder` with FABRICATED UUIDs as `artifactIds` even though
 * the actual artifact ids in storage are slugs (`mentor_prompt`,
 * `mentor_scene`, ...). The placeholder copy in the agent's instruction
 * file ("`[artifact-uuid]`", `"a1b2c3d4-uuid"`) trained the model to
 * convert slugs into UUIDs. Track A removes the misleading placeholders;
 * this Track B helper removes the model's room to drift entirely.
 *
 * Conventions used to bootstrap the builder pipeline:
 * - Casting Director publishes character prompts under the slugs
 *   `mentor_prompt` / `practice_prompt` / `feedback_prompt`.
 * - Image Generation Agent publishes scene images under the slugs
 *   `mentor_scene` / `practice_scene` / `feedback_scene`.
 *
 * The helper enumerates the parent session's artifacts via
 * `context.listArtifacts()` and returns deterministic deploy plans for
 * each canonical slug it finds. Slugs that are missing are surfaced in
 * `result.missing` (with the role each was meant to fill) so the caller
 * can fail loudly instead of writing a half-built experience.
 *
 * Output ordering is always `mentor → practice → feedback` regardless of
 * the order artifacts appear in storage — this matches the experience
 * scaffold's expectations and keeps the deploy log readable.
 */

const PROMPT_DEFINITIONS = [
  { artifactId: 'mentor_prompt',   destinationPath: 'resources/instructions/agent', fileName: 'mentor.md' },
  { artifactId: 'practice_prompt', destinationPath: 'resources/instructions/agent', fileName: 'practice.md' },
  { artifactId: 'feedback_prompt', destinationPath: 'resources/instructions/agent', fileName: 'feedback.md' },
] as const;

const SCENE_DEFINITIONS = [
  { artifactId: 'mentor_scene',   destinationPath: 'resources/scenes', fileName: 'mentor-scene.png' },
  { artifactId: 'practice_scene', destinationPath: 'resources/scenes', fileName: 'practice-scene.png' },
  { artifactId: 'feedback_scene', destinationPath: 'resources/scenes', fileName: 'feedback-scene.png' },
] as const;

export interface DiscoveredAsset {
  artifactId: string;
  destinationPath: string;
  fileName: string;
}

export interface MissingAsset {
  artifactId: string;
  kind: 'prompt' | 'scene';
}

export interface DiscoveredBuildArtifacts {
  prompts: DiscoveredAsset[];
  scenes: DiscoveredAsset[];
  missing: MissingAsset[];
}

export async function discoverBuildArtifacts(
  context: ToolContext,
): Promise<DiscoveredBuildArtifacts> {
  if (!context.listArtifacts) {
    throw new Error(
      'discoverBuildArtifacts: context.listArtifacts is unavailable',
    );
  }

  const artifacts = await context.listArtifacts();
  const presentIds = new Set(
    artifacts
      .map((a: any) => a?.id)
      .filter((id: unknown): id is string => typeof id === 'string'),
  );

  const prompts: DiscoveredAsset[] = [];
  const scenes: DiscoveredAsset[] = [];
  const missing: MissingAsset[] = [];

  for (const definition of PROMPT_DEFINITIONS) {
    if (presentIds.has(definition.artifactId)) {
      prompts.push({ ...definition });
    } else {
      missing.push({ artifactId: definition.artifactId, kind: 'prompt' });
    }
  }

  for (const definition of SCENE_DEFINITIONS) {
    if (presentIds.has(definition.artifactId)) {
      scenes.push({ ...definition });
    } else {
      missing.push({ artifactId: definition.artifactId, kind: 'scene' });
    }
  }

  return { prompts, scenes, missing };
}
