"use client";

import React from "react";
import { 
  Mic, 
  MicOff, 
  Volume, 
  VolumeX, 
  MessageCircle, 
  NotepadText, 
  Volume2, 
  Bug, 
  Info,
  LogOut
} from "lucide-react";
import { WindowManager } from "../WindowManager";
import { Button } from "@/components/ui/button";
import { SessionStatus } from "../../lib/types";
import { ReadmeDialog } from "../ReadmeDialog";
import { useState } from "react";
import { FOOTER_CLASSES } from "@/config/layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlayPageControlsProps {
  // Session state
  sessionStatus: SessionStatus;
  isExperienceLoaded: boolean;
  
  // Audio state
  hasAudio: boolean;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (enabled: boolean) => void;
  isAIAudioPlaying: boolean;
  isUserAudioPlaying: boolean;
  
  // View state
  isTranscriptExpanded: boolean;
  setIsTranscriptExpanded: (expanded: boolean) => void;
  isEventsPaneExpanded: boolean;
  setIsEventsPaneExpanded: (expanded: boolean) => void;
  isDebugModeEnabled: boolean;
  setIsDebugModeEnabled: (enabled: boolean) => void;
  
  // Handlers
  handleQuit: () => void;
  
  // Permissions
  canViewTechnical: boolean;
  
  // Experience info
  experienceId: string;
  experienceTitle: string;
  hasReadme: boolean;
}

export function PlayPageControls({
  sessionStatus,
  isExperienceLoaded,
  hasAudio,
  isMuted,
  setIsMuted,
  isAudioPlaybackEnabled,
  setIsAudioPlaybackEnabled,
  isAIAudioPlaying,
  isUserAudioPlaying,
  isTranscriptExpanded,
  setIsTranscriptExpanded,
  isEventsPaneExpanded,
  setIsEventsPaneExpanded,
  isDebugModeEnabled,
  setIsDebugModeEnabled,
  handleQuit,
  canViewTechnical,
  experienceId,
  experienceTitle,
  hasReadme,
}: PlayPageControlsProps) {
  const [readmeDialogOpen, setReadmeDialogOpen] = useState(false);
  
  return (
    <TooltipProvider delayDuration={300}>
      <div className={FOOTER_CLASSES}>
        <div className="flex items-center justify-between gap-1 min-[460px]:gap-2">
          {/* Left section - Quit and Audio Controls */}
          {isExperienceLoaded && (
            <div className="flex items-center gap-1 min-[460px]:gap-2">
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="customDestructive"
                        size="icon"
                      >
                        <LogOut className="size-5 stroke-2" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Quit session</p>
                  </TooltipContent>
                </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to quit?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will end your current session and return you to the home page. Any unsaved progress may be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleQuit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Quit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

              {(sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") && (
              <>
                {hasAudio && (
                  <div className="flex gap-1 min-[460px]:gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setIsMuted(!isMuted)}
                          variant={
                            isUserAudioPlaying ? "customIconAudioActive" : "customIcon"
                          }
                          size="icon"
                        >
                          {isMuted ? (
                            <MicOff className="size-5 stroke-1" />
                          ) : (
                            <Mic className="size-5 stroke-2" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isMuted ? "Unmute microphone" : "Mute microphone"}</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() =>
                            setIsAudioPlaybackEnabled(!isAudioPlaybackEnabled)
                          }
                          variant={
                            isAIAudioPlaying ? "customIconAudioActive" : "customIcon"
                          }
                          size="icon"
                        >
                          {isAudioPlaybackEnabled ? (
                            isAIAudioPlaying ? (
                              <Volume2 className="size-5 stroke-2" />
                            ) : (
                              <Volume className="size-5 stroke-2" />
                            )
                          ) : (
                            <VolumeX className="size-5 stroke-2" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isAudioPlaybackEnabled ? "Disable AI audio" : "Enable AI audio"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Center section - Window Manager */}
        <div className="flex-1 flex justify-center">
          <WindowManager />
        </div>

        {/* Right section - View Controls and Edit Button */}
        <div className="flex items-center gap-1 min-[460px]:gap-2">
          {isExperienceLoaded ? (
            <>
              <div className="flex items-center gap-1 min-[460px]:gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                      variant={isTranscriptExpanded ? "customIconActive" : "customIcon"}
                      size="icon"
                    >
                      <MessageCircle className="size-5 stroke-2" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isTranscriptExpanded ? "Hide conversation transcript" : "Show conversation transcript"}</p>
                  </TooltipContent>
                </Tooltip>

                {canViewTechnical && (
                  <>
                    {isDebugModeEnabled && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() =>
                              setIsEventsPaneExpanded(!isEventsPaneExpanded)
                            }
                            variant={
                              isEventsPaneExpanded ? "customIconActive" : "customIcon"
                            }
                            size="icon"
                          >
                            <NotepadText className="size-5 stroke-2" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{isEventsPaneExpanded ? "Hide event log" : "Show event log"}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setIsDebugModeEnabled(!isDebugModeEnabled)}
                          variant={isDebugModeEnabled ? "customIconActive" : "customIcon"}
                          size="icon"
                        >
                          <Bug className="size-5 stroke-2" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isDebugModeEnabled ? "Disable debug mode" : "Enable debug mode"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>

              {hasReadme && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setReadmeDialogOpen(true)}
                      variant="customIcon"
                      size="icon"
                    >
                      <Info className="size-5 stroke-2" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View experience info</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          ) : null}
        </div>
        </div>
        
        {/* README Dialog */}
        {hasReadme && (
          <ReadmeDialog
            experienceId={experienceId}
            experienceTitle={experienceTitle}
            open={readmeDialogOpen}
            onOpenChange={setReadmeDialogOpen}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

