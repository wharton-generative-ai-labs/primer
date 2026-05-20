import { Suspense } from 'react';
import type { Metadata } from 'next';

import { CatalogShell } from '@/app/components/catalog/CatalogShell';

export const metadata: Metadata = {
  title: {
    // `default` covers any catalog-group route that doesn't export its own
    // metadata; `template` lets nested pages set just their own segment
    // (e.g. "Modules") and we automatically append the brand suffix.
    default: 'Primer',
    template: '%s — Primer',
  },
  description:
    'Open-source AI platform enabling educators to create interactive learning tools without coding. Created by Wharton Generative AI Labs.',
};

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <CatalogShell>{children}</CatalogShell>
    </Suspense>
  );
}
