/**
 * @jest-environment jsdom
 *
 * Tests for `ExperienceCompletedDialog` (Task A14c).
 *
 * The dialog is a thin presentational shell over `useWorkflowPhase`. We mock
 * that hook directly so the tests only assert on what the dialog renders /
 * does for a given context shape.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type { WorkflowPhaseContextValue } from '@/app/contexts/WorkflowPhaseContext';

const mockUseWorkflowPhase = jest.fn<WorkflowPhaseContextValue, []>();

jest.mock('@/app/contexts/WorkflowPhaseContext', () => ({
  __esModule: true,
  useWorkflowPhase: () => mockUseWorkflowPhase(),
}));

import { ExperienceCompletedDialog } from '../ExperienceCompletedDialog';

interface ContextOverrides extends Partial<WorkflowPhaseContextValue> {
  goBack?: jest.Mock;
}

function buildValue(overrides: ContextOverrides = {}): WorkflowPhaseContextValue {
  const goBack = overrides.goBack ?? jest.fn().mockResolvedValue(undefined);
  return {
    phases: [
      { id: 'intro', title: 'Intro' },
      { id: 'pitch', title: 'Pitch' },
    ],
    currentPhase: { id: 'pitch', title: 'Pitch' },
    furthestPhase: { id: 'pitch', title: 'Pitch' },
    visited: ['intro', 'pitch'],
    completedPhases: ['intro', 'pitch'],
    nextPhaseOverride: undefined,
    experienceCompleted: true,
    isLoading: false,
    goToPhase: jest.fn().mockResolvedValue(undefined),
    advance: jest.fn().mockResolvedValue(undefined),
    goBack,
    resolvedNextPhaseId: undefined,
    ...overrides,
    // Keep the explicit goBack mock in place even if `overrides` spread
    // overwrote it via the default-then-override pattern above.
    ...(overrides.goBack ? { goBack } : {}),
  };
}

beforeEach(() => {
  mockUseWorkflowPhase.mockReset();
});

describe('<ExperienceCompletedDialog />', () => {
  it('does NOT render when experienceCompleted === false', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({ experienceCompleted: false }),
    );
    render(<ExperienceCompletedDialog onClose={jest.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Experience complete'),
    ).not.toBeInTheDocument();
  });

  it('renders when experienceCompleted === true', () => {
    mockUseWorkflowPhase.mockReturnValue(buildValue());
    render(<ExperienceCompletedDialog onClose={jest.fn()} />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Experience complete')).toBeInTheDocument();
  });

  it('renders the documented body copy', () => {
    mockUseWorkflowPhase.mockReturnValue(buildValue());
    render(<ExperienceCompletedDialog onClose={jest.fn()} />);
    expect(
      screen.getByText(
        "You've finished. You can rewind to revisit any phase, or close this session.",
      ),
    ).toBeInTheDocument();
  });

  it('calls goBack() when Rewind is clicked', () => {
    const goBack = jest.fn().mockResolvedValue(undefined);
    mockUseWorkflowPhase.mockReturnValue(buildValue({ goBack }));
    render(<ExperienceCompletedDialog onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rewind' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Close is clicked', () => {
    const onClose = jest.fn();
    mockUseWorkflowPhase.mockReturnValue(buildValue());
    render(<ExperienceCompletedDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-closes when experienceCompleted flips to false', () => {
    mockUseWorkflowPhase.mockReturnValue(buildValue());
    const { rerender } = render(
      <ExperienceCompletedDialog onClose={jest.fn()} />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    mockUseWorkflowPhase.mockReturnValue(
      buildValue({ experienceCompleted: false }),
    );
    rerender(<ExperienceCompletedDialog onClose={jest.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('is NOT dismissed by Escape key', () => {
    mockUseWorkflowPhase.mockReturnValue(buildValue());
    render(<ExperienceCompletedDialog onClose={jest.fn()} />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();

    // Fire Escape on the dialog content; the component preventDefaults the
    // escape-key event so the dialog must remain mounted.
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('is suppressed when the final phase is mode="result" — the result tile is the closure UX', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        currentPhase: { id: 'handoff', title: 'Handoff', mode: 'result' },
      }),
    );
    render(<ExperienceCompletedDialog onClose={jest.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Experience complete')).not.toBeInTheDocument();
  });

  it('still renders for mode="interactive" final phases', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        currentPhase: { id: 'pitch', title: 'Pitch', mode: 'interactive' },
      }),
    );
    render(<ExperienceCompletedDialog onClose={jest.fn()} />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('is NOT dismissed by overlay click', () => {
    mockUseWorkflowPhase.mockReturnValue(buildValue());
    render(<ExperienceCompletedDialog onClose={jest.fn()} />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();

    // Radix renders the overlay as a sibling of the content with
    // `data-state="open"`. Click on the body (outside the dialog content) —
    // Radix `AlertDialog` ignores outside-click dismissal by default. We
    // assert here that this default is preserved.
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
