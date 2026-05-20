import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases/types';

// Stub the artifact context so we can drive BuildPhaseSurface with a fixed
// artifact list per test instead of standing up the full provider chain.
// Mirrors the pattern in LibraryView.test.tsx.
const mockArtifactState = {
    artifacts: [] as Array<{
        id: string;
        name: string;
        type: string;
        content?: string;
        metadata?: { tags?: string[] };
    }>,
};

jest.mock('@/app/contexts/ArtifactContext', () => {
    const actual = jest.requireActual('@/app/contexts/ArtifactContext');
    return {
        ...actual,
        useArtifact: () => ({
            artifacts: mockArtifactState.artifacts,
        }),
    };
});

import { BuildPhaseSurface } from '../BuildPhaseSurface';

const phase: WorkflowPhaseConfig = {
    id: 'designing',
    title: 'Designing',
    mode: 'build',
};

afterEach(() => {
    mockArtifactState.artifacts = [];
});

describe('BuildPhaseSurface — failure & retry', () => {
    it('does not render the retry button by default', () => {
        render(<BuildPhaseSurface phase={phase} />);
        expect(
            screen.queryByRole('button', { name: /retry/i }),
        ).not.toBeInTheDocument();
    });

    it('renders a retry button after a phase-failure event for this phase', () => {
        render(<BuildPhaseSurface phase={phase} />);

        act(() => {
            window.dispatchEvent(
                new CustomEvent('phase-failure', {
                    detail: {
                        phaseId: 'designing',
                        message: 'I am having trouble delegating to design-agent.',
                    },
                }),
            );
        });

        expect(
            screen.getByRole('button', { name: /retry/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/trouble delegating to design-agent/i),
        ).toBeInTheDocument();
    });

    it('ignores phase-failure events targeted at a different phase', () => {
        render(<BuildPhaseSurface phase={phase} />);

        act(() => {
            window.dispatchEvent(
                new CustomEvent('phase-failure', {
                    detail: {
                        phaseId: 'some-other-phase',
                        message: 'failure in another phase',
                    },
                }),
            );
        });

        expect(
            screen.queryByRole('button', { name: /retry/i }),
        ).not.toBeInTheDocument();
    });

    it('clears the failure state and dispatches a workflow-phase-change system message on retry click', async () => {
        const user = userEvent.setup();
        const phaseChangeListener = jest.fn();
        window.addEventListener('workflow-phase-change', phaseChangeListener);

        render(<BuildPhaseSurface phase={phase} />);

        act(() => {
            window.dispatchEvent(
                new CustomEvent('phase-failure', {
                    detail: {
                        phaseId: 'designing',
                        message: 'something failed',
                    },
                }),
            );
        });

        const retryButton = screen.getByRole('button', { name: /retry/i });
        await user.click(retryButton);

        // After click, retry button should be gone (failure cleared)
        expect(
            screen.queryByRole('button', { name: /retry/i }),
        ).not.toBeInTheDocument();

        // And a workflow-phase-change event should have fired carrying a
        // system message. useAgentSwitching listens for this event in real
        // sessions and forwards the message into the realtime conversation.
        expect(phaseChangeListener).toHaveBeenCalledTimes(1);
        const detail = (phaseChangeListener.mock.calls[0][0] as CustomEvent)
            .detail as { systemMessage?: string; toAgent?: string };
        expect(detail.systemMessage).toMatch(/\[SYSTEM\/phase_retry\]/);
        expect(detail.systemMessage).toMatch(/designing/);
        // toAgent is omitted so the message rides on the current agent —
        // the user is stuck in the orchestrator's context, that's where
        // the retry needs to land.
        expect(detail.toAgent).toBeUndefined();

        window.removeEventListener('workflow-phase-change', phaseChangeListener);
    });

    it('falls back to a generic message when the failure event omits one', () => {
        render(<BuildPhaseSurface phase={phase} />);

        act(() => {
            window.dispatchEvent(
                new CustomEvent('phase-failure', {
                    detail: { phaseId: 'designing' },
                }),
            );
        });

        expect(
            screen.getByRole('button', { name: /retry/i }),
        ).toBeInTheDocument();
    });

    it('also matches failure events that omit phaseId (defensive)', () => {
        render(<BuildPhaseSurface phase={phase} />);

        act(() => {
            window.dispatchEvent(
                new CustomEvent('phase-failure', {
                    detail: { message: 'global failure' },
                }),
            );
        });

        expect(
            screen.getByRole('button', { name: /retry/i }),
        ).toBeInTheDocument();
    });
});
