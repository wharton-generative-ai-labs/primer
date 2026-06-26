"use client";

/**
 * ExperienceCompletedDialog — Task A14c.
 *
 * Modal dialog rendered when the workflow-phase context reports
 * `experienceCompleted === true` (set via the `finishExperience` tool from
 * Task A14b). The dialog is *not* user-dismissible other than via its two
 * actions:
 *
 *   - **Rewind** calls `goBack()` from `useWorkflowPhase`. The provider
 *     server-side clears `experienceCompleted` and navigates backward; once
 *     the flag flips back to `false`, the `open` prop drops and the dialog
 *     unmounts.
 *   - **Close** invokes `onClose`, which `PlayPage` wires to its existing
 *     quit-dialog flow (`setQuitDialogOpen(true)`).
 *
 * Escape-key dismissal and outside-click dismissal are both disabled per the
 * plan: the only way out is one of the two actions. Radix's `AlertDialog`
 * already eats outside clicks; we additionally `preventDefault` the escape
 * key so the dialog stays mounted on Esc.
 *
 * Out of scope (per plan): read-only artifact mode, realtime disconnect,
 * threading the experience title into the headline. The headline uses the
 * generic "Experience complete" copy.
 */

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
} from '@/components/ui/alert-dialog';
import { useWorkflowPhase } from '@/app/contexts/WorkflowPhaseContext';

export interface ExperienceCompletedDialogProps {
  /**
   * Invoked when the user clicks **Close**. The parent (`PlayPage`) wires this
   * to its existing exit flow (currently the quit-confirmation dialog). The
   * dialog itself does not navigate or disconnect — that is the parent's job.
   */
  onClose: () => void;
}

export function ExperienceCompletedDialog({
  onClose,
}: ExperienceCompletedDialogProps): React.ReactElement | null {
  const { experienceCompleted, currentPhase, goBack } = useWorkflowPhase();

  // Suppress the dialog when the final phase is itself the outcome surface
  // (`mode: 'result'`). The result tile already presents the deliverable
  // (Play Experience CTA, share link, preview) so an overlay saying
  // "you've finished, rewind?" blocks the actual outcome and forces the user
  // through Close → re-open just to interact with what they just produced.
  // For chat-mode finals, the dialog still matters — there's no obvious
  // closure UX otherwise.
  const isResultOutcome = currentPhase?.mode === 'result';
  const open = experienceCompleted && !isResultOutcome;

  // Both action handlers preventDefault so Radix doesn't auto-close the
  // dialog. The dialog's open state is derived from `experienceCompleted`;
  // letting Radix close it would briefly desync the visual state from the
  // provider while the rewind round-trip is in flight.
  const handleRewind = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void goBack();
  };

  const handleClose = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onClose();
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        data-testid="experience-completed-dialog"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Experience complete</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ve finished. You can rewind to revisit any phase, or close
            this session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={handleRewind}>Rewind</AlertDialogCancel>
          <AlertDialogAction onClick={handleClose}>Close</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ExperienceCompletedDialog;
