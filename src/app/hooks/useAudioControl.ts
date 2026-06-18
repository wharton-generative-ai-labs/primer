/**
 * useAudioControl Hook
 * 
 * Manages audio playback for OpenAI Realtime API:
 * - Audio element lifecycle
 * - Playback state management
 * - Autoplay handling
 * - Audio cleanup
 */

import { useRef, useEffect } from 'react';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useAudioControl');

interface UseAudioControlProps {
  isAudioPlaybackEnabled: boolean;
}

export function useAudioControl({
  isAudioPlaybackEnabled,
}: UseAudioControlProps) {
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Effect to handle audio playback state changes
  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.play().catch((err) => {
          logger.warn(err, 'Autoplay may be blocked by browser');
        });
      } else {
        audioElementRef.current.pause();
      }
    }
  }, [isAudioPlaybackEnabled]);

  return {
    audioElementRef,
  };
}
