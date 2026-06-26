'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

import { Permission } from '@/config/auth';
import { usePermissions } from '@/app/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import type { Experience } from '@/app/lib/experiences/listExperiences';
import {
  CATALOG_FILTER_STORAGE_KEY,
  type CatalogFilters,
  DEFAULT_FILTERS,
  parseFiltersFromJsonString,
  serializeFilters,
} from '@/app/lib/catalog/filterStorage';
import { useCatalogListEnterGeneration } from '@/app/components/catalog/CatalogListEnterContext';
import { CatalogFilters as CatalogFiltersBar } from '@/app/components/catalog/CatalogFilters';
import { ExperienceCard } from '@/app/components/ExperienceCard';

const KIND_PRIORITY: Record<string, number> = {
  meta: 1,
  user: 2,
  bundled: 3,
  debugger: 4,
  template: 5,
};

interface ClientProps {
  initialExperiences: Experience[];
  isAdmin: boolean;
  isTechnical: boolean;
  userEmail: string;
}

export function Client({
  initialExperiences,
  isAdmin,
  isTechnical,
  userEmail,
}: ClientProps) {
  const { can } = usePermissions();
  const listEnterGen = useCatalogListEnterGeneration();
  const cardEnterInitial = listEnterGen === 0 ? false : { opacity: 0, y: 12 as const };
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasCommittedFiltersRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);

  const hasUser = !!userEmail;

  // useEffect (not useLayoutEffect): there's no DOM measurement here, just a
  // localStorage read that hydrates filter state. useLayoutEffect would also
  // emit the well-known "useLayoutEffect does nothing on the server" warning
  // when this component is reached via SSR.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(CATALOG_FILTER_STORAGE_KEY);
    if (raw) {
      setFilters(parseFiltersFromJsonString(raw));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasCommittedFiltersRef.current) {
      hasCommittedFiltersRef.current = true;
      return;
    }
    try {
      localStorage.setItem(CATALOG_FILTER_STORAGE_KEY, serializeFilters(filters));
    } catch {
      // private mode / quota — ignore
    }
  }, [filters]);

  // Autofocus only when the URL explicitly opts in (`?focus=search`). The
  // previous unconditional focus stole focus from screen readers landing on
  // the page heading and scrolled the viewport on iOS Safari, which softly
  // hijacked back-navigation from `/play/[id]`.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('focus') === 'search') {
      searchInputRef.current?.focus();
    }
  }, []);

  const filteredExperiences = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    return initialExperiences
      .filter((experience) => {
        if (experience.kind === 'template' && !filters.templates) return false;
        if (experience.kind === 'bundled' && !filters.bundled) return false;
        if (experience.kind === 'debugger' && !filters.debug) return false;
        const matchesSearch =
          experience.title.toLowerCase().includes(lower) ||
          experience.description.toLowerCase().includes(lower);
        if (filters.mine && userEmail) {
          return matchesSearch && experience.authorEmail === userEmail;
        }
        return matchesSearch;
      })
      .sort((a, b) => {
        const aPriority = a.kind ? (KIND_PRIORITY[a.kind] ?? 6) : 0;
        const bPriority = b.kind ? (KIND_PRIORITY[b.kind] ?? 6) : 0;
        if (aPriority !== bPriority) return aPriority - bPriority;
        const aDate = a.lastModified || a.created || '';
        const bDate = b.lastModified || b.created || '';
        return bDate.localeCompare(aDate);
      });
  }, [initialExperiences, searchQuery, filters, userEmail]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredExperiences.length === 1) {
      e.preventDefault();
      router.push(`/play/${filteredExperiences[0].id}`);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilters(DEFAULT_FILTERS);
  };

  const onFiltersChange = (next: Partial<CatalogFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  };

  const hasCatalogActivity =
    initialExperiences.length > 0 ||
    searchQuery.length > 0 ||
    filters.mine ||
    !filters.bundled ||
    filters.templates ||
    filters.debug;

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-col">
        <CatalogFiltersBar
          filters={filters}
          onFiltersChange={onFiltersChange}
          hasUser={hasUser}
          isAdmin={isAdmin}
          isTechnical={isTechnical}
          hasCatalogActivity={hasCatalogActivity}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchInputRef}
          onSearchKeyDown={handleSearchKeyDown}
          searchPlaceholder="Search experiences..."
          showInstallButton={can(Permission.UPLOAD_EXPERIENCE)}
          showAdminButton={false}
        />

        {initialExperiences.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16">
            <div className="flex flex-col items-center gap-7 rounded-lg border border-border bg-background p-10 text-center">
              <div className="flex flex-col gap-1.5">
                <p className="text-xl font-semibold text-foreground">No experiences available.</p>
              </div>
            </div>
          </div>
        ) : filteredExperiences.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16">
            <div className="flex flex-col items-center gap-7 rounded-lg border border-border bg-background p-10 text-center">
              <div className="flex flex-col gap-1.5">
                <p className="text-xl font-semibold text-foreground">
                  {searchQuery
                    ? `No experiences match "${searchQuery}".`
                    : 'No experiences match these filters.'}
                </p>
                <p className="text-base text-muted-foreground">Try adjusting your search or filters.</p>
              </div>
              <Button type="button" variant="outline" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 pb-4 grid-cols-[repeat(auto-fill,minmax(390px,1fr))]">
            <AnimatePresence>
              {filteredExperiences.map((experience) => (
                <motion.div
                  key={experience.id}
                  initial={cardEnterInitial}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.18 }}
                >
                  <ExperienceCard experience={experience} userEmail={userEmail} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
