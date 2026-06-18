'use client';

import React from 'react';
import Link from 'next/link';
import { Circle, CircleCheck, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { BUILD_STEPS, type BuildPhase } from './types';

/**
 * "Your simulation is being built." panel — the loading state of the play
 * route. Renders a 5-step checklist whose ticks are tied to real progress
 * signals from `ConfigLoader` plus a `'starting-up'` signal emitted by
 * `PlayClientInner` once sound + scene managers have been initialized.
 *
 * **Cascading top-down reveal:** the design (Figma `601:6481`) shows steps
 * in an order that doesn't match the real firing order (e.g. "Configuring
 * AI models" appears second in the list but fires last in real time).
 * Naively mapping events to ticks would produce out-of-order checks.
 * Instead, step N's check turns green only when step N's mapped event AND
 * every earlier-position event have all fired. The result: in real-time
 * progression, step 1 ticks first, then steps 2–4 typically cascade-tick
 * simultaneously when the last out-of-order event arrives, then step 5
 * ticks last. Always strictly top-down — never out of order.
 *
 * The `allPending` mode is used by the Suspense fallback in `loading.tsx`
 * (and by the SSR-server-render path) so the user sees the full checklist
 * even before any phase event has been observed.
 *
 * The `error` mode swaps the body for an error message + Return CTA. The
 * server RSC renders this when `getExperienceBootstrap` fails; the client
 * renders it on a `ConfigLoader` validation error.
 *
 * The chrome wrapper (white card + border + shadow) is part of this
 * default export so static SSR consumers (`loading.tsx`, `error.tsx`,
 * `page.tsx`'s `PlayErrorScreen`) can use it as-is. The animated phase
 * host (`ExperienceBuildSequence`) instead consumes the body-only named
 * exports below ({@link BuildingPanelBody}, {@link BuildingErrorBody}) so
 * the loading/ready/error transitions can share a single morphing card
 * chrome — see Figma frames `504:12984` → `601:6575`.
 */
export type BuildingPanelMode =
    | { kind: 'loading'; firedPhases: ReadonlySet<BuildPhase> }
    | { kind: 'allPending' }
    | { kind: 'error'; message: string };

interface BuildingPanelProps {
    mode: BuildingPanelMode;
}

/**
 * Strict top-down reveal: a step is "done" only when its phase has fired
 * AND every earlier-position step's phase has also fired. Anything else is
 * "pending". The "active" pulse from the legacy ExperienceLoadingStatus is
 * intentionally dropped — with real signals there's no need to animate
 * between checks.
 */
function computeStepStates(firedPhases: ReadonlySet<BuildPhase>): ('done' | 'pending')[] {
    const states: ('done' | 'pending')[] = [];
    let cascadeBroken = false;
    for (const step of BUILD_STEPS) {
        if (cascadeBroken || !firedPhases.has(step.phase)) {
            cascadeBroken = true;
            states.push('pending');
        } else {
            states.push('done');
        }
    }
    return states;
}

/**
 * Body-only "Your simulation is being built." content (heading, subtitle,
 * 5-item checklist) without the surrounding card chrome. Consumed by the
 * morphing `ExperienceBuildSequence` host so the loading and ready bodies
 * cross-fade inside a single `<motion.div layout>` shared card while
 * framer-motion auto-animates the height collapse.
 */
const BuildingPanelBody: React.FC<{
    firedPhases: ReadonlySet<BuildPhase>;
    kind?: string;
}> = ({ firedPhases }) => {
    const states = computeStepStates(firedPhases);
    const allDone = states.every((s) => s === 'done');
    return (
        <div
            className="flex flex-col gap-4"
            aria-busy={allDone ? undefined : true}
        >
            <p className="text-base leading-6 text-muted-foreground">
              Please don&apos;t close this tab.
            </p>

            <ul
                className="flex flex-col gap-2"
                role="list"
                aria-live="polite"
            >
                {BUILD_STEPS.map((step, i) => {
                    const isDone = states[i] === 'done';
                    return (
                        <li
                          key={step.phase}
                          className="flex items-center gap-2"
                          aria-label={`${step.label}: ${isDone ? 'done' : 'in progress'}`}
                        >
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                            {isDone ? (
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
                            {step.label}
                          </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

/**
 * Body-only error content (warning icon + heading + message + Return CTA)
 * without the surrounding card chrome. Renders inside the same morphing
 * `ExperienceBuildSequence` card chrome as the loading/ready bodies so the
 * card morphs into the error state instead of cross-fading to a fresh one.
 */
const BuildingErrorBody: React.FC<{ message: string }> = ({ message }) => {
    return (
        <div role="alert" aria-live="assertive">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 text-amber-500">
                    <FileWarning size={28} aria-hidden />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-semibold text-foreground">
                        Something went wrong
                    </h2>
                    <div className="mt-2 whitespace-pre-wrap text-base leading-6 text-muted-foreground">
                        {message}
                    </div>
                </div>
            </div>
            <div className="mt-8 flex justify-end">
                <Button asChild variant="custom" size="sm">
                    <Link href="/">Return</Link>
                </Button>
            </div>
        </div>
    );
};

/**
 * Static (non-animated) card composition used by the SSR loading/error
 * shells. Wraps {@link BuildingPanelBody} or {@link BuildingErrorBody} in
 * the standard card chrome (`bg-background border rounded-lg p-10 shadow`).
 * The animated phase host uses the body-only exports directly so the chrome
 * itself can morph across phases.
 */
const BuildingPanel: React.FC<BuildingPanelProps> = ({ mode }) => {
    if (mode.kind === 'error') {
        return (
            <div className="flex w-full items-center justify-center">
                <div className="w-full max-w-xl rounded-lg border bg-background p-10 shadow-lg">
                    <BuildingErrorBody message={mode.message} />
                </div>
            </div>
        );
    }

    const firedPhases = mode.kind === 'loading' ? mode.firedPhases : new Set<BuildPhase>();

    return (
        <div className="flex w-full items-center justify-center">
            <div className="rounded-lg border bg-background p-10 shadow-lg">
                <BuildingPanelBody firedPhases={firedPhases} />
            </div>
        </div>
    );
};

export default BuildingPanel;
export { computeStepStates, BuildingPanelBody, BuildingErrorBody };
