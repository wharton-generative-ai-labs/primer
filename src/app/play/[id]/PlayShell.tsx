'use client';

import type { ReactNode } from 'react';

import PrimerBackground from '@/app/components/PrimerBackground';
import ExperienceTitle from '@/app/components/ExperienceTitle';

/**
 * Shared chrome for the play `loading` UI, the route `error` boundary, and
 * the `PlayErrorScreen` in `page.tsx`.
 * Extracted so loading / error / bootstrap failure states cannot drift
 * visually.
 */
export default function PlayShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <PrimerBackground darkOverlay useInitialBackdrop showOverlays>
      <ExperienceTitle title={title} />
      {children}
    </PrimerBackground>
  );
}
