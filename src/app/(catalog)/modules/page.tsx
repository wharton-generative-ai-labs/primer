import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getCachedSession } from '@/lib/getCachedSession';
import { getEffectiveUserEmail } from '@/lib/devAuth';
import { Intro } from '@/app/components/ViewModules/Intro';
import { BodySkeleton } from '@/app/components/ViewModules/BodySkeleton';
import Section from '@/app/components/ViewModules/Section';

export const metadata: Metadata = {
  // Suffix is added by the catalog layout's `title.template`.
  title: 'Modules',
};

export default async function ModulesPage() {
  const session = await getCachedSession();
  const userEmail = getEffectiveUserEmail(session?.user?.email);

  if (!userEmail) {
    redirect('/auth/signin');
  }

  return (
    <div className="flex w-full flex-col">
      <Intro />
      <Suspense fallback={<BodySkeleton />}>
        <Section />
      </Suspense>
    </div>
  );
}
