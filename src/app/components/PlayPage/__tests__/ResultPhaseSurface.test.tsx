import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases/types';

const mockArtifactState = {
    artifacts: [] as Array<{
        id: string;
        name: string;
        type: string;
        content?: string;
        metadata?: { tags?: string[] };
    }>,
};

const mockGetArtifact = jest.fn();

jest.mock('@/app/contexts/ArtifactContext', () => {
    const actual = jest.requireActual('@/app/contexts/ArtifactContext');
    return {
        ...actual,
        useArtifact: () => ({
            artifacts: mockArtifactState.artifacts,
            getArtifact: mockGetArtifact,
        }),
    };
});

// useToast is harmless to use directly (it manages an in-memory store) but
// stub it so we can avoid pulling in the real Toaster context. The component
// only calls it for the copy-link error path which our tests don't exercise.
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/app/components/ExperienceCard', () => ({
    ExperienceCard: ({ experience }: { experience: { id: string; title: string } }) => (
        <div data-testid="experience-card">{experience.title}</div>
    ),
    ExperienceCardSkeleton: () => <div data-testid="experience-card-skeleton" />,
}));

jest.mock('@/app/components/redesign', () => ({
    PhaseHeading: ({ children }: { children: React.ReactNode }) => (
        <h1>{children}</h1>
    ),
}));

import { ResultPhaseSurface } from '../ResultPhaseSurface';

const phase: WorkflowPhaseConfig = {
    id: 'handoff',
    title: 'Handoff',
    mode: 'result',
};

afterEach(() => {
    mockArtifactState.artifacts = [];
    mockGetArtifact.mockReset();
});

describe('ResultPhaseSurface — render states', () => {
    describe('loading', () => {
        it('renders the experience card skeleton when no tagged artifact has been registered', () => {
            mockArtifactState.artifacts = [];
            render(<ResultPhaseSurface phase={phase} />);
            expect(screen.getByTestId('experience-card-skeleton')).toBeInTheDocument();
            expect(screen.queryByTestId('experience-card')).not.toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: /reload page/i }),
            ).not.toBeInTheDocument();
        });

        it('renders the skeleton while only an unrelated artifact exists', () => {
            mockArtifactState.artifacts = [
                {
                    id: 'design',
                    name: 'Design Document',
                    type: 'markdown',
                    content: 'design body',
                    metadata: { tags: ['design'] },
                },
            ];
            render(<ResultPhaseSurface phase={phase} />);
            expect(screen.getByTestId('experience-card-skeleton')).toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: /reload page/i }),
            ).not.toBeInTheDocument();
        });
    });

    describe('missing-content', () => {
        it('renders the error tile with a Reload page button when tagged artifact content is empty', async () => {
            mockArtifactState.artifacts = [
                {
                    id: 'result_experience_id',
                    name: 'Built Experience',
                    type: 'markdown',
                    content: '',
                    metadata: { tags: ['result:experience-id'] },
                },
            ];

            render(<ResultPhaseSurface phase={phase} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /reload page/i }),
                ).toBeInTheDocument();
            });
            expect(screen.queryByTestId('experience-card-skeleton')).not.toBeInTheDocument();
            expect(screen.queryByTestId('experience-card')).not.toBeInTheDocument();
            expect(
                screen.getByText(/build didn't link to a playable experience/i),
            ).toBeInTheDocument();
        });

        it('renders the error tile when tagged artifact content is whitespace only', async () => {
            mockArtifactState.artifacts = [
                {
                    id: 'result_experience_id',
                    name: 'Built Experience',
                    type: 'markdown',
                    content: '   \n  \t  ',
                    metadata: { tags: ['result:experience-id'] },
                },
            ];

            render(<ResultPhaseSurface phase={phase} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /reload page/i }),
                ).toBeInTheDocument();
            });
        });

        it('clicking the Reload page button calls window.location.reload', async () => {
            const user = userEvent.setup();
            const reloadSpy = jest.fn();
            const originalLocation = window.location;
            // jsdom's `window.location` doesn't allow reassigning .reload directly
            // because it's a non-configurable getter, so swap the whole object.
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: { ...originalLocation, reload: reloadSpy },
            });

            try {
                mockArtifactState.artifacts = [
                    {
                        id: 'result_experience_id',
                        name: 'Built Experience',
                        type: 'markdown',
                        content: '',
                        metadata: { tags: ['result:experience-id'] },
                    },
                ];

                render(<ResultPhaseSurface phase={phase} />);

                const button = await screen.findByRole('button', { name: /reload page/i });
                await user.click(button);

                expect(reloadSpy).toHaveBeenCalledTimes(1);
            } finally {
                Object.defineProperty(window, 'location', {
                    configurable: true,
                    value: originalLocation,
                });
            }
        });
    });

    describe('ready', () => {
        it('renders the experience card area (or its skeleton while meta fetches) when content is present', () => {
            mockArtifactState.artifacts = [
                {
                    id: 'result_experience_id',
                    name: 'Built Experience',
                    type: 'markdown',
                    content: 'exp_built_abc123',
                    metadata: { tags: ['result:experience-id'] },
                },
            ];

            render(<ResultPhaseSurface phase={phase} />);

            expect(
                screen.queryByRole('button', { name: /reload page/i }),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText(/build didn't link to a playable experience/i),
            ).not.toBeInTheDocument();
        });
    });
});

describe('ResultPhaseSurface — failure & retry', () => {
    it('does not render the retry button by default', () => {
        render(<ResultPhaseSurface phase={phase} />);
        expect(
            screen.queryByRole('button', { name: /retry/i }),
        ).not.toBeInTheDocument();
    });

    it('renders a retry button after a phase-failure event for this phase', () => {
        render(<ResultPhaseSurface phase={phase} />);

        act(() => {
            window.dispatchEvent(
                new CustomEvent('phase-failure', {
                    detail: {
                        phaseId: 'handoff',
                        message: 'I am having trouble finalizing the build.',
                    },
                }),
            );
        });

        expect(
            screen.getByRole('button', { name: /retry/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/trouble finalizing the build/i),
        ).toBeInTheDocument();
    });

    it('does not fetch when the tagged artifact already has content', () => {
        // Happy path: /api/artifacts/list inlined the content body, so the
        // surface has everything it needs and must not chase a redundant
        // per-id fetch.
        mockArtifactState.artifacts = [
            {
                id: 'result_experience_id',
                name: 'Result: Experience ID',
                type: 'markdown',
                content: 'exp_built_abc123',
                metadata: { tags: ['result:experience-id'] },
            },
        ];

        render(<ResultPhaseSurface phase={phase} />);

        expect(mockGetArtifact).not.toHaveBeenCalled();
    });

    it('calls getArtifact with the tagged artifact id when content is missing', async () => {
        // Defense-in-depth path: tags hydrated but content didn't (older
        // metadata-only list response, race window, etc). The surface must
        // pull the body itself or the Play CTA stays disabled forever.
        mockArtifactState.artifacts = [
            {
                id: 'result_experience_id',
                name: 'Result: Experience ID',
                type: 'markdown',
                content: undefined,
                metadata: { tags: ['result:experience-id'] },
            },
        ];

        render(<ResultPhaseSurface phase={phase} />);

        await waitFor(() => {
            expect(mockGetArtifact).toHaveBeenCalledWith('result_experience_id');
        });
        expect(mockGetArtifact).toHaveBeenCalledTimes(1);
    });

    it('clears failure state and dispatches a workflow-phase-change system message on retry', async () => {
        const user = userEvent.setup();
        const phaseChangeListener = jest.fn();
        window.addEventListener('workflow-phase-change', phaseChangeListener);

        render(<ResultPhaseSurface phase={phase} />);

        act(() => {
            window.dispatchEvent(
                new CustomEvent('phase-failure', {
                    detail: { phaseId: 'handoff', message: 'failed' },
                }),
            );
        });

        await user.click(screen.getByRole('button', { name: /retry/i }));

        expect(
            screen.queryByRole('button', { name: /retry/i }),
        ).not.toBeInTheDocument();
        expect(phaseChangeListener).toHaveBeenCalledTimes(1);
        const detail = (phaseChangeListener.mock.calls[0][0] as CustomEvent)
            .detail as { systemMessage?: string; toAgent?: string };
        expect(detail.systemMessage).toMatch(/\[SYSTEM\/phase_retry\]/);
        expect(detail.systemMessage).toMatch(/handoff/);
        expect(detail.toAgent).toBeUndefined();

        window.removeEventListener('workflow-phase-change', phaseChangeListener);
    });
});
