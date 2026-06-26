import { Intro } from '@/app/components/ExperienceList/Intro';
import { BodySkeleton } from '@/app/components/ExperienceList/BodySkeleton';

export default function ExperiencesLoading() {
  return (
    <div className="flex w-full flex-col">
      <Intro />
      <BodySkeleton />
    </div>
  );
}
