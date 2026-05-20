"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
// Note: Information is now session-scoped on the backend, no need to clear on frontend

// Types
import { ExperienceMetadata, AgentConfig, SessionStatus } from "../lib/types";
import type { PlayPageFooterApi } from "./PlayPage/playPageFooterApi";

export type { PlayPageFooterApi } from "./PlayPage/playPageFooterApi";

// Context providers & hooks
import { useTranscript } from "../contexts/TranscriptContext";
import { LayoutProvider, useLayout } from "../contexts/LayoutContext";
import { useArtifact } from "../contexts/ArtifactContext";
import { WorkflowPhaseProvider } from "../contexts/WorkflowPhaseContext";
import { useScene } from "../hooks/useScene";
import { usePermissions } from "../hooks/usePermissions";
import { useTranscriptPersistence } from "../hooks/useTranscriptPersistence";
import { getExistingSessionId } from "../lib/session-utils";

// UI components
import { Permission } from "@/config/auth";
import { FileUpload } from "./FileUpload";
import { Artifact } from "./Artifact";
import { RealtimeController } from "./RealtimeController";
import { SocketController } from "./SocketController";
import { EventsWindow } from "./EventsWindow";
import { ReadmeDialog } from "./ReadmeDialog";
import { ExperienceCompletedDialog } from "./ExperienceCompletedDialog/ExperienceCompletedDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// PlayPage components
import {
  PlayPageSplitContent,
  PhaseSurfaceSwitch,
  usePlayPageState,
} from "./PlayPage/index";
import { resolveInitialAgentKey } from "./PlayPage/resolveInitialAgentKey";

interface PlayPageProps {
  setDataChannel: React.Dispatch<React.SetStateAction<RTCDataChannel | null>>;
  experienceId: string;
  experienceMetadata: ExperienceMetadata;
  agents: Record<string, AgentConfig>;
  toolsRegistered: boolean;
  aiConfigurations: Record<string, any>;
  /** Wired from play route; drives shared `Footer` actions. */
  footerApiRef: React.MutableRefObject<PlayPageFooterApi | null>;
  onFooterTranscriptActive: (active: boolean) => void;
  onFooterEventsActive: (active: boolean) => void;
  onFooterDebugActive: (active: boolean) => void;
  /**
   * Optional notifier for the realtime session connection lifecycle.
   * `PlayClient` uses this to advance its own loading state machine from
   * `welcome` → `play` once the realtime session reports `CONNECTED` while
   * `PlayPage` is pre-mounted hidden.
   */
  onSessionStatusChange?: (status: SessionStatus) => void;
}

export default function PlayPage(props: PlayPageProps) {
  return (
    <LayoutProvider>
      <PlayPageInner {...props} />
    </LayoutProvider>
  );
}

function PlayPageInner({
  setDataChannel,
  experienceId,
  experienceMetadata,
  agents,
  toolsRegistered,
  aiConfigurations,
  footerApiRef,
  onFooterTranscriptActive,
  onFooterEventsActive,
  onFooterDebugActive,
  onSessionStatusChange,
}: PlayPageProps) {
  const { can } = usePermissions();
  const { setScene } = useScene();
  const { addTranscriptBreadcrumb, setActiveAgent } = useTranscript();
  const { setDocumentTab, setDocumentVisible } = useLayout();
  const { setActiveChecklist } = useArtifact();

  // Platform-managed conversation transcript: when the experience opts in
  // via `autoTranscript: true` in its experience.json, the platform
  // debounces writes of the rendered chat history to a
  // `conversation_transcript` markdown artifact. Agents reference the
  // artifact id without producing the content themselves, eliminating the
  // empty-content failure mode where voice/realtime agents would call
  // `artifact create` with no body.
  useTranscriptPersistence({ enabled: experienceMetadata?.autoTranscript === true });

  const [quitDialogOpen, setQuitDialogOpen] = useState(false);
  const [readmeDialogOpen, setReadmeDialogOpen] = useState(false);
  // Read the per-tab session id once on mount so the WorkflowPhaseProvider
  // (and any sibling) can hit `/api/workflow-phases/*` with the right header
  // without re-reading sessionStorage each render. The id is server-issued by
  // the play RSC or recovery flow before this component mounts.
  const [sessionId, setSessionId] = useState<string | null>(null);
  useEffect(() => {
    setSessionId(getExistingSessionId());
  }, []);

  // Initialize selected agent. Prefer the authored `initialAgent` from the
  // experience config (propagated through `ConfigResponse.metadata`); fall
  // back to the first agent key for experiences that don't declare one.
  const initialAgentKey = resolveInitialAgentKey(
    agents,
    experienceMetadata?.initialAgent
  );

  // Get AI configuration for selected agent
  const selectedAgentAiConfiguration =
    agents[initialAgentKey]?.aiConfiguration || "default";
  const selectedConfig =
    aiConfigurations[selectedAgentAiConfiguration] || aiConfigurations.default;
  const hasAudio = selectedConfig?.modalities?.includes("audio");

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
    userText,
    setUserText,
  } = usePlayPageState(hasAudio);

  // Checklists now live inside the document panel's Checklist tab. The
  // callbacks passed into the realtime/socket controllers update
  // ArtifactContext and swing the tab into view.
  const showChecklist = useCallback(
    (artifactId: string) => {
      setActiveChecklist(artifactId);
      setDocumentTab("checklist");
      setDocumentVisible(true);
    },
    [setActiveChecklist, setDocumentTab, setDocumentVisible]
  );
  const hideChecklist = useCallback(() => {
    setActiveChecklist(null);
  }, [setActiveChecklist]);

  // Initialize selected agent key
  useEffect(() => {
    if (!selectedAgentKey && initialAgentKey) {
      setSelectedAgentKey(initialAgentKey);
    }
  }, [initialAgentKey, selectedAgentKey, setSelectedAgentKey]);

  // Keep TranscriptContext aware of the active agent so newly added items
  // (messages + breadcrumbs) get stamped with agentKey/agentName for the
  // left chat panel's per-agent labeling and filter chips.
  useEffect(() => {
    if (selectedAgentKey && agents[selectedAgentKey]) {
      setActiveAgent(selectedAgentKey, agents[selectedAgentKey].name);
    }
  }, [selectedAgentKey, agents, setActiveAgent]);

  // Mirror the realtime session lifecycle out so `PlayClient` can advance
  // its `welcome → play` transition once the connection lands.
  useEffect(() => {
    onSessionStatusChange?.(sessionStatus);
  }, [sessionStatus, onSessionStatusChange]);

  // Mirror expand states to play route (footer visual active states).
  useEffect(() => {
    onFooterTranscriptActive(isTranscriptExpanded);
  }, [isTranscriptExpanded, onFooterTranscriptActive]);
  useEffect(() => {
    onFooterEventsActive(isEventsPaneExpanded);
  }, [isEventsPaneExpanded, onFooterEventsActive]);
  useEffect(() => {
    onFooterDebugActive(isDebugModeEnabled);
  }, [isDebugModeEnabled, onFooterDebugActive]);

  // Wire shared Footer actions
  useEffect(() => {
    const api: PlayPageFooterApi = {
      onRequestLeave: () => setQuitDialogOpen(true),
      onToggleTranscript: () => setIsTranscriptExpanded((v) => !v),
      onToggleEvents: () => setIsEventsPaneExpanded((v) => !v),
      onToggleDebug: () => setIsDebugModeEnabled((v) => !v),
      onOpenInfo: () => setReadmeDialogOpen(true),
    };
    footerApiRef.current = api;
    return () => {
      footerApiRef.current = null;
    };
  }, [
    footerApiRef,
    setIsTranscriptExpanded,
    setIsEventsPaneExpanded,
    setIsDebugModeEnabled,
  ]);

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

  const isExperienceLoaded = true;

  // Helper for debug breadcrumbs
  const addDebugTranscriptBreadcrumb = useCallback(
    (title: string, data?: Record<string, any>) => {
      if (isDebugModeEnabled) {
        addTranscriptBreadcrumb(title, data);
      }
    },
    [isDebugModeEnabled, addTranscriptBreadcrumb]
  );

  // Handler to connect SocketController socket when RealtimeController becomes active
  const handleRealtimeConnected = () => {
    if (socketControllerRef.current) {
      socketControllerRef.current.connect();
    }
  };

  // Handle queued agent transfer when audio finishes
  useEffect(() => {
    if (!isAIAudioPlaying && queuedAgentTransfer) {
      addDebugTranscriptBreadcrumb("Executing queued agent transfer", {
        from: agents[selectedAgentKey]?.name,
        to: agents[queuedAgentTransfer]?.name,
        audioWasPlaying: isAIAudioPlaying,
      });
      setSelectedAgentKey(queuedAgentTransfer);
      setQueuedAgentTransfer(null);
    }
  }, [
    isAIAudioPlaying,
    queuedAgentTransfer,
    agents,
    selectedAgentKey,
    setSelectedAgentKey,
    setQueuedAgentTransfer,
    addDebugTranscriptBreadcrumb,
  ]);

  // Set default scene when disconnected
  useEffect(() => {
    if (!isExperienceLoaded && !selectedAgentKey && sessionStatus === "DISCONNECTED") {
      setScene("default");
    }
  }, [isExperienceLoaded, selectedAgentKey, sessionStatus, setScene]);

  // Add touch-action management for mobile
  useEffect(() => {
    document.body.style.touchAction = "manipulation";

    const preventDefaultOnMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventGesture = (e: Event) => e.preventDefault();

    document.addEventListener("touchmove", preventDefaultOnMove, { passive: false });
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);

    return () => {
      document.body.style.touchAction = "";
      document.removeEventListener("touchmove", preventDefaultOnMove);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
    };
  }, []);

  return (
    <WorkflowPhaseProvider
      phases={experienceMetadata.workflowPhases}
      experienceId={experienceId}
      sessionId={sessionId ?? ""}
      selectedAgentKey={selectedAgentKey}
    >
      <FileUpload />
      <Artifact />
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
        isMuted={isMuted}
        isAIAudioPlaying={isAIAudioPlaying}
        isAudioPlaybackEnabled={isAudioPlaybackEnabled}
        showChecklist={showChecklist}
        hideChecklist={hideChecklist}
        onRealtimeConnected={handleRealtimeConnected}
        ref={controllerRef}
      />
      {(experienceMetadata.workflowPhases?.length ?? 0) > 0 && (
        <ExperienceCompletedDialog
          onClose={() => setQuitDialogOpen(true)}
        />
      )}
      <div className="flex h-full min-h-0 max-w-screen-2xl mx-auto flex-1 flex-col text-foreground py-10 ">
        <PhaseSurfaceSwitch
          interactive={
            <PlayPageSplitContent
              userText={userText}
              setUserText={setUserText}
              onSendMessage={() => {
                if (controllerRef.current) {
                  controllerRef.current.sendTextMessage(userText);
                  setUserText("");
                }
              }}
              sessionStatus={sessionStatus}
              experienceTitle={experienceMetadata.title}
              showPhaseCount={experienceMetadata.showPhaseCount}
              agents={agents}
              selectedAgentKey={selectedAgentKey}
              setSelectedAgentKey={setSelectedAgentKey}
              canSwitchAgents={can(Permission.SWITCH_AGENTS) ?? false}
              isDebugModeEnabled={isDebugModeEnabled}
              queuedAgentKey={queuedAgentTransfer}
              hasAudio={hasAudio}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              isAudioPlaybackEnabled={isAudioPlaybackEnabled}
              setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
              isAIAudioPlaying={isAIAudioPlaying}
              showToolErrors={
                isDebugModeEnabled || (can(Permission.VIEW_TECHNICAL) ?? false)
              }
            />
          }
        />

        <EventsWindow
          isExpanded={isEventsPaneExpanded}
          setIsExpanded={setIsEventsPaneExpanded}
        />
      </div>

      {isExperienceLoaded && (
        <AlertDialog open={quitDialogOpen} onOpenChange={setQuitDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to quit?</AlertDialogTitle>
              <AlertDialogDescription>
                This will end your current session and return you to the home
                page. Any unsaved progress may be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleQuit}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Quit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {experienceMetadata.hasReadme && (
        <ReadmeDialog
          experienceId={experienceId}
          experienceTitle={experienceMetadata.title}
          open={readmeDialogOpen}
          onOpenChange={setReadmeDialogOpen}
        />
      )}
    </WorkflowPhaseProvider>
  );
}
