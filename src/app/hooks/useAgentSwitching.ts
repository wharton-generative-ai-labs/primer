/**
 * useAgentSwitching Hook
 * 
 * Manages agent switching and transfer logic:
 * - Queued agent transfers
 * - Agent switching when audio finishes
 * - Initial message sending
 * - Agent transition coordination
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
}: UseAgentSwitchingProps) {
  const [queuedAgentTransfer, setLocalQueuedAgentTransfer] = useState<string | null>(null);
  const initialMessageSentRef = useRef<string | null>(null);

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
      
      // Only send initial message once per agent connection
      if (initialMessageSentRef.current === sessionKey) {
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
        
        sendSimulatedUserMessage("Hello!");
        initialMessageSentRef.current = sessionKey;
      }
    } else if (currentStatus === "DISCONNECTED") {
      // Reset when disconnected so we can send again on next connection
      initialMessageSentRef.current = null;
    }
  }, [currentStatus, selectedAgentKey, toolsRegistered, sessionConfiguredCount, agents, getToolsForAgent, isDebugModeEnabled, addTranscriptBreadcrumb, sendSimulatedUserMessage]);

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

  return {
    queuedAgentTransfer,
    setLocalQueuedAgentTransfer,
    sendSimulatedUserMessage,
  };
}
