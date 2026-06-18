'use client';

import React from 'react';
import { AgentConfig, TranscriptItem } from '@/app/lib/types';
import { agentPalette, AgentPalette } from './palette';

/**
 * Per-agent filter chips that appear once 2+ agents have appeared in the
 * transcript. Clicking a chip dims everything that isn't from that agent
 * (handoff dividers are kept so the narrative still reads).
 */
export function AgentFilterChips({
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
  // Only show chips for agents that have actually appeared in the transcript,
  // so an experience with 10 agents doesn't spam the panel header.
  const seen = new Map<string, string>();
  for (const item of items) {
    if (item.agentKey && item.agentName && !seen.has(item.agentKey)) {
      seen.set(item.agentKey, item.agentName);
    }
  }

  if (seen.size < 2) return null;

  const chips = Array.from(seen.entries());

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2">
      <FilterChip active={activeKey === null} onClick={() => onSelect(null)} label="All" />
      {chips.map(([key, name]) => {
        const pal = agentPalette(key);
        const isCurrent = agents[key] !== undefined;
        return (
          <FilterChip
            key={key}
            active={activeKey === key}
            onClick={() => onSelect(activeKey === key ? null : key)}
            label={name}
            palette={pal}
            dim={!isCurrent}
          />
        );
      })}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  palette,
  dim,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  palette?: AgentPalette;
  dim?: boolean;
}) {
  const baseIdle = palette ? `${palette.bg} ${palette.text}` : 'bg-slate-100 text-slate-600';
  const activeClasses = palette
    ? `ring-2 ${palette.ring} ${palette.bg} ${palette.text}`
    : 'ring-2 ring-penn-blue/40 bg-penn-blue/10 text-brand';
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all ${
        active ? activeClasses : `${baseIdle} hover:opacity-80`
      } ${dim ? 'opacity-60' : ''}`}
    >
      {label}
    </button>
  );
}
