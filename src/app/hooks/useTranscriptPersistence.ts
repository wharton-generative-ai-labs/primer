"use client";

import { useEffect, useRef } from 'react';
import { useTranscript } from '@/app/contexts/TranscriptContext';
import { useArtifact } from '@/app/contexts/ArtifactContext';
import { formatTranscriptMarkdown } from '@/app/lib/transcript-persistence';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useTranscriptPersistence');

const TRANSCRIPT_ARTIFACT_NAME = 'conversation_transcript';
const TRANSCRIPT_ARTIFACT_TYPE = 'markdown';
const DEFAULT_DEBOUNCE_MS = 1500;

/**
 * Auto-maintain the `conversation_transcript` session artifact from the
 * client's TranscriptContext message list.
 *
 * Why this exists: voice/realtime agents would routinely fail their prompted
 * "save the conversation transcript verbatim" tool call by passing empty
 * `content`. The realtime API delivers transcript text to the client; the
 * platform now persists it on the client's behalf so the agent can simply
 * reference the artifact id (`conversation_transcript`) without producing
 * the content itself.
 *
 * Behavior:
 *  - Debounced writes (default 1500ms) avoid hammering the API while
 *    streaming deltas arrive token-by-token. The pure formatter
 *    {@link formatTranscriptMarkdown} produces deterministic output, so a
 *    same-content guard (`lastWrittenRef`) drops duplicate writes before
 *    they hit the network.
 *  - The storage layer's same-name coercion (`createArtifact` ->
 *    `updateArtifact` when name+type+agents match an existing artifact)
 *    means we can call createArtifact every time without first checking
 *    existence. The server will mint rev-1 the first time and bump revs
 *    thereafter; identical-content writes become no-op revs.
 *  - Streaming partials get coalesced: the formatter only emits messages
 *    once their `title` is non-empty, and the debounce timer resets on
 *    every items mutation, so the API only sees one POST per quiet window.
 *  - On unmount we flush any pending write so the tail of the conversation
 *    isn't lost if the user navigates away mid-stream.
 *
 * @param options.enabled - when false, the hook is a no-op. Lets callers
 *   gate transcript persistence by experience flag (e.g. `autoTranscript`).
 * @param options.debounceMs - override for tests; defaults to 1500ms.
 */
export function useTranscriptPersistence(options?: {
  enabled?: boolean;
  debounceMs?: number;
}): void {
  const enabled = options?.enabled ?? true;
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  const { transcriptItems } = useTranscript();
  const { createArtifact } = useArtifact();

  // Refs so the timer-fired flush sees the latest items / api binding
  // without re-creating the closure when the items array reference flips on
  // every streaming delta.
  const itemsRef = useRef(transcriptItems);
  itemsRef.current = transcriptItems;

  const createArtifactRef = useRef(createArtifact);
  createArtifactRef.current = createArtifact;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const lastWrittenRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable flush — closes over refs only so the unmount effect can call it
  // from a `[]`-deps cleanup without re-binding.
  const flushRef = useRef<() => Promise<void>>(async () => {});
  flushRef.current = async function flush(): Promise<void> {
    if (!enabledRef.current) return;
    if (inFlightRef.current) {
      // Another write is in progress; mark that we want one more pass after
      // it lands so the latest items aren't lost.
      pendingRef.current = true;
      return;
    }
    const markdown = formatTranscriptMarkdown(itemsRef.current);
    if (markdown === lastWrittenRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      await createArtifactRef.current(
        TRANSCRIPT_ARTIFACT_NAME,
        markdown,
        TRANSCRIPT_ARTIFACT_TYPE,
        {
          description:
            'Auto-maintained verbatim transcript of the educator/agent conversation.',
          tags: ['system:transcript'],
        },
      );
      lastWrittenRef.current = markdown;
    } catch (err) {
      // Don't poison the cache on failure — leave lastWrittenRef as-is so
      // the next debounce tick retries with the same (or newer) content.
      logger.warn({ err }, 'Failed to persist conversation transcript');
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        // Schedule another pass — there are newer items waiting.
        void flushRef.current();
      }
    }
  };

  // Debounce loop. Clears any pending timer on dep change (or unmount) and
  // (re)schedules one so the latest items snapshot wins.
  useEffect(() => {
    if (!enabled) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushRef.current();
    }, debounceMs);

    return () => {
      // Just clear the timer here — re-renders that change `transcriptItems`
      // run this cleanup BEFORE the next effect schedules a fresh timer, so
      // flushing on every dep-change cleanup would emit a write per delta
      // (defeating the debounce). The unmount-flush happens in the
      // separate `[]`-deps effect below.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, debounceMs, transcriptItems]);

  // Unmount-only flush so the tail of the conversation lands when the user
  // navigates away mid-stream. Empty-deps cleanup runs once when the host
  // component unmounts (not on every re-render).
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Effect cleanup must be sync; the resulting POST is allowed to
      // complete in the background.
      void flushRef.current();
    };
  }, []);
}
