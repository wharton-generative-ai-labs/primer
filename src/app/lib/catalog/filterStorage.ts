/** `localStorage` key for client-only catalog filter persistence. */
export const CATALOG_FILTER_STORAGE_KEY = 'primer.catalogFilters';

export interface CatalogFilters {
  /** Show experiences with kind "template". Admin only. */
  templates: boolean;
  /** Show experiences with kind "bundled". Default true. */
  bundled: boolean;
  /** Show experiences with kind "debugger". Technical users only. */
  debug: boolean;
  /** Show only experiences authored by the current user. */
  mine: boolean;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  templates: false,
  bundled: true,
  debug: false,
  mine: false,
};

function mergeFilters(parsed: unknown): CatalogFilters {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return DEFAULT_FILTERS;
  }
  const p = parsed as Partial<CatalogFilters>;
  return {
    templates: typeof p.templates === 'boolean' ? p.templates : DEFAULT_FILTERS.templates,
    bundled: typeof p.bundled === 'boolean' ? p.bundled : DEFAULT_FILTERS.bundled,
    debug: typeof p.debug === 'boolean' ? p.debug : DEFAULT_FILTERS.debug,
    mine: typeof p.mine === 'boolean' ? p.mine : DEFAULT_FILTERS.mine,
  };
}

/**
 * Parses a `localStorage` JSON value into a `CatalogFilters` object. Missing
 * or malformed keys fall back to {@link DEFAULT_FILTERS} so we never strand a
 * user with a partial state from a stale serialization.
 */
export function parseFiltersFromJsonString(raw: string | undefined | null): CatalogFilters {
  if (!raw) return DEFAULT_FILTERS;
  try {
    return mergeFilters(JSON.parse(raw));
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function serializeFilters(filters: CatalogFilters): string {
  return JSON.stringify(filters);
}
