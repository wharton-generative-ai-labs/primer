/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { BuildingPanelBody } from '../BuildingPanel';
import WelcomePanel from '../WelcomePanel';
import type { BuildPhase } from '../types';

const ALL_BUILD_PHASES = new Set<BuildPhase>([
    'experience-data',
    'ai-models',
    'media',
    'tools-plugins',
    'starting-up',
]);

describe('<BuildingPanelBody />', () => {
    it('keeps done step labels in text-muted-foreground (Figma 601:6496)', () => {
        render(<BuildingPanelBody firedPhases={ALL_BUILD_PHASES} />);
        expect(
            screen.getByText('Loading experience data'),
        ).toHaveClass('text-muted-foreground');
    });
});

describe('<WelcomePanel />', () => {
    it('renders the welcome scene image when sceneImageUrl is provided', () => {
        render(
            <WelcomePanel
                title="Negotiation Lab"
                sceneImageUrl="https://example.test/welcome.png"
            />,
        );
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'https://example.test/welcome.png');
        // Falls back to title for alt when sceneImageAlt is omitted.
        expect(img).toHaveAttribute('alt', 'Negotiation Lab');
    });

    it('uses sceneImageAlt when provided', () => {
        render(
            <WelcomePanel
                title="Negotiation Lab"
                sceneImageUrl="https://example.test/welcome.png"
                sceneImageAlt="Skyline at dusk"
            />,
        );
        expect(screen.getByRole('img')).toHaveAttribute('alt', 'Skyline at dusk');
    });

});
