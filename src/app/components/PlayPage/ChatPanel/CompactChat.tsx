'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, Loader2, Mic, MicOff, Send, Volume, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranscript } from '@/app/contexts/TranscriptContext';
import { AgentConfig } from '@/app/lib/types';
import { AgentAvatar } from './AgentAvatar';
import { AudioIconButton } from './AudioIconButton';

/**
 * Compact chat bar. Intended for layouts where the full chat panel would cover
 * too much of the viewport. Shows the current agent (or handoff state), the
 * latest assistant line, a text input, mic/volume tiles, and an expand button.
 *
 * Handoff state: during a queued transfer, the agent pill flips to a mini
 * "Current → Pending" layout with a spinner. Matches the full-panel header
 * semantics so the user sees the same "something is happening" signal.
 */
export interface CompactChatProps {
  userText: string;
  setUserText: (text: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
  agents: Record<string, AgentConfig>;
  selectedAgentKey: string;
  queuedAgentKey: string | null;
  isReconnecting: boolean;
  hasAudio: boolean;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (enabled: boolean) => void;
  isAIAudioPlaying: boolean;
  /** Click handler for the expand-to-full-panel button. Callers typically
   *  flip layoutMode back to `panels-only` or `scene-and-panels` here. */
  onExpand: () => void;
}

export function CompactChat({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  agents,
  selectedAgentKey,
  queuedAgentKey,
  isReconnecting,
  hasAudio,
  isMuted,
  setIsMuted,
  isAudioPlaybackEnabled,
  setIsAudioPlaybackEnabled,
  isAIAudioPlaying,
  onExpand,
}: CompactChatProps) {
  const { transcriptItems } = useTranscript();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentAgent = agents[selectedAgentKey];
  const currentAgentName = currentAgent?.name ?? 'Agent';
  const pendingAgent = queuedAgentKey ? agents[queuedAgentKey] : undefined;
  const pendingAgentName = pendingAgent?.name;
  const showPending = Boolean(queuedAgentKey && pendingAgentName);

  // Latest assistant-turn text — the bar shows just this, not a scrollback.
  const latestAssistant = [...transcriptItems]
    .reverse()
    .find((item) => item.type === 'MESSAGE' && item.role === 'assistant' && !item.isHidden);

  useEffect(() => {
    if (canSend) inputRef.current?.focus();
  }, [canSend]);

  const canSendText = canSend && userText.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="mx-auto flex w-full max-w-[470px] xl:max-w-2xl items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
    >
      {/* Agent pill (or handoff mini-pill while transfer is queued). */}
      <div className="flex flex-shrink-0 items-center gap-1.5">
        {showPending ? (
          <>
            <AgentAvatar agentKey={selectedAgentKey} agentName={currentAgentName} size="sm" />
            <span aria-hidden className="text-slate-400">
              →
            </span>
            <AgentAvatar agentKey={queuedAgentKey!} agentName={pendingAgentName} size="sm" />
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          </>
        ) : (
          <>
            <AgentAvatar agentKey={selectedAgentKey} agentName={currentAgentName} size="sm" />
            {isReconnecting && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
          </>
        )}
      </div>

      {/* Latest assistant line, truncated so the bar never grows past one
          row. Clicking opens the full panel if the user wants scrollback. */}
      <button
        type="button"
        onClick={onExpand}
        className="min-w-0 flex-1 truncate rounded-full px-3 py-1 text-left text-sm text-slate-600 hover:bg-slate-50"
        title="Open full chat"
      >
        {latestAssistant?.title || (
          <span className="italic text-slate-400">
            {isReconnecting ? 'Connecting…' : 'Listening…'}
          </span>
        )}
      </button>

      {hasAudio && (
        <div className="flex flex-shrink-0 gap-2.5">
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
            pulsing={isAudioPlaybackEnabled && isAIAudioPlaying}
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
      )}

      <Textarea
        ref={inputRef}
        rows={1}
        value={userText}
        onChange={(e) => setUserText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && canSendText) {
            e.preventDefault();
            onSendMessage();
          }
        }}
        placeholder={canSend ? `Message ${currentAgentName}…` : 'Connecting…'}
        disabled={!canSend}
        className="h-8 min-h-8 w-56 max-h-8 flex-shrink-0 resize-none overflow-hidden rounded-md border-input bg-background px-3 py-1.5 text-sm leading-tight text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      <Button
        type="button"
        variant={canSendText ? 'default' : 'outline'}
        size="icon"
        onClick={onSendMessage}
        disabled={!canSendText}
        aria-label="Send message"
        title="Send"
        className="h-10 w-10 shrink-0 rounded-lg"
      >
        <Send className="h-5 w-5" />
      </Button>
      <button
        type="button"
        onClick={onExpand}
        aria-label="Expand chat panel"
        title="Expand chat"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
