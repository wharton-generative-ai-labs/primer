"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateTime, getRelativeTimeString } from '../lib/date-utils';
import { SESSION_EVENTS, SessionEvent } from '../lib/file-utils';
import { Button } from '@/components/ui/button';

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
  /**
   * Disables both buttons and prevents radix from closing the dialog while a
   * server action is in flight. Lets the parent keep the dialog open until the
   * `chooseSessionAction` round-trip resolves with a session id.
   */
  pending?: boolean;
  onContinueSession: () => void;
  onStartFresh: () => void;
}

/**
 * Format an event for display
 */
export function formatEventDescription(event: SessionEvent): string {
  switch (event.event) {
    case SESSION_EVENTS.SESSION_STARTED:
      return 'Session started';
    case SESSION_EVENTS.SESSION_COMPLETED:
      return 'Experience completed';
    case 'phase_started':
      return event.data?.phase ? `Started: ${event.data.phase}` : 'Started new phase';
    case SESSION_EVENTS.PHASE_COMPLETED:
      return event.data?.phase ? `Phase "${event.data.phase}" marked complete` : 'Phase marked complete';
    case SESSION_EVENTS.WORKFLOW_PHASE_ENTERED:
      return event.data?.phase ? `Entered: ${event.data.phase}` : 'Entered phase';
    case SESSION_EVENTS.WORKFLOW_PHASE_LEFT:
      return event.data?.phase ? `Left: ${event.data.phase}` : 'Left phase';
    case SESSION_EVENTS.WORKFLOW_PHASE_SKIPPED: {
      const skipped = Array.isArray(event.data?.skipped) ? event.data.skipped : [];
      const n = skipped.length;
      return `Skipped ${n} phase(s)`;
    }
    case SESSION_EVENTS.WORKFLOW_PHASE_REVISITED:
      return event.data?.phase ? `Revisited: ${event.data.phase}` : 'Revisited phase';
    case SESSION_EVENTS.WORKFLOW_NEXT_OVERRIDDEN:
      return event.data?.phase ? `Next phase set to: ${event.data.phase}` : 'Next phase overridden';
    case SESSION_EVENTS.EXPERIENCE_COMPLETED:
      return 'Experience completed';
    case SESSION_EVENTS.EXPERIENCE_REWOUND:
      return 'Experience rewound';
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
  pending = false,
  onContinueSession,
  onStartFresh,
}: SessionRecoveryDialogProps) {
  // Use lastActivity if available, otherwise startTime
  const activityTime = sessionInfo.lastActivity || sessionInfo.startTime;
  const relativeTime = getRelativeTimeString(activityTime);
  const fullDateTime = formatDateTime(activityTime);

  // Radix `AlertDialogAction`/`AlertDialogCancel` close the dialog on click
  // unless the click event is `preventDefault`-ed. We always preventDefault so
  // the parent stays in control: the dialog only closes once the parent flips
  // `isOpen` to false after the server action resolves.
  const handleStartFreshClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (pending) return;
    onStartFresh();
  };
  const handleContinueClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (pending) return;
    onContinueSession();
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isCompleted ? 'Previous Session Completed' : 'Continue Previous Session?'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <span className="block">
                We found a previous session from <span className="text-foreground font-medium" title={fullDateTime}>{relativeTime}</span>.
              </span>

              {lastEvent && (
                <span className="block text-muted-foreground">
                  Last activity: {formatEventDescription(lastEvent)}
                  {lastEvent.agent && lastEvent.agent !== 'system' && (
                    <span className="text-muted-foreground"> (by {lastEvent.agent})</span>
                  )}
                </span>
              )}

              {hasArtifacts && !isCompleted && (
                <span className="block text-muted-foreground">
                  This session contains saved work and progress.
                </span>
              )}

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
          <Button variant="outline" disabled={pending} onClick={handleStartFreshClick}>Start Fresh</Button>
          <AlertDialogAction disabled={pending} onClick={handleContinueClick}>
            {isCompleted ? 'Review Previous' : 'Continue Session'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
