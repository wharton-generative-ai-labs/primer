/**
 * useAgentSwitching Hook
 *
 * Manages agent switching and transfer logic:
 * - Queued agent transfers
 * - Agent switching when audio finishes
 * - Initial message sending
 * - Agent transition coordination
 * - Workflow-phase system-message injection (Task A12)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AgentConfig, SessionStatus } from '../lib/types';
import { generateUUID } from '@/app/lib/uuid';

interface UseAgentSwitchingProps {
  selectedAgentKey: string;
  agents: Record<string, AgentConfig>;
  currentStatus: SessionStatus;
  toolsRegistered: boolean;
  isAIAudioPlaying: boolean;
  isDebugModeEnabled: boolean;
  sendMessage: (message: any) => boolean;
  setQueuedAgentTransfer: (key: string | null) => void;
  setSelectedAgentKey: (key: string) => void;
  addTranscriptBreadcrumb: (message: string, data?: any) => void;
  addTranscriptMessage: (id: string, role: "user" | "assistant", text: string, isSimulated?: boolean) => void;
  getToolsForAgent: (agent: AgentConfig) => any[];
  sessionConfiguredCount: number;
  configuredAgentKey: string;
  /**
   * Workflow-phase context for the initial-message decision: when the agent
   * connects and the session is already mid-flight in a non-interactive phase
   * (build/result), we send a phase-resume system message instead of the
   * default "Hello!" simulated user turn. Without this, a resumed agent in a
   * silent phase has no impulse to keep orchestrating.
   */
  currentPhaseId?: string;
  currentPhaseTitle?: string;
  currentPhaseMode?: 'interactive' | 'build' | 'result';
}

export function useAgentSwitching({
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
  currentPhaseId,
  currentPhaseTitle,
  currentPhaseMode,
}: UseAgentSwitchingProps) {
  const [queuedAgentTransfer, setLocalQueuedAgentTransfer] = useState<string | null>(null);
  const initialMessageSentRef = useRef<string | null>(null);
  // Holds a workflow-phase-change system message that should ride post-transfer
  // when the phase change requires switching agents. Set by the
  // `workflow-phase-change` listener; consumed by the post-transfer "Hello"
  // effect (which sends it as a system message INSTEAD of "Hello!"). Also
  // consumed when the audio queue flushes a same-agent injection.
  const pendingPhaseSystemMessageRef = useRef<string | null>(null);
  // Holds a same-agent workflow-phase-change message that arrived while audio
  // was playing. Flushed by the audio-stop effect.
  const queuedPhaseSystemMessageRef = useRef<string | null>(null);

  const sendSimulatedUserMessage = useCallback((text: string) => {
    const id = generateUUID().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    const success = sendMessage({
      type: "conversation.item.create",
      item: {
        id,
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });

    if (success) {
      sendMessage({ type: "response.create" });
    }
  }, [sendMessage, addTranscriptMessage]);

  // Inject a `system`-role conversation item into the realtime session.
  // Mirrors the inline pattern in `RealtimeController` (component-event
  // injection) but exposed here so the workflow-phase-change handler can reach
  // it. Does NOT add a transcript message — system items are not user-visible.
  const sendSimulatedSystemMessage = useCallback((text: string) => {
    const success = sendMessage({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text }],
      },
    });

    if (success) {
      sendMessage({ type: "response.create" });
    }
  }, [sendMessage]);

  // Effect to send initial message when connected and tools are registered
  // CRITICAL: This effect depends on sessionConfiguredCount which is incremented
  // AFTER the session update is sent, ensuring proper ordering
  useEffect(() => {
    if (currentStatus === "CONNECTED" && agents && selectedAgentKey && toolsRegistered && sessionConfiguredCount > 0) {
      // CRITICAL: Only send Hello if the counter belongs to THIS agent
      // When switching agents, the counter might still be from the previous agent
      if (configuredAgentKey !== selectedAgentKey) {
        return;
      }

      // Create a unique key for this agent (NOT including counter, since counter triggers this effect)
      // We want to send Hello once per agent, not once per counter value
      const sessionKey = `${selectedAgentKey}-${currentStatus}`;
      const pendingPhaseMessage = pendingPhaseSystemMessageRef.current;

      // Only send initial message once per agent connection — UNLESS a
      // pending phase-change system message is queued, which always sends.
      if (initialMessageSentRef.current === sessionKey && !pendingPhaseMessage) {
        return;
      }

      const currentAgent = agents[selectedAgentKey];
      const toolsForAI = getToolsForAgent(currentAgent);

      // Only send initial message if we have tools and instructions
      if (toolsForAI.length > 0 && currentAgent?.instructions) {

        const toolsForLogging = {
          agent: currentAgent.name,
          availableTools: toolsForAI.map(t => t.name).sort(),
          toolsFound: toolsForAI.length
        };

        if (isDebugModeEnabled) {
          addTranscriptBreadcrumb(
            "Available tools",
            toolsForLogging,
          );
        }

        if (pendingPhaseMessage) {
          // Cross-agent phase change: send the queued system message instead
          // of the default "Hello!" so the new agent enters with phase context.
          sendSimulatedSystemMessage(pendingPhaseMessage);
          pendingPhaseSystemMessageRef.current = null;
        } else if (
          currentPhaseId &&
          (currentPhaseMode === 'build' || currentPhaseMode === 'result')
        ) {
          // Resume into a non-interactive phase: the user has no chat surface
          // and the mic is muted, so a default "Hello!" simulated user turn
          // would either get no response or land the agent in a confused
          // greeting state. Inject a phase-resume system message that tells
          // the agent exactly what to do next: inspect artifact state,
          // continue orchestration silently via tool calls.
          const phaseLabel = currentPhaseTitle
            ? `"${currentPhaseTitle}" (${currentPhaseId})`
            : `"${currentPhaseId}"`;
          sendSimulatedSystemMessage(
            `[SYSTEM/session_resume]\n` +
              `Session resumed mid-flight in workflow phase ${phaseLabel}, ` +
              `mode: ${currentPhaseMode}. The user has no chat surface in this ` +
              `phase. Do NOT greet the user, narrate, or ask questions. ` +
              `Inspect existing artifact state via tool calls (artifact discover, ` +
              `checklist discover) and continue orchestration from where the ` +
              `prior session left off. If the work for this phase is already ` +
              `complete, advance via 'workflowPhase nextPhase'.`,
          );
        } else {
          sendSimulatedUserMessage("Hello!");
        }
        initialMessageSentRef.current = sessionKey;
      }
    } else if (currentStatus === "DISCONNECTED") {
      // Reset when disconnected so we can send again on next connection
      initialMessageSentRef.current = null;
    }
  }, [currentStatus, selectedAgentKey, toolsRegistered, sessionConfiguredCount, agents, getToolsForAgent, isDebugModeEnabled, addTranscriptBreadcrumb, sendSimulatedUserMessage, sendSimulatedSystemMessage, configuredAgentKey, currentPhaseId, currentPhaseTitle, currentPhaseMode]);

  // Effect to handle queued agent transfer when audio finishes
  useEffect(() => {
    if (!isAIAudioPlaying && queuedAgentTransfer) {
      addTranscriptBreadcrumb(
        "Transferring agents (queued)",
        {
          from: agents[selectedAgentKey]?.name,
          to: agents[queuedAgentTransfer]?.name,
          audioWasPlaying: isAIAudioPlaying
        }
      );
      setSelectedAgentKey(queuedAgentTransfer);
      setQueuedAgentTransfer(null);
      setLocalQueuedAgentTransfer(null);
    }
  }, [isAIAudioPlaying, queuedAgentTransfer, addTranscriptBreadcrumb, agents, selectedAgentKey, setSelectedAgentKey, setQueuedAgentTransfer]);

  // Effect to flush a same-agent workflow-phase system message that was queued
  // while audio was playing. Runs whenever audio stops. Independent of the
  // cross-agent flow (which uses `pendingPhaseSystemMessageRef` and rides
  // post-transfer in the Hello effect above).
  useEffect(() => {
    if (!isAIAudioPlaying && queuedPhaseSystemMessageRef.current) {
      const text = queuedPhaseSystemMessageRef.current;
      queuedPhaseSystemMessageRef.current = null;
      sendSimulatedSystemMessage(text);
    }
  }, [isAIAudioPlaying, sendSimulatedSystemMessage]);

  // Listen for workflow-phase-change events dispatched by WorkflowPhaseContext
  // and inject the system message into the realtime conversation. Cross-agent
  // transitions queue an agent transfer first; the system message rides
  // post-transfer (see the Hello effect above).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { systemMessage?: string | null; toAgent?: string }
        | undefined;
      if (!detail || !detail.systemMessage) return;
      const text = detail.systemMessage;

      if (detail.toAgent && detail.toAgent !== selectedAgentKey) {
        // Cross-agent: queue the transfer; deliver the message post-transfer.
        pendingPhaseSystemMessageRef.current = text;
        setLocalQueuedAgentTransfer(detail.toAgent);
        setQueuedAgentTransfer(detail.toAgent);
        return;
      }

      if (isAIAudioPlaying) {
        // Same agent, audio mid-playback: queue and flush on audio stop.
        queuedPhaseSystemMessageRef.current = text;
        return;
      }

      // Same agent, audio idle: inject immediately.
      sendSimulatedSystemMessage(text);
    };

    window.addEventListener('workflow-phase-change', handler);
    return () => window.removeEventListener('workflow-phase-change', handler);
  }, [
    selectedAgentKey,
    isAIAudioPlaying,
    setQueuedAgentTransfer,
    sendSimulatedSystemMessage,
  ]);

  return {
    queuedAgentTransfer,
    setLocalQueuedAgentTransfer,
    sendSimulatedUserMessage,
    sendSimulatedSystemMessage,
  };
}
