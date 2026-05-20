import path from 'path';
import { assertExperienceId } from '@/app/server-actions/_validation';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('getExperienceBootstrap');

/**
 * Cap on the inlined `experience.json` payload that ships down to the client
 * via `bootstrapConfigText`. Beyond this we fall back to the network seed
 * (PlayClient short-circuits on empty/null) rather than ballooning the RSC
 * payload — the entire SSR HTML pays for it on every navigation.
 */
const MAX_BOOTSTRAP_CONFIG_BYTES = 256 * 1024;

export interface ExperienceBootstrap {
  title: string;
  kind?: string;
  hasComponents: boolean;
  hasReadme: boolean;
  /**
   * Verbatim `experience.json` payload. Forwarded to `PlayClient` so the
   * browser-side `ConfigLoader` can be seeded via
   * {@link import('@/app/lib/configUtils').seedExperienceConfig} instead of
   * issuing its own `/api/storage/{id}/experience.json` request.
   */
  configText: string;
}

/**
 * Discriminated reasons a bootstrap fetch can fail in a way the play RSC is
 * expected to render a tailored error screen for. Anything outside this set
 * still propagates as a thrown error.
 */
export type ExperienceBootstrapFailure = 'not-found' | 'invalid';

export type ExperienceBootstrapResult =
  | { ok: true; bootstrap: ExperienceBootstrap }
  | { ok: false; reason: ExperienceBootstrapFailure };

/**
 * Reads `experience.json` once from storage and derives the small set of
 * top-level flags `PlayClient` needs before the browser-side `ConfigLoader`
 * runs. Replaces the second `/api/storage/{id}/experience.json` fetch and the
 * `/api/experiences/{id}/readme` existence check the legacy SPA flow did
 * client-side.
 *
 * Returns the raw JSON text alongside the derived flags so the client can
 * seed its config cache with the same payload — eliminating the entry-point
 * round trip without changing how downstream resources (instructions, scenes,
 * sounds, tools) are loaded.
 *
 * Returns a `Result` for the two expected failure modes (missing file,
 * unparseable JSON) so the RSC can branch with `if (!result.ok)` instead of
 * try/catching across two custom error subclasses. Unexpected I/O errors
 * still propagate via throw (caught by `error.tsx` or the surrounding
 * `Promise.allSettled`).
 */
export async function getExperienceBootstrap(
  experienceId: string,
): Promise<ExperienceBootstrapResult> {
  assertExperienceId(experienceId);
  const storage = StorageServiceFactory.getInstance();

  const configPath = path.join(experienceId, 'experience.json');
  const readmePath = path.join(experienceId, 'README.md');

  let configText: string;
  let readmeExists: boolean;
  try {
    [configText, readmeExists] = await Promise.all([
      storage.readFileAsText(configPath),
      storage.fileExists(readmePath).catch(() => false),
    ]);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { ok: false, reason: 'not-found' };
    }
    throw err;
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(configText);
  } catch (error) {
    logger.error({ err: error, experienceId }, 'Failed to parse experience.json');
    return { ok: false, reason: 'invalid' };
  }

  const resources = (config.resources as { components?: unknown[] } | undefined) ?? {};
  const tools = (config.tools as { plugins?: string[] } | undefined) ?? {};

  const hasExistingComponents = Array.isArray(resources.components)
    ? resources.components.length > 0
    : false;
  const hasCustomComponentPlugin = Array.isArray(tools.plugins)
    ? tools.plugins.includes('@primer/custom-component-plugin')
    : false;
  // Meta-experiences that create components at runtime declare this on the
  // experience config so the bootstrap still warms up the component runtime
  // even when no components are pre-defined.
  const usesComponents = (config as { usesComponents?: unknown }).usesComponents === true;

  // Drop the inlined payload past the cap; PlayClient falls back to the
  // network seed (preserves correctness, just no zero-RTT win).
  const inlinedConfigText =
    Buffer.byteLength(configText, 'utf8') > MAX_BOOTSTRAP_CONFIG_BYTES
      ? ''
      : configText;
  if (!inlinedConfigText) {
    logger.warn(
      { experienceId, byteLength: Buffer.byteLength(configText, 'utf8') },
      'experience.json exceeds inline cap; client will refetch',
    );
  }

  return {
    ok: true,
    bootstrap: {
      title: typeof config.title === 'string' ? config.title : experienceId,
      kind: typeof config.kind === 'string' ? config.kind : undefined,
      hasComponents: hasExistingComponents || hasCustomComponentPlugin || usesComponents,
      hasReadme: readmeExists,
      configText: inlinedConfigText,
    },
  };
}
