/**
 * @jest-environment jsdom
 *
 * `PhaseSurfaceSwitch` is a thin router over `useWorkflowPhase` + `mode`. We
 * mock the hook directly so each test can drive the switch with a specific
 * loading / phase state without standing up the full provider chain.
 *
 * `BuildPhaseSurface` / `ResultPhaseSurface` / `PhaseHeading` are stubbed to
 * pure marker components so the assertions only check which branch the
 * switch picked, not what the children render. Those children are tested in
 * their own files.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases';
import type { WorkflowPhaseContextValue } from '@/app/contexts/WorkflowPhaseContext';

const mockUseWorkflowPhase = jest.fn<WorkflowPhaseContextValue, []>();

jest.mock('@/app/contexts/WorkflowPhaseContext', () => ({
    __esModule: true,
    useWorkflowPhase: () => mockUseWorkflowPhase(),
}));

jest.mock('../BuildPhaseSurface', () => ({
    __esModule: true,
    BuildPhaseSurface: ({ phase }: { phase: WorkflowPhaseConfig }) => (
        <div data-testid="build-phase-surface">{phase.id}</div>
    ),
}));

jest.mock('../ResultPhaseSurface', () => ({
    __esModule: true,
    ResultPhaseSurface: ({ phase }: { phase: WorkflowPhaseConfig }) => (
        <div data-testid="result-phase-surface">{phase.id}</div>
    ),
}));

jest.mock('@/app/components/redesign', () => ({
    __esModule: true,
    PhaseHeading: ({ children }: { children: React.ReactNode }) => (
        <h1 data-testid="phase-heading">{children}</h1>
    ),
}));

import { PhaseSurfaceSwitch } from '../PhaseSurfaceSwitch';

const INTERACTIVE_MARKER = 'interactive-workspace';

function interactiveChild() {
    return <div data-testid={INTERACTIVE_MARKER}>chat + docs</div>;
}

function buildValue(
    overrides: Partial<WorkflowPhaseContextValue> = {},
): WorkflowPhaseContextValue {
    const noop = jest.fn().mockResolvedValue(undefined);
    const noopOp = jest.fn().mockResolvedValue({ ok: true });
    return {
        phases: [],
        currentPhase: undefined,
        furthestPhase: undefined,
        visited: [],
        completedPhases: [],
        nextPhaseOverride: undefined,
        experienceCompleted: false,
        isLoading: false,
        goToPhase: noop,
        advance: noop,
        goBack: noop,
        complete: noopOp,
        nextPhase: noopOp,
        setPhase: noopOp,
        setNext: noopOp,
        finishExperience: noopOp,
        resolvedNextPhaseId: undefined,
        ...overrides,
    };
}

beforeEach(() => {
    mockUseWorkflowPhase.mockReset();
});

describe('<PhaseSurfaceSwitch />', () => {
    describe('loading gate', () => {
        it('renders nothing for a build-mode phase while isLoading is true', () => {
            // Even when `currentPhase` already resolves to `mode: 'build'` in
            // the seeded value, we MUST wait for the server fetch to finish
            // before committing to a surface. Otherwise the interactive
            // workspace can flash in for a frame on first paint when
            // `currentPhase` is undefined and `mode` falls through to the
            // `?? 'interactive'` default. This test pins the gate.
            mockUseWorkflowPhase.mockReturnValue(
                buildValue({
                    isLoading: true,
                    currentPhase: { id: 'designing', title: 'Designing', mode: 'build' },
                }),
            );

            const { container } = render(
                <PhaseSurfaceSwitch interactive={interactiveChild()} />,
            );

            expect(container).toBeEmptyDOMElement();
            expect(screen.queryByTestId('build-phase-surface')).not.toBeInTheDocument();
            expect(screen.queryByTestId(INTERACTIVE_MARKER)).not.toBeInTheDocument();
            expect(screen.queryByTestId('phase-heading')).not.toBeInTheDocument();
        });

        it('renders nothing while isLoading is true and the phase is not yet known', () => {
            // Pre-fetch state: `currentPhase` is undefined so `mode` would
            // resolve to `'interactive'` via the fallback. Without the gate,
            // the interactive workspace would render and then flip away once
            // the fetch lands and reveals the real `mode: 'build'`.
            mockUseWorkflowPhase.mockReturnValue(
                buildValue({
                    isLoading: true,
                    currentPhase: undefined,
                }),
            );

            const { container } = render(
                <PhaseSurfaceSwitch interactive={interactiveChild()} />,
            );

            expect(container).toBeEmptyDOMElement();
            expect(screen.queryByTestId(INTERACTIVE_MARKER)).not.toBeInTheDocument();
        });
    });

    describe('after load', () => {
        it('renders BuildPhaseSurface (not the interactive child) when mode is "build"', () => {
            mockUseWorkflowPhase.mockReturnValue(
                buildValue({
                    isLoading: false,
                    currentPhase: {
                        id: 'designing',
                        title: 'Designing',
                        mode: 'build',
                        buildConfig: { title: 'Designing your experience' },
                    },
                }),
            );

            render(<PhaseSurfaceSwitch interactive={interactiveChild()} />);

            expect(screen.getByTestId('build-phase-surface')).toHaveTextContent('designing');
            expect(screen.getByTestId('phase-heading')).toHaveTextContent(
                'Designing your experience',
            );
            expect(screen.queryByTestId(INTERACTIVE_MARKER)).not.toBeInTheDocument();
        });

        it('renders ResultPhaseSurface (not the interactive child) when mode is "result"', () => {
            mockUseWorkflowPhase.mockReturnValue(
                buildValue({
                    isLoading: false,
                    currentPhase: {
                        id: 'done',
                        title: 'Done',
                        mode: 'result',
                    },
                }),
            );

            render(<PhaseSurfaceSwitch interactive={interactiveChild()} />);

            expect(screen.getByTestId('result-phase-surface')).toHaveTextContent('done');
            expect(screen.queryByTestId(INTERACTIVE_MARKER)).not.toBeInTheDocument();
        });

        it('renders the interactive child for an interactive-mode phase', () => {
            mockUseWorkflowPhase.mockReturnValue(
                buildValue({
                    isLoading: false,
                    currentPhase: {
                        id: 'design',
                        title: 'Design',
                        mode: 'interactive',
                    },
                }),
            );

            render(<PhaseSurfaceSwitch interactive={interactiveChild()} />);

            expect(screen.getByTestId(INTERACTIVE_MARKER)).toBeInTheDocument();
            expect(screen.queryByTestId('build-phase-surface')).not.toBeInTheDocument();
            expect(screen.queryByTestId('result-phase-surface')).not.toBeInTheDocument();
        });

        it('renders the interactive child when the experience has no phases', () => {
            mockUseWorkflowPhase.mockReturnValue(
                buildValue({
                    isLoading: false,
                    currentPhase: undefined,
                }),
            );

            render(<PhaseSurfaceSwitch interactive={interactiveChild()} />);

            expect(screen.getByTestId(INTERACTIVE_MARKER)).toBeInTheDocument();
        });
    });
});
