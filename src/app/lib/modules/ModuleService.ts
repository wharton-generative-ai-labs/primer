import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { FILE_UPLOAD_LIMITS } from '@/config/constants';
import { createModuleLogger } from '@/lib/logger';
import { env } from '@/config/env';
import { extractZipToStorage } from './zip-utils';
import type { ModuleManifest, ModuleEntry, ModuleCatalogEntry, InstallResult } from './types';
import crypto from 'crypto';

const logger = createModuleLogger('module-service');

const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/wharton-generative-ai-labs/primer-modules/main/modules.json';

function getRegistryUrls(): string[] {
  const configured = env.MODULE_REGISTRY_URLS;
  if (configured && configured.trim().length > 0) {
    return configured.split(',').map((url: string) => url.trim()).filter(Boolean);
  }
  return [DEFAULT_REGISTRY_URL];
}

function getAuthToken(): string | undefined {
  return env.MODULE_REGISTRY_TOKEN || undefined;
}

function buildAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}

/**
 * Fetches and merges module manifests from all configured registry URLs.
 * First source wins on module ID conflicts.
 * Supports private GitHub repos via MODULE_REGISTRY_TOKEN.
 */
export async function fetchRegistry(): Promise<Record<string, ModuleEntry>> {
  const urls = getRegistryUrls();
  const merged: Record<string, ModuleEntry> = {};
  const authHeaders = buildAuthHeaders();

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json', ...authHeaders },
        next: { revalidate: 300 },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch registry from ${url}: ${response.statusText}`);
      }
      const manifest: ModuleManifest = await response.json();
      return manifest;
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const manifest = result.value;
      for (const [id, entry] of Object.entries(manifest.modules)) {
        if (!merged[id]) {
          merged[id] = entry;
        }
      }
    } else {
      logger.warn({ reason: result.reason }, 'Failed to fetch a module registry');
    }
  }

  return merged;
}

/**
 * Returns the full module catalog with install status for each module.
 */
export async function getModuleCatalog(): Promise<ModuleCatalogEntry[]> {
  const registry = await fetchRegistry();
  const storage = StorageServiceFactory.getInstance();

  const entries: ModuleCatalogEntry[] = [];

  for (const [id, entry] of Object.entries(registry)) {
    let installed = false;
    let installedVersion: string | null = null;
    let previewImageUrl: string | undefined;

    try {
      const configPath = `${id}/experience.json`;
      if (await storage.fileExists(configPath)) {
        installed = true;
        const content = await storage.readFile(configPath);
        const config = JSON.parse(content.toString());
        installedVersion = config.version || null;
        const firstScene = config?.resources?.scenes?.[0];
        if (typeof firstScene === 'string' && firstScene.length > 0) {
          previewImageUrl = `/api/storage/${id}/${firstScene}`;
        }
      }
    } catch {
      // Not installed or unreadable
    }

    const updateAvailable = installed && installedVersion !== null && installedVersion !== entry.version;

    entries.push({
      ...entry,
      id,
      installed,
      installedVersion,
      updateAvailable,
      ...(previewImageUrl ? { previewImageUrl } : {}),
    });
  }

  entries.sort((a, b) => a.title.localeCompare(b.title));
  return entries;
}

/**
 * For private GitHub repos, the browser download URL (/releases/latest/download/file.zip)
 * returns 404. We need to resolve the asset through the GitHub API instead.
 * Parses a URL like:
 *   https://github.com/{owner}/{repo}/releases/latest/download/{filename}
 * and returns the API-based download URL for the matching asset.
 */
async function resolveGitHubAssetUrl(url: string): Promise<string | null> {
  const match = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/(latest|tag\/[^/]+)\/download\/(.+)$/
  );
  if (!match) return null;

  const [, owner, repo, releaseRef, filename] = match;
  const authHeaders = buildAuthHeaders();
  if (!authHeaders['Authorization']) return null;

  const apiUrl = releaseRef === 'latest'
    ? `https://api.github.com/repos/${owner}/${repo}/releases/latest`
    : `https://api.github.com/repos/${owner}/${repo}/releases/tags/${releaseRef.replace('tag/', '')}`;

  const releaseResponse = await fetch(apiUrl, {
    headers: { 'Accept': 'application/vnd.github+json', ...authHeaders },
  });
  if (!releaseResponse.ok) return null;

  const release = await releaseResponse.json();
  const asset = release.assets?.find((a: { name: string }) => a.name === filename);
  if (!asset) return null;

  return asset.url;
}

/**
 * Downloads and installs a single module from the registry.
 * Verifies SHA-256 hash if present in the manifest.
 * For private GitHub repos, resolves release assets through the API.
 */
export async function installModule(moduleId: string, registryEntry: ModuleEntry): Promise<void> {
  const { url, sha256 } = registryEntry;
  const authHeaders = buildAuthHeaders();

  logger.info({ moduleId, url }, 'Downloading module');

  // For private repos, resolve the asset URL through the GitHub API
  const resolvedUrl = await resolveGitHubAssetUrl(url);
  const downloadUrl = resolvedUrl || url;
  const headers: Record<string, string> = {
    'Accept': 'application/octet-stream',
    ...authHeaders,
  };

  if (resolvedUrl) {
    logger.debug({ moduleId }, 'Resolved GitHub API asset URL for private repo');
  }

  const response = await fetch(downloadUrl, { headers, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to download module ${moduleId}: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length > FILE_UPLOAD_LIMITS.EXPERIENCE_MAX_SIZE) {
    throw new Error(`Module ${moduleId} exceeds size limit`);
  }

  if (sha256 && sha256.length > 0) {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (hash !== sha256) {
      throw new Error(`Integrity check failed for module ${moduleId}: expected ${sha256}, got ${hash}`);
    }
    logger.debug({ moduleId }, 'SHA-256 integrity check passed');
  }

  await extractZipToStorage(buffer, { targetId: moduleId });
  logger.info({ moduleId }, 'Module installed successfully');
}

/**
 * Resolves the dependency tree for a module and installs all missing dependencies,
 * then installs the module itself.
 */
export async function resolveAndInstall(moduleId: string): Promise<InstallResult> {
  const registry = await fetchRegistry();
  const storage = StorageServiceFactory.getInstance();

  const result: InstallResult = {
    installed: [],
    skipped: [],
    errors: [],
  };

  const entry = registry[moduleId];
  if (!entry) {
    result.errors.push({ moduleId, error: `Module "${moduleId}" not found in registry` });
    return result;
  }

  // Topological sort: collect all modules to install (dependencies first)
  const installOrder = resolveInstallOrder(moduleId, registry);

  for (const id of installOrder) {
    const moduleEntry = registry[id];
    if (!moduleEntry) {
      result.errors.push({ moduleId: id, error: `Dependency "${id}" not found in registry` });
      continue;
    }

    try {
      const exists = await storage.fileExists(`${id}/experience.json`);
      if (exists) {
        result.skipped.push(id);
        continue;
      }

      await installModule(id, moduleEntry);
      result.installed.push(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({ moduleId: id, error: message });
      logger.error({ err: error, moduleId: id }, 'Failed to install module');
    }
  }

  return result;
}

/**
 * Resolves the full install order for a module including all transitive dependencies.
 * Returns module IDs in topological order (dependencies before dependents).
 */
function resolveInstallOrder(
  moduleId: string,
  registry: Record<string, ModuleEntry>
): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const entry = registry[id];
    if (entry?.requires) {
      for (const dep of entry.requires) {
        visit(dep);
      }
    }

    order.push(id);
  }

  visit(moduleId);
  return order;
}

/**
 * Checks which required modules are missing from local storage.
 * Returns the list of missing module IDs.
 */
export async function checkDependencies(experienceId: string): Promise<string[]> {
  const storage = StorageServiceFactory.getInstance();

  try {
    const configPath = `${experienceId}/experience.json`;
    const content = await storage.readFile(configPath);
    const config = JSON.parse(content.toString());

    if (!config.requires || !Array.isArray(config.requires) || config.requires.length === 0) {
      return [];
    }

    const missing: string[] = [];
    for (const dep of config.requires) {
      const depConfigPath = `${dep}/experience.json`;
      const exists = await storage.fileExists(depConfigPath);
      if (!exists) {
        missing.push(dep);
      }
    }

    return missing;
  } catch {
    return [];
  }
}
