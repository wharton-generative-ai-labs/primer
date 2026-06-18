import path from 'path';
import type { StorageService } from '@/app/lib/storage/StorageService';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { canViewExperienceInCatalog } from '@/app/lib/experiencePermissions';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('listExperiences');

/**
 * Concurrency cap for the per-experience fan-out. Without a cap, large
 * catalogs would issue one open-fd per directory in parallel, starving the
 * Node thread pool (default 4 libuv workers) and making p99 latency worse,
 * not better. Picked empirically — high enough to saturate disk on a typical
 * workstation, low enough to leave headroom for concurrent requests.
 */
const LIST_EXPERIENCES_CONCURRENCY = 16;

export interface ExperienceTool {
  source?: string;
  name: string;
}

export interface ExperienceAgent {
  key: string;
  name: string;
}

export interface Experience {
  id: string;
  title: string;
  version: string;
  description: string;
  previewImageUrl?: string;
  kind?: string;
  sceneCount?: number;
  soundsCount?: number;
  agents: ExperienceAgent[];
  initialAgent?: string;
  tools?: ExperienceTool[];
  created?: string;
  lastModified?: string;
  author?: string;
  authorEmail?: string;
  hasReadme?: boolean;
}

export interface ListExperiencesOptions {
  userEmail: string;
  includeTemplates?: boolean;
  includeBundled?: boolean;
  includeDebugger?: boolean;
}

interface RawAgent {
  name?: string;
  [key: string]: unknown;
}

/**
 * Reads every experience directory from storage and returns the catalog list
 * the current user is allowed to see. Used by the SSR catalog page; previously
 * lived in /api/experiences/route.ts.
 * Directories are processed in parallel to avoid serial fs latency.
 */
export async function listExperiences(opts: ListExperiencesOptions): Promise<Experience[]> {
  const {
    userEmail,
    includeTemplates = false,
    includeBundled = true,
    includeDebugger = false,
  } = opts;

  const storage = StorageServiceFactory.getInstance();
  const directories = await storage.listDirectories('');

  const filterOpts = {
    userEmail,
    includeTemplates,
    includeBundled,
    includeDebugger,
  };

  const results = await mapWithConcurrency(
    directories,
    LIST_EXPERIENCES_CONCURRENCY,
    (dir) => loadOneExperience(storage, filterOpts, dir),
  );

  const experiences = results.filter((e): e is Experience => e !== null);
  experiences.sort((a, b) => a.title.localeCompare(b.title));
  return experiences;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await worker(items[i]);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

async function loadOneExperience(
  storage: StorageService,
  filterOpts: {
    userEmail: string;
    includeTemplates: boolean;
    includeBundled: boolean;
    includeDebugger: boolean;
  },
  dir: string
): Promise<Experience | null> {
  const { userEmail, includeTemplates, includeBundled, includeDebugger } = filterOpts;
  const configPath = path.join(dir, 'experience.json');

  try {
    // Single read instead of `fileExists` + `readFile` — the prior version
    // double-stat'd the file and was racy if the directory was being
    // mutated between the two calls.
    let configContent: Buffer;
    try {
      configContent = await storage.readFile(configPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
    const config = JSON.parse(configContent.toString());

    const readmePath = path.join(dir, 'README.md');
    const hasReadme = await storage.fileExists(readmePath);

    const experienceData: Experience = {
      id: dir,
      title: config.title || 'Untitled Experience',
      version: config.version || '1.0.0',
      description: config.description || 'No description available',
      ...(config.resources?.scenes?.[0]
        ? { previewImageUrl: `/api/storage/${dir}/${config.resources.scenes[0]}` }
        : {}),
      ...(config.kind ? { kind: config.kind } : {}),
      ...(config.resources?.scenes?.length ? { sceneCount: config.resources.scenes.length } : {}),
      ...(config.resources?.sounds?.length ? { soundsCount: config.resources.sounds.length } : {}),
      agents: Object.entries((config.agents || {}) as Record<string, RawAgent>).map(
        ([key, agent]) => ({
          key,
          name: agent?.name || key,
        })
      ),
      ...(config.tools
        ? {
            tools: [
              ...(config.tools.builtin || []).map((p: string) => ({
                name: p.split('/').pop()?.replace('.ts', '') || '',
              })),
              ...(config.tools.bundled || []).map((p: string) => ({
                name: p.split('/').pop()?.replace('.ts', '') || '',
              })),
            ],
          }
        : {}),
      ...(config.initialAgent ? { initialAgent: config.initialAgent } : {}),
      ...(config.created ? { created: config.created } : {}),
      ...(config.lastModified ? { lastModified: config.lastModified } : {}),
      ...(config.author ? { author: config.author } : {}),
      ...(config.authorEmail ? { authorEmail: config.authorEmail } : {}),
      hasReadme,
    };

    if (experienceData.kind === 'template' && !includeTemplates) {
      return null;
    }
    if (experienceData.kind === 'bundled' && !includeBundled) {
      return null;
    }
    if (experienceData.kind === 'debugger' && !includeDebugger) {
      return null;
    }

    const canView = await canViewExperienceInCatalog({
      experienceId: dir,
      userEmail,
      authorEmail: experienceData.authorEmail,
      kind: experienceData.kind,
    });

    if (!canView) {
      return null;
    }
    return experienceData;
  } catch (error) {
    logger.warn({ configPath, err: error }, 'Failed to read experience config');
    return null;
  }
}
