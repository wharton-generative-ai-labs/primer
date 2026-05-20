/**
 * @jest-environment jsdom
 *
 * Tests for `WorkflowPhaseStrip` (Task A14).
 *
 * The strip is a thin presentational shell over `useWorkflowPhase`. We mock
 * that hook directly so the tests only assert on what the strip renders / does
 * for a given context shape.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases';
import type { WorkflowPhaseContextValue } from '@/app/contexts/WorkflowPhaseContext';

const mockUseWorkflowPhase = jest.fn<WorkflowPhaseContextValue, []>();

jest.mock('@/app/contexts/WorkflowPhaseContext', () => ({
  __esModule: true,
  useWorkflowPhase: () => mockUseWorkflowPhase(),
}));

import { WorkflowPhaseStrip } from '../WorkflowPhaseStrip';

const PHASES: WorkflowPhaseConfig[] = [
  { id: 'intro', title: 'Intro' },
  { id: 'pitch', title: 'Pitch a VC' },
  { id: 'feedback', title: 'Feedback' },
  { id: 'reflect', title: 'Reflect' },
  { id: 'wrap', title: 'Wrap-up' },
];

interface ContextOverrides extends Partial<WorkflowPhaseContextValue> {
  advance?: jest.Mock;
  goBack?: jest.Mock;
  goToPhase?: jest.Mock;
  complete?: jest.Mock;
}

function buildValue(
  overrides: ContextOverrides = {},
): WorkflowPhaseContextValue {
  const advance = overrides.advance ?? jest.fn().mockResolvedValue(undefined);
  const goBack = overrides.goBack ?? jest.fn().mockResolvedValue(undefined);
  const goToPhase = overrides.goToPhase ?? jest.fn().mockResolvedValue(undefined);
  const complete =
    overrides.complete ?? jest.fn().mockResolvedValue({ ok: true });
  // Auto-resolve `resolvedNextPhase` from `resolvedNextPhaseId` against the
  // phases list so callers that override the id (or the phases array) get a
  // consistent destination config without restating it. Tests that need a
  // specific destination mode (e.g. `'build'`) pass `resolvedNextPhase`
  // explicitly via overrides.
  const phasesForValue = overrides.phases ?? PHASES;
  const resolvedNextPhaseId =
    overrides.resolvedNextPhaseId !== undefined
      ? overrides.resolvedNextPhaseId
      : 'feedback';
  const resolvedNextPhase =
    overrides.resolvedNextPhase !== undefined
      ? overrides.resolvedNextPhase
      : resolvedNextPhaseId
        ? phasesForValue.find((p) => p.id === resolvedNextPhaseId)
        : undefined;
  return {
    phases: PHASES,
    currentPhase: PHASES[1], // "Pitch a VC"
    furthestPhase: PHASES[1],
    visited: ['intro', 'pitch'],
    completedPhases: [],
    completedObjectives: {},
    nextPhaseOverride: undefined,
    experienceCompleted: false,
    isLoading: false,
    goToPhase,
    advance,
    goBack,
    complete,
    resolvedNextPhaseId,
    resolvedNextPhase,
    backTargetId: 'intro',
    ...overrides,
    // Keep the mocks the caller passed in so they aren't silently overridden
    // by spreading defaults under the spread.
    ...(overrides.advance ? { advance } : {}),
    ...(overrides.goBack ? { goBack } : {}),
    ...(overrides.goToPhase ? { goToPhase } : {}),
    ...(overrides.complete ? { complete } : {}),
  };
}

beforeEach(() => {
  mockUseWorkflowPhase.mockReset();
});

describe('<WorkflowPhaseStrip />', () => {
  it('renders nothing when phases.length === 0', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        phases: [],
        currentPhase: undefined,
        furthestPhase: undefined,
        visited: [],
        completedPhases: [],
        resolvedNextPhaseId: undefined,
      }),
    );
    const { container } = render(<WorkflowPhaseStrip />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides Back when there is no interactive predecessor in the visited stack', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        visited: ['intro'],
        currentPhase: PHASES[0],
        backTargetId: undefined,
      }),
    );
    render(<WorkflowPhaseStrip />);
    expect(
      screen.queryByRole('button', { name: 'Back' }),
    ).not.toBeInTheDocument();
  });

  it('hides Back when every visited predecessor is non-interactive (build/result)', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        visited: ['drafting', 'pitch'],
        backTargetId: undefined,
      }),
    );
    render(<WorkflowPhaseStrip />);
    expect(
      screen.queryByRole('button', { name: 'Back' }),
    ).not.toBeInTheDocument();
  });

  it('renders Back when visited.length > 1', () => {
    mockUseWorkflowPhase.mockReturnValue(buildValue());
    render(<WorkflowPhaseStrip />);
    const backBtn = screen.getByRole('button', { name: 'Back' });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).not.toBeDisabled();
  });

  it('labels Back as "Rewind" when experienceCompleted is true', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({ experienceCompleted: true }),
    );
    render(<WorkflowPhaseStrip />);
    const rewindBtn = screen.getByRole('button', { name: 'Rewind' });
    expect(rewindBtn).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Back$/ }),
    ).not.toBeInTheDocument();
  });

  it('keeps Next clickable when current phase is not in completedPhases (veto-on-click)', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({ completedPhases: [] }),
    );
    render(<WorkflowPhaseStrip />);
    const nextBtn = screen.getByRole('button', { name: /^Next: Feedback$/ });
    expect(nextBtn).not.toBeDisabled();
  });

  it('dispatches a USER_ADVANCE_REQUEST system message when Next is clicked on an unfinished phase', () => {
    const advance = jest.fn().mockResolvedValue(undefined);
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({ completedPhases: [], advance }),
    );
    const events: CustomEvent[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('workflow-phase-change', handler);
    try {
      render(<WorkflowPhaseStrip />);
      fireEvent.click(
        screen.getByRole('button', { name: /^Next: Feedback$/ }),
      );
    } finally {
      window.removeEventListener('workflow-phase-change', handler);
    }
    expect(advance).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    const detail = events[0].detail as {
      systemMessage?: string;
      toAgent?: string;
    };
    expect(detail.systemMessage).toMatch(/USER_ADVANCE_REQUEST/);
    expect(detail.toAgent).toBeUndefined();
  });

  it('debounces repeated Next clicks during the veto-round cooldown', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({ completedPhases: [] }),
    );
    const events: CustomEvent[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('workflow-phase-change', handler);
    try {
      render(<WorkflowPhaseStrip />);
      const nextBtn = screen.getByRole('button', {
        name: /^Next: Feedback$/,
      });
      fireEvent.click(nextBtn);
      fireEvent.click(nextBtn);
      fireEvent.click(nextBtn);
    } finally {
      window.removeEventListener('workflow-phase-change', handler);
    }
    expect(events).toHaveLength(1);
  });

  // ── non-interactive next-phase branch ────────────────────────────────────
  // The veto round assumes the destination has a chat surface where the
  // agent can respond. When the resolved next phase is `mode: 'build'` or
  // `'result'` there is no chat surface, so the strip skips the veto round
  // and finalizes the transition from the client. This is the bug fix for
  // the design → build hand-off: on `requireEducatorAdvance` phases where
  // the agent has not (yet) emitted `workflowPhase nextPhase`, the click
  // must still reliably land the user on `mode: 'build'`.

  it('fast-paths advance when current is complete and next is non-interactive (build), no veto dispatch', () => {
    const advance = jest.fn().mockResolvedValue(undefined);
    const complete = jest.fn().mockResolvedValue({ ok: true });
    const buildPhase: WorkflowPhaseConfig = {
      id: 'building',
      title: 'Building',
      mode: 'build',
    };
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        completedPhases: ['pitch'],
        advance,
        complete,
        resolvedNextPhaseId: 'building',
        resolvedNextPhase: buildPhase,
      }),
    );
    const events: CustomEvent[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('workflow-phase-change', handler);
    try {
      render(<WorkflowPhaseStrip />);
      fireEvent.click(
        screen.getByRole('button', { name: /^Next: Building$/ }),
      );
    } finally {
      window.removeEventListener('workflow-phase-change', handler);
    }
    expect(advance).toHaveBeenCalledTimes(1);
    expect(advance).toHaveBeenCalledWith({ trigger: 'user' });
    expect(complete).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it('force-finalizes complete → advance when current is incomplete and next is non-interactive (build), no veto dispatch', async () => {
    const advance = jest.fn().mockResolvedValue(undefined);
    const complete = jest.fn().mockResolvedValue({ ok: true });
    const callOrder: string[] = [];
    advance.mockImplementation(async () => {
      callOrder.push('advance');
    });
    complete.mockImplementation(async () => {
      callOrder.push('complete');
      return { ok: true };
    });
    const buildPhase: WorkflowPhaseConfig = {
      id: 'building',
      title: 'Building',
      mode: 'build',
    };
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        completedPhases: [],
        advance,
        complete,
        resolvedNextPhaseId: 'building',
        resolvedNextPhase: buildPhase,
      }),
    );
    const events: CustomEvent[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('workflow-phase-change', handler);
    try {
      render(<WorkflowPhaseStrip />);
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /^Next: Building$/ }),
        );
      });
    } finally {
      window.removeEventListener('workflow-phase-change', handler);
    }
    expect(complete).toHaveBeenCalledTimes(1);
    expect(advance).toHaveBeenCalledTimes(1);
    expect(advance).toHaveBeenCalledWith({ trigger: 'user' });
    expect(callOrder).toEqual(['complete', 'advance']);
    expect(events).toHaveLength(0);
  });

  it('does NOT call advance when complete() fails (non-interactive branch)', async () => {
    const advance = jest.fn().mockResolvedValue(undefined);
    const complete = jest
      .fn()
      .mockResolvedValue({ ok: false, message: 'boom' });
    const buildPhase: WorkflowPhaseConfig = {
      id: 'building',
      title: 'Building',
      mode: 'build',
    };
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        completedPhases: [],
        advance,
        complete,
        resolvedNextPhaseId: 'building',
        resolvedNextPhase: buildPhase,
      }),
    );
    render(<WorkflowPhaseStrip />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /^Next: Building$/ }),
      );
    });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(advance).not.toHaveBeenCalled();
  });

  it('result-mode destination mirrors the build branch (force complete → advance)', async () => {
    const advance = jest.fn().mockResolvedValue(undefined);
    const complete = jest.fn().mockResolvedValue({ ok: true });
    const resultPhase: WorkflowPhaseConfig = {
      id: 'handoff',
      title: 'Handoff',
      mode: 'result',
    };
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        completedPhases: [],
        advance,
        complete,
        resolvedNextPhaseId: 'handoff',
        resolvedNextPhase: resultPhase,
      }),
    );
    const events: CustomEvent[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('workflow-phase-change', handler);
    try {
      render(<WorkflowPhaseStrip />);
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /^Next: Handoff$/ }),
        );
      });
    } finally {
      window.removeEventListener('workflow-phase-change', handler);
    }
    expect(complete).toHaveBeenCalledTimes(1);
    expect(advance).toHaveBeenCalledWith({ trigger: 'user' });
    expect(events).toHaveLength(0);
  });

  it('disables Next while the force-advance round-trip is in flight (no duplicate POST pair)', async () => {
    // Hold `complete()` open until we release it manually, so the click
    // window stays "in flight" long enough for a second click to register.
    let releaseComplete: (() => void) | undefined;
    const completePromise = new Promise<{ ok: true }>((resolve) => {
      releaseComplete = () => resolve({ ok: true });
    });
    const advance = jest.fn().mockResolvedValue(undefined);
    const complete = jest.fn().mockReturnValue(completePromise);
    const buildPhase: WorkflowPhaseConfig = {
      id: 'building',
      title: 'Building',
      mode: 'build',
    };
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        completedPhases: [],
        advance,
        complete,
        resolvedNextPhaseId: 'building',
        resolvedNextPhase: buildPhase,
      }),
    );
    render(<WorkflowPhaseStrip />);
    const nextBtn = screen.getByRole('button', { name: /^Next: Building$/ });
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(nextBtn).toBeDisabled();
    await act(async () => {
      releaseComplete?.();
      await completePromise;
    });
    await waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('keeps Next clickable when current phase is in completedPhases', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({ completedPhases: ['pitch'] }),
    );
    render(<WorkflowPhaseStrip />);
    const nextBtn = screen.getByRole('button', { name: /^Next: Feedback$/ });
    expect(nextBtn).not.toBeDisabled();
  });

  it('shows resolved next phase title in the Next label', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        completedPhases: ['pitch'],
        resolvedNextPhaseId: 'feedback',
      }),
    );
    render(<WorkflowPhaseStrip />);
    expect(
      screen.getByRole('button', { name: /^Next: Feedback$/ }),
    ).toBeInTheDocument();
  });

  it('shows the override redirect indicator when nextPhaseOverride differs from array-next', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        completedPhases: ['pitch'],
        // Array-next from "pitch" would be "feedback"; override to "wrap".
        nextPhaseOverride: 'wrap',
        resolvedNextPhaseId: 'wrap',
      }),
    );
    render(<WorkflowPhaseStrip />);
    expect(
      screen.getByTestId('workflow-phase-strip-override-indicator'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Next: Wrap-up$/ }),
    ).toBeInTheDocument();
  });

  it('does NOT show the override indicator when override equals array-next', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        completedPhases: ['pitch'],
        // Array-next from "pitch" is "feedback"; override is also "feedback".
        nextPhaseOverride: 'feedback',
        resolvedNextPhaseId: 'feedback',
      }),
    );
    render(<WorkflowPhaseStrip />);
    expect(
      screen.queryByTestId('workflow-phase-strip-override-indicator'),
    ).not.toBeInTheDocument();
  });

  it('hides Next entirely when experienceCompleted is true', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        experienceCompleted: true,
        completedPhases: ['pitch'],
      }),
    );
    render(<WorkflowPhaseStrip />);
    expect(
      screen.queryByRole('button', { name: /^Next/ }),
    ).not.toBeInTheDocument();
  });

  it('invokes advance() when Next is clicked', () => {
    const advance = jest.fn().mockResolvedValue(undefined);
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        completedPhases: ['pitch'],
        advance,
      }),
    );
    render(<WorkflowPhaseStrip />);
    fireEvent.click(screen.getByRole('button', { name: /^Next: Feedback$/ }));
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it('invokes goBack() when Back is clicked', () => {
    const goBack = jest.fn().mockResolvedValue(undefined);
    mockUseWorkflowPhase.mockReturnValue(buildValue({ goBack }));
    render(<WorkflowPhaseStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('does not render any AlertDialog (skip dialog regression guard)', () => {
    mockUseWorkflowPhase.mockReturnValue(buildValue());
    render(<WorkflowPhaseStrip />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('regression guard: no AlertDialog appears in any state combination', () => {
    const states: ContextOverrides[] = [
      { completedPhases: ['pitch'] },
      { completedPhases: [] },
      { experienceCompleted: true },
      { experienceCompleted: true, completedPhases: ['pitch'] },
      {
        nextPhaseOverride: 'wrap',
        resolvedNextPhaseId: 'wrap',
        completedPhases: ['pitch'],
      },
      { visited: ['intro'], currentPhase: PHASES[0] },
    ];
    for (const overrides of states) {
      mockUseWorkflowPhase.mockReturnValue(buildValue(overrides));
      const { unmount } = render(<WorkflowPhaseStrip />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('dispatches a per-objective USER_ADVANCE_REQUEST when Next is clicked on an unfinished phase', () => {
    const advance = jest.fn().mockResolvedValue(undefined);
    mockUseWorkflowPhase.mockReturnValue(
      buildValue({
        completedPhases: [],
        currentPhase: {
          id: 'pitch',
          title: 'Pitch a VC',
          objectives: [
            { id: 'intro_made', description: 'Introduced themselves.' },
            { id: 'ask_clear', description: 'Asked a clear question.' },
          ],
        },
        completedObjectives: { pitch: ['intro_made'] },
        advance,
      }),
    );
    const events: CustomEvent[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('workflow-phase-change', handler);
    try {
      render(<WorkflowPhaseStrip />);
      fireEvent.click(
        screen.getByRole('button', { name: /^Next: Feedback$/ }),
      );
    } finally {
      window.removeEventListener('workflow-phase-change', handler);
    }
    expect(advance).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    const detail = events[0].detail as { systemMessage?: string };
    expect(detail.systemMessage).toMatch(/Current phase: pitch/);
    expect(detail.systemMessage).toMatch(/- intro_made: MARKED — Introduced themselves\./);
    expect(detail.systemMessage).toMatch(/- ask_clear: UNMARKED — Asked a clear question\./);
  });
});
