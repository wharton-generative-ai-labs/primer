'use client';

import React from 'react';
import { CheckCircle2, Info, Undo2Icon } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export type DocBannerProps = {
  currentRev: number;
  focusedRev: number;
  onRestore: () => void | Promise<void>;
};

// Figma 153:2894: single-line 52px row, no title.
// - Updated  (focusedRev === currentRev, currentRev > 1) → success variant + check-circle.
// - Historical (focusedRev < currentRev)                 → accent variant + info-circle + inline Restore.
// - currentRev === 1                                     → null (first draft, no banner).
//
// We override shadcn Alert's defaults (which absolutely-position the icon for a
// title+description layout) to a single-row flex.
const ROW_BASE =
  'flex h-[52px] w-full items-center gap-1.5 rounded-none border-0 px-0 py-0 pl-6 pr-[18px] text-sm font-medium [&>svg]:static [&>svg]:translate-y-0';

export function DocBanner({ currentRev, focusedRev, onRestore }: DocBannerProps) {
  if (currentRev <= 1) {
    return null;
  }

  const isHistorical = focusedRev < currentRev;

  if (!isHistorical) {
    return (
      <Alert variant="success" className={ROW_BASE} role="status">
        <CheckCircle2 className="h-5 w-5" aria-hidden />
        <span>Your simulation design has been successfully updated.</span>
      </Alert>
    );
  }

  return (
    <Alert variant="accent" className={ROW_BASE} role="status">
      <Info className="h-5 w-5" aria-hidden />
      <span>
        Viewing version {focusedRev} of {currentRev}.
      </span>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="ml-auto !ps-2"
        onClick={() => void onRestore()}
      >
        <Undo2Icon className="size-4" />
        Restore this version
      </Button>
    </Alert>
  );
}
