"use client";

import React, { useState, useEffect, useRef } from "react";
import { Permission } from "@/config/auth";
import { usePermissions } from "../hooks/usePermissions";
import ExperienceCatalog from "./ExperienceCatalog";
import ExperienceLoadingStatus, { LoadingPhase, defaultPhases } from "./ExperienceLoadingStatus";
import PrimerBackground from './PrimerBackground';

interface HomePageProps {
  onExperienceLoad: (configPath: string) => Promise<void>;
  isLoading: boolean;
  experienceError: string | null;
  loadingPhase: LoadingPhase | null;
  onExperienceUnload: () => void;
}

export default function HomePage({ 
  onExperienceLoad, 
  isLoading: parentIsLoading, 
  experienceError, 
  loadingPhase, 
  onExperienceUnload 
}: HomePageProps) {
  const { can, isAuthenticated, cannot } = usePermissions();
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(parentIsLoading);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update local loading state when parent prop changes
  useEffect(() => {
    setIsLoading(parentIsLoading);
  }, [parentIsLoading]);

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

  useEffect(() => {
    if (experienceError) {
      setCurrentError(experienceError);
    }
  }, [experienceError]);

  // Handle hiding the loading status after fade-out animation completes
  useEffect(() => {
    if (loadingProgress === 100 && !currentError) {
      // Wait for the fade-out animation to complete before hiding the component
      const hideTimer = setTimeout(() => {
        // Only hide the loading status if there's no error
        if (!currentError) {
          setIsLoading(false);
        }
      }, 1500); // 1.5 seconds (1s delay + 0.5s for animation)
      
      return () => clearTimeout(hideTimer);
    }
  }, [loadingProgress, currentError]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setCurrentError(`Invalid file type: ${file.name}. Please upload a .zip file.`);
      setLoadingProgress(100);
      return;
    }

    setCurrentError(null);
    setIsLoading(true);
    setLoadingProgress(0);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: file
      });
      
      const data = await response.json();
      if (data.error) {
        setCurrentError(data.error);
        return;
      }
      
      setIsLoading(false);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'An unexpected error occurred while loading the Experience.';
      setCurrentError(message);
      setIsLoading(false);
    } finally {
      // Reset the file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDismissError = () => {
    setCurrentError(null);
    setLoadingProgress(0);
    
    // Also reset parent error if it exists
    if (experienceError) {
      onExperienceUnload();
      // We need to reset the loading state completely here
      setIsLoading(false);
    } else {
      // If it's just a local error (like invalid file type), 
      // we need to reset the loading state manually
      setIsLoading(false);
    }
  };
  
  return (
    <PrimerBackground useInitialBackdrop={true}>
      {/* Container for bottom-positioned catalog - constrained between header and footer */}
      <div className="flex flex-col h-full">
        <div className="flex-1">
          <div className="absolute inset-0 flex justify-center overflow-hidden pb-[calc(40px+1rem)] md:pb-[calc(56px+1rem)] pt-[calc(40px+1rem)] md:pt-[calc(56px+1rem)]">
            <div className="max-w-6xl w-full mx-4 flex flex-col justify-end h-full">
                {isLoading || currentError || loadingProgress === 100 ? (
                  <ExperienceLoadingStatus 
                    currentPhase={loadingPhase || 'loading'} 
                    error={currentError || experienceError}
                    progress={loadingProgress}
                    onDismissError={handleDismissError}
                  />
                ) : !isAuthenticated ? (
                  // Show nothing while authentication is being determined
                  null
                ) : (
                  <>
                    {(can(Permission.LIST_EXPERIENCES) || can(Permission.CREATE_EXPERIENCE)) && (
                      <>
                        <ExperienceCatalog 
                          onExperienceLoad={onExperienceLoad}
                          onInstallClick={() => fileInputRef.current?.click()}
                        />
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".zip"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </>
                    )}

                    {cannot(Permission.CREATE_EXPERIENCE) && cannot(Permission.LIST_EXPERIENCES) && (
                      <div className="rounded-lg p-6 mb-4 text-center backdrop-blur-lg shadow-2xl text-white bg-black/30">
                        <h2 className="text-xl font-semibold mb-4">Welcome</h2>
                        <p className="text-white/90">Please contact an administrator to get access to Experiences.</p>
                      </div>
                    )}
                  </>
                )}
            </div>
          </div>
        </div>
      </div>
    </PrimerBackground>
  );
} 