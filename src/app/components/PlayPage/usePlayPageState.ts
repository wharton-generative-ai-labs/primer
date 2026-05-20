"use client";

import { useState, useEffect } from "react";
import { SessionStatus } from "../../lib/types";

export function usePlayPageState(hasAudio: boolean) {
  // Layout state moved into LayoutContext so the AI-controllable UI state
  // (mode, panel collapse, document tab) lives in a single place that both
  // React consumers and the useHandleServerEvent ui.* handlers can reach.

  // Session and connection state
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>("");
  const [queuedAgentTransfer, setQueuedAgentTransfer] = useState<string | null>(null);
  
  // View state
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState<boolean>(false);
  const [isEventsPaneExpanded, setIsEventsPaneExpanded] = useState<boolean>(false);
  const [isDebugModeEnabled, setIsDebugModeEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('playPage.isDebugModeEnabled');
      return stored === 'true';
    }
    return false;
  });
  
  // Audio state
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('playPage.isMuted');
      return stored === 'true';
    }
    return false;
  });
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('playPage.isAudioPlaybackEnabled');
      // Default to true if not set
      return stored === null ? true : stored === 'true';
    }
    return true;
  });
  const [isAIAudioPlaying, setIsAIAudioPlaying] = useState<boolean>(false);
  
  // Transcript state
  const [userText, setUserText] = useState<string>("");


  // Persist muted setting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('playPage.isMuted', isMuted.toString());
    }
  }, [isMuted]);

  // Persist audio playback setting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('playPage.isAudioPlaybackEnabled', isAudioPlaybackEnabled.toString());
    }
  }, [isAudioPlaybackEnabled]);

  // Persist debug mode setting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('playPage.isDebugModeEnabled', isDebugModeEnabled.toString());
    }
  }, [isDebugModeEnabled]);

  // Auto-expand transcript for non-audio experiences
  useEffect(() => {
    if (!hasAudio) {
      setIsTranscriptExpanded(true);
    }
  }, [hasAudio]);

  // Close events pane when debug mode is disabled
  useEffect(() => {
    if (!isDebugModeEnabled) {
      setIsEventsPaneExpanded(false);
    }
  }, [isDebugModeEnabled]);

  return {
    // Session state
    sessionStatus,
    setSessionStatus,
    selectedAgentKey,
    setSelectedAgentKey,
    queuedAgentTransfer,
    setQueuedAgentTransfer,
    
    // View state
    isTranscriptExpanded,
    setIsTranscriptExpanded,
    isEventsPaneExpanded,
    setIsEventsPaneExpanded,
    isDebugModeEnabled,
    setIsDebugModeEnabled,
    
    // Audio state
    isMuted,
    setIsMuted,
    isAudioPlaybackEnabled,
    setIsAudioPlaybackEnabled,
    isAIAudioPlaying,
    setIsAIAudioPlaying,
    
    // Transcript state
    userText,
    setUserText,
  };
}

