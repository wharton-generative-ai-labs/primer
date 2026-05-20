'use client';

import { createContext, useContext } from 'react';

/**
 * Increments when the catalog pathname changes (`/` ⟷ `/modules` …) so list
 * cards can run an enter motion after client-side navigation, but stay
 * `initial={false}` on the first in-shell paint (e.g. after the route loading
 * skeleton) when generation is still 0.
 */
const CatalogListEnterContext = createContext(0);

export { CatalogListEnterContext };

export function useCatalogListEnterGeneration(): number {
  return useContext(CatalogListEnterContext);
}
