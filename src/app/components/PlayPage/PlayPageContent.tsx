"use client";

import React from "react";
import Scene from "../Scene";
import Slides from "../Slides";
import MermaidViewer from "../MermaidViewer";
import { TranscriptWindow } from "../TranscriptWindow";
import { EventsWindow } from "../EventsWindow";
import { NotesComponent } from "@/app/lib/tools/ui/notes";
import { DelegationStatusComponent } from "@/app/lib/tools/ui/delegation";
import { CustomComponents } from "../CustomComponents";
import { SessionStatus } from "../../lib/types";

interface PlayPageContentProps {
  // View state
  isTranscriptExpanded: boolean;
  setIsTranscriptExpanded: (expanded: boolean) => void;
  isEventsPaneExpanded: boolean;
  setIsEventsPaneExpanded: (expanded: boolean) => void;
  isExperienceLoaded: boolean;
  
  // Transcript state
  userText: string;
  setUserText: (text: string) => void;
  onSendMessage: () => void;
  sessionStatus: SessionStatus;
}

export function PlayPageContent({
  isTranscriptExpanded,
  setIsTranscriptExpanded,
  isEventsPaneExpanded,
  setIsEventsPaneExpanded,
  isExperienceLoaded,
  userText,
  setUserText,
  onSendMessage,
  sessionStatus,
}: PlayPageContentProps) {
  return (
    <div className="flex flex-1 overflow-hidden relative -mt-1 -mb-1 md:-mt-2 md:-mb-2 z-play-content">
      <div className="flex-1 flex w-full items-center justify-center relative">
        {/* Background blur and desaturation animation */}
        <div className="absolute inset-0 backdrop-blur-none animate-[blur-in_4s_ease-in-out_forwards]" />
        <style jsx global>{`
          @keyframes blur-in {
            0% {
              backdrop-filter: blur(0) saturate(100%);
              background-color: rgba(0, 0, 0, 0);
            }
            30% {
              backdrop-filter: blur(8px) saturate(62.5%);
              background-color: rgba(0, 0, 0, 0.1);
            }
            100% {
              backdrop-filter: blur(16px) saturate(25%);
              background-color: rgba(0, 0, 0, 0.35);
            }
          }
        `}</style>

        {/* Main content area */}
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          <Scene />
          <Slides />
          <MermaidViewer />
          <NotesComponent />
          <CustomComponents />
        </div>
      </div>

      {/* Transcript sidebar */}
      <TranscriptWindow
        userText={userText}
        setUserText={setUserText}
        onSendMessage={onSendMessage}
        canSend={sessionStatus === "CONNECTED"}
        isExpanded={isTranscriptExpanded && isExperienceLoaded}
        setIsExpanded={setIsTranscriptExpanded}
      />

      {/* Events sidebar */}
      <EventsWindow 
        isExpanded={isEventsPaneExpanded}
        setIsExpanded={setIsEventsPaneExpanded}
      />
      
      {/* Delegation status - rendered at root level for proper z-index */}
      <DelegationStatusComponent />
    </div>
  );
}

