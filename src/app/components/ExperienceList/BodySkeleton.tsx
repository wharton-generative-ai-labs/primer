import { CatalogGridSkeleton } from '@/app/components/catalog/CatalogGridSkeleton';

/**
 * Stand-in for the catalog filters + card grid while the async list is pending.
 * Shapes follow `@/app/components/catalog/CatalogFilters.tsx`: search (with
 * trailing icon), Install experience, Filter (with count badge), Admin.
 */
export function BodySkeleton() {
  return (
    <div className="flex w-full flex-col">
      <div
        className="mb-5 flex flex-wrap items-center justify-center gap-3"
        aria-hidden
      >
        {/* Search — w-full sm:w-64, icon right (pr-9 on real Input) */}
        <div className="relative w-full sm:w-64 lg:me-10">
          <div className="h-9 w-full rounded-md border border-border bg-muted/60 animate-pulse" />
          <div
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-sm bg-muted-foreground/20"
            aria-hidden
          />
        </div>

        {/* Install Experience — size="lg" outline: icon + label */}
        <div className="flex h-10 w-[12.5rem] max-w-full shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 sm:w-auto sm:min-w-48">
          <div className="size-5 shrink-0 rounded-sm bg-muted animate-pulse" />
          <div className="h-3.5 w-full min-w-0 max-w-[9.5rem] rounded-sm bg-muted animate-pulse" />
        </div>

        {/* Filter — Sliders + "Filter" + badge (matches active-Filters count pill) */}
        <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background pl-1.5 pr-2.5">
          <div className="size-5 shrink-0 rounded-sm bg-muted animate-pulse" />
          <div className="h-3.5 w-9 rounded-sm bg-muted animate-pulse" />
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/50"
            aria-hidden
          >
            <span className="h-1.5 w-2.5 rounded-full bg-sky-400/60 dark:bg-sky-500/50" />
          </span>
        </div>

        {/* Admin — Shield + label */}
        <div className="flex h-10 w-[5.75rem] shrink-0 items-center gap-2 rounded-md border border-border bg-background pl-1.5 pr-3">
          <div className="size-5 shrink-0 rounded-sm bg-muted animate-pulse" />
          <div className="h-3.5 w-9 rounded-sm bg-muted animate-pulse" />
        </div>
      </div>

      <CatalogGridSkeleton />
    </div>
  );
}
