import { Card, CardContent } from '@/components/ui/card';

export function ExperienceCardSkeleton() {
  return (
    <Card className="flex w-full flex-col overflow-hidden p-0 h-full">
      <div className="h-[250px] w-full shrink-0 animate-pulse bg-muted" />
      <CardContent className="flex flex-1 flex-col gap-5 p-6">
        <div className="space-y-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-auto flex gap-2.5">
          <div className="h-10 w-36 animate-pulse rounded-md bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
