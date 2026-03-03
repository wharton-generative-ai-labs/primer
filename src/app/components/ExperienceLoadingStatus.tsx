import React, { useState, useEffect } from 'react';
import { FileWarning } from 'lucide-react';
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button";

export type LoadingPhase = 
  | 'loading'
  | 'extracting'
  | 'getExperienceMetadata'
  | 'loadAIConfigurations'
  | 'getAgents'
  | 'getSounds'
  | 'getScenes'
  | 'getTools'
  | 'loadPlugins'
  | 'initializeAudio'
  | 'initializeScenes'
  | 'complete';

// Default loading phases in the order they occur
export const defaultPhases: LoadingPhase[] = [
  'loading',
  'extracting',
  'getExperienceMetadata',
  'loadAIConfigurations',
  'getAgents',
  'getSounds',
  'getScenes',
  'getTools',
  'loadPlugins',
  'initializeAudio',
  'initializeScenes',
  'complete'
];

interface ExperienceLoadingStatusProps {
  currentPhase: LoadingPhase;
  error?: string | null;
  progress?: number; // Optional progress percentage (0-100)
  onDismissError?: () => void;
}

const phaseMessages: Record<LoadingPhase, string> = {
  loading: 'Loading Experience',
  extracting: 'Extracting',
  getExperienceMetadata: 'Reading metadata',
  loadAIConfigurations: 'Loading: AI Configurations',
  getAgents: 'Initializing: Agents',
  getSounds: 'Initializing: Sounds',
  getScenes: 'Initializing: Scenes',
  getTools: 'Loading: Tools',
  loadPlugins: 'Loading: Plugins',
  initializeAudio: 'Starting audio manager',
  initializeScenes: 'Starting scene manager',
  complete: 'Experience loaded'
};

const ExperienceLoadingStatus: React.FC<ExperienceLoadingStatusProps> = ({
  currentPhase,
  error = null,
  progress,
  onDismissError
}) => {
  // Use the provided phase or default to 'uploading' instead of 'complete'
  const displayPhase = currentPhase || 'loading';
  
  // State to control the fade-in animation
  const [isVisible, setIsVisible] = useState(false);
  
  // Apply the fade-in effect only when the component mounts
  useEffect(() => {
    setIsVisible(true);
  }, []);
  
  // Apply fade-out effect when progress reaches 100%
  useEffect(() => {
    if (progress === 100 && !error) {
      // Add a small delay before starting the fade-out
      const fadeOutTimer = setTimeout(() => {
        setIsVisible(false);
      }, 1000); // Wait 1 second before fading out
      
      return () => clearTimeout(fadeOutTimer);
    }
  }, [progress, error]);
  
  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div 
        className={`rounded-lg p-8 text-center backdrop-blur-lg shadow-2xl text-white bg-black/30 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        <h2 className="text-xl font-semibold mb-6">
          {error ? 'Experience Error' : 'Loading Experience'}
        </h2>
        
        {/* Progress indicator - only show if no error */}
        {progress !== undefined && !error && (
          <div className="w-full mb-6">
            <Progress value={progress} className="h-3 bg-gray-700 [&>div]:bg-bay-blue" />
          </div>
        )}
        
        {/* Current phase indicator - only show if no error */}
        {!error && (
          <div className="mb-4">
            <span className="text-white/90">
              {phaseMessages[displayPhase]}
            </span>
          </div>
        )}
        
        {/* Error display */}
        {error && (
          <div className="text-left relative">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 text-yellow-500">
                <FileWarning size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-yellow-300 mb-2">Error Details</h3>
                <div className="text-white/90 whitespace-pre-wrap">
                  {error}
                </div>
              </div>
            </div>
            
            {/* Dismiss button */}
            {onDismissError && (
              <Button 
                onClick={onDismissError}
                variant="custom"
                size="sm"
                className="absolute top-4 right-4"
              >
                Return
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExperienceLoadingStatus; 