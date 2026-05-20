'use client';

import React from 'react';
import { TranscriptItem } from '@/app/lib/types';
import { AgentAvatar } from './AgentAvatar';
import { agentPalette } from './palette';

/** Figma: dialogue bubble padding p-[3.5] (14px), radius --radius/xl (12px), 2px between time and body. */
const bubbleFrame = 'flex flex-col gap-0.5 rounded-xl p-3.5';

/**
 * Figma: text-sm/normal — 14px / 20px line, muted-foreground. (messages use Regular/400, not medium.)
 * See Dialogue nodes I…524:8557, I97:1012 in Chat/Placeholder.
 */
const timeClasses = 'text-sm font-normal leading-5 text-muted-foreground';

/**
 * Figma: text-base/normal — 16px / 24px line, foreground. Body copy is Regular/400.
 */
const bodyClasses = 'min-w-0 text-base font-normal leading-6 text-foreground';

function AgentNameRow({ agentKey, agentName }: { agentKey?: string; agentName?: string }) {
  const pal = agentPalette(agentKey);
  return (
    <div className="flex items-center gap-2">
      <AgentAvatar agentKey={agentKey} agentName={agentName} size="lg" />
      {/* Figma: agent label text-sm + medium, palette — not bubble body. */}
      {agentName && (
        <span className={`text-sm font-medium leading-5 ${pal.text}`}>{agentName}</span>
      )}
    </div>
  );
}

export function MessageRow({
  item,
  showAgentLabel,
}: {
  item: TranscriptItem;
  showAgentLabel: boolean;
}) {
  const isUser = item.role === 'user';
  if (isUser) {
    return (
      <div className="flex justify-end pl-11">
        <div className={`${bubbleFrame} w-full max-w-[85%] bg-accent`}>
          <p className={timeClasses}>{item.timestamp}</p>
          <p className={bodyClasses}>{item.title}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 pr-11">
      {showAgentLabel && <AgentNameRow agentKey={item.agentKey} agentName={item.agentName} />}
      <div className="pl-5">
        <div className={`${bubbleFrame} bg-muted`}>
          <p className={timeClasses}>{item.timestamp}</p>
          <p className={bodyClasses}>
            {item.title}
            {item.status === 'IN_PROGRESS' && (
              <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-muted-foreground/50" />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
