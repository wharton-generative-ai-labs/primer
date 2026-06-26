/**
 * Tests for catalog filter persistence helpers.
 *
 * `parseFiltersFromJsonString` is the only fallback boundary between user
 * `localStorage` (which can be hand-edited or carry old shapes) and the React
 * tree, so we exercise the round-trip with `serializeFilters` plus the tricky
 * fallback cases (missing keys, wrong types, malformed JSON, non-objects).
 */

import {
  CATALOG_FILTER_STORAGE_KEY,
  DEFAULT_FILTERS,
  parseFiltersFromJsonString,
  serializeFilters,
  type CatalogFilters,
} from '../filterStorage';

describe('catalog/filterStorage', () => {
  describe('CATALOG_FILTER_STORAGE_KEY', () => {
    it('uses a stable, namespaced key', () => {
      expect(CATALOG_FILTER_STORAGE_KEY).toBe('primer.catalogFilters');
    });
  });

  describe('serializeFilters / parseFiltersFromJsonString round-trip', () => {
    it('round-trips the default filters', () => {
      const round = parseFiltersFromJsonString(serializeFilters(DEFAULT_FILTERS));
      expect(round).toEqual(DEFAULT_FILTERS);
    });

    it('round-trips a fully-populated, non-default object', () => {
      const filters: CatalogFilters = {
        templates: true,
        bundled: false,
        debug: true,
        mine: true,
      };
      expect(parseFiltersFromJsonString(serializeFilters(filters))).toEqual(filters);
    });
  });

  describe('parseFiltersFromJsonString fallbacks', () => {
    it('returns DEFAULT_FILTERS for null input', () => {
      expect(parseFiltersFromJsonString(null)).toEqual(DEFAULT_FILTERS);
    });

    it('returns DEFAULT_FILTERS for undefined input', () => {
      expect(parseFiltersFromJsonString(undefined)).toEqual(DEFAULT_FILTERS);
    });

    it('returns DEFAULT_FILTERS for an empty string', () => {
      expect(parseFiltersFromJsonString('')).toEqual(DEFAULT_FILTERS);
    });

    it('returns DEFAULT_FILTERS for malformed JSON', () => {
      expect(parseFiltersFromJsonString('{not json')).toEqual(DEFAULT_FILTERS);
    });

    it('returns DEFAULT_FILTERS when JSON parses to null', () => {
      expect(parseFiltersFromJsonString('null')).toEqual(DEFAULT_FILTERS);
    });

    it('returns DEFAULT_FILTERS when JSON parses to a primitive', () => {
      expect(parseFiltersFromJsonString('42')).toEqual(DEFAULT_FILTERS);
      expect(parseFiltersFromJsonString('"hello"')).toEqual(DEFAULT_FILTERS);
      expect(parseFiltersFromJsonString('true')).toEqual(DEFAULT_FILTERS);
    });

    it('returns DEFAULT_FILTERS when JSON parses to an array', () => {
      expect(parseFiltersFromJsonString('[true, false, true, false]')).toEqual(DEFAULT_FILTERS);
    });

    it('fills in missing keys from DEFAULT_FILTERS', () => {
      // Only `mine` is set, so `templates`, `bundled`, and `debug` should fall back.
      const result = parseFiltersFromJsonString(JSON.stringify({ mine: true }));
      expect(result).toEqual({
        ...DEFAULT_FILTERS,
        mine: true,
      });
    });

    it('coerces non-boolean values per-key to defaults', () => {
      const result = parseFiltersFromJsonString(
        JSON.stringify({
          templates: 'yes',
          bundled: 0,
          debug: null,
          mine: true,
        }),
      );
      // Only `mine` is a real boolean; the rest get the DEFAULT value.
      expect(result).toEqual({
        templates: DEFAULT_FILTERS.templates,
        bundled: DEFAULT_FILTERS.bundled,
        debug: DEFAULT_FILTERS.debug,
        mine: true,
      });
    });

    it('ignores extra unknown keys', () => {
      const result = parseFiltersFromJsonString(
        JSON.stringify({
          ...DEFAULT_FILTERS,
          someFutureFlag: true,
        }),
      );
      expect(result).toEqual(DEFAULT_FILTERS);
      expect(result).not.toHaveProperty('someFutureFlag');
    });
  });
});
