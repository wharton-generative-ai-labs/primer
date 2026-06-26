'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { TranscriptItem } from '@/app/lib/types';
import { agentPalette } from './palette';

export function HandoffDivider({
  item,
  pending,
}: {
  item: TranscriptItem;
  pending?: boolean;
}) {
  const from = (item.data?.from as string | undefined) ?? item.agentName;
  const to = item.data?.to as string | undefined;
  const rationale = item.data?.rationale as string | undefined;
  // Destination agentKey isn't on the breadcrumb, so we hash the to-name for
  // a stable-looking tint. Good enough for a divider; not a load-bearing id.
  const toPal = agentPalette(to ?? '');
  return (
    <div className="my-2 flex items-center gap-3">
      <div className="h-px flex-1 bg-slate-200" />
      <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] ${toPal.bg} ${toPal.text}`}>
        <span className="font-medium">{from ?? '?'}</span>
        <span aria-hidden>→</span>
        <span className="font-semibold">{to ?? '?'}</span>
        {pending && <Loader2 className="h-3 w-3 animate-spin" />}
        {rationale && (
          <span className="hidden max-w-[240px] truncate opacity-70 sm:inline">· {rationale}</span>
        )}
      </div>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
