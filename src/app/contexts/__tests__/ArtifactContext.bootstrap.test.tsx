/**
 * @jest-environment jsdom
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated' })),
}));

jest.mock('@/app/contexts/ClientEventContext', () => ({
  useClientEvent: () => ({ sendClientEvent: jest.fn() }),
}));

jest.mock('@/app/hooks/useExperienceUrl', () => ({
  useExperienceUrl: () => ({ getExperienceId: () => 'exp_testexperienceid' }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

import { ArtifactProvider, useArtifact } from '../ArtifactContext';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ArtifactProvider bootstrapArtifactsForSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('primer:session-id', 'sess_bootstrap_test');
    }
    mockFetch.mockImplementation((url: string | Request) => {
      const u = typeof url === 'string' ? url : url.url;
      if (u.includes('/api/artifacts/list')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'a1',
              name: 'Doc',
              content: 'hello',
              type: 'markdown',
              createdAt: '1',
              updatedAt: '1',
              revisions: [],
            },
          ],
        });
      }
      if (u.includes('/panel-state')) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      return Promise.resolve({ ok: false, statusText: 'not mocked' });
    });
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return <ArtifactProvider>{children}</ArtifactProvider>;
  }

  it('populates artifacts from list API', async () => {
    const { result } = renderHook(() => useArtifact(), { wrapper });

    await act(async () => {
      const arts = await result.current.bootstrapArtifactsForSession({
        experienceId: 'exp_testexperienceid',
        sessionId: 'sess_bootstrap_test',
      });
      expect(arts).toHaveLength(1);
      expect(arts[0]?.id).toBe('a1');
    });

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(1);
    });

    const listCalls = mockFetch.mock.calls.filter((c) =>
      String(c[0]).includes('/api/artifacts/list'),
    );
    expect(listCalls.length).toBeGreaterThanOrEqual(1);
  });
});
