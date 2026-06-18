import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const GRID = 'grid gap-5 pb-4 md:grid-cols-[repeat(auto-fill,minmax(390px,1fr))]';

type CatalogGridSkeletonProps = {
  /** e.g. `@/app/components/ViewModules/BodySkeleton` uses `gap-4` to match the modules page grid. */
  className?: string;
};

/** Placeholder card grid for catalog routes while the list is still loading. */
export function CatalogGridSkeleton({ className }: CatalogGridSkeletonProps) {
  return (
    <div className={cn(GRID, className)}>
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i} className="flex h-full w-full flex-col overflow-hidden p-0">
          <div className="h-[250px] w-full shrink-0 animate-pulse bg-muted" />
          <CardContent className="flex flex-1 flex-col gap-5 p-6">
            <div className="h-4 w-20 shrink-0 animate-pulse rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-5 w-3/4 max-w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-full max-w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 max-w-full animate-pulse rounded bg-muted" />
            </div>
            <div className="mt-auto flex gap-2.5">
              <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
              <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
