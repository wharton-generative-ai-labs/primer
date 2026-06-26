import { Intro } from '@/app/components/ViewModules/Intro';
import { BodySkeleton } from '@/app/components/ViewModules/BodySkeleton';

export default function ModulesLoading() {
  return (
    <div className="flex w-full flex-col">
      <Intro />
      <BodySkeleton />
    </div>
  );
}
