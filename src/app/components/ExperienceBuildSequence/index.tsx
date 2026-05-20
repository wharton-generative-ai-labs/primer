'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import BuildingPanel, { BuildingPanelBody, BuildingErrorBody } from './BuildingPanel';
import WelcomePanel, { WelcomePanelBody } from './WelcomePanel';
import type { BuildPhase } from './types';

/**
 * The top-level phase the play loading flow is currently in. Driven by
 * `PlayClientInner`'s reducer (see Slice 4) — this component is the
 * presentational shell.
 */
export type SequencePhase = 'loading' | 'welcome' | 'error';

interface ExperienceBuildSequenceProps {
    phase: SequencePhase;
    /** Phases observed so far (drives the loading checklist). */
    firedPhases: ReadonlySet<BuildPhase>;
    /** Verbatim experience title. Forwarded to `WelcomePanel` for default image alt. */
    title: string;
    /**
     * Welcome scene image URL (if any). When `phase === 'welcome'` the parent
     * should only render after resolving a `welcome*` scene; otherwise pass
     * `undefined` and do not set `phase` to `'welcome'`.
     */
    welcomeSceneImageUrl?: string;
    welcomeSceneImageAlt?: string;
    /** Error message shown when `phase === 'error'`. */
    errorMessage?: string;
}

/**
 * Inner-body cross-fade timing. Kept shorter than the layout tween so
 * the new body has settled by the time the card finishes resizing — the
 * eye reads "content swap, then card settles" rather than two animations
 * racing.
 */
const BODY_FADE = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.25, ease: 'easeOut' as const },
};

/**
 * Layout tween for the morphing card chrome. The `[0.32, 0.72, 0, 1]`
 * cubic is roughly Apple's "smooth out" curve (slow start, ease-out
 * tail), which makes the loading → ready collapse and the ready →
 * welcome growth feel deliberate without dragging.
 */
const CARD_LAYOUT_TRANSITION = {
    layout: { duration: 0.45, ease: [0.32, 0.72, 0, 1] as const },
};

/**
 * Phase-specific size constraints for the shared morph chrome. The
 * loading / ready / error states share the small text card (`max-w-xl`,
 * height auto) from Figma frames `504:12984` and `601:6575`; the welcome
 * state grows the same chrome to the 800×600 (`aspect-4/3`) image card
 * from frame `601:6748`. Switching between these classes mid-render
 * triggers framer-motion's `layout` prop to tween the resize.
 */
const CARD_SIZE_BY_PHASE: Record<SequencePhase, string> = {
    loading: 'w-full max-w-xl',
    error: 'w-full max-w-xl',
    welcome: 'aspect-[4/3] w-full max-w-[800px]',
};

/**
 * Phase-specific inner padding. The text bodies share the Figma `p-10`
 * inset; the welcome body is full-bleed and sizes itself via
 * {@link WelcomePanelBody}'s `aspect-[4/3]` wrapper (no `h-full` here).
 */
const BODY_PADDING_BY_PHASE: Record<SequencePhase, string> = {
    loading: 'p-10',
    error: 'p-10',
    welcome: 'w-full',
};

/**
 * Morphing card host for `/play/[id]`. Implements the Figma morph chain
 * from "Your simulation is being built." (frame `504:12984`) → "Your
 * simulation is ready." (frame `601:6575`) → welcome scene
 * (frame `601:6748`): a single shared card chrome stays mounted through
 * every phase while only the inner body cross-fades, and framer-motion's
 * `layout` prop tweens the chrome's width/height as the body grows from
 * the small text card to the larger image card. The `'error'` phase is
 * hosted in the same card so a mid-load failure morphs into a
 * Something-Went-Wrong message in place rather than flashing a separate
 * panel.
 *
 * All phase changes are driven by the parent's state machine — this
 * component owns no timers, dwell logic, or session state.
 */
const ExperienceBuildSequence: React.FC<ExperienceBuildSequenceProps> = ({
    phase,
    firedPhases,
    title,
    welcomeSceneImageUrl,
    welcomeSceneImageAlt,
    errorMessage,
}) => {
    return (
        <div className="flex items-center justify-center">
            <motion.div
                layout
                transition={CARD_LAYOUT_TRANSITION}
                className={`relative mx-auto overflow-hidden rounded-lg border bg-background shadow-lg ${CARD_SIZE_BY_PHASE[phase]}`}
            >
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                        key={phase === 'error' ? 'error' : phase}
                        layout="position"
                        {...BODY_FADE}
                        className={BODY_PADDING_BY_PHASE[phase]}
                    >
                        <PhaseBody
                            phase={phase}
                            firedPhases={firedPhases}
                            title={title}
                            welcomeSceneImageUrl={welcomeSceneImageUrl}
                            welcomeSceneImageAlt={welcomeSceneImageAlt}
                            errorMessage={errorMessage}
                        />
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

interface PhaseBodyProps {
    phase: SequencePhase;
    firedPhases: ReadonlySet<BuildPhase>;
    title: string;
    welcomeSceneImageUrl?: string;
    welcomeSceneImageAlt?: string;
    errorMessage?: string;
}

/**
 * Renders the body content for a given phase, without any chrome
 * wrapper. Each branch is a body-only export from its sibling panel
 * file, intentionally chrome-less so the {@link ExperienceBuildSequence}
 * host's shared `motion.div` chrome can morph across phases.
 *
 * Switch is exhaustive over {@link SequencePhase} per project convention
 * — adding a new phase will fail the type-check until handled here.
 */
const PhaseBody: React.FC<PhaseBodyProps> = ({
    phase,
    firedPhases,
    title,
    welcomeSceneImageUrl,
    welcomeSceneImageAlt,
    errorMessage,
}) => {
    switch (phase) {
        case 'loading':
            return <BuildingPanelBody firedPhases={firedPhases} />;
        case 'welcome':
            if (!welcomeSceneImageUrl) {
                return null;
            }
            return (
                <WelcomePanelBody
                    title={title}
                    sceneImageUrl={welcomeSceneImageUrl}
                    sceneImageAlt={welcomeSceneImageAlt}
                />
            );
        case 'error':
            return (
                <BuildingErrorBody
                    message={
                        errorMessage ??
                        'Something unexpected went wrong loading this Experience.'
                    }
                />
            );
        default: {
            const _exhaustive: never = phase;
            void _exhaustive;
            return null;
        }
    }
};

export default ExperienceBuildSequence;
export { BuildingPanel, WelcomePanel };
export type { BuildingPanelMode } from './BuildingPanel';
export type { BuildPhase } from './types';
export { BUILD_STEPS } from './types';
