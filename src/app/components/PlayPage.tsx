"use client";

import React, { useEffect, useRef } from "react";
// Note: Information is now session-scoped on the backend, no need to clear on frontend

// Types
import { ExperienceMetadata, AgentConfig } from "../lib/types";

// Context providers & hooks
import { useTranscript } from "../contexts/TranscriptContext";
import { useScene } from "../hooks/useScene";
import { usePermissions } from "../hooks/usePermissions";

// UI components
import { Permission } from "@/config/auth";
import { FileUpload } from "./FileUpload";
import { Artifact } from "./Artifact";
import { ChecklistViewer } from "./ChecklistViewer";
import { RealtimeController } from "./RealtimeController";
import { SocketController } from "./SocketController";

// PlayPage components
import { 
  PlayPageHeader, 
  PlayPageControls, 
  PlayPageContent, 
  usePlayPageState 
} from "./PlayPage/index";

interface PlayPageProps {
  setDataChannel: React.Dispatch<React.SetStateAction<RTCDataChannel | null>>;
  experienceId: string;
  experienceMetadata: ExperienceMetadata;
  agents: Record<string, AgentConfig>;
  toolsRegistered: boolean;
  aiConfigurations: Record<string, any>;
}

export default function PlayPage({ 
  setDataChannel,
  experienceId,
  experienceMetadata,
  agents,
  toolsRegistered,
  aiConfigurations
}: PlayPageProps) {
  const { can } = usePermissions();
  const { setScene } = useScene();
  const { addTranscriptBreadcrumb } = useTranscript();

  // Initialize selected agent
  const initialAgentKey = Object.keys(agents)[0] || "";
  
  // Get AI configuration for selected agent
  const selectedAgentAiConfiguration = agents[initialAgentKey]?.aiConfiguration || 'default';
  const selectedConfig = aiConfigurations[selectedAgentAiConfiguration] || aiConfigurations.default;
  const hasAudio = selectedConfig?.modalities?.includes('audio');

  // Use custom hook for state management
  const {
    sessionStatus,
    setSessionStatus,
    selectedAgentKey,
    setSelectedAgentKey,
    queuedAgentTransfer,
    setQueuedAgentTransfer,
    isTranscriptExpanded,
    setIsTranscriptExpanded,
    isEventsPaneExpanded,
    setIsEventsPaneExpanded,
    isDebugModeEnabled,
    setIsDebugModeEnabled,
    isMuted,
    setIsMuted,
    isAudioPlaybackEnabled,
    setIsAudioPlaybackEnabled,
    isAIAudioPlaying,
    setIsAIAudioPlaying,
    isUserAudioPlaying,
    setIsUserAudioPlaying,
    userText,
    setUserText,
    checklistState,
    showChecklist,
    hideChecklist,
  } = usePlayPageState(hasAudio);

  // Initialize selected agent key
  useEffect(() => {
    if (!selectedAgentKey && initialAgentKey) {
      setSelectedAgentKey(initialAgentKey);
    }
  }, [initialAgentKey, selectedAgentKey, setSelectedAgentKey]);

  const isExperienceLoaded = true;

  // Ref to hold the controller methods
  const controllerRef = useRef<{
    connect: () => Promise<void>;
    disconnect: () => void;
    reconnect: () => Promise<void>;
    updateSession: (shouldTriggerResponse?: boolean) => Promise<void>;
    sendTextMessage: (text: string) => void;
    handleTalkButtonDown: () => void;
    handleTalkButtonUp: () => void;
  } | null>(null);

  // Additional ref for the background SocketController (socket-only mode)
  const socketControllerRef = useRef<{
    connect: () => Promise<void>;
    disconnect: () => void;
    reconnect: () => Promise<void>;
  } | null>(null);

  const handleQuit = () => {
    // Disconnect if connected, then navigate home
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      controllerRef.current?.disconnect();
    }
    // Navigate home
    window.location.href = "/";
  };

  // Helper for debug breadcrumbs
  const addDebugTranscriptBreadcrumb = (title: string, data?: Record<string, any>) => {
    if (isDebugModeEnabled) {
      addTranscriptBreadcrumb(title, data);
    }
  };

  // Handler to connect SocketController socket when RealtimeController becomes active
  const handleRealtimeConnected = () => {
    if (socketControllerRef.current) {
      socketControllerRef.current.connect();
    }
  };

  // Handle queued agent transfer when audio finishes
  useEffect(() => {
    if (!isAIAudioPlaying && queuedAgentTransfer) {
      addDebugTranscriptBreadcrumb(
        "Executing queued agent transfer",
        {
          from: agents[selectedAgentKey]?.name,
          to: agents[queuedAgentTransfer]?.name,
          audioWasPlaying: isAIAudioPlaying
        }
      );
      setSelectedAgentKey(queuedAgentTransfer);
      setQueuedAgentTransfer(null);
    }
  }, [isAIAudioPlaying, queuedAgentTransfer, agents, selectedAgentKey, setSelectedAgentKey, setQueuedAgentTransfer, addDebugTranscriptBreadcrumb]);

  // Set default scene when disconnected
  useEffect(() => {
    if (!isExperienceLoaded && !selectedAgentKey && sessionStatus === "DISCONNECTED") {
      setScene("default");
    }
  }, [isExperienceLoaded, selectedAgentKey, sessionStatus, setScene]);

  // Add touch-action management for mobile
  useEffect(() => {
    // Prevent default touch behaviors but allow hover
    document.body.style.touchAction = 'manipulation';
    
    // Only prevent default on specific events, not all touch events
    const preventDefaultOnMove = (e: TouchEvent) => {
      // Only prevent default if it's a multi-touch gesture (pinch/zoom)
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventDefaultOnMove, { passive: false });
    document.addEventListener('gesturestart', (e: Event) => e.preventDefault());
    document.addEventListener('gesturechange', (e: Event) => e.preventDefault());

    return () => {
      document.body.style.touchAction = '';
      document.removeEventListener('touchmove', preventDefaultOnMove);
      document.removeEventListener('gesturestart', (e: Event) => e.preventDefault());
      document.removeEventListener('gesturechange', (e: Event) => e.preventDefault());
    };
  }, []);

  // Note: Information is now session-scoped on the backend
  // Each session automatically starts with a fresh information store

  return (
    <div className="h-screen w-screen flex flex-col">
      <FileUpload />
      <Artifact />
      <ChecklistViewer 
        artifactId={checklistState.artifactId}
        isVisible={checklistState.isVisible}
        onClose={hideChecklist}
        agentName={agents[selectedAgentKey]?.name}
      />
      
      {/* Always initialize SocketController for socket connectivity (background mode) */}
      <SocketController
        aiConfigurations={aiConfigurations}
        selectedAgentAiConfiguration={selectedAgentAiConfiguration}
        agents={agents}
        selectedAgentKey={selectedAgentKey}
        toolsRegistered={toolsRegistered}
        isDebugModeEnabled={isDebugModeEnabled}
        showChecklist={showChecklist}
        hideChecklist={hideChecklist}
        autoConnect={true}
        experienceId={experienceId}
        setQueuedAgentTransfer={setQueuedAgentTransfer}
        addTranscriptBreadcrumb={addDebugTranscriptBreadcrumb}
        ref={socketControllerRef}
      />
      
      {/* Always initialize RealtimeController as the primary controller */}
      <RealtimeController
        aiConfigurations={aiConfigurations}
        selectedAgentAiConfiguration={selectedAgentAiConfiguration}
        agents={agents}
        selectedAgentKey={selectedAgentKey}
        toolsRegistered={toolsRegistered}
        onSessionStatusChange={setSessionStatus}
        setQueuedAgentTransfer={setQueuedAgentTransfer}
        setSelectedAgentKey={setSelectedAgentKey}
        isDebugModeEnabled={isDebugModeEnabled}
        onDataChannelChange={setDataChannel}
        setIsAIAudioPlaying={setIsAIAudioPlaying}
        setIsUserAudioPlaying={setIsUserAudioPlaying}
        isMuted={isMuted}
        isAIAudioPlaying={isAIAudioPlaying}
        isAudioPlaybackEnabled={isAudioPlaybackEnabled}
        showChecklist={showChecklist}
        hideChecklist={hideChecklist}
        onRealtimeConnected={handleRealtimeConnected}
        ref={controllerRef}
      />
      
      <div className="flex flex-col h-full text-white relative">
        {/* Header */}
        <PlayPageHeader
          experienceMetadata={experienceMetadata}
          agents={agents}
          selectedAgentKey={selectedAgentKey}
          setSelectedAgentKey={setSelectedAgentKey}
          isDebugModeEnabled={isDebugModeEnabled}
          canSwitchAgents={can(Permission.SWITCH_AGENTS) ?? false}
        />

        {/* Content Area */}
        <PlayPageContent
          isTranscriptExpanded={isTranscriptExpanded}
          setIsTranscriptExpanded={setIsTranscriptExpanded}
          isEventsPaneExpanded={isEventsPaneExpanded}
          setIsEventsPaneExpanded={setIsEventsPaneExpanded}
          isExperienceLoaded={isExperienceLoaded}
          userText={userText}
          setUserText={setUserText}
          onSendMessage={() => {
            if (controllerRef.current) {
              controllerRef.current.sendTextMessage(userText);
              setUserText("");
            }
          }}
          sessionStatus={sessionStatus}
        />

        {/* Controls */}
        <PlayPageControls
          sessionStatus={sessionStatus}
          isExperienceLoaded={isExperienceLoaded}
          hasAudio={hasAudio}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          isAudioPlaybackEnabled={isAudioPlaybackEnabled}
          setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
          isAIAudioPlaying={isAIAudioPlaying}
          isUserAudioPlaying={isUserAudioPlaying}
          isTranscriptExpanded={isTranscriptExpanded}
          setIsTranscriptExpanded={setIsTranscriptExpanded}
          isEventsPaneExpanded={isEventsPaneExpanded}
          setIsEventsPaneExpanded={setIsEventsPaneExpanded}
          isDebugModeEnabled={isDebugModeEnabled}
          setIsDebugModeEnabled={setIsDebugModeEnabled}
          handleQuit={handleQuit}
          canViewTechnical={can(Permission.VIEW_TECHNICAL) ?? false}
          experienceId={experienceId}
          experienceTitle={experienceMetadata.title}
          hasReadme={experienceMetadata.hasReadme ?? false}
        />
      </div>
    </div>
  );
} 