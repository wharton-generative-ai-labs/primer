"use client";

/**
 * WorkflowPhaseStrip — Task A14.
 *
 * Compact ~40px navigation strip rendered above the play layout when the
 * experience declares workflow phases. The AI drives the experience; the user
 * mostly confirms forward motion via Next, and can step back via Back.
 *
 * Layout:
 *   [<- Back]                                  [Next -> Feedback ->]
 *
 * Rules:
 *   - No stepper, no per-phase dots, no skip dialog. Strip-only.
 *   - Hidden when `phases.length === 0`.
 *   - Back hidden when no interactive predecessor exists in the visited
 *     stack. Non-interactive phases (`mode: 'build'` or `'result'`) are
 *     transit-only and are skipped on backward nav — the strip's Back jumps
 *     straight to the nearest earlier interactive phase. Labeled `Rewind`
 *     when `experienceCompleted === true`.
 *   - Next is always clickable. Three branches:
 *       * If the current phase is in `completedPhases`, Next calls `advance`
 *         directly — fast path, no agent round-trip.
 *       * Otherwise, if the resolved next phase is non-interactive
 *         (`mode: 'build'` or `'result'`), Next finalizes the transition
 *         from the client: `complete()` then `advance({ trigger: 'user' })`.
 *         The destination has no chat surface, so a veto round would have
 *         nowhere to surface; the user click is authoritative. This is the
 *         "Build Experience" path on `requireEducatorAdvance` phases: when
 *         the agent has not (yet) fired `workflowPhase nextPhase`, the
 *         strip still reliably lands the user on `mode: 'build'`.
 *       * Otherwise (interactive → interactive), Next dispatches a
 *         `[SYSTEM/USER_ADVANCE_REQUEST]` system message to the agent,
 *         which either fires `nextPhase` / `finishExperience` itself or
 *         replies with the specific objective that's still unmet.
 *     The button is briefly disabled after a veto-round click to debounce
 *     spam, and stays disabled while the non-interactive `complete + advance`
 *     round-trip is in flight; the strip otherwise updates naturally when
 *     the phase changes.
 *   - Next hidden entirely when `experienceCompleted === true`.
 *   - When `nextPhaseOverride` is set AND differs from the array-next phase,
 *     show a redirect indicator (small forward-arrow glyph) and label
 *     "Next: {override.title}".
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CornerUpRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useWorkflowPhase } from '@/app/contexts/WorkflowPhaseContext';
import { buildAdvanceRequestMessage } from '@/app/lib/workflow-phases/buildAdvanceRequestMessage';

const ADVANCE_REQUEST_COOLDOWN_MS = 3000;

export interface WorkflowPhaseStripProps {
  /**
   * @deprecated The position label was removed from the strip. This prop is
   * retained only so existing call sites threading
   * `ExperienceConfig.showPhaseCount` via `ConfigResponse.metadata` keep
   * type-checking; the value is ignored.
   */
  showPhaseCount?: boolean;
}

export function WorkflowPhaseStrip(
  _props: WorkflowPhaseStripProps = {},
): React.ReactElement | null {
  const {
    phases,
    currentPhase,
    completedPhases,
    completedObjectives,
    nextPhaseOverride,
    resolvedNextPhase,
    backTargetId,
    experienceCompleted,
    advance,
    complete,
    goBack,
  } = useWorkflowPhase();

  const [advanceRequestPending, setAdvanceRequestPending] = useState(false);
  // True while the non-interactive force-advance branch (complete → advance)
  // is mid-flight. The two POSTs serialize through `mutateSessionMetadata`
  // server-side, so the only consequence of a double-click is a stale
  // duplicate request — but disabling the button until the transition lands
  // keeps the UX honest and matches the cooldown behavior of the veto branch.
  const [forceAdvanceInFlight, setForceAdvanceInFlight] = useState(false);

  // Clear the cooldown if the current phase changes out from under us (the
  // agent advanced, or the user navigated). Without this, the brief disabled
  // window can outlive the state it was guarding.
  useEffect(() => {
    setAdvanceRequestPending(false);
  }, [currentPhase?.id]);

  // Declared before the early return so hooks are always called in the same
  // order (react-hooks/rules-of-hooks). The callback only runs when the button
  // is clicked, which only happens when the component renders — i.e. when
  // phases.length > 0 — so the values it closes over are always valid at
  // call-time.
  const handleNext = useCallback(() => {
    const isComplete = !!currentPhase && completedPhases.includes(currentPhase.id);
    if (isComplete) {
      // Fast path: server already marked this phase ready, no agent round-trip
      // needed.
      void advance({ trigger: 'user' });
      return;
    }
    const nextIsNonInteractive =
      resolvedNextPhase?.mode === 'build' ||
      resolvedNextPhase?.mode === 'result';
    if (nextIsNonInteractive) {
      // The destination has no chat surface (`mode: 'build'` or `'result'`),
      // so a veto round would have nowhere to surface and the user click is
      // authoritative. Finalize the transition from the client:
      //   1. `complete()` so the leaving phase's objectives are auto-marked
      //      and `completedPhases` mirrors what an agent-driven `nextPhase`
      //      would have produced.
      //   2. `advance({ trigger: 'user' })` so `currentPhase` actually moves
      //      forward (on a `requireEducatorAdvance` phase, `nextPhase` alone
      //      stays put — the educator's click is the gate).
      // Both calls funnel through `mutateSessionMetadata` server-side, so
      // they serialize per session — no race.
      if (forceAdvanceInFlight) return;
      setForceAdvanceInFlight(true);
      void (async () => {
        try {
          const completeResult = await complete();
          if (!completeResult.ok) {
            return;
          }
          await advance({ trigger: 'user' });
        } finally {
          setForceAdvanceInFlight(false);
        }
      })();
      return;
    }
    if (advanceRequestPending) return;
    // Veto round: ask the agent to either advance or explain what's unmet.
    // `useAgentSwitching` consumes this event and injects a system-role
    // conversation item into the realtime session.
    if (typeof window !== 'undefined' && currentPhase) {
      const marked = completedObjectives[currentPhase.id] ?? [];
      window.dispatchEvent(
        new CustomEvent('workflow-phase-change', {
          detail: {
            systemMessage: buildAdvanceRequestMessage(currentPhase, marked),
            toAgent: undefined,
          },
        }),
      );
    }
    setAdvanceRequestPending(true);
    window.setTimeout(
      () => setAdvanceRequestPending(false),
      ADVANCE_REQUEST_COOLDOWN_MS,
    );
  }, [
    currentPhase,
    completedPhases,
    advance,
    advanceRequestPending,
    completedObjectives,
    resolvedNextPhase,
    complete,
    forceAdvanceInFlight,
  ]);

  // Hidden when there are no phases at all.
  if (phases.length === 0) {
    return null;
  }

  const total = phases.length;
  const currentIndex = currentPhase
    ? phases.findIndex((p) => p.id === currentPhase.id)
    : -1;

  // Back is hidden when there's no interactive predecessor in the visited
  // stack. Non-interactive phases (build / result) are transit-only and are
  // skipped on backward nav — see `findBackwardTarget` in the context.
  const backDisabled = !backTargetId;
  const customBackLabel = currentPhase?.navLabels?.backLabel;
  const backLabel = experienceCompleted
    ? 'Rewind'
    : customBackLabel ?? 'Back';

  const arrayNextId =
    currentIndex >= 0 && currentIndex + 1 < total
      ? phases[currentIndex + 1].id
      : undefined;
  const isOverrideRedirect =
    !!nextPhaseOverride && nextPhaseOverride !== arrayNextId;
  const customNextLabel = currentPhase?.navLabels?.nextLabel;
  const nextLabel = customNextLabel
    ? customNextLabel
    : resolvedNextPhase
      ? `Next: ${resolvedNextPhase.title}`
      : 'Next';

  const showNext = !experienceCompleted;

  const handleBack = () => {
    void goBack();
  };

  const nextDisabled = advanceRequestPending || forceAdvanceInFlight;
  const nextButton = showNext ? (
    <Button
      type="button"
      variant="default"
      onClick={handleNext}
      disabled={nextDisabled}
      aria-label={nextLabel}
      data-testid="workflow-phase-strip-next"
      data-advance-pending={advanceRequestPending ? 'true' : undefined}
      data-force-advance-in-flight={forceAdvanceInFlight ? 'true' : undefined}
    >
      <span className="flex items-center gap-1.5">
        <span>{nextLabel}</span>
        {isOverrideRedirect ? (
          <CornerUpRight
            aria-label="Redirected next phase"
            data-testid="workflow-phase-strip-override-indicator"
            className="size-4"
          />
        ) : (
          <ArrowRight aria-hidden className="size-4" />
        )}
      </span>
    </Button>
  ) : null;

  return (
    <div
      role="navigation"
      aria-label="Workflow phases"
      data-testid="workflow-phase-strip"
      className="flex w-full shrink-0 items-center justify-between border-t border-border/40 bg-muted px-4 py-3"
    >
      {
        !backDisabled ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={backDisabled}
            aria-label={backLabel}
          >
            <span className="flex items-center gap-1.5">
              <ArrowLeft aria-hidden className="size-4" />
              <span>{backLabel}</span>
            </span>
          </Button>
        ) : null
      }

      <div className="flex items-center flex-1 justify-end">{nextButton}</div>
    </div>
  );
}

export default WorkflowPhaseStrip;
