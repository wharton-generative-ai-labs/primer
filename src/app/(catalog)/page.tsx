import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getCachedSession } from '@/lib/getCachedSession';
import { Permission } from '@/config/auth';
import { hasMergedPermission } from '@/config/user-storage';
import { getEffectiveUserEmail } from '@/lib/devAuth';
import { BodySkeleton } from '@/app/components/ExperienceList/BodySkeleton';
import { Intro } from '@/app/components/ExperienceList/Intro';
import Section from '@/app/components/ExperienceList/Section';

export const metadata: Metadata = {
  title: 'Experiences',
};

export default async function CatalogExperiencesPage() {
  const session = await getCachedSession();
  const userEmail = getEffectiveUserEmail(session?.user?.email);

  // Middleware should already redirect unauthenticated users; this guard is
  // a defensive belt-and-suspenders for direct server calls / dev auth misses.
  if (!userEmail) {
    redirect('/auth/signin');
  }

  const isAdmin = hasMergedPermission(userEmail, Permission.ADMIN_USERS);
  const isTechnical = hasMergedPermission(userEmail, Permission.VIEW_TECHNICAL);

  return (
    <div className="flex w-full flex-col">
      <Intro />

      <Suspense fallback={<BodySkeleton />}>
        <Section userEmail={userEmail} isAdmin={isAdmin} isTechnical={isTechnical} />
      </Suspense>
    </div>
  );
}
