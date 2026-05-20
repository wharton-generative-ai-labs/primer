/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import BuildingPanel, { computeStepStates } from '../BuildingPanel';
import { BUILD_STEPS, type BuildPhase } from '../types';

describe('computeStepStates', () => {
    it('returns all pending when no phases have fired', () => {
        const states = computeStepStates(new Set());
        expect(states).toEqual([
            'pending',
            'pending',
            'pending',
            'pending',
            'pending',
        ]);
    });

    it('returns all done when every phase has fired', () => {
        const all = new Set<BuildPhase>(BUILD_STEPS.map((s) => s.phase));
        const states = computeStepStates(all);
        expect(states).toEqual(['done', 'done', 'done', 'done', 'done']);
    });

    it('strict top-down: a later step cannot tick before an earlier one', () => {
        // Real ConfigLoader firing order: experience-data first, then media,
        // then tools-plugins, then ai-models. Display order has ai-models in
        // position 2 — so when only experience-data + media have fired,
        // step 1 should tick but step 2 (ai-models, fires last in real time)
        // and step 3 (media) should still be pending because of the cascade
        // gate (step 2 hasn't fired).
        const fired = new Set<BuildPhase>(['experience-data', 'media']);
        const states = computeStepStates(fired);
        expect(states).toEqual(['done', 'pending', 'pending', 'pending', 'pending']);
    });

    it('cascade collapses when the late event finally fires', () => {
        // Once ai-models fires (which in real time happens last among the
        // ConfigLoader phases), steps 1–4 all flip to done in a single
        // render — the cascade gate has been satisfied for each of them.
        const fired = new Set<BuildPhase>([
            'experience-data',
            'media',
            'tools-plugins',
            'ai-models',
        ]);
        const states = computeStepStates(fired);
        expect(states).toEqual(['done', 'done', 'done', 'done', 'pending']);
    });

    it('out-of-order fired phases never produce out-of-order ticks', () => {
        // Even if (defensively) the events arrive out of design order, the
        // checklist must remain strictly top-down: missing earlier-position
        // phases force their later siblings to stay pending.
        const fired = new Set<BuildPhase>(['ai-models', 'tools-plugins']);
        const states = computeStepStates(fired);
        expect(states).toEqual([
            // experience-data hasn't fired ⇒ step 1 pending ⇒ entire
            // cascade is broken from there on, regardless of which later
            // events landed.
            'pending',
            'pending',
            'pending',
            'pending',
            'pending',
        ]);
    });
});

describe('<BuildingPanel mode={allPending} />', () => {
    it('renders the subtitle and 5 unchecked steps', () => {
        render(<BuildingPanel mode={{ kind: 'allPending' }} />);
        expect(screen.getByText(/Please don't close this tab/)).toBeInTheDocument();

        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(5);
        for (const item of items) {
            expect(item).toHaveAccessibleName(/in progress$/);
        }
    });
});

describe('<BuildingPanel mode={loading} />', () => {
    it('reflects fired phases as done in design display order', () => {
        const fired = new Set<BuildPhase>([
            'experience-data',
            'media',
            'tools-plugins',
            'ai-models',
        ]);
        render(<BuildingPanel mode={{ kind: 'loading', firedPhases: fired }} />);

        const items = screen.getAllByRole('listitem');
        expect(items[0]).toHaveAccessibleName(/Loading experience data: done/);
        expect(items[1]).toHaveAccessibleName(/Configuring AI agents: done/);
        expect(items[2]).toHaveAccessibleName(/Loading instructions and content: done/);
        expect(items[3]).toHaveAccessibleName(/Registering tools: done/);
        // Starting up only fires after PlayClientInner emits it; until then
        // it stays pending even when every ConfigLoader phase has landed.
        expect(items[4]).toHaveAccessibleName(/Launching\.\.\.: in progress/);
    });
});

describe('<BuildingPanel mode={error} />', () => {
    it('replaces the checklist with a Something Went Wrong card', () => {
        render(
            <BuildingPanel
                mode={{
                    kind: 'error',
                    message: 'experience.json could not be parsed.',
                }}
            />,
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Something went wrong' }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('experience.json could not be parsed.'),
        ).toBeInTheDocument();
        expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    });

    it('exposes a Return link to the home route', () => {
        render(<BuildingPanel mode={{ kind: 'error', message: 'boom' }} />);
        const link = screen.getByRole('link', { name: 'Return' });
        expect(link).toHaveAttribute('href', '/');
    });
});
