'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { AgentAvatar } from './AgentAvatar';

/**
 * Top-of-chat-panel speaker identity. Has three states:
 *
 *   1. Idle — current agent's avatar, name, voice hint.
 *   2. Queued handoff — tool fired, current agent still talking. Shows a
 *      Current → Pending avatar transition.
 *   3. Reconnecting — selectedAgentKey flipped; realtime is mid-reconnect
 *      with the new voice. Spinner + "Connecting…".
 */
export function AgentHeader({
  agentKey,
  agentName,
  voice,
  pendingAgentKey,
  pendingAgentName,
  isReconnecting,
  rightSlot,
}: {
  agentKey: string;
  agentName: string;
  voice?: string;
  pendingAgentKey?: string;
  pendingAgentName?: string;
  isReconnecting?: boolean;
  rightSlot?: React.ReactNode;
}) {
  const showPending = Boolean(pendingAgentKey && pendingAgentName);
  const showReconnect = !showPending && isReconnecting;

  return (
    <div
      className={`flex items-center gap-3 border-b border-border px-6 py-3 ${
        showPending || showReconnect ? 'bg-muted' : 'bg-background'
      }`}
    >
      <motion.div
        // Key on agentKey so the inner identity animates in when the active
        // agent changes — the obvious "you're now talking to someone new"
        // signal. rightSlot sits outside so it doesn't re-mount on handoff.
        key={
          agentKey +
          (showPending ? `:pending-${pendingAgentKey}` : '') +
          (showReconnect ? ':reconnecting' : '')
        }
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        {showPending ? (
          <div className="flex items-center gap-2">
            <AgentAvatar agentKey={agentKey} agentName={agentName} size="sm" />
            <motion.span
              aria-hidden
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className="text-muted-foreground"
            >
              →
            </motion.span>
            <AgentAvatar agentKey={pendingAgentKey!} agentName={pendingAgentName} />
          </div>
        ) : (
          <AgentAvatar agentKey={agentKey} agentName={agentName} />
        )}
        <div className="flex min-w-0 flex-col">
          {showPending ? (
            <>
              <span className="truncate text-sm font-semibold text-foreground">
                Handing off to {pendingAgentName}…
              </span>
              <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Letting {agentName} finish speaking</span>
              </span>
            </>
          ) : showReconnect ? (
            <>
              <span className="truncate text-sm font-semibold text-foreground">{agentName}</span>
              <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Connecting…</span>
              </span>
            </>
          ) : (
            <>
              <span className="truncate text-sm font-semibold text-foreground">{agentName}</span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {voice ? `Voice · ${voice}` : 'Conversation'}
              </span>
            </>
          )}
        </div>
      </motion.div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}
