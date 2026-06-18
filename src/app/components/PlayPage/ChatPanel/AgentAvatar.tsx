'use client';

import React from 'react';
import { agentInitials, agentPalette } from './palette';

export function AgentAvatar({
  agentKey,
  agentName,
  size = 'md',
}: {
  agentKey?: string;
  agentName?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const pal = agentPalette(agentKey);
  const sizeClasses =
    size === 'sm'
      ? 'h-6 w-6 text-[10px]'
      : size === 'lg'
        ? 'h-[30px] w-[30px] text-sm font-medium'
        : 'h-8 w-8 text-xs';
  return (
    <div
      className={`${sizeClasses} ${pal.bg} ${pal.text} flex flex-shrink-0 items-center justify-center rounded-full font-semibold`}
      title={agentName}
    >
      {agentInitials(agentName)}
    </div>
  );
}
