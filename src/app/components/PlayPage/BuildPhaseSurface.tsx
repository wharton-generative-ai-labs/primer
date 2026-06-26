'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, CircleCheck, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useArtifact } from '@/app/contexts/ArtifactContext';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases/types';

import { parseChecklistItems, type ChecklistItem } from './parseChecklist';

/**
 * `mode: 'build'` surface — replaces the chat/document workspace while a
 * fully-automated phase runs. Renders a live checklist sourced from a shared
 * checklist artifact tagged `phase:<phaseId>` that the orchestrator agent
 * updates via the `checklist` tool as backend subagents return.
 *
 * The artifact subscription is implicit: `ArtifactContext` already syncs
 * artifact mutations into React state via its socket listener, so flipping
 * `- [ ]` → `- [x]` on the server is enough to re-render this surface.
 *
 * Falls back to an empty placeholder while the artifact bootstraps; falls
 * back to a "no checklist authored" warning if no matching artifact is found
 * once bootstrap completes.
 *
 * Failure recovery: when the orchestrator emits a destructive toast during
 * this phase (e.g. a backend subagent failed and the delegation chain
 * aborted), `useHandleServerEvent` dispatches a `phase-failure` window event.
 * We capture it here and render a Retry button below the checklist so the
 * user has a way out — the surface has no chat input, so without this they'd
 * be stuck refreshing the session.
 */
export function BuildPhaseSurface({
    phase,
}: {
    phase: WorkflowPhaseConfig;
}) {
    const { artifacts } = useArtifact();
    const [failureMessage, setFailureMessage] = useState<string | null>(null);

    const items = useMemo<ChecklistItem[]>(() => {
        const tag = `phase:${phase.id}`;
        const checklist = artifacts.find((a) => {
            const tags = a.metadata?.tags ?? [];
            return a.type === 'checklist' && tags.includes(tag);
        });
        // Content can be undefined briefly: ArtifactContext sometimes lists
        // an artifact's metadata before its body has been fetched, and
        // freshly server-seeded artifacts arrive that way on first render.
        // Treat missing content as "no items yet" rather than crashing.
        if (!checklist?.content) return [];
        return parseChecklistItems(checklist.content);
    }, [artifacts, phase.id]);

    const allDone = items.length > 0 && items.every((i) => i.done);

    // Subscribe to phase-failure events. Only react when the failure is for
    // this phase (the event carries phaseId) so a stale failure from a phase
    // we've since left doesn't reappear here.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as
                | { phaseId?: string; message?: string }
                | undefined;
            if (!detail) return;
            if (detail.phaseId && detail.phaseId !== phase.id) return;
            setFailureMessage(detail.message ?? 'Something went wrong.');
        };
        window.addEventListener('phase-failure', handler);
        return () => window.removeEventListener('phase-failure', handler);
    }, [phase.id]);

    // Reset failure state when the phase id changes (defense-in-depth: the
    // surface unmounts on phase change anyway, but guards against authored
    // edge cases where the same component instance gets reused).
    useEffect(() => {
        setFailureMessage(null);
    }, [phase.id]);

    const handleRetry = useCallback(() => {
        // Inject a system message into the realtime conversation by piggy-
        // backing on the workflow-phase-change channel. `useAgentSwitching`
        // listens for this event and routes the message into the realtime
        // session via `sendSimulatedSystemMessage`. Omitting `toAgent` keeps
        // it on the current (orchestrator) agent — exactly what we want for
        // a retry on the same phase.
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('workflow-phase-change', {
                    detail: {
                        systemMessage:
                            `[SYSTEM/phase_retry]\n` +
                            `The user requested a retry for workflow phase ` +
                            `"${phase.title}" (${phase.id}). The previous ` +
                            `attempt failed. Inspect existing artifact state ` +
                            `via tool calls (artifact discover, checklist ` +
                            `discover) and re-run the failed step. Do NOT ` +
                            `restart steps that already completed; resume ` +
                            `from where the failure occurred.`,
                        toAgent: undefined,
                    },
                }),
            );
        }
        setFailureMessage(null);
    }, [phase.id, phase.title]);

    // Heading is rendered above this surface by PhaseSurfaceSwitch using the
    // shared PhaseHeading block, so build/interactive/result phases all share
    // the same title treatment. Subtitle stays in-tile because it's a
    // surface-specific instruction ("Please don't close this tab.").
    const subtitle =
        phase.buildConfig?.subtitle ?? "Please don't close this tab.";

    return (
        <div className="flex justify-center px-4">
            <div
                className="rounded-lg border bg-background p-10 shadow-lg"
                aria-busy={
                    allDone || failureMessage !== null ? undefined : true
                }
            >
                <div className="flex flex-col items-center gap-4">
                    <p className="text-base leading-6 text-muted-foreground text-start w-full">
                        {subtitle}
                    </p>

                    {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Waiting for the build to start…
                        </p>
                    ) : (
                        <ul
                            className="flex flex-col items-start gap-2"
                            role="list"
                            aria-live="polite"
                        >
                            {items.map((item, i) => (
                                <li
                                    key={`${i}:${item.text}`}
                                    className="flex items-center gap-2"
                                    aria-label={`${item.text}: ${item.done ? 'done' : 'in progress'}`}
                                >
                                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                                        {item.done ? (
                                            <CircleCheck
                                                className="h-6 w-6 text-success-foreground transition-colors duration-300"
                                                aria-hidden
                                            />
                                        ) : (
                                            <Circle
                                                className="h-6 w-6 text-success-foreground transition-colors duration-300"
                                                aria-hidden
                                            />
                                        )}
                                    </span>
                                    <span className="text-lg leading-7 text-muted-foreground">
                                        {item.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {failureMessage && (
                        <div
                            className="flex flex-col items-center gap-3 pt-2 max-w-15"
                            role="alert"
                        >
                            <p className="text-sm text-destructive text-center">
                                {failureMessage}
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRetry}
                            >
                                <RotateCcw aria-hidden />
                                Retry
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
