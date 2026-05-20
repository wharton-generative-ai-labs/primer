'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume, Volume2, VolumeX, Send, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranscript } from '@/app/contexts/TranscriptContext';
import { useFileUpload } from '@/app/contexts/FileUploadContext';
import { AgentConfig } from '@/app/lib/types';
import {
  getDelegationManager,
  subscribeToStateUpdates as subscribeToDelegations,
} from '@/app/lib/tools/delegation/DelegationManager';
import type { ActiveDelegation } from '@/app/lib/tools/delegation/DelegationManager';
import { AgentFilterButton } from './AgentFilterButton';
import { DelegationStatusLine } from './DelegationStatusLine';
import { HandoffDivider } from './HandoffDivider';
import { InlineChatToastRow } from './InlineChatToastRow';
import { ToolErrorNotice } from './ToolErrorNotice';
import { MessageRow } from './MessageRow';
import { AudioIconButton } from './AudioIconButton';

export interface ChatPanelProps {
  userText: string;
  setUserText: (text: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
  agents: Record<string, AgentConfig>;
  /** Key of the agent we are about to hand off to — drives handoff dividers. */
  queuedAgentKey: string | null;
  isReconnecting: boolean;
  hasAudio: boolean;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (enabled: boolean) => void;
  isAIAudioPlaying: boolean;
  /** When true, tool-call errors render as inline amber notices in the
   *  stream. False for students (they'd just see noise); true for users
   *  with VIEW_TECHNICAL or when debug mode is on. The breadcrumbs are
   *  always captured in TranscriptContext; this only gates the display. */
  showToolErrors: boolean;
}

export function ChatPanel({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  agents,
  queuedAgentKey,
  isReconnecting,
  hasAudio,
  isMuted,
  setIsMuted,
  isAudioPlaybackEnabled,
  setIsAudioPlaybackEnabled,
  isAIAudioPlaying,
  showToolErrors,
}: ChatPanelProps) {
  const { transcriptItems } = useTranscript();
  const { showFileUpload } = useFileUpload();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filterAgentKey, setFilterAgentKey] = useState<string | null>(null);
  const [activeDelegations, setActiveDelegations] = useState<ActiveDelegation[]>([]);

  useEffect(() => {
    const read = () => setActiveDelegations(getDelegationManager().getActiveDelegations());
    read();
    return subscribeToDelegations(read);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptItems, activeDelegations]);

  // Keep the full stream in order: messages + handoff breadcrumbs. Non-handoff
  // breadcrumbs stay out of the chat (they live in the debug transcript).
  // Non-handoff / non-tool-error breadcrumbs stay in the debug transcript.
  // Tool-error breadcrumbs surface here only for technical users (gated by
  // showToolErrors) — students shouldn't see raw tool failures, but devs
  // need them loud to diagnose.
  const stream = transcriptItems.filter((item) => {
    if (item.isHidden) return false;
    if (item.type === 'MESSAGE') return true;
    if (item.type !== 'BREADCRUMB') return false;
    if (item.breadcrumbKind === 'handoff') return true;
    if (item.breadcrumbKind === 'tool-error') return showToolErrors;
    return false;
  });

  const visibleStream = filterAgentKey
    ? stream.filter(
        (item) => item.agentKey === filterAgentKey || item.breadcrumbKind === 'handoff'
      )
    : stream;

  const canSendText = canSend && userText.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Figma 97:1005 — title row uses bg-muted, pl-6 pr-[18px] py-3, border-b */}
      <div className="flex shrink-0 items-center justify-between gap-3 rounded-t-2xl border-b border-border bg-muted pl-6 pr-[18px] py-3">
        <h2 className="min-w-0 text-base font-medium leading-6 text-foreground">Interview Transcript</h2>
        <AgentFilterButton
          agents={agents}
          activeKey={filterAgentKey}
          onSelect={setFilterAgentKey}
          items={transcriptItems}
        />
      </div>
      {/* Figma 97:1009: px-6 pt-3 (outer); gap-3 (12px) between stream and composer; pb-6 on outer */}
      <div className="flex min-h-0 flex-1 flex-col bg-background px-6 pt-3">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-3 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-3"
        >
          {visibleStream.length === 0 && (
            <p className="text-sm italic text-muted-foreground">Waiting for conversation to begin...</p>
          )}
          {visibleStream.map((item, idx) => {
            if (item.type === 'BREADCRUMB' && item.breadcrumbKind === 'tool-error') {
              return <ToolErrorNotice key={item.itemId} item={item} />;
            }
            if (item.type === 'BREADCRUMB' && item.breadcrumbKind === 'handoff') {
              // Spinner on the most recent handoff while the transfer is queued
              // or the session is mid-reconnect — gives the "something's
              // happening" signal the user asked for.
              const isMostRecentHandoff = !visibleStream
                .slice(idx + 1)
                .some(
                  (it) => it.type === 'BREADCRUMB' && it.breadcrumbKind === 'handoff'
                );
              const pending =
                isMostRecentHandoff && (Boolean(queuedAgentKey) || isReconnecting);
              return <HandoffDivider key={item.itemId} item={item} pending={pending} />;
            }
            // Show the agent label/avatar only when the speaker changes vs the
            // previous rendered message — consecutive messages from the same
            // agent group silently, matching chat-app conventions.
            const prev = visibleStream[idx - 1];
            const prevAgent = prev && prev.type === 'MESSAGE' ? prev.agentKey : undefined;
            const prevRole = prev && prev.type === 'MESSAGE' ? prev.role : undefined;
            const showAgentLabel =
              item.role === 'assistant' &&
              (prevRole !== 'assistant' || prevAgent !== item.agentKey);
            return <MessageRow key={item.itemId} item={item} showAgentLabel={showAgentLabel} />;
          })}
          <AnimatePresence>
            <DelegationStatusLine activeDelegations={activeDelegations} />
          </AnimatePresence>
        </div>
        <InlineChatToastRow />
        <div className="flex shrink-0 flex-col gap-3 bg-background pt-3 pb-6">
          <Textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && canSendText) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            placeholder={canSend ? 'Type a message...' : 'Connecting...'}
            disabled={!canSend}
            className="h-[80px] min-h-[80px] resize-y rounded-md text-sm"
          />
          <div className="flex w-full items-start justify-between">
            {hasAudio ? (
              <div className="flex gap-2.5">
                <AudioIconButton
                  onClick={() => setIsMuted(!isMuted)}
                  on={!isMuted}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </AudioIconButton>
                <AudioIconButton
                  onClick={() => setIsAudioPlaybackEnabled(!isAudioPlaybackEnabled)}
                  on={isAudioPlaybackEnabled}
                  title={isAudioPlaybackEnabled ? 'Mute agent audio' : 'Unmute agent audio'}
                >
                  {!isAudioPlaybackEnabled ? (
                    <VolumeX className="h-5 w-5" />
                  ) : isAIAudioPlaying ? (
                    <Volume2 className="h-5 w-5" />
                  ) : (
                    <Volume className="h-5 w-5" />
                  )}
                </AudioIconButton>
              </div>
            ) : (
              <span aria-hidden className="min-w-0" />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => showFileUpload()}
                disabled={!canSend}
                aria-label="Upload attachment"
                title="Upload attachment"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="default"
                size="icon"
                onClick={onSendMessage}
                disabled={!canSendText}
                aria-label="Send message"
                title="Send"
                className="h-10 w-10 shrink-0 rounded-lg"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
