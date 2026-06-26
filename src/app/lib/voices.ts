/**
 * Canonical OpenAI Realtime voice list and sanitisation helper.
 *
 * Single source of truth used by:
 * - `useRealtimeConnection` (initial ephemeral key fetch)
 * - `useSessionManagement` (per-agent session.update payloads)
 * - `MatterCompiler.modifyAgent` (server-side guard against persisting
 *   hallucinated voices like "emerald" in `experience.json`)
 *
 * If OpenAI ships a new voice, update this file — every call site picks it
 * up automatically.
 */

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('voices');

export const VALID_VOICES: ReadonlySet<string> = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
]);

export const DEFAULT_VOICE = 'ballad';

export function isValidVoice(voice: unknown): voice is string {
  return typeof voice === 'string' && VALID_VOICES.has(voice);
}

/**
 * Coerce any voice-like value to a voice the OpenAI Realtime API will
 * accept. Logs a warning when falling back so we can spot prompt drift.
 */
export function sanitizeVoice(voice: string | undefined | null): string {
  if (isValidVoice(voice)) {
    return voice;
  }
  if (voice) {
    logger.warn(
      { voice, defaultVoice: DEFAULT_VOICE },
      `Voice "${voice}" is not supported by OpenAI Realtime API, falling back to "${DEFAULT_VOICE}"`,
    );
  }
  return DEFAULT_VOICE;
}
