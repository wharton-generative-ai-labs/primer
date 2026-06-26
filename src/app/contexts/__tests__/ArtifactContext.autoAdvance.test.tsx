/**
 * @jest-environment jsdom
 *
 * End-to-end "agent edits → my UI auto-advances" pipeline.
 *
 * Backend wrapper coverage (`backend-agent-socket-emit.test.ts`) proves the
 * server fires `artifact.changed` with the right payload. SocketController
 * dispatches that as a `primer:artifact-changed` window event. This test
 * picks up there and asserts:
 *
 *   1. `mergeArtifactUpdate` runs, advancing `currentRev` and the artifact's
 *      `lastAuthor`.
 *   2. The freshly-merged `revisions` list survives — the auto-advance
 *      watch-effect must not evict the data we just placed (the cache
 *      eviction was a holdover from the pre-eager-revisions design).
 *   3. `viewState[id].focusedRev` advances when the user was on the
 *      previous head ("Updated" banner case).
 *   4. `viewState[id].focusedRev` stays put when the user is browsing a
 *      historical rev ("Historical" banner case — agent edit must not yank
 *      the user back to the latest).
 *
 * Together these guarantee the chain "agent edit → banner cycles + switcher
 * grows + library tile picks up the new row" works without a manual refresh.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ArtifactRevisionMeta } from '@/app/lib/artifacts/types';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated' })),
}));

jest.mock('@/app/contexts/ClientEventContext', () => ({
  useClientEvent: () => ({ sendClientEvent: jest.fn() }),
}));

jest.mock('@/app/hooks/useExperienceUrl', () => ({
  useExperienceUrl: () => ({ getExperienceId: () => 'exp_test' }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

import { ArtifactProvider, useArtifact } from '../ArtifactContext';

function rev(n: number, authorName: string, msAgo = 1000 * n): ArtifactRevisionMeta {
  return {
    rev: n,
    artifactId: 'art1',
    contentHash: `h-${n}`,
    author: { kind: 'agent', agentKey: authorName.toLowerCase(), name: authorName },
    parentRev: n === 1 ? null : n - 1,
    createdAt: new Date(Date.now() - msAgo).toISOString(),
  };
}

function dispatchArtifactChanged(detail: {
  artifactId: string;
  artifact: any;
  revisions?: ArtifactRevisionMeta[];
}) {
  window.dispatchEvent(new CustomEvent('primer:artifact-changed', { detail }));
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <ArtifactProvider>{children}</ArtifactProvider>;
}

beforeEach(() => {
  // Without a session id `updateArtifact` short-circuits with "No active
  // session" and never reaches the API path we want to exercise.
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('primer:session-id', 'sess_autoadvance_test');
  }
});

describe('ArtifactContext auto-advance on backend agent write', () => {
  it('merges agent-emitted update and advances focusedRev when user was on the latest', async () => {
    const { result } = renderHook(() => useArtifact(), { wrapper });

    // Seed: artifact at rev 1, user implicitly on rev 1 (the seed effect
    // runs after the first commit and points focusedRev at currentRev).
    act(() => {
      dispatchArtifactChanged({
        artifactId: 'art1',
        artifact: {
          id: 'art1',
          name: 'Demo',
          content: 'v1',
          type: 'markdown',
          createdAt: '1',
          updatedAt: '1',
          currentRev: 1,
          lastAuthor: { kind: 'agent', agentKey: 'hal', name: 'HAL' },
        },
        revisions: [rev(1, 'HAL')],
      });
    });

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(1);
      expect(result.current.viewState['art1']?.focusedRev).toBe(1);
    });

    // Agent edit lands. New currentRev=2; revisions list grows.
    act(() => {
      dispatchArtifactChanged({
        artifactId: 'art1',
        artifact: {
          id: 'art1',
          name: 'Demo',
          content: 'v2',
          type: 'markdown',
          createdAt: '1',
          updatedAt: '2',
          currentRev: 2,
          lastAuthor: { kind: 'agent', agentKey: 'hal', name: 'HAL' },
        },
        revisions: [rev(1, 'HAL'), rev(2, 'HAL')],
      });
    });

    // `currentRev` bumps, focusedRev follows because the user was on the
    // previous head — this is the "Updated" banner case.
    await waitFor(() => {
      const a = result.current.artifacts.find((x) => x.id === 'art1');
      expect(a?.currentRev).toBe(2);
      expect(result.current.viewState['art1']?.focusedRev).toBe(2);
    });

    // Critical: the revisions list we just merged must NOT have been wiped
    // by the auto-advance watch-effect. Without this guarantee, the
    // VersionSwitcher dropdown loses its data on every agent edit and the
    // LibraryView's per-doc rev rows briefly disappear.
    expect(result.current.revisionsByArtifact['art1']).toEqual([
      expect.objectContaining({ rev: 1 }),
      expect.objectContaining({ rev: 2 }),
    ]);
  });

  it('does not advance focusedRev when the user is browsing a historical rev', async () => {
    const { result } = renderHook(() => useArtifact(), { wrapper });

    // Seed at rev 2, then snap focused back to rev 1 (the user is reading
    // the older version).
    act(() => {
      dispatchArtifactChanged({
        artifactId: 'art1',
        artifact: {
          id: 'art1',
          name: 'Demo',
          content: 'v2',
          type: 'markdown',
          createdAt: '1',
          updatedAt: '2',
          currentRev: 2,
          lastAuthor: { kind: 'agent', agentKey: 'hal', name: 'HAL' },
        },
        revisions: [rev(1, 'HAL'), rev(2, 'HAL')],
      });
    });
    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(1);
    });

    act(() => {
      result.current.setFocusedRev('art1', 1);
    });
    await waitFor(() => {
      expect(result.current.viewState['art1']?.focusedRev).toBe(1);
    });

    // Agent ships rev 3 while the user is parked on rev 1.
    act(() => {
      dispatchArtifactChanged({
        artifactId: 'art1',
        artifact: {
          id: 'art1',
          name: 'Demo',
          content: 'v3',
          type: 'markdown',
          createdAt: '1',
          updatedAt: '3',
          currentRev: 3,
          lastAuthor: { kind: 'agent', agentKey: 'hal', name: 'HAL' },
        },
        revisions: [rev(1, 'HAL'), rev(2, 'HAL'), rev(3, 'HAL')],
      });
    });

    await waitFor(() => {
      const a = result.current.artifacts.find((x) => x.id === 'art1');
      expect(a?.currentRev).toBe(3);
    });

    // Historical-banner case: user picked a past rev, so the agent's edit
    // must NOT yank the viewport back to the latest. The Restore button on
    // the banner is the only way out.
    expect(result.current.viewState['art1']?.focusedRev).toBe(1);

    // Same eviction-survival check: dropdown still has all 3 rows.
    expect(result.current.revisionsByArtifact['art1']).toHaveLength(3);
  });

  it('advances focusedRev after a realtime-agent edit (API response path)', async () => {
    // The realtime agent's `artifact.edit` tool ends up calling
    // `useArtifact().updateArtifact(id, content)`, which POSTs to
    // /api/artifacts/{id}/update and merges the response. This test pins
    // that path so a regression in either the API contract or the merge
    // sequence is caught before users see the symptom of "doc panel keeps
    // fetching /revisions/1 even after the agent edited."
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    try {
      const headRev1 = {
        id: 'my_first_document',
        name: 'My First Document',
        type: 'markdown',
        createdAt: '1',
        updatedAt: '1',
        currentRev: 1,
        content: '# v1',
        lastAuthor: { kind: 'user', email: 'u@x', name: 'User' },
      };

      const headRev2 = {
        id: 'my_first_document',
        name: 'My First Document',
        type: 'markdown',
        createdAt: '1',
        updatedAt: '2',
        currentRev: 2,
        content: '# v2 from agent',
        lastAuthor: { kind: 'agent', agentKey: 'hal', name: 'HAL' },
      };

      // The realtime agent's update flow returns the new head + revisions.
      // Mirror the contract from /api/artifacts/[id]/update/route.ts.
      fetchMock.mockImplementation((url: string | Request) => {
        const u = typeof url === 'string' ? url : url.url;
        if (u.endsWith('/api/artifacts/my_first_document/update')) {
          return Promise.resolve({
            ok: true,
            statusText: 'OK',
            json: async () => ({
              ...headRev2,
              revisions: [rev(1, 'User'), rev(2, 'HAL')],
            }),
          });
        }
        return Promise.resolve({ ok: false, statusText: 'not mocked' });
      });

      const { result } = renderHook(() => useArtifact(), { wrapper });

      // Seed via the same socket path real sessions use at bootstrap.
      act(() => {
        dispatchArtifactChanged({
          artifactId: 'my_first_document',
          artifact: headRev1,
          revisions: [rev(1, 'User')],
        });
      });
      await waitFor(() => {
        expect(result.current.viewState['my_first_document']?.focusedRev).toBe(1);
      });

      // Realtime agent fires edit → API → mergeArtifactUpdate.
      await act(async () => {
        await result.current.updateArtifact('my_first_document', '# v2 from agent');
      });

      await waitFor(() => {
        const a = result.current.artifacts.find((x) => x.id === 'my_first_document');
        expect(a?.currentRev).toBe(2);
        // The fix for "URL keeps fetching /revisions/1": focusedRev must
        // advance with the head when the user was on the latest. Without
        // this, DocumentContentWithRevisions sees focusedRev (1) <
        // currentRev (2) and refetches the stale rev-1 content forever.
        expect(result.current.viewState['my_first_document']?.focusedRev).toBe(2);
      });

      expect(result.current.revisionsByArtifact['my_first_document']).toHaveLength(2);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('still auto-advances after the user clicks the LATEST rev in the Library', async () => {
    // Reproduces the "I clicked Version N (the head) in the Library, then
    // asked the agent to edit, and the doc panel kept fetching
    // /revisions/N" symptom report. setFocusedRev(id, current) before an
    // edit must NOT trip the historical-rev gate — the gate is keyed on
    // "user was on the previous head", which is still true here.
    const { result } = renderHook(() => useArtifact(), { wrapper });

    act(() => {
      dispatchArtifactChanged({
        artifactId: 'art1',
        artifact: {
          id: 'art1',
          name: 'Demo',
          content: 'v1',
          type: 'markdown',
          createdAt: '1',
          updatedAt: '1',
          currentRev: 1,
          lastAuthor: { kind: 'user', email: 'u@x', name: 'User' },
        },
        revisions: [rev(1, 'User')],
      });
    });
    await waitFor(() => {
      expect(result.current.viewState['art1']?.focusedRev).toBe(1);
    });

    // User clicks "Version 1" in the LibraryView while it IS the head.
    act(() => {
      result.current.setFocusedRev('art1', 1);
    });

    // Agent edit fires next. Auto-advance should still kick in because the
    // user was on the latest at the time of the bump (1 → 2, foc was 1).
    act(() => {
      dispatchArtifactChanged({
        artifactId: 'art1',
        artifact: {
          id: 'art1',
          name: 'Demo',
          content: 'v2',
          type: 'markdown',
          createdAt: '1',
          updatedAt: '2',
          currentRev: 2,
          lastAuthor: { kind: 'agent', agentKey: 'hal', name: 'HAL' },
        },
        revisions: [rev(1, 'User'), rev(2, 'HAL')],
      });
    });

    await waitFor(() => {
      const a = result.current.artifacts.find((x) => x.id === 'art1');
      expect(a?.currentRev).toBe(2);
      expect(result.current.viewState['art1']?.focusedRev).toBe(2);
    });
  });

  it('removes the artifact entirely when an artifact.deleted event arrives', async () => {
    const { result } = renderHook(() => useArtifact(), { wrapper });

    act(() => {
      dispatchArtifactChanged({
        artifactId: 'art1',
        artifact: {
          id: 'art1',
          name: 'Doomed',
          content: 'v1',
          type: 'markdown',
          createdAt: '1',
          updatedAt: '1',
          currentRev: 1,
          lastAuthor: { kind: 'agent', agentKey: 'hal', name: 'HAL' },
        },
        revisions: [rev(1, 'HAL')],
      });
    });
    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(1);
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('primer:artifact-deleted', {
          detail: { artifactId: 'art1' },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(0);
      expect(result.current.viewState['art1']).toBeUndefined();
      expect(result.current.revisionsByArtifact['art1']).toBeUndefined();
    });
  });
});
