/**
 * Tests for the canonical voice utilities used by both the realtime
 * connection (ephemeral key request) and the session.update path.
 *
 * Adding a single guard here prevents experiences like the QA Round 4
 * `lql5wxo2lea` build (`voice: "emerald"`) from blowing up OpenAI's API.
 */

import {
  DEFAULT_VOICE,
  VALID_VOICES,
  isValidVoice,
  sanitizeVoice,
} from '../voices';

describe('voices', () => {
  describe('VALID_VOICES', () => {
    it('matches the canonical OpenAI Realtime voice list', () => {
      expect(Array.from(VALID_VOICES).sort()).toEqual(
        [
          'alloy',
          'ash',
          'ballad',
          'cedar',
          'coral',
          'echo',
          'marin',
          'sage',
          'shimmer',
          'verse',
        ].sort(),
      );
    });

    it('includes the default voice', () => {
      expect(VALID_VOICES.has(DEFAULT_VOICE)).toBe(true);
    });
  });

  describe('isValidVoice', () => {
    it.each(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'])(
      'returns true for canonical voice "%s"',
      (voice) => {
        expect(isValidVoice(voice)).toBe(true);
      },
    );

    it.each(['emerald', 'jade', 'ALLOY', '', ' ', 'mystery', null, undefined])(
      'returns false for invalid voice %p',
      (voice) => {
        expect(isValidVoice(voice as string | undefined | null)).toBe(false);
      },
    );
  });

  describe('sanitizeVoice', () => {
    it('returns the voice unchanged when valid', () => {
      expect(sanitizeVoice('shimmer')).toBe('shimmer');
    });

    it('falls back to the default voice when undefined', () => {
      expect(sanitizeVoice(undefined)).toBe(DEFAULT_VOICE);
    });

    it('falls back to the default voice when empty', () => {
      expect(sanitizeVoice('')).toBe(DEFAULT_VOICE);
    });

    it('falls back to the default voice for hallucinated values', () => {
      expect(sanitizeVoice('emerald')).toBe(DEFAULT_VOICE);
    });

    it('does not normalize casing — invalid casing is rejected', () => {
      // OpenAI's API is case-sensitive; we must not silently uppercase.
      expect(sanitizeVoice('Alloy')).toBe(DEFAULT_VOICE);
    });
  });
});
