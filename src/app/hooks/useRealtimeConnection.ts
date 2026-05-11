/**
 * useRealtimeConnection Hook
 * 
 * Manages WebRTC connection lifecycle for OpenAI Realtime API:
 * - RTCPeerConnection and RTCDataChannel management
 * - Connection, disconnection, and reconnection logic
 * - Ephemeral key fetching
 * - Connection status tracking
 */

import { useRef, useCallback } from 'react';
import { createRealtimeConnection } from '../lib/realtimeConnection';
import { SessionStatus, AgentConfig } from '../lib/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useRealtimeConnection');

interface UseRealtimeConnectionProps {
  selectedAgentKey: string;
  agents: Record<string, AgentConfig>;
  aiConfigurations: Record<string, any>;
  selectedAgentAiConfiguration: string;
  audioElementRef: React.MutableRefObject<HTMLAudioElement | null>;
  isAudioPlaybackEnabled: boolean;
  onStatusChange: (status: SessionStatus) => void;
  onDataChannelChange: (dc: RTCDataChannel | null) => void;
  onDataChannelMessage: (data: any) => void;
  logClientEvent: (event: any, eventNameSuffix?: string) => void;
  logServerEvent: (event: any, eventNameSuffix?: string) => void;
  onRealtimeConnected?: () => void;
}

export function useRealtimeConnection({
  selectedAgentKey,
  agents,
  aiConfigurations,
  selectedAgentAiConfiguration,
  audioElementRef,
  isAudioPlaybackEnabled,
  onStatusChange,
  onDataChannelChange,
  onDataChannelMessage,
  logClientEvent,
  logServerEvent,
  onRealtimeConnected,
}: UseRealtimeConnectionProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const isConnectingRef = useRef<boolean>(false);

  const selectedConfig = aiConfigurations[selectedAgentAiConfiguration] || aiConfigurations.default;
  const hasAudio = selectedConfig?.modalities?.includes('audio');

  const fetchEphemeralKey = useCallback(async (): Promise<string | null> => {
    const currentAgent = agents[selectedAgentKey];
    const selectedConfig = aiConfigurations[selectedAgentAiConfiguration] || aiConfigurations.default;
    
    // For reasoning-capable models (e.g., gpt-realtime-2) the session can be
    // created with a default reasoning effort. The same value is also resent
    // in session.update by useSessionManagement so it survives reconnects and
    // agent switches.
    const reasoningEffort = selectedConfig?.reasoningEffort;

    const response = await fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedConfig?.model,
        modalities: selectedConfig?.modalities,
        voice: currentAgent?.voice || "ballad",
        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
      })
    });
    const data = await response.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      logger.error({ data }, 'No ephemeral key provided by the server');
      onStatusChange("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  }, [selectedAgentKey, agents, aiConfigurations, selectedAgentAiConfiguration, logServerEvent, logClientEvent, onStatusChange]);

  const connectToRealtime = useCallback(async () => {
    if (isConnectingRef.current) {
      logger.debug({}, 'Already connecting, skipping');
      return;
    }

    isConnectingRef.current = true;
    onStatusChange("CONNECTING");

    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        return;
      }

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
        audioElementRef.current.playbackRate = 1;
      }
      audioElementRef.current.autoplay = isAudioPlaybackEnabled;

      const { pc, dc } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioElementRef,
        hasAudio,
        selectedConfig?.model
      );
      pcRef.current = pc;
      dcRef.current = dc;

      onDataChannelChange(dc);

      dc.addEventListener("open", () => {
        logClientEvent({}, "data_channel.open");
        onStatusChange("CONNECTED");
        // Trigger socket connection for backend delegation support
        if (onRealtimeConnected) {
          logger.debug({}, 'Triggering socket connection for backend delegation support');
          onRealtimeConnected();
        }
      });
      dc.addEventListener("close", () => {
        logClientEvent({}, "data_channel.close");
        onStatusChange("DISCONNECTED");
      });
      dc.addEventListener("error", (err: any) => {
        logClientEvent({ error: err }, "data_channel.error");
        onStatusChange("DISCONNECTED");
      });
      dc.addEventListener("message", (e: MessageEvent) => {
        onDataChannelMessage(JSON.parse(e.data));
      });
    } catch (err) {
      logger.error(err, 'Error connecting to realtime');
      onStatusChange("DISCONNECTED");
    } finally {
      isConnectingRef.current = false;
    }
  }, [
    fetchEphemeralKey,
    audioElementRef,
    isAudioPlaybackEnabled,
    hasAudio,
    selectedConfig?.model,
    onDataChannelChange,
    logClientEvent,
    onStatusChange,
    onRealtimeConnected,
    onDataChannelMessage,
  ]);

  const disconnectFromRealtime = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });

      pcRef.current.close();
      pcRef.current = null;
    }
    
    onDataChannelChange(null);
    dcRef.current = null;
    onStatusChange("DISCONNECTED");
  }, [onDataChannelChange, onStatusChange]);

  const reconnectToRealtime = useCallback(async () => {
    disconnectFromRealtime();
    onStatusChange("DISCONNECTED");
    await connectToRealtime();
  }, [disconnectFromRealtime, onStatusChange, connectToRealtime]);

  const sendMessage = useCallback((message: any) => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  return {
    pcRef,
    dcRef,
    isConnectingRef,
    connectToRealtime,
    disconnectFromRealtime,
    reconnectToRealtime,
    sendMessage,
  };
}
