"use client";

import React, { useState, Suspense, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import { SceneProvider } from "../../contexts/SceneContext";
import { ClientEventProvider } from "../../contexts/ClientEventContext";
import PlayPage from "../../components/PlayPage";
import PrimerBackground from '../../components/PrimerBackground';
import ExperienceLoadingStatus, { LoadingPhase, defaultPhases } from "../../components/ExperienceLoadingStatus";
import { SessionRecoveryDialog } from "../../components/SessionRecoveryDialog";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { ComponentScripts } from "../../components/ComponentScripts";
import { getValidationReport, getExperienceMetadata, getAgents, getScenes, getSounds, getTools as getExperienceTools, getAIConfigurations } from '../../lib/configUtils';
import { createSoundManager } from '@/app/lib/tools/sound';
import { createSceneManager } from '../../lib/SceneManager';
import { ExperienceMetadata, AgentConfig } from "../../lib/types";
import { clearSession, setSessionId, ensureSession, getExistingSessionId } from '../../lib/session-utils';
import { useSession } from 'next-auth/react';
import { SessionEvent } from '../../lib/file-utils';

interface AccessCheckResult {
  canAccess: boolean;
  reason: 'permission' | 'owner' | 'class' | 'none' | 'not_authenticated';
  classInfo?: { className: string; classId: string };
}

interface PreviousSessionInfo {
  sessionId: string;
  experienceId: string;
  startTime: string;
  lastActivity?: string;
  userName?: string;
  userEmail?: string;
}

interface UserSessionResponse {
  session: PreviousSessionInfo | null;
  hasArtifacts?: boolean;
  isCompleted?: boolean;
  lastEvent?: SessionEvent | null;
}

function AppWrapper() {
  const params = useParams();
  const experienceId = params?.id as string;
  const { data: authSession, status: authStatus } = useSession();
  
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('loading');
  const [experienceError, setExperienceError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [experienceMetadata, setExperienceMetadata] = useState<ExperienceMetadata | null>(null);
  const [agents, setAgents] = useState<Record<string, AgentConfig>>({});
  const [toolsRegistered, setToolsRegistered] = useState<boolean>(false);
  const [aiConfigurations, setAIConfigurations] = useState<Record<string, any>>({});
  const [hasComponents, setHasComponents] = useState<boolean>(false);
  // Store class info for potential future use (analytics, display)
  const [, setClassInfo] = useState<{ className: string; classId: string } | null>(null);
  
  // Session recovery state
  const [showSessionRecovery, setShowSessionRecovery] = useState<boolean>(false);
  const [previousSession, setPreviousSession] = useState<PreviousSessionInfo | null>(null);
  const [previousSessionHasArtifacts, setPreviousSessionHasArtifacts] = useState<boolean>(false);
  const [previousSessionIsCompleted, setPreviousSessionIsCompleted] = useState<boolean>(false);
  const [previousSessionLastEvent, setPreviousSessionLastEvent] = useState<SessionEvent | null>(null);
  const [sessionDecisionMade, setSessionDecisionMade] = useState<boolean>(false);
  
  // Backdrop transition state
  const [triggerBackdropTransition, setTriggerBackdropTransition] = useState<boolean>(false);

  // Calculate progress based on current phase
  useEffect(() => {
    if (!loadingPhase) {
      setLoadingProgress(0);
      return;
    }
    
    const currentIndex = defaultPhases.indexOf(loadingPhase);
    if (currentIndex >= 0) {
      // Calculate progress as percentage (leaving some room at the end)
      const progress = Math.min(95, Math.round((currentIndex / (defaultPhases.length - 1)) * 100));
      setLoadingProgress(progress);
      
      // Set to 100% when complete
      if (loadingPhase === 'complete') {
        setLoadingProgress(100);
      }
    }
  }, [loadingPhase]);

  // Handle hiding the loading status after fade-out animation completes
  useEffect(() => {
    if (loadingProgress === 100 && !experienceError) {
      // Wait for the fade-out animation to complete before hiding the component
      const hideTimer = setTimeout(() => {
        // Only hide the loading status if there's no error
        if (!experienceError) {
          setIsLoading(false);
        }
      }, 1500); // 1.5 seconds (1s delay + 0.5s for animation)
      
      return () => clearTimeout(hideTimer);
    }
  }, [loadingProgress, experienceError]);

  // Handle session recovery choice
  const handleContinueSession = useCallback(() => {
    if (previousSession) {
      setSessionId(previousSession.sessionId);
    }
    setShowSessionRecovery(false);
    setSessionDecisionMade(true);
  }, [previousSession]);

  const handleStartFresh = useCallback(() => {
    clearSession();
    setShowSessionRecovery(false);
    setSessionDecisionMade(true);
  }, []);

  // Load the experience when ID is available and auth is ready
  useEffect(() => {
    async function loadExperience() {
      if (!experienceId) return;
      
      // Wait for auth to be ready so we have user info for session metadata
      if (authStatus === 'loading') return;

      setIsLoading(true);
      setLoadingPhase('loading');

      try {
        // First, check if user has access to this experience
        const accessResponse = await fetch(`/api/classes/check-access?experienceId=${experienceId}`);
        const accessResult: AccessCheckResult = await accessResponse.json();
        
        if (!accessResult.canAccess) {
          throw new Error('You do not have access to this experience. Please contact your instructor if you believe this is an error.');
        }
        
        // Store class info if accessing via class membership
        if (accessResult.classInfo) {
          setClassInfo(accessResult.classInfo);
        }

        // Check for missing required modules
        try {
          const depsResponse = await fetch(`/api/modules/check-dependencies?experienceId=${experienceId}`);
          const depsResult = await depsResponse.json();
          if (depsResult.missing && depsResult.missing.length > 0) {
            throw new Error(`Missing required modules: ${depsResult.missing.join(', ')}. Install them from the Module catalog on the home page.`);
          }
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Missing required modules:')) {
            throw error;
          }
          // Non-blocking: if the check itself fails, continue loading
        }

        // Check for previous sessions (only if we haven't made a decision yet)
        if (!sessionDecisionMade) {
          try {
            const sessionResponse = await fetch(`/api/sessions/user?experienceId=${experienceId}`);
            const sessionResult: UserSessionResponse = await sessionResponse.json();
            
            if (sessionResult.session) {
              // Found a previous session - show recovery dialog
              setPreviousSession(sessionResult.session);
              setPreviousSessionHasArtifacts(sessionResult.hasArtifacts || false);
              setPreviousSessionIsCompleted(sessionResult.isCompleted || false);
              setPreviousSessionLastEvent(sessionResult.lastEvent || null);
              setShowSessionRecovery(true);
              // Don't continue loading until user makes a choice
              return;
            } else {
              // No previous session - clear any stale session and continue
              clearSession();
            }
          } catch (_error) {
            // Continue without session recovery on error
            clearSession();
          }
        }
        
        // Trigger backdrop transition now that we're past session recovery
        setTriggerBackdropTransition(true);
        
        // Ensure session exists (this is the ONLY place sessions should be created)
        // If user recovered a session, this will use that ID. If starting fresh, creates new.
        await ensureSession(
          experienceId,
          authSession?.user?.name || undefined,
          authSession?.user?.email || undefined
        );
        
        const metadata = await getExperienceMetadata(`/api/storage/${experienceId}/experience.json`);
        
        // Check if experience has custom components and README
        try {
          const response = await fetch(`/api/storage/${experienceId}/experience.json`);
          const config = await response.json();
          
          // Enable components if either:
          // 1. Components already exist in the experience, OR
          // 2. The custom-component plugin is enabled (allows dynamic creation)
          const hasExistingComponents = !!config.resources?.components?.length;
          const hasCustomComponentPlugin = config.tools?.plugins?.includes('@primer/custom-component-plugin');
          setHasComponents(hasExistingComponents || hasCustomComponentPlugin);
          
          // Check for README.md existence
          try {
            const readmeResponse = await fetch(`/api/experiences/${experienceId}/readme`);
            if (readmeResponse.ok) {
              metadata.hasReadme = true;
            }
          } catch (_readmeError) {
            // README doesn't exist, that's fine
          }
        } catch (_error) {
          setHasComponents(false);
        }

        setLoadingPhase('loadAIConfigurations');
        try {
          const aiConfig = await getAIConfigurations(`/api/storage/${experienceId}/experience.json`);
          setAIConfigurations(aiConfig);
        } catch (_error) {
          setAIConfigurations({});
        }

        setLoadingPhase('getAgents');
        const agentConfigs = await getAgents(`/api/storage/${experienceId}/experience.json`);
        
        setLoadingPhase('getSounds');
        const sounds = await getSounds(`/api/storage/${experienceId}/experience.json`);
        
        setLoadingPhase('getScenes');
        const scenes = await getScenes(`/api/storage/${experienceId}/experience.json`);

        setLoadingPhase('getTools');
        try {
          await getExperienceTools(`/api/storage/${experienceId}/experience.json`);
          setToolsRegistered(true);
        } catch (_error) {
          setToolsRegistered(false);
        }

        setLoadingPhase('loadPlugins');
        // Plugins are now loaded by the ConfigLoader

        setLoadingPhase('initializeAudio');
        createSoundManager({ sounds });
        
        setLoadingPhase('initializeScenes');
        createSceneManager({ scenes });

        setExperienceMetadata(metadata);
        setAgents(agentConfigs);

        // Check validation report after loading
        const validationReport = getValidationReport();
        if (validationReport?.hasErrors && validationReport.statuses) {
          const errorMessages = validationReport.statuses
            .filter(s => s.status === 'MISSING' || s.status === 'INVALID_PLACEHOLDER')
            .map(s => `${s.objectPath} ${s.status}: ${s.statusDetail ? ` - ${s.statusDetail}` : ''}`)
            .join('\n');

          throw new Error(errorMessages);
        }

        setLoadingPhase('complete');
        // Add a short delay to ensure users can see the completion message
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'An unexpected error occurred while loading the Experience.';

        setExperienceError(errorMessage);
        setExperienceMetadata(null);
        setAgents({});
        setToolsRegistered(false);
        setAIConfigurations({});
      }
    }

    loadExperience();
    // Note: We depend on authStatus (not authSession) to wait for auth to be ready,
    // but we don't want to re-run if authSession data changes after initial load
  }, [experienceId, sessionDecisionMade, authStatus]);

  // Create a sendClientEvent function that can be passed to components
  const handleSendClientEvent = useCallback((eventObj: Record<string, unknown>) => {
    if (dataChannel && dataChannel.readyState === "open") {
      const message = JSON.stringify(eventObj);
      dataChannel.send(message);
    }
  }, [dataChannel]);

  const handleDismissError = () => {
    // Navigate back to homepage instead of just clearing error state
    window.location.href = '/';
  };

  return (
    <ClientEventProvider sendClientEvent={handleSendClientEvent}>
      <SceneProvider>
        <TranscriptProvider>
          <EventProvider>
            {/* Load CDN scripts for custom components if needed */}
            <ComponentScripts 
              experienceId={experienceId} 
              sessionId={getExistingSessionId() || ''}
              hasComponents={hasComponents}
            />
            <PrimerBackground 
              darkOverlay 
              showOverlays={isLoading || !!experienceError || !experienceMetadata}
              useInitialBackdrop={true}
              triggerTransition={triggerBackdropTransition}
              loadingPhase={loadingPhase}
            >
              {/* Session Recovery Dialog */}
              {showSessionRecovery && previousSession && (
                <SessionRecoveryDialog
                  isOpen={showSessionRecovery}
                  sessionInfo={previousSession}
                  hasArtifacts={previousSessionHasArtifacts}
                  isCompleted={previousSessionIsCompleted}
                  lastEvent={previousSessionLastEvent}
                  onContinueSession={handleContinueSession}
                  onStartFresh={handleStartFresh}
                />
              )}
              
              {/* Show loading/error state when not showing session recovery and not ready */}
              {!showSessionRecovery && (isLoading || experienceError || !experienceMetadata) && (
                <div className="absolute inset-0 flex items-end justify-center pb-[calc(40px+1rem)] md:pb-[calc(56px+1rem)]">
                  <div className="max-w-2xl w-full mx-4">
                    <ExperienceLoadingStatus 
                      currentPhase={loadingPhase} 
                      error={experienceError}
                      progress={loadingProgress}
                      onDismissError={handleDismissError}
                    />
                  </div>
                </div>
              )}
              
              {/* Show play page when fully loaded */}
              {!showSessionRecovery && !isLoading && !experienceError && experienceMetadata && (
                <PlayPage 
                  setDataChannel={setDataChannel}
                  experienceId={experienceId}
                  experienceMetadata={experienceMetadata}
                  agents={agents}
                  toolsRegistered={toolsRegistered}
                  aiConfigurations={aiConfigurations}
                />
              )}
            </PrimerBackground>
          </EventProvider>
        </TranscriptProvider>
      </SceneProvider>
    </ClientEventProvider>
  );
}

export default function Page() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PrimerBackground darkOverlay useInitialBackdrop={true} />}>
        <AppWrapper />
      </Suspense>
    </ErrorBoundary>
  );
} 