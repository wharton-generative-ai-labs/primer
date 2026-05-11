/**
 * useSessionManagement Hook
 * 
 * Manages OpenAI Realtime API session configuration:
 * - Session updates and configuration
 * - Tool registration and formatting
 * - Agent-specific settings (instructions, voice, temperature)
 * - Turn detection and modality configuration
 */

import { useRef, useCallback, useState } from 'react';
import { AgentConfig, SessionStatus, AIConfiguration } from '../lib/types';
import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useSessionManagement');

interface UseSessionManagementProps {
  selectedAgentKey: string;
  agents: Record<string, AgentConfig>;
  aiConfigurations: Record<string, AIConfiguration>;
  selectedAgentAiConfiguration: string;
  isMuted: boolean;
  currentStatus: SessionStatus;
  sendMessage: (message: any) => boolean;
  reconnectToRealtime: () => Promise<void>;
  isDebugModeEnabled: boolean;
  addTranscriptBreadcrumb: (message: string, data?: any) => void;
  setIsAIAudioPlaying: (isPlaying: boolean) => void;
  setIsUserAudioPlaying: (isPlaying: boolean) => void;
}

export function useSessionManagement({
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
}: UseSessionManagementProps) {
  const lastAgentRef = useRef<AgentConfig | undefined>(undefined);
  const lastSessionUpdateRef = useRef<string>('');
  const [sessionConfiguredCount, setSessionConfiguredCount] = useState<number>(0);
  const pendingInitialConfigRef = useRef<boolean>(false);
  const configuredAgentKeyRef = useRef<string>('');

  const selectedConfig = aiConfigurations[selectedAgentAiConfiguration] || aiConfigurations.default;
  const hasAudio = selectedConfig?.modalities?.includes('audio');

  const getToolsForAgent = useCallback((currentAgent: AgentConfig) => {
    const registeredTools = ToolRegistry.getInstance().getAllTools();

    let availableTools = [];
    if (currentAgent?.availableTools && Array.isArray(currentAgent.availableTools)) {
      // Filter registered tools to only those specified in availableTools
      availableTools = registeredTools.filter(tool => 
        currentAgent.availableTools!.includes(tool.name)
      );
    } else {
      // Fallback to all registered tools if the agent doesn't specify availableTools
      // Note: On client side, registeredTools only contains client-safe tools (registerClientBuiltinTools)
      // This fallback should rarely be used with properly configured experiences (configVersion 2+)
      logger.warn(`[useSessionManagement] Agent '${currentAgent.name}' has no availableTools specified. Using all registered tools as fallback.`);
      availableTools = registeredTools;
    }

    const toolsForAI = ToolRegistry.getInstance().formatForAI(availableTools);
    return toolsForAI;
  }, []);

  const updateSession = useCallback(async (isInitialConfiguration: boolean = false): Promise<{ didSendSessionUpdate: boolean }> => {
    const currentAgent = agents[selectedAgentKey];
    const selectedConfig = aiConfigurations[selectedAgentAiConfiguration] || aiConfigurations.default;

    // Create a unique key for this session configuration based on actual config parameters
    // Note: Don't include currentStatus in the key, as we want to prevent duplicates
    // regardless of connection state transitions
    const sessionKey = `${selectedAgentKey}-${isMuted}-${isInitialConfiguration}`;
    
    // Skip if we've already sent this exact session update
    if (lastSessionUpdateRef.current === sessionKey && currentStatus === "CONNECTED") {
      logger.debug({ sessionKey }, 'Session already updated, skipping duplicate');
      return { didSendSessionUpdate: false };
    }

    // Create a new session only when switching agents, not on initial connection
    const shouldCreateNewSession = 
      lastAgentRef.current !== undefined && // Skip on initial connection
      currentAgent !== lastAgentRef.current;

    if (shouldCreateNewSession) {
      logger.debug({
        currentAgent: currentAgent?.name,
        lastAgent: lastAgentRef.current?.name,
      }, 'Creating new session');
      
      if (isDebugModeEnabled) {
        addTranscriptBreadcrumb(
          "Creating new realtime session",
          {
            reason: "Agent changed",
            currentAgent: currentAgent?.name,
            lastAgent: lastAgentRef.current?.name,
            voice: currentAgent?.voice ?? "ballad"
          }
        );
      }

      // Reset audio states when changing agents
      setIsAIAudioPlaying(false);
      setIsUserAudioPlaying(false);

      // Update lastAgentRef before reconnecting to prevent race conditions
      lastAgentRef.current = currentAgent;
      lastSessionUpdateRef.current = '';  // Reset session key on reconnect
      
      // Wait for reconnection to complete before proceeding
      await reconnectToRealtime();
      return { didSendSessionUpdate: false };
    }

    // Only proceed if we're actually connected
    if (currentStatus !== "CONNECTED") {
      logger.debug({}, 'Not connected, skipping update');
      return { didSendSessionUpdate: false };
    }

    const toolsForAI = getToolsForAgent(currentAgent);
    
    logger.debug({ toolsForAI: JSON.stringify(toolsForAI, null, 2) }, 'Tools being sent to AI (raw)');

    if (!currentAgent?.instructions) {
      logger.warn({
        agent: currentAgent?.name,
        selectedAgentKey,
        instructionsLength: currentAgent?.instructions?.length
      }, 'No agent instructions available, skipping session update');
      return { didSendSessionUpdate: false };
    }

    // Build turn detection settings from aiConfiguration.realtimeSettings if available
    const realtimeSettings = selectedConfig?.realtimeSettings;
    const turnDetection = isMuted
      ? null
      : {
        type: "server_vad",
        threshold: realtimeSettings?.threshold ?? 0.5,
        prefix_padding_ms: realtimeSettings?.prefix_padding_ms ?? 300,
        silence_duration_ms: realtimeSettings?.silence_duration_ms ?? 500,
        create_response: realtimeSettings?.create_response ?? true,
        interrupt_response: realtimeSettings?.interrupt_response ?? true,
      };

    // Reasoning-capable realtime models (e.g., gpt-realtime-2) accept a
    // `reasoning.effort` setting at session level. Only included when the
    // experience config opts in; non-reasoning models will ignore it.
    const reasoningEffort = selectedConfig?.reasoningEffort;
    const reasoning = reasoningEffort ? { effort: reasoningEffort } : undefined;

    // GA Realtime API session.update shape:
    //   - `session.type: "realtime"` is required (server rejects otherwise
    //     with `Missing required parameter: 'session.type'.`).
    //   - Audio config is nested under `audio.input` / `audio.output` rather
    //     than the legacy flat fields (`voice`, `input_audio_format`,
    //     `input_audio_transcription`, `turn_detection`).
    //   - session.update is a true PATCH: only fields we send get updated,
    //     so we omit `output_modalities` and audio formats that were already
    //     set during ephemeral key creation.
    //   - To clear `turn_detection` (e.g. on mute), pass `null` per the GA
    //     "clearing fields" convention.
    const audioInput = hasAudio
      ? {
          transcription: { model: "whisper-1" },
          turn_detection: turnDetection,
        }
      : {
          transcription: null,
          turn_detection: null,
        };

    // Note: `temperature` is intentionally omitted. The GA Realtime API
    // dropped it from the session schema (server returns
    // `Unknown parameter: 'session.temperature'.` if sent). For reasoning
    // models (e.g. gpt-realtime-2) use `reasoning.effort` to control output
    // variability instead; non-reasoning GA models use a fixed default.
    // `AgentConfig.temperature` is still consumed by non-realtime flows
    // (text chat, etc.), so we keep it on the agent config — just don't
    // forward it here.
    const sessionUpdateEvent = {
      type: "session.update",
      session: {
        type: "realtime",
        instructions: currentAgent.instructions,
        tools: toolsForAI,
        audio: {
          input: audioInput,
          output: {
            voice: currentAgent.voice || "alloy",
          },
        },
        ...(reasoning ? { reasoning } : {}),
      },
    };

    sendMessage(sessionUpdateEvent);
    lastAgentRef.current = currentAgent;
    lastSessionUpdateRef.current = sessionKey;
    
    // Track if this was an initial configuration so we can increment the counter
    // when we receive session.updated from OpenAI
    if (isInitialConfiguration) {
      pendingInitialConfigRef.current = true;
    }
    
    return { didSendSessionUpdate: true };
  }, [
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
    getToolsForAgent,
    hasAudio,
  ]);

  const clearAudioBuffer = useCallback(() => {
    if (!isMuted) {
      logger.debug({}, 'Unmuting, clearing audio buffer');
      sendMessage({ type: "input_audio_buffer.clear" });
    }
  }, [isMuted, sendMessage]);

  const onSessionUpdated = useCallback(() => {
    // Called when we receive session.updated from OpenAI
    // Only increment counter if this was an initial configuration
    if (pendingInitialConfigRef.current) {
      setSessionConfiguredCount(prev => prev + 1);
      configuredAgentKeyRef.current = selectedAgentKey; // Track which agent this counter belongs to
      pendingInitialConfigRef.current = false;
    }
  }, [sessionConfiguredCount, selectedAgentKey]);

  return {
    lastAgentRef,
    sessionConfiguredCount,
    configuredAgentKey: configuredAgentKeyRef.current,
    updateSession,
    getToolsForAgent,
    clearAudioBuffer,
    onSessionUpdated,
  };
}
