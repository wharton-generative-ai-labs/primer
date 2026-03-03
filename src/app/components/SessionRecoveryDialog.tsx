"use client";

import React from 'react';
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
import { formatDateTime, getRelativeTimeString } from '../lib/date-utils';
import { SessionEvent } from '../lib/file-utils';

interface SessionInfo {
  sessionId: string;
  startTime: string;
  lastActivity?: string;
  userName?: string;
}

interface SessionRecoveryDialogProps {
  isOpen: boolean;
  sessionInfo: SessionInfo;
  hasArtifacts?: boolean;
  isCompleted?: boolean;
  lastEvent?: SessionEvent | null;
  onContinueSession: () => void;
  onStartFresh: () => void;
}

/**
 * Format an event for display
 */
function formatEventDescription(event: SessionEvent): string {
  switch (event.event) {
    case 'session_started':
      return 'Session started';
    case 'session_completed':
      return 'Experience completed';
    case 'phase_started':
      return event.data?.phase ? `Started: ${event.data.phase}` : 'Started new phase';
    case 'phase_completed':
      return event.data?.phase ? `Completed: ${event.data.phase}` : 'Completed phase';
    default:
      return event.event.replace(/_/g, ' ');
  }
}

export function SessionRecoveryDialog({
  isOpen,
  sessionInfo,
  hasArtifacts,
  isCompleted,
  lastEvent,
  onContinueSession,
  onStartFresh,
}: SessionRecoveryDialogProps) {
  // Use lastActivity if available, otherwise startTime
  const activityTime = sessionInfo.lastActivity || sessionInfo.startTime;
  const relativeTime = getRelativeTimeString(activityTime);
  const fullDateTime = formatDateTime(activityTime);
  
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="bg-black/95 border-gray-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            {isCompleted ? 'Previous Session Completed' : 'Continue Previous Session?'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-white/70 space-y-2 text-sm">
              <span className="block">
                We found a previous session from <span className="text-white font-medium" title={fullDateTime}>{relativeTime}</span>.
              </span>
              
              {/* Show last event context */}
              {lastEvent && (
                <span className="block text-white/50">
                  Last activity: {formatEventDescription(lastEvent)}
                  {lastEvent.agent && lastEvent.agent !== 'system' && (
                    <span className="text-white/40"> (by {lastEvent.agent})</span>
                  )}
                </span>
              )}
              
              {/* Show artifacts info */}
              {hasArtifacts && !isCompleted && (
                <span className="block text-white/50">
                  This session contains saved work and progress.
                </span>
              )}
              
              {/* Show completion message or prompt */}
              {isCompleted ? (
                <span className="block mt-4">
                  You completed this experience previously. Would you like to review your work, or start fresh?
                </span>
              ) : (
                <span className="block mt-4">
                  Would you like to continue where you left off, or start a fresh session?
                </span>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel 
            onClick={onStartFresh}
            className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
          >
            Start Fresh
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onContinueSession}
            className="bg-bay-blue hover:bg-bay-blue/80 text-white"
          >
            {isCompleted ? 'Review Previous' : 'Continue Session'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
