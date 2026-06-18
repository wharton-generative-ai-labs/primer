'use client';

import React from 'react';

import { useWorkflowPhase } from '@/app/contexts/WorkflowPhaseContext';
import { PhaseHeading } from '@/app/components/redesign';

import { BuildPhaseSurface } from './BuildPhaseSurface';
import { ResultPhaseSurface } from './ResultPhaseSurface';

/**
 * Top-level surface switch driven by the current workflow phase's `mode`.
 *
 * - `interactive` (default): renders the parent-supplied `interactive` node
 *   — the chat/document split workspace. (PhaseHeading is owned by the
 *   interactive content, since it sits flush with chat/document layout.)
 * - `build`: replaces the workspace with {@link BuildPhaseSurface}, wrapped
 *   in the same {@link PhaseHeading} block as interactive phases for a
 *   consistent title treatment across modes.
 * - `result`: same wrapping for {@link ResultPhaseSurface}.
 *
 * Phases without a `mode` field, and experiences without workflow phases at
 * all, fall through to `interactive`.
 *
 * Loading gate: while `WorkflowPhaseContext.isLoading` is `true` the server
 * hasn't told us which phase the session is actually on yet, so
 * `currentPhase` is undefined and `mode` would resolve to `'interactive'` via
 * the `?? 'interactive'` fallback. Rendering the interactive workspace in
 * that window flashes the chat/document split in for a frame before we
 * correctly switch to `BuildPhaseSurface` / `ResultPhaseSurface` once the
 * fetch resolves. Returning `null` while loading avoids that flash without
 * adding a visible loader — the bootstrap-level `ExperienceBuildSequence`
 * (driven by `PlayClient`) is still on screen during this window because
 * `PlayPage` itself is hidden until that sequence advances to `'play'`.
 */
export function PhaseSurfaceSwitch({
    interactive,
}: {
    interactive: React.ReactNode;
}) {
    const { currentPhase, isLoading } = useWorkflowPhase();
    const mode = currentPhase?.mode ?? 'interactive';

    if (isLoading) return null;

    if (mode === 'build' && currentPhase) {
        const heading =
            currentPhase.buildConfig?.title ??
            currentPhase.heading ??
            'Your experience is being built.';
        return (
            <div className="flex flex-1 flex-col min-h-0">
                <div className="mb-6 flex flex-col items-center gap-1 px-4">
                    <PhaseHeading>{heading}</PhaseHeading>
                </div>
                <BuildPhaseSurface phase={currentPhase} />
            </div>
        );
    }

    if (mode === 'result' && currentPhase) {
        return <ResultPhaseSurface phase={currentPhase} />;
    }

    return <>{interactive}</>;
}
