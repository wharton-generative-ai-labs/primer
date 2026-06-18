import { listExperiences } from '@/app/lib/experiences/listExperiences';
import { Client } from './Client';

export interface SectionProps {
  userEmail: string;
  isAdmin: boolean;
  isTechnical: boolean;
}

/**
 * Server component that awaits `listExperiences` and is intended to be wrapped
 * in `<Suspense>` so the page intro can stream first.
 */
export default async function Section({
  userEmail,
  isAdmin,
  isTechnical,
}: SectionProps) {
  // One broad fetch; filter checkboxes (templates/bundled/debug/mine) are client-only
  // so changing them does not re-run this slow path.
  const experiences = await listExperiences({
    userEmail,
    includeTemplates: isAdmin,
    includeBundled: true,
    includeDebugger: isTechnical,
  });

  return (
    <Client
      initialExperiences={experiences}
      isAdmin={isAdmin}
      isTechnical={isTechnical}
      userEmail={userEmail}
    />
  );
}
