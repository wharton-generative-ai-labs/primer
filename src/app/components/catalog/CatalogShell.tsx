'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import PrimerBackground from '@/app/components/PrimerBackground';
import type { FooterType } from '@/app/components/Footer';
import { CatalogListEnterContext } from '@/app/components/catalog/CatalogListEnterContext';

interface CatalogShellProps {
  children: React.ReactNode;
}

/**
 * Client wrapper for the catalog (`/`, `/modules`) route group. Hosts the
 * `PrimerBackground` chrome (Header + Footer + animated backdrop) and derives
 * the footer variant from the current pathname, and a list "enter generation"
 * used so card grids can animate in after in-catalog navigation but not after
 * the first paint following the shared route `loading` fallback.
 */
export function CatalogShell({ children }: CatalogShellProps) {
  const pathname = usePathname();
  const pathRef = useRef<string | undefined>(undefined);
  const [listEnterGen, setListEnterGen] = useState(0);
  const footerType: FooterType = pathname?.startsWith('/modules') ? 'modules' : 'home';

  // useEffect (not useLayoutEffect): no DOM measurement, just a counter bump
  // for the next-tick AnimatePresence enter on cross-route navigation. The
  // pre-paint timing isn't required and useLayoutEffect logs a server warning.
  useEffect(() => {
    if (pathRef.current !== undefined && pathRef.current !== pathname) {
      setListEnterGen((g) => g + 1);
    }
    pathRef.current = pathname;
  }, [pathname]);

  return (
    <PrimerBackground useInitialBackdrop footerType={footerType}>
      <CatalogListEnterContext.Provider value={listEnterGen}>
        <div className="mx-auto flex w-full flex-col px-10 md:px-28 pt-10 pb-10 2xl:max-w-screen-2xl">
          {children}
        </div>
      </CatalogListEnterContext.Provider>
    </PrimerBackground>
  );
}
