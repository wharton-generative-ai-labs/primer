/**
 * @jest-environment jsdom
 *
 * Tests for `WorkflowPhaseContext` (Task A9 of the workflow-phases plan).
 *
 * The provider is the client-side mirror of the server's per-session phase
 * state. It hydrates from `GET /api/workflow-phases/state` on mount, drives
 * navigation through `POST /api/workflow-phases/transition`, and dispatches a
 * `workflow-phase-change` window event after each navigation so the agent
 * handoff hook (Task A12) can take it from there.
 *
 * Snapshot composition is deferred to Task A10; for now the provider passes no
 * `currentSnapshot` and the tests don't assert on one.
 */

import React from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react';

import {
  WorkflowPhaseProvider,
  useWorkflowPhase,
  type WorkflowPhaseProviderProps,
} from '../WorkflowPhaseContext';
import type {
  WorkflowPhaseConfig,
  WorkflowPhaseState,
} from '@/app/lib/workflow-phases';

const PHASES: WorkflowPhaseConfig[] = [
  { id: 'intro', title: 'Intro', initialAgent: 'intro-agent' },
  { id: 'design', title: 'Design', initialAgent: 'design-agent' },
  { id: 'pitch', title: 'Pitch', initialAgent: 'pitch-agent' },
];

function makeStateResponse(overrides: Partial<WorkflowPhaseState> = {}) {
  const state: WorkflowPhaseState = {
    currentPhase: 'intro',
    furthestPhase: 'intro',
    visited: ['intro'],
    completedPhases: [],
    snapshots: {},
    ...overrides,
  };
  return {
    workflowPhaseState: state,
    experienceCompleted: false,
    workflowPhases: PHASES,
  };
}

function makeTransitionResponse(opts: {
  currentPhase: string;
  furthestPhase?: string;
  visited?: string[];
  completedPhases?: string[];
  nextPhaseOverride?: string;
  experienceCompleted?: boolean;
  systemMessage?: string | null;
}) {
  return {
    newState: {
      currentPhase: opts.currentPhase,
      furthestPhase: opts.furthestPhase ?? opts.currentPhase,
      visited: opts.visited ?? [opts.currentPhase],
      completedPhases: opts.completedPhases ?? [],
      nextPhaseOverride: opts.nextPhaseOverride,
      snapshots: {},
    },
    experienceCompleted: opts.experienceCompleted ?? false,
    systemMessage: opts.systemMessage ?? null,
  };
}

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return {
    ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
    status: init.status ?? 200,
    json: async () => body,
  } as Response;
}

const DEFAULT_PROVIDER_PROPS: Omit<WorkflowPhaseProviderProps, 'children'> = {
  phases: PHASES,
  experienceId: 'exp-1',
  sessionId: 'sess-1',
  selectedAgentKey: 'intro-agent',
};

function wrap(props: Partial<WorkflowPhaseProviderProps> = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <WorkflowPhaseProvider {...DEFAULT_PROVIDER_PROPS} {...props}>
        {children}
      </WorkflowPhaseProvider>
    );
  };
}

describe('<WorkflowPhaseProvider />', () => {
  let fetchMock: jest.Mock;
  let dispatchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as { fetch: unknown }).fetch = fetchMock;
    dispatchSpy = jest.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it('fetches /api/workflow-phases/state on mount and clears isLoading', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/workflow-phases/state');
    expect(init).toMatchObject({
      method: 'GET',
      headers: {
        'x-experience-id': 'exp-1',
        'x-session-id': 'sess-1',
      },
    });
    expect(result.current.currentPhase?.id).toBe('intro');
    expect(result.current.visited).toEqual(['intro']);
  });

  it('goToPhase POSTs the goTo op with trigger=user and applies the response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));

    const transitionBody = makeTransitionResponse({
      currentPhase: 'design',
      furthestPhase: 'design',
      visited: ['intro', 'design'],
      completedPhases: ['intro'],
      systemMessage: 'You are now in the design phase.',
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(transitionBody));

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.goToPhase('design');
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/workflow-phases/transition');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'x-experience-id': 'exp-1',
      'x-session-id': 'sess-1',
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      op: { kind: 'goTo', targetPhase: 'design' },
      trigger: 'user',
    });

    expect(result.current.currentPhase?.id).toBe('design');
    expect(result.current.visited).toEqual(['intro', 'design']);
    expect(result.current.completedPhases).toEqual(['intro']);
    expect(result.current.experienceCompleted).toBe(false);
  });

  it('goToPhase dispatches a workflow-phase-change window event with the system message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeTransitionResponse({
          currentPhase: 'design',
          visited: ['intro', 'design'],
          systemMessage: 'You are now in the design phase.',
        }),
      ),
    );

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.goToPhase('design');
    });

    const phaseChangeCall = dispatchSpy.mock.calls.find(
      ([event]) =>
        event instanceof CustomEvent && event.type === 'workflow-phase-change',
    );
    expect(phaseChangeCall).toBeDefined();
    const event = phaseChangeCall![0] as CustomEvent<{
      systemMessage: string | null;
      toAgent: string | undefined;
    }>;
    expect(event.detail.systemMessage).toBe('You are now in the design phase.');
    // Re-entry resolution: no reentryAgent + no snapshot ⇒ initialAgent.
    expect(event.detail.toAgent).toBe('design-agent');
  });

  it('advance() POSTs op: { kind: "advance" }', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeTransitionResponse({
          currentPhase: 'design',
          visited: ['intro', 'design'],
          completedPhases: ['intro'],
          systemMessage: 'Moving forward to design.',
        }),
      ),
    );

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.advance();
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/workflow-phases/transition');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      op: { kind: 'advance' },
      trigger: 'user',
    });
    expect(result.current.currentPhase?.id).toBe('design');
  });

  it('goBack() finds the prior visited id and POSTs goTo for it', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeStateResponse({
          currentPhase: 'pitch',
          furthestPhase: 'pitch',
          visited: ['intro', 'design', 'pitch'],
          completedPhases: ['intro', 'design'],
        }),
      ),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeTransitionResponse({
          currentPhase: 'design',
          furthestPhase: 'pitch',
          visited: ['intro', 'design', 'pitch', 'design'],
          completedPhases: ['intro', 'design'],
          systemMessage: 'Returning to design.',
        }),
      ),
    );

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.goBack();
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/workflow-phases/transition');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      op: { kind: 'goTo', targetPhase: 'design' },
      trigger: 'user',
    });
    expect(result.current.currentPhase?.id).toBe('design');
  });

  it('goBack() is a no-op when there is no prior visited phase', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.goBack();
    });

    // Only the initial GET fired; no transition POST.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('goBack() skips non-interactive predecessors and lands on the nearest interactive ancestor', async () => {
    const mixedPhases: WorkflowPhaseConfig[] = [
      { id: 'intake', title: 'Intake', initialAgent: 'intake-agent' },
      {
        id: 'designing',
        title: 'Drafting',
        initialAgent: 'intake-agent',
        mode: 'build',
      },
      { id: 'design', title: 'Review', initialAgent: 'intake-agent' },
    ];
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        workflowPhaseState: {
          currentPhase: 'design',
          furthestPhase: 'design',
          visited: ['intake', 'designing', 'design'],
          completedPhases: ['intake', 'designing'],
          snapshots: {},
        },
        experienceCompleted: false,
        workflowPhases: mixedPhases,
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeTransitionResponse({
          currentPhase: 'intake',
          furthestPhase: 'design',
          visited: ['intake', 'designing', 'design', 'intake'],
          completedPhases: ['intake', 'designing'],
          systemMessage: 'Returning to intake.',
        }),
      ),
    );

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap({ phases: mixedPhases }),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.backTargetId).toBe('intake');

    await act(async () => {
      await result.current.goBack();
    });

    const [, init] = fetchMock.mock.calls[1];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      op: { kind: 'goTo', targetPhase: 'intake' },
      trigger: 'user',
    });
  });

  it('goBack() is a no-op when every predecessor is non-interactive', async () => {
    const mixedPhases: WorkflowPhaseConfig[] = [
      {
        id: 'designing',
        title: 'Drafting',
        initialAgent: 'orchestrator',
        mode: 'build',
      },
      { id: 'design', title: 'Review', initialAgent: 'orchestrator' },
    ];
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        workflowPhaseState: {
          currentPhase: 'design',
          furthestPhase: 'design',
          visited: ['designing', 'design'],
          completedPhases: ['designing'],
          snapshots: {},
        },
        experienceCompleted: false,
        workflowPhases: mixedPhases,
      }),
    );

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap({ phases: mixedPhases }),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.backTargetId).toBeUndefined();

    await act(async () => {
      await result.current.goBack();
    });

    // Only the initial GET fired; no transition POST.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ── resolvedNextPhase ────────────────────────────────────────────────────
  // Exposed alongside `resolvedNextPhaseId` so the strip can branch on the
  // destination phase's `mode` without re-implementing override math. The
  // strip uses this to detect non-interactive next phases (`mode: 'build'`
  // or `'result'`) and skip the agent veto round.
  it('resolvedNextPhase resolves to the next phase config', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resolvedNextPhaseId).toBe('design');
    expect(result.current.resolvedNextPhase?.id).toBe('design');
  });

  it('resolvedNextPhase honors nextPhaseOverride', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeStateResponse({
          currentPhase: 'intro',
          visited: ['intro'],
          nextPhaseOverride: 'pitch',
        }),
      ),
    );

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resolvedNextPhase?.id).toBe('pitch');
  });

  it('resolvedNextPhase carries `mode` so the strip can detect non-interactive destinations', async () => {
    const mixedPhases: WorkflowPhaseConfig[] = [
      { id: 'design', title: 'Design', initialAgent: 'intake' },
      { id: 'building', title: 'Building', mode: 'build', initialAgent: 'intake' },
    ];
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        workflowPhaseState: {
          currentPhase: 'design',
          furthestPhase: 'design',
          visited: ['design'],
          completedPhases: [],
          snapshots: {},
        },
        experienceCompleted: false,
        workflowPhases: mixedPhases,
      }),
    );

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap({ phases: mixedPhases }),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resolvedNextPhase?.id).toBe('building');
    expect(result.current.resolvedNextPhase?.mode).toBe('build');
  });

  it('resolvedNextPhaseId reflects nextPhaseOverride when set, else array-next', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeStateResponse({
          currentPhase: 'intro',
          visited: ['intro'],
          nextPhaseOverride: 'pitch',
        }),
      ),
    );

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resolvedNextPhaseId).toBe('pitch');

    // Drop the override via a transition response without one — array-next
    // should kick in (intro → design).
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeTransitionResponse({
          currentPhase: 'intro',
          visited: ['intro'],
          completedPhases: ['intro'],
          systemMessage: null,
        }),
      ),
    );
    await act(async () => {
      // goToPhase here just exercises the state-refresh path; the actual op
      // doesn't matter for what we're asserting.
      await result.current.goToPhase('intro');
    });
    expect(result.current.nextPhaseOverride).toBeUndefined();
    expect(result.current.resolvedNextPhaseId).toBe('design');
  });

  it('with no phases: provider exposes empty arrays + no-ops and never fetches', async () => {
    fetchMock.mockImplementation(() => {
      throw new Error('fetch should not be called when phases are empty');
    });

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap({ phases: [] }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.phases).toEqual([]);
    expect(result.current.visited).toEqual([]);
    expect(result.current.completedPhases).toEqual([]);
    expect(result.current.experienceCompleted).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.resolvedNextPhaseId).toBeUndefined();

    // No-op handlers resolve without firing fetch.
    await act(async () => {
      await result.current.goToPhase('intro');
      await result.current.advance();
      await result.current.goBack();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when useWorkflowPhase is called outside a provider', () => {
    // Suppress the React error-boundary console noise for this assertion.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Probe() {
      useWorkflowPhase();
      return null;
    }
    expect(() => render(<Probe />)).toThrow(
      /useWorkflowPhase must be used inside a WorkflowPhaseProvider/,
    );
    errorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Agent-driven ops: complete() and nextPhase()
  // These tests reproduce the "Next button stays disabled after agent
  // acknowledges phase done" bug. Before the fix, complete() and nextPhase()
  // made raw fetch calls that bypassed applyResponse, so completedPhases
  // never updated in React state and the strip's Next gate stayed false.
  // -------------------------------------------------------------------------

  it('complete() updates completedPhases so the strip Next button can enable', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeTransitionResponse({
          currentPhase: 'intro',
          completedPhases: ['intro'],
          systemMessage: null,
        }),
      ),
    );

    const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Pre-condition: Next button would be disabled (phase not in completedPhases).
    expect(result.current.completedPhases).toEqual([]);

    await act(async () => {
      const r = await result.current.complete();
      expect(r.ok).toBe(true);
    });

    // Post-condition: completedPhases now contains 'intro' → Next button enables.
    expect(result.current.completedPhases).toContain('intro');
  });

  it('nextPhase() with requireEducatorAdvance server collapse updates completedPhases', async () => {
    // When requireEducatorAdvance: true, the server collapses nextPhase → complete-only:
    // same currentPhase is returned, but the phase is added to completedPhases.
    // The client must apply this response so the educator's Next button enables.
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeTransitionResponse({
          currentPhase: 'intro',     // did NOT advance — still on intro
          completedPhases: ['intro'], // but now complete
          systemMessage: null,
        }),
      ),
    );

    const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.completedPhases).toEqual([]);

    await act(async () => {
      const r = await result.current.nextPhase();
      expect(r.ok).toBe(true);
    });

    // Phase is now complete even though currentPhase didn't change.
    expect(result.current.completedPhases).toContain('intro');
    expect(result.current.currentPhase?.id).toBe('intro');
  });

  // ── Strip-driven design → build hand-off ─────────────────────────────────
  // When the strip's Next button finalizes a transition into a non-interactive
  // phase (`mode: 'build'` or `'result'`), it calls `complete()` then
  // `advance({ trigger: 'user' })` sequentially. This mirrors the agent's
  // `nextPhase` behavior (objective auto-mark + currentPhase change) without
  // depending on the agent emitting `workflowPhase nextPhase` — the destination
  // has no chat surface, so the user's click is authoritative.

  it('design → build hand-off: complete() then advance() updates completedPhases AND currentPhase', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeStateResponse({
          currentPhase: 'design',
          furthestPhase: 'design',
          visited: ['intro', 'design'],
          completedPhases: ['intro'],
        }),
      ),
    );
    // Step 1: complete() — server returns same currentPhase, design now complete.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeTransitionResponse({
          currentPhase: 'design',
          furthestPhase: 'design',
          visited: ['intro', 'design'],
          completedPhases: ['intro', 'design'],
          systemMessage: null,
        }),
      ),
    );
    // Step 2: advance() — currentPhase moves forward.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeTransitionResponse({
          currentPhase: 'pitch',
          furthestPhase: 'pitch',
          visited: ['intro', 'design', 'pitch'],
          completedPhases: ['intro', 'design'],
          systemMessage: 'Entering build.',
        }),
      ),
    );

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.completedPhases).toEqual(['intro']);

    await act(async () => {
      const r = await result.current.complete();
      expect(r.ok).toBe(true);
    });
    expect(result.current.completedPhases).toContain('design');
    expect(result.current.currentPhase?.id).toBe('design');

    await act(async () => {
      await result.current.advance({ trigger: 'user' });
    });
    expect(result.current.currentPhase?.id).toBe('pitch');

    // Verify the wire order: complete (trigger: agent) then advance
    // (trigger: user), each its own POST.
    const completeCall = fetchMock.mock.calls[1];
    const advanceCall = fetchMock.mock.calls[2];
    expect(JSON.parse(completeCall[1].body as string)).toEqual({
      op: { kind: 'complete' },
      trigger: 'agent',
    });
    expect(JSON.parse(advanceCall[1].body as string)).toEqual({
      op: { kind: 'advance' },
      trigger: 'user',
    });
  });

  it('complete() POSTs op: { kind: "complete" } with trigger: agent', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeTransitionResponse({
          currentPhase: 'intro',
          completedPhases: ['intro'],
          systemMessage: null,
        }),
      ),
    );

    const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.complete();
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/workflow-phases/transition');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ op: { kind: 'complete' }, trigger: 'agent' });
  });

  it('complete() with empty sessionId returns ok: false and does not update completedPhases', async () => {
    // Simulate the early-mount window where sessionId hasn't been seeded yet.
    // postTransition should bail out early (no fetch, or non-ok response) and
    // complete() should return { ok: false } without mutating completedPhases.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'missing session' }, { status: 400 }),
    );

    const { result } = renderHook(() => useWorkflowPhase(), {
      wrapper: wrap({ sessionId: '' }),
    });

    // Provider skips hydration fetch when sessionId is empty — isLoading stays
    // true, but we can still invoke complete() to test the guard.
    let opResult: { ok: boolean } | undefined;
    await act(async () => {
      opResult = await result.current.complete();
    });

    expect(opResult?.ok).toBe(false);
    expect(result.current.completedPhases).toEqual([]);
  });

  // ── markObjective ─────────────────────────────────────────────────────────
  // Reintroduced when the agent-facing `workflowPhase markObjective` action
  // came back as documentation + telemetry (no per-objective gating). The
  // browser realtime path uses this callback to record objective marks; the
  // server transition route owns validation (unknown id, missing phase, etc.).
  it('exposes `markObjective` and POSTs a markObjective transition', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...makeTransitionResponse({ currentPhase: 'intro' }),
        newState: {
          currentPhase: 'intro',
          furthestPhase: 'intro',
          visited: ['intro'],
          completedPhases: [],
          completedObjectives: { intro: ['o1'] },
          snapshots: {},
        },
      }),
    );

    const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let opResult: { ok: boolean } | undefined;
    await act(async () => {
      opResult = await result.current.markObjective('o1', { note: 'covered' });
    });
    expect(opResult?.ok).toBe(true);

    const [, init] = fetchMock.mock.calls[1];
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      op: { kind: 'markObjective', id: 'o1', note: 'covered' },
      trigger: 'agent',
    });

    expect(result.current.completedObjectives).toEqual({ intro: ['o1'] });
  });

  it('omits `note` from the markObjective op when not provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(makeTransitionResponse({ currentPhase: 'intro' })),
    );

    const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markObjective('o1');
    });

    const [, init] = fetchMock.mock.calls[1];
    const body = JSON.parse(init?.body as string);
    expect(body.op).toEqual({ kind: 'markObjective', id: 'o1' });
  });

  it('surfaces server error messages from markObjective', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Cannot markObjective: objective "x" is not declared on phase "intro".',
      }),
    } as Response);

    const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let opResult: { ok: boolean; message?: string } | undefined;
    await act(async () => {
      opResult = await result.current.markObjective('x');
    });
    expect(opResult?.ok).toBe(false);
    expect(opResult?.message).toMatch(/objective "x" is not declared/);
  });

  // The server's `/api/workflow-phases/transition` route returns a 4xx with
  // `{ error: <human-readable message> }` for every transition rule it
  // refuses (last-phase-with-no-override, unknown phase, session-not-found,
  // backward jump, etc.). The agent can only self-correct (e.g., "call
  // finishExperience instead of nextPhase on the last phase") if the
  // provider surfaces that string verbatim instead of swallowing it into a
  // generic placeholder.
  describe('server error propagation', () => {
    const NO_NEXT_PHASE_ERROR =
      'Cannot advance: "review" is the last phase and no nextPhaseOverride is set. ' +
      'The agent should call finishExperience.';

    it('nextPhase() forwards the server\'s 400 error verbatim instead of "transition failed"', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: NO_NEXT_PHASE_ERROR }, { status: 400 }),
      );

      const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let opResult: { ok: boolean; message?: string } | undefined;
      await act(async () => {
        opResult = await result.current.nextPhase();
      });

      expect(opResult).toEqual({ ok: false, message: NO_NEXT_PHASE_ERROR });
    });

    it('complete() forwards the server\'s 400 error verbatim', async () => {
      const COMPLETE_ERROR =
        'Cannot complete: no current phase in state.';
      fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: COMPLETE_ERROR }, { status: 400 }),
      );

      const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let opResult: { ok: boolean; message?: string } | undefined;
      await act(async () => {
        opResult = await result.current.complete();
      });

      expect(opResult).toEqual({ ok: false, message: COMPLETE_ERROR });
    });

    it('setPhase() forwards the server\'s 400 error (backward jump rejected)', async () => {
      const BACKWARD_JUMP_ERROR =
        'set requires a forward target; "intro" is not after current phase "design".';
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          makeStateResponse({ currentPhase: 'design', visited: ['intro', 'design'] }),
        ),
      );
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: BACKWARD_JUMP_ERROR }, { status: 400 }),
      );

      const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let opResult: { ok: boolean; message?: string } | undefined;
      await act(async () => {
        opResult = await result.current.setPhase('intro');
      });

      expect(opResult).toEqual({ ok: false, message: BACKWARD_JUMP_ERROR });
    });

    it('setNext() forwards the server\'s 400 error', async () => {
      const SET_NEXT_ERROR =
        'setNext requires a forward target; "intro" is before current phase "design".';
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          makeStateResponse({ currentPhase: 'design', visited: ['intro', 'design'] }),
        ),
      );
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: SET_NEXT_ERROR }, { status: 400 }),
      );

      const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let opResult: { ok: boolean; message?: string } | undefined;
      await act(async () => {
        opResult = await result.current.setNext('intro');
      });

      expect(opResult).toEqual({ ok: false, message: SET_NEXT_ERROR });
    });

    it('finishExperience() forwards the server\'s 4xx error', async () => {
      const FINISH_ERROR = 'Cannot finishExperience: workflow already completed.';
      fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: FINISH_ERROR }, { status: 400 }),
      );

      const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let opResult: { ok: boolean; message?: string } | undefined;
      await act(async () => {
        opResult = await result.current.finishExperience('done');
      });

      expect(opResult).toEqual({ ok: false, message: FINISH_ERROR });
    });

    it('falls back to the HTTP status when the response body is not parseable JSON', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      } as unknown as Response);

      const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let opResult: { ok: boolean; message?: string } | undefined;
      await act(async () => {
        opResult = await result.current.nextPhase();
      });

      expect(opResult?.ok).toBe(false);
      expect(opResult?.message).toBe('transition failed: HTTP 500');
    });

    it('falls back to the HTTP status when the body is JSON but missing the `error` field', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(makeStateResponse()));
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ unrelated: 'shape' }, { status: 400 }),
      );

      const { result } = renderHook(() => useWorkflowPhase(), { wrapper: wrap() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let opResult: { ok: boolean; message?: string } | undefined;
      await act(async () => {
        opResult = await result.current.nextPhase();
      });

      expect(opResult?.ok).toBe(false);
      expect(opResult?.message).toBe('transition failed: HTTP 400');
    });

    it('surfaces a "no active session" message when sessionId is empty', async () => {
      // Provider skips the hydration fetch entirely on empty sessionId, so
      // the only mocked response we need is the (never-reached) transition
      // POST. We still drive nextPhase() to confirm the early-return path
      // produces a non-generic message the agent can act on.
      const { result } = renderHook(() => useWorkflowPhase(), {
        wrapper: wrap({ sessionId: '' }),
      });

      let opResult: { ok: boolean; message?: string } | undefined;
      await act(async () => {
        opResult = await result.current.nextPhase();
      });

      expect(opResult?.ok).toBe(false);
      expect(opResult?.message).toMatch(/no active session/i);
      // No transition POST should have happened.
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('WorkflowPhaseContext — completedObjectives', () => {
    beforeEach(() => {
      (global as any).fetch = jest.fn(async (input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/workflow-phases/state')) {
          return jsonResponse(
            makeStateResponse({
              currentPhase: 'design',
              visited: ['intro', 'design'],
              completedPhases: ['intro'],
              completedObjectives: { intro: ['obj_x'], design: ['obj_y'] },
            } as any),
          );
        }
        return jsonResponse({ error: `unexpected url ${url}` }, { status: 500 });
      });
    });

    test('exposes completedObjectives from server state', async () => {
      const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <WorkflowPhaseProvider
          phases={PHASES}
          experienceId="exp"
          sessionId="sid"
        >
          {children}
        </WorkflowPhaseProvider>
      );

      const { result } = renderHook(() => useWorkflowPhase(), { wrapper });

      await waitFor(() => {
        expect(result.current.completedObjectives).toEqual({
          intro: ['obj_x'],
          design: ['obj_y'],
        });
      });
    });

    test('empty value (no phases) has empty completedObjectives object', () => {
      const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <WorkflowPhaseProvider phases={[]} experienceId="exp" sessionId="sid">
          {children}
        </WorkflowPhaseProvider>
      );
      const { result } = renderHook(() => useWorkflowPhase(), { wrapper });
      expect(result.current.completedObjectives).toEqual({});
    });
  });
});
