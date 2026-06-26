/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import ExperienceBuildSequence from '../index';
import type { BuildPhase } from '../types';

// AnimatePresence's wait/popLayout modes + framer-motion exit/layout
// animations would otherwise leave stale panels in the DOM during a
// synchronous re-render in jsdom. Stub motion.* to passthroughs that
// strip framer-motion-only props (otherwise React DOM warns about
// unknown attributes like `layout`) and stub AnimatePresence to render
// children directly so we can assert "the right panel is in the DOM
// right now" without worrying about exit timing.
jest.mock('framer-motion', () => {
    const FRAMER_PROPS = new Set([
        'initial',
        'animate',
        'exit',
        'transition',
        'layout',
        'layoutId',
        'whileHover',
        'whileTap',
        'whileFocus',
        'whileDrag',
        'whileInView',
        'variants',
        'custom',
        'drag',
        'onAnimationStart',
        'onAnimationComplete',
    ]);
    return {
        motion: new Proxy(
            {},
            {
                get:
                    (_target, key: string) =>
                    ({
                        children,
                        ...rest
                    }: { children?: React.ReactNode } & Record<string, unknown>) => {
                        const domProps: Record<string, unknown> = {};
                        for (const [k, v] of Object.entries(rest)) {
                            if (!FRAMER_PROPS.has(k)) domProps[k] = v;
                        }
                        return React.createElement(key, domProps, children);
                    },
            },
        ),
        AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    };
});

const EMPTY = new Set<BuildPhase>();

describe('<ExperienceBuildSequence />', () => {
    it('renders the BuildingPanel during the loading phase', () => {
        render(
            <ExperienceBuildSequence
                phase="loading"
                firedPhases={EMPTY}
                title="Negotiation Lab"
            />,
        );
        expect(screen.getByText(/Please don't close this tab/)).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(5);
    });

    it('renders the WelcomePanel during the welcome phase', () => {
        render(
            <ExperienceBuildSequence
                phase="welcome"
                firedPhases={EMPTY}
                title="Negotiation Lab"
                welcomeSceneImageUrl="https://example.test/w.png"
            />,
        );
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'https://example.test/w.png');
    });

    it('renders no welcome image when welcome phase is passed without a URL (defensive)', () => {
        const { container } = render(
            <ExperienceBuildSequence
                phase="welcome"
                firedPhases={EMPTY}
                title="Negotiation Lab"
            />,
        );
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        // Still one morph card chrome; body slot is empty.
        expect(
            container.querySelectorAll('.rounded-lg.border.bg-background'),
        ).toHaveLength(1);
    });

    it('renders the BuildingPanel error mode when phase is error', () => {
        render(
            <ExperienceBuildSequence
                phase="error"
                firedPhases={EMPTY}
                title="Negotiation Lab"
                errorMessage="experience.json could not be loaded."
            />,
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(
            screen.getByText('experience.json could not be loaded.'),
        ).toBeInTheDocument();
    });

    it('shares one card chrome across all phases (morph chain)', () => {
        // Identify the morph card by its chrome classes; the same DOM node
        // should be reused across every phase so framer-motion's `layout`
        // prop can tween width/height instead of unmounting and remounting
        // separate cards. Welcome included — Figma frame `601:6748` shares
        // the same `bg-background border rounded-lg` chrome pattern as
        // loading/error, just resized to 800×600 with full-bleed body.
        const cardSelector = '.rounded-lg.border.bg-background';

        const { rerender, container } = render(
            <ExperienceBuildSequence
                phase="loading"
                firedPhases={EMPTY}
                title="Negotiation Lab"
            />,
        );
        expect(container.querySelectorAll(cardSelector)).toHaveLength(1);
        expect(screen.getByText(/Please don't close this tab/)).toBeInTheDocument();

        rerender(
            <ExperienceBuildSequence
                phase="welcome"
                firedPhases={EMPTY}
                title="Negotiation Lab"
                welcomeSceneImageUrl="https://example.test/w.png"
            />,
        );
        // Same chrome morphs into the welcome card — no second panel.
        expect(container.querySelectorAll(cardSelector)).toHaveLength(1);
        expect(screen.getByRole('img')).toHaveAttribute(
            'src',
            'https://example.test/w.png',
        );

        rerender(
            <ExperienceBuildSequence
                phase="error"
                firedPhases={EMPTY}
                title="Negotiation Lab"
                errorMessage="boom"
            />,
        );
        expect(container.querySelectorAll(cardSelector)).toHaveLength(1);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });
});
