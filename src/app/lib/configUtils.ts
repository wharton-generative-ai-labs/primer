import { Resource, ExperienceMetadata, ConfigResponse, AgentConfig, ValidationReport, AIConfiguration } from './types';
import { ConfigLoader, type LoadPhase, type LoadPhaseCallback } from './ConfigLoader';
import { HttpLoader } from './HttpLoader';
import { ExperienceURLError, validateAndProcessExperienceURL } from './experience-url-utils';
import { ToolDefinition } from './types';

export type { LoadPhase, LoadPhaseCallback } from './ConfigLoader';

/**
 * Memoized loader entry. The play loading flow re-enters `getConfig` from
 * multiple places (PlayClient bootstrap, prefetch warm-ups, strict-mode
 * remounts) so the loader, the in-flight promise, and the cumulative phase
 * progress all need to be cached together — keyed by the URL we last
 * initialized for.
 */
interface LoaderEntry {
    loader: ConfigLoader;
    configPromise: Promise<ConfigResponse>;
    /** Phases the loader has already emitted. Replayed to late subscribers. */
    resolvedPhases: Set<LoadPhase>;
    /** Active subscribers. Phase events are fanned out to all of them. */
    phaseSubscribers: Set<LoadPhaseCallback>;
}

let currentEntry: LoaderEntry | null = null;
let lastConfigUrl: string | null = null;

function createLoader(configPath: string): HttpLoader {
    const loader = new HttpLoader();
    loader.basePath = configPath;
    return loader;
}

function broadcastPhase(entry: LoaderEntry, phase: LoadPhase): void {
    entry.resolvedPhases.add(phase);
    // Snapshot the subscriber list before iterating so a callback that
    // unsubscribes (or re-subscribes) during dispatch can't skip or
    // double-fire siblings.
    const snapshot = Array.from(entry.phaseSubscribers);
    for (const sub of snapshot) {
        try {
            sub(phase);
        } catch {
            // Subscriber callbacks must never block the load pipeline.
        }
    }
}

/**
 * Drive the loader from a freshly-created entry. Phase events are routed
 * through {@link broadcastPhase} so already-resolved phases land in the
 * entry's record (for late subscribers) before any in-flight subscriber sees
 * them.
 */
async function runLoader(entry: LoaderEntry, processedUrl: string): Promise<ConfigResponse> {
    try {
        await entry.loader.loadExperience(processedUrl, (phase) =>
            broadcastPhase(entry, phase),
        );
        return await entry.loader.loadConfig((phase) => broadcastPhase(entry, phase));
    } catch (error) {
        if (error instanceof Error) {
            throw new ExperienceURLError(error.message);
        }
        throw new ExperienceURLError('Unknown error loading Experience configuration');
    }
}

function attachSubscriber(entry: LoaderEntry, onPhase: LoadPhaseCallback): void {
    // Replay synchronously so a late subscriber (e.g. one mounted after the
    // loader is already partway through) doesn't miss phases that fired
    // before it attached. Iteration order matches insertion order, which
    // matches the loader's natural firing order.
    for (const phase of entry.resolvedPhases) {
        try {
            onPhase(phase);
        } catch {
            // Subscriber callbacks must never block.
        }
    }
    entry.phaseSubscribers.add(onPhase);
}

/**
 * Returns the cached `ConfigResponse` promise for `experienceUrl`, kicking
 * off a fresh load if this is the first call (or the URL changed since
 * last call).
 *
 * @param experienceUrl `experience.json` URL.
 * @param onPhase Optional progress callback. Receives every phase the loader
 *   has emitted so far (synchronously, on subscription) plus every phase
 *   that emits afterwards. Subscribers from the same memoized load all
 *   receive identical phase streams. Note: there is no formal unsubscribe —
 *   subscribers are released when the URL changes (or when a new load is
 *   forced via {@link seedExperienceConfig}). Consumers who care about
 *   stale-callback semantics should guard their handler with a `cancelled`
 *   flag from their own `useEffect` cleanup.
 */
export const getConfig = (
    experienceUrl: string,
    onPhase?: LoadPhaseCallback,
): Promise<ConfigResponse> => {
    const processedUrl = validateAndProcessExperienceURL(experienceUrl);

    if (!currentEntry || lastConfigUrl !== processedUrl) {
        lastConfigUrl = processedUrl;
        const entry: LoaderEntry = {
            loader: new ConfigLoader(createLoader(processedUrl)),
            configPromise: undefined as unknown as Promise<ConfigResponse>,
            resolvedPhases: new Set(),
            phaseSubscribers: new Set(),
        };
        entry.configPromise = runLoader(entry, processedUrl);
        currentEntry = entry;
    }

    if (onPhase) {
        attachSubscriber(currentEntry, onPhase);
    }

    return currentEntry.configPromise;
};

/**
 * Pre-populate the config cache with `experience.json` text already fetched on
 * the server (typically inside a React Server Component via
 * `getExperienceBootstrap`). This skips the redundant client-side HTTP fetch
 * for the entry-point config without changing anything else about how the
 * client-side `ConfigLoader` runs (instructions, scenes, sounds, agents, and
 * tools still load and validate normally).
 *
 * Idempotent: calling repeatedly with the same URL is a no-op so callers can
 * invoke this freely from a render path or a `useEffect` without worrying
 * about React strict-mode double-mounts.
 */
export const seedExperienceConfig = (experienceUrl: string, configText: string): void => {
    // Hard fence: the loader resolves URLs against `window.location.origin`,
    // so calling this on the server (e.g. an accidental import into an RSC)
    // would silently produce a cache entry the client would never see. Better
    // to fail loudly during development than ship a cache miss to production.
    if (typeof window === 'undefined') {
        throw new Error(
            'seedExperienceConfig was called from a server context (typeof window === "undefined") — this helper must run on the client',
        );
    }

    // Empty configText means the server skipped inlining (e.g. payload over
    // the size cap). Fall through to the network path on demand instead of
    // priming the cache with an empty string that would short-circuit fetch.
    if (!configText) {
        return;
    }

    const processedUrl = validateAndProcessExperienceURL(experienceUrl);

    if (currentEntry && lastConfigUrl === processedUrl) {
        return;
    }

    const httpLoader = createLoader(processedUrl);
    httpLoader.seed(processedUrl, configText);
    const entry: LoaderEntry = {
        loader: new ConfigLoader(httpLoader),
        configPromise: undefined as unknown as Promise<ConfigResponse>,
        resolvedPhases: new Set(),
        phaseSubscribers: new Set(),
    };
    entry.configPromise = runLoader(entry, processedUrl);
    currentEntry = entry;
    lastConfigUrl = processedUrl;
};

export const getValidationReport = (): ValidationReport | null => {
    if (!currentEntry) {
        return null;
    }
    return currentEntry.loader.getValidationReport();
};

const handleConfigError = async <T>(promise: Promise<T>): Promise<T> => {
    try {
        return await promise;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('An unexpected error occurred.');
    }
};

export const getAgents = async (experienceUrl: string): Promise<Record<string, AgentConfig>> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.agents));
};

export const getExperienceMetadata = async (experienceUrl: string): Promise<ExperienceMetadata> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.metadata));
};

export const getScenes = async (experienceUrl: string): Promise<Resource[]> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.resources.scenes));
};

export const getSounds = async (experienceUrl: string): Promise<Resource[]> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.resources.sounds));
};

export const getTools = async (experienceUrl: string): Promise<Record<string, ToolDefinition>> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.tools || {}));
};

export const getAIConfigurations = async (experienceUrl: string): Promise<Record<string, AIConfiguration>> => {
    return handleConfigError(getConfig(experienceUrl).then(config => config.aiConfigurations || {}));
};
