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
import { useWorkflowPhase } from "../contexts/WorkflowPhaseContext";
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
  isMuted: userIsMuted,
  isAudioPlaybackEnabled: userIsAudioPlaybackEnabled,
  toolsRegistered,
  setIsAIAudioPlaying,
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

  // Read the current phase mode so we can force-mute the mic and silence
  // playback during non-interactive surfaces (`build`, `result`). The user has
  // no chat surface in those phases — leaving the mic live means stray
  // background noise can fire a turn the user can't see, and any agent audio
  // would play with no visible context. The user's own toggle preferences
  // (userIsMuted / userIsAudioPlaybackEnabled) are preserved and restored
  // automatically when the workflow returns to an interactive phase.
  const { currentPhase } = useWorkflowPhase();
  const phaseIsNonInteractive =
    currentPhase?.mode === 'build' || currentPhase?.mode === 'result';
  const isMuted = userIsMuted || phaseIsNonInteractive;
  const isAudioPlaybackEnabled =
    userIsAudioPlaybackEnabled && !phaseIsNonInteractive;

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
    currentPhaseId: currentPhase?.id,
    currentPhaseTitle: currentPhase?.title,
    currentPhaseMode: currentPhase?.mode,
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

    // Document version focus change: fired by ArtifactContext.setFocusedRev
    // and ArtifactContext.restoreRevision when the user (NOT the system)
    // changes which revision is rendered in the doc panel — VersionSwitcher
    // selection, library row click, or Restore button. Inject a terse
    // system message so the agent's next response can ground itself in
    // what the user is actually looking at, without polling.
    const handleDocFocusRevChange = (e: Event) => {
      const detail = (e as CustomEvent<{
        artifactId: string;
        docName: string;
        rev: number;
        currentRev: number;
        source?: string;
      }>).detail;
      if (!detail || detail.source !== 'user') return;
      const onLatest = detail.rev === detail.currentRev;
      const text = onLatest
        ? `[Document Focus] User is now viewing the latest version of "${detail.docName}".`
        : `[Document Focus] User is now viewing version ${detail.rev} of "${detail.docName}" (latest is ${detail.currentRev}). Use the artifact tool with action "get" and rev=${detail.rev} if you need the exact content they're seeing.`;
      sendMessage({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "system",
          content: [{ type: "input_text", text }],
        },
      });
      // No response.create here: agent shouldn't proactively respond to
      // browsing; it should fold the new context into its NEXT reply.
    };

    window.addEventListener('primer:component-event', handleComponentEvent);
    window.addEventListener('primer:component-state-change', handleComponentStateChange);
    window.addEventListener('primer:document-focus-rev-change', handleDocFocusRevChange);

    return () => {
      window.removeEventListener('primer:component-event', handleComponentEvent);
      window.removeEventListener('primer:component-state-change', handleComponentStateChange);
      window.removeEventListener('primer:document-focus-rev-change', handleDocFocusRevChange);
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
    };
  }, [selectedAgentKey, toolsRegistered]); // Intentionally limited dependencies

  // Effect to reset hasInitializedSessionRef when agent changes
  // This ensures each agent gets an initial configuration with sessionConfiguredCount increment
  useEffect(() => {
    hasInitializedSessionRef.current = false;
  }, [selectedAgentKey]);

  // Effect to handle session updates for both connection and mute state changes.
  //
  // Defer-during-audio: if the agent is currently speaking and a non-initial
  // session reconfig fires (e.g. phase advanced from interactive → build, so
  // isMuted just flipped), we DON'T want to send the session.update mid-word.
  // It cuts the agent's audio off at exactly the moment they were narrating
  // the handoff that triggered the change. Wait for audio to settle, then the
  // effect re-fires (isAIAudioPlaying is in deps) and the update applies
  // cleanly. Initial configurations skip the audio gate — there's nothing to
  // interrupt yet.
  useEffect(() => {
    if (currentStatus === "CONNECTED" && toolsRegistered) {
      const isInitialConfiguration = !hasInitializedSessionRef.current;

      // Defer the reconfig if mid-audio for a non-initial update.
      if (!isInitialConfiguration && isAIAudioPlaying) {
        return;
      }

      // Clear audio buffer when mute state changes
      clearAudioBuffer();

      // Only update session if we have valid agent data
      if (agents && selectedAgentKey) {
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
  }, [currentStatus, selectedAgentKey, toolsRegistered, isMuted, isAIAudioPlaying]);

  // Expose imperative methods via ref
  useImperativeHandle(ref, () => ({
    connect: () => connectToRealtime(),
    disconnect: () => {
      disconnectFromRealtime();
      getSoundManager().stopAllSounds();
      setScene("blank");
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
