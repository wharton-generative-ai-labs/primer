'use client';

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { AgentConfig, TranscriptItem } from '@/app/lib/types';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { agentPalette } from './palette';

/**
 * Single filter trigger that replaces the per-agent chip row. Hidden until 2+
 * agents have appeared — same visibility rule as the old chips. Selecting a
 * speaker dims everything else; handoff dividers stay so the narrative reads.
 */
export function AgentFilterButton({
  agents,
  activeKey,
  onSelect,
  items,
}: {
  agents: Record<string, AgentConfig>;
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  items: TranscriptItem[];
}) {
  const seen = new Map<string, string>();
  for (const item of items) {
    if (item.agentKey && item.agentName && !seen.has(item.agentKey)) {
      seen.set(item.agentKey, item.agentName);
    }
  }
  if (seen.size < 2) return null;

  const activeCount = activeKey ? 1 : 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-3 rounded-lg bg-background px-6 text-sm font-medium data-[state=open]:bg-accent"
        >
          <span className="inline-flex items-center gap-1.5">
            <SlidersHorizontal className="h-5 w-5 shrink-0" aria-hidden />
            <span>Filter</span>
          </span>
          {activeCount > 0 && (
            <span className="inline-flex w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-medium leading-5 text-sky-700">
              {activeCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Show messages from
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={activeKey ?? '__all__'}
          onValueChange={(v) => onSelect(v === '__all__' ? null : v)}
        >
          <DropdownMenuRadioItem value="__all__">All speakers</DropdownMenuRadioItem>
          {Array.from(seen.entries()).map(([key, name]) => {
            const pal = agentPalette(key);
            const isCurrent = agents[key] !== undefined;
            return (
              <DropdownMenuRadioItem key={key} value={key} className={isCurrent ? '' : 'opacity-70'}>
                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${pal.bg} ring-1 ${pal.ring}`} />
                <span className="truncate">{name}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
