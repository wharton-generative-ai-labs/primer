import { CatalogGridSkeleton } from '@/app/components/catalog/CatalogGridSkeleton';

/**
 * Matches `./Client` while `getModuleCatalog` / navigation is in flight:
 * search-only toolbar, optional result-count line, then the card grid.
 * (The experiences skeleton includes Install/Filter/Admin, which are hidden on modules.)
 */
export function BodySkeleton() {
  return (
    <div className="flex w-full flex-col">
      <div
        className="mb-5 flex flex-wrap items-center justify-center gap-3"
        aria-hidden
      >
        <div className="relative w-full sm:w-64 lg:me-10">
          <div className="h-9 w-full rounded-md border border-border bg-muted/60 animate-pulse" />
          <div
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-sm bg-muted-foreground/20"
            aria-hidden
          />
        </div>
      </div>

      <div
        className="mb-4 h-4 w-44 max-w-full rounded bg-muted/70 animate-pulse"
        aria-hidden
      />
      <CatalogGridSkeleton className="grid gap-5 pb-4 md:grid-cols-2 xl:grid-cols-3" />
    </div>
  );
}
