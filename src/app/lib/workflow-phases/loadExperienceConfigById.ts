/**
 * Thin utility: load `experience.json` from disk for a given experienceId.
 *
 * Intentionally kept as a standalone module so it can be cleanly mocked in
 * unit tests without pulling in the full ConfigLoader stack.
 */

import fs from 'fs/promises';
import path from 'path';

import { getExperienceFolder } from '@/app/lib/file-utils';
import type { ExperienceConfig } from '@/app/lib/types';

/**
 * Read and parse `storage/{experienceId}/experience.json`.
 * Throws if the file is missing or unparseable — callers that need
 * best-effort behaviour should wrap in try/catch themselves.
 */
export async function loadExperienceConfigById(
  experienceId: string,
): Promise<ExperienceConfig> {
  const folder = await getExperienceFolder(experienceId);
  const raw = await fs.readFile(path.join(folder, 'experience.json'), 'utf-8');
  return JSON.parse(raw) as ExperienceConfig;
}
