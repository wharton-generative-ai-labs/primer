"use client";

import React, { useState, Suspense, useCallback } from "react";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import { SceneProvider } from "./contexts/SceneContext";
import { ClientEventProvider } from "./contexts/ClientEventContext";
import HomePage from "./components/HomePage";
import PrimerBackground from './components/PrimerBackground';
import { LoadingPhase } from "./components/ExperienceLoadingStatus";
import { ErrorBoundary } from "./components/ErrorBoundary";

function AppWrapper() {
  const [dataChannel] = useState<RTCDataChannel | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase | null>(null);
  const [experienceError, setExperienceError] = useState<string | null>(null);

  // Create a sendClientEvent function that can be passed to components
  const handleSendClientEvent = useCallback((eventObj: any) => {
    if (dataChannel && dataChannel.readyState === "open") {
      const message = JSON.stringify(eventObj);
      dataChannel.send(message);
    }
  }, [dataChannel]);

  const handleExperienceLoad = async (configPath: string) => {
    setIsLoading(true);
    setLoadingPhase('loading');
    try {
      // Navigate to the play route with the experience ID
      const match = configPath.match(/\/api\/storage\/([^/]+)\/experience\.json$/);
      if (match) {
        const experienceId = match[1];
        window.location.href = `/play/${experienceId}`;
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'An unexpected error occurred while loading the Experience.';
      setExperienceError(errorMessage);
    } finally {
      setIsLoading(false);
      setLoadingPhase(null);
    }
  };

  const handleExperienceUnload = () => {
    setExperienceError(null);
    setIsLoading(false);
    setLoadingPhase(null);
  };

  return (
    <ClientEventProvider sendClientEvent={handleSendClientEvent}>
      <SceneProvider>
        <TranscriptProvider>
          <EventProvider>
            <HomePage 
              onExperienceLoad={handleExperienceLoad}
              isLoading={isLoading}
              experienceError={experienceError}
              loadingPhase={loadingPhase}
              onExperienceUnload={handleExperienceUnload}
            />
          </EventProvider>
        </TranscriptProvider>
      </SceneProvider>
    </ClientEventProvider>
  );
}

export default function Page() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PrimerBackground useInitialBackdrop={true} />}>
        <AppWrapper />
      </Suspense>
    </ErrorBoundary>
  );
}