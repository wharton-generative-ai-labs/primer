/**
 * RealtimeController Component
 * 
 * Orchestrates OpenAI Realtime API integration by composing specialized hooks:
 * - useRealtimeConnection: WebRTC connection management
 * - useSessionManagement: Session configuration and updates
 * - useAudioControl: Audio playback management
 * - useAgentSwitching: Agent transfer coordination
 * 
 * This component has been refactored from a 497-line monolithic component
 * into a clean orchestration layer using custom hooks for better maintainability.
 */

import { useEffect, useState, forwardRef, useImperativeHandle, useRef } from "react";
import { useHandleServerEvent } from "../hooks/useHandleServerEvent";
import { AgentConfig, SessionStatus } from "../lib/types";
import { useTranscript } from "../contexts/TranscriptContext";
import { useEvent } from "../contexts/EventContext";
import { useScene } from "../hooks/useScene";
import { getSoundManager } from '@/app/lib/tools/sound';
import { useRealtimeConnection } from "../hooks/useRealtimeConnection";
import { useSessionManagement } from "../hooks/useSessionManagement";
import { useAudioControl } from "../hooks/useAudioControl";
import { useAgentSwitching } from "../hooks/useAgentSwitching";
import { createModuleLogger } from "@/lib/logger";
import type { ComponentEventMessage, ComponentStateChangeMessage } from "@/app/types/socket";

const logger = createModuleLogger('RealtimeController');

interface RealtimeControllerProps {
  selectedAgentKey: string;
  agents: Record<string, AgentConfig>;
  onSessionStatusChange: (status: SessionStatus) => void;
  onDataChannelChange: (dc: RTCDataChannel | null) => void;
  isMuted: boolean;
  isAudioPlaybackEnabled: boolean;
  toolsRegistered: boolean;
  setIsAIAudioPlaying: (isPlaying: boolean) => void;
  setIsUserAudioPlaying: (isPlaying: boolean) => void;
  isAIAudioPlaying: boolean;
  setQueuedAgentTransfer: (key: string | null) => void;
  setSelectedAgentKey: (key: string) => void;
  isDebugModeEnabled: boolean;
  aiConfigurations: Record<string, any>;
  selectedAgentAiConfiguration: string;
  showChecklist?: (artifactId: string) => void;
  hideChecklist?: () => void;
  onRealtimeConnected?: () => void;
}

export interface RealtimeControllerRef {
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  updateSession: () => Promise<void>;
  sendTextMessage: (text: string) => void;
}

export const RealtimeController = forwardRef<RealtimeControllerRef, RealtimeControllerProps>(({
  selectedAgentKey,
  agents,
  onSessionStatusChange,
  onDataChannelChange,
  isMuted,
  isAudioPlaybackEnabled,
  toolsRegistered,
  setIsAIAudioPlaying,
  setIsUserAudioPlaying,
  isAIAudioPlaying,
  setQueuedAgentTransfer,
  setSelectedAgentKey,
  isDebugModeEnabled,
  aiConfigurations,
  selectedAgentAiConfiguration,
  showChecklist,
  hideChecklist,
  onRealtimeConnected,
}, ref) => {
  const [currentStatus, setCurrentStatus] = useState<SessionStatus>("DISCONNECTED");
  
  // Track if we've already done initial configuration for the current connection
  // Reset on disconnect, set to true after first session update
  const hasInitializedSessionRef = useRef<boolean>(false);

  const { addTranscriptBreadcrumb, addTranscriptMessage } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();
  const { setScene } = useScene();

  const handleStatusChange = (status: SessionStatus) => {
    logger.debug({
      from: currentStatus,
      to: status,
    }, 'Status changing');
    setCurrentStatus(status);
    onSessionStatusChange(status);
  };

  // Audio control hook
  const { audioElementRef } = useAudioControl({
    isAudioPlaybackEnabled,
  });

  // Connection management hook
  const {
    isConnectingRef,
    connectToRealtime,
    disconnectFromRealtime,
    reconnectToRealtime,
    sendMessage,
  } = useRealtimeConnection({
    selectedAgentKey,
    agents,
    aiConfigurations,
    selectedAgentAiConfiguration,
    audioElementRef,
    isAudioPlaybackEnabled,
    onStatusChange: handleStatusChange,
    onDataChannelChange,
    onDataChannelMessage: (data) => handleServerEvent.current(data),
    logClientEvent,
    logServerEvent,
    onRealtimeConnected,
  });

  // Session management hook
  const {
    updateSession,
    getToolsForAgent,
    clearAudioBuffer,
    sessionConfiguredCount,
    configuredAgentKey,
    onSessionUpdated,
  } = useSessionManagement({
    selectedAgentKey,
    agents,
    aiConfigurations,
    selectedAgentAiConfiguration,
    isMuted,
    currentStatus,
    sendMessage,
    reconnectToRealtime,
    isDebugModeEnabled,
    addTranscriptBreadcrumb,
    setIsAIAudioPlaying,
    setIsUserAudioPlaying,
  });

  // Agent switching hook - handles initial message and queued transfers
  useAgentSwitching({
    selectedAgentKey,
    agents,
    currentStatus,
    toolsRegistered,
    isAIAudioPlaying,
    isDebugModeEnabled,
    sendMessage,
    setQueuedAgentTransfer,
    setSelectedAgentKey,
    addTranscriptBreadcrumb,
    addTranscriptMessage,
    getToolsForAgent,
    sessionConfiguredCount,
    configuredAgentKey,
  });

  // Server event handler
  const handleServerEvent = useHandleServerEvent({
    setSessionStatus: handleStatusChange,
    selectedAgentKey,
    agents,
    sendClientEvent: (eventObj: any, eventNameSuffix?: string) => {
      const success = sendMessage(eventObj);
      if (success) {
        logClientEvent(eventObj, eventNameSuffix);
      } else {
        logClientEvent(
          { attemptedEvent: eventObj.type },
          "error.data_channel_not_open"
        );
      }
    },
    setIsAIAudioPlaying,
    setIsUserAudioPlaying,
    setQueuedAgentTransfer,
    isDebugModeEnabled,
    showChecklist,
    hideChecklist,
    onSessionUpdated,
  });

  // Effect to listen for component events via custom DOM events and inject into realtime conversation
  // SocketController dispatches 'primer:component-event' when it receives component.event.forward from server
  // This avoids race conditions with socket availability
  useEffect(() => {
    const handleComponentEvent = (e: Event) => {
      const data = (e as CustomEvent<ComponentEventMessage>).detail;
      logger.info({ 
        componentId: data.componentId, 
        eventType: data.eventType 
      }, 'Component event received for agent injection');
      
      // Inject into realtime conversation as a system message (won't appear in transcript)
      const success = sendMessage({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "system",
          content: [
            {
              type: "input_text",
              text: `[Component Event] User interaction with ${data.componentId}: ${data.eventType}${data.eventData ? ` - Data: ${JSON.stringify(data.eventData)}` : ''}`
            }
          ]
        }
      });
      
      if (success) {
        // Trigger a response from the agent
        sendMessage({ type: "response.create" });
      }
    };

    const handleComponentStateChange = (e: Event) => {
      const data = (e as CustomEvent<ComponentStateChangeMessage>).detail;
      logger.debug({ 
        componentId: data.componentId, 
        stateChanges: data.stateChanges 
      }, 'Component state change received');
      // State changes are logged but don't automatically trigger agent response
    };

    window.addEventListener('primer:component-event', handleComponentEvent);
    window.addEventListener('primer:component-state-change', handleComponentStateChange);

    return () => {
      window.removeEventListener('primer:component-event', handleComponentEvent);
      window.removeEventListener('primer:component-state-change', handleComponentStateChange);
    };
  }, [sendMessage]);

  // Effect to handle initial connection and reconnection when disconnected
  useEffect(() => {
    // Only connect if we're disconnected, have a selected agent, and tools are registered
    // AND we're not already connecting
    if (selectedAgentKey && currentStatus === "DISCONNECTED" && toolsRegistered && !isConnectingRef.current) {
      logger.debug({
        selectedAgentKey,
        currentStatus,
        toolsRegistered,
        isConnecting: isConnectingRef.current
      }, 'Connection effect triggered');
      connectToRealtime();
    }

    return () => {
      disconnectFromRealtime();
      getSoundManager().stopAllSounds();
      setScene("blank");
      setIsUserAudioPlaying(false);
    };
  }, [selectedAgentKey, toolsRegistered]); // Intentionally limited dependencies

  // Effect to reset hasInitializedSessionRef when agent changes
  // This ensures each agent gets an initial configuration with sessionConfiguredCount increment
  useEffect(() => {
    hasInitializedSessionRef.current = false;
  }, [selectedAgentKey]);

  // Effect to handle session updates for both connection and mute state changes
  useEffect(() => {
    if (currentStatus === "CONNECTED" && toolsRegistered) {
      // Clear audio buffer when mute state changes
      clearAudioBuffer();

      // Only update session if we have valid agent data
      if (agents && selectedAgentKey) {
        // Determine if this is the initial configuration or a subsequent update
        const isInitialConfiguration = !hasInitializedSessionRef.current;
        
        updateSession(isInitialConfiguration).then(result => {
          // Only mark as initialized if we actually sent a session update
          // (not if we triggered a reconnect, which returns didSendSessionUpdate: false)
          if (result.didSendSessionUpdate && isInitialConfiguration) {
            hasInitializedSessionRef.current = true;
          }
        }).catch(error => {
          logger.error(error, 'Error updating session');
          disconnectFromRealtime();
        });
      }
    } else if (currentStatus === "DISCONNECTED") {
      // Reset on disconnect so next connection will be treated as initial
      hasInitializedSessionRef.current = false;
    }
  }, [currentStatus, selectedAgentKey, toolsRegistered, isMuted]);

  // Expose imperative methods via ref
  useImperativeHandle(ref, () => ({
    connect: () => connectToRealtime(),
    disconnect: () => {
      disconnectFromRealtime();
      getSoundManager().stopAllSounds();
      setScene("blank");
      setIsUserAudioPlaying(false);
    },
    reconnect: () => {
      setScene("blank");
      return reconnectToRealtime();
    },
    updateSession: async () => {
      await updateSession(false);
    },
    sendTextMessage: (text: string) => {
      sendMessage({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      });
      sendMessage({ type: "response.create" });
    },
  }));

  return null;
});

RealtimeController.displayName = 'RealtimeController';
