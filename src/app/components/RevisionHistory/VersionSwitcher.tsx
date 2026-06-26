'use client';

import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import type { ArtifactRevisionMeta } from '@/app/lib/artifacts/types';
import { getRelativeTimeString } from '@/app/lib/date-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

function authorLabel(meta: ArtifactRevisionMeta): string {
  const { author } = meta;
  if (author.kind === 'user') return author.name || author.email;
  if (author.kind === 'agent') return author.name;
  return 'System';
}

export type VersionSwitcherProps = {
  artifactId: string;
  currentRev: number;
  focusedRev: number;
  revisions: ArtifactRevisionMeta[] | undefined;
  onOpen: () => void | Promise<void>;
  onSelectRev: (artifactId: string, rev: number) => void;
  /** When true, renders an icon-only trigger (for small containers where
   *  the sidebar is hidden). The dropdown still shows full revision detail. */
  compact?: boolean;
};

export function VersionSwitcher({
  artifactId,
  currentRev,
  focusedRev,
  revisions,
  onOpen,
  onSelectRev,
  compact = false,
}: VersionSwitcherProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && revisions === undefined) {
      void onOpen();
    }
  }, [open, revisions, onOpen]);

  if (currentRev <= 1) {
    return null;
  }

  const loading = open && revisions === undefined;

  // Full trigger label for the sidebar variant.
  let triggerLabel: string;
  if (revisions === undefined) {
    triggerLabel = loading ? 'Loading versions…' : `Version ${focusedRev}`;
  } else if (focusedRev === currentRev) {
    triggerLabel = 'Latest version';
  } else if (revisions.length > 0) {
    const focused = revisions.find((r) => r.rev === focusedRev);
    triggerLabel = focused
      ? `Version ${focusedRev} · ${getRelativeTimeString(focused.createdAt)}`
      : `Version ${focusedRev}`;
  } else {
    triggerLabel = `Version ${focusedRev}`;
  }

  const items = loading ? (
    <div className="px-2 py-3 text-sm text-muted-foreground">Loading versions…</div>
  ) : (
    (revisions ?? []).map((r) => (
      <SelectItem key={r.rev} value={String(r.rev)}>
        Version {r.rev} · {authorLabel(r)} · {getRelativeTimeString(r.createdAt)}
      </SelectItem>
    ))
  );

  if (compact) {
    return (
      <Select
        value={String(focusedRev)}
        onValueChange={(v) => onSelectRev(artifactId, Number.parseInt(v, 10))}
        open={open}
        onOpenChange={setOpen}
      >
        <SelectTrigger
          aria-label="Document version history"
        >
          <History className="mx-auto size-5" />
        </SelectTrigger>
        <SelectContent align="end">{items}</SelectContent>
      </Select>
    );
  }

  return (
    <div className="mb-4">
      <Select
        value={String(focusedRev)}
        onValueChange={(v) => onSelectRev(artifactId, Number.parseInt(v, 10))}
        open={open}
        onOpenChange={setOpen}
      >
        <SelectTrigger className="w-full text-left" aria-label="Document version">
          <span className="truncate">{triggerLabel}</span>
        </SelectTrigger>
        <SelectContent>{items}</SelectContent>
      </Select>
    </div>
  );
}
