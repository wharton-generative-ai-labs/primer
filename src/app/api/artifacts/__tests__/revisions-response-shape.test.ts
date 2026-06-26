/**
 * @jest-environment node
 *
 * Contract tests pinning the on-the-wire shape of `revisions` on every
 * artifact API endpoint that inlines it.
 *
 * Background: `listArtifactRevisions` returns
 * `{ revisions, currentRev } | null`. If a route forwards that whole object
 * into the response under the `revisions` key, the frontend stuffs it into
 * `revisionsByArtifact[id]` and then `VersionSwitcher` crashes the moment
 * it tries to call `.find` / `.map` on the wrapper. The bootstrap path
 * (ArtifactContext.fetchArtifactsListFromApi) silently drops the field
 * because it guards with `Array.isArray`, hiding the same bug on the list
 * route.
 *
 * These tests mock the storage layer to return the wrapped shape and
 * assert each route's JSON has `revisions` as a flat array. If a future
 * change starts returning the wrapper again, the test fails before any UI
 * code crashes.
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/getCachedSession', () => ({
  getCachedSession: jest.fn(async () => ({
    user: { email: 'u@x', name: 'User' },
  })),
}));

jest.mock('@/lib/devAuth', () => ({
  getEffectiveUserEmail: (email: string | undefined | null) => email ?? null,
}));

jest.mock('@/app/lib/file-utils', () => ({
  getExperienceArtifactsFolder: jest.fn(async () => '/tmp/mock-artifacts'),
  getSessionMetadataFilePath: jest.fn(async () => '/tmp/mock-artifacts/session.json'),
  SessionMetadata: undefined,
}));

jest.mock('@/app/lib/artifacts/storage', () => ({
  createArtifact: jest.fn(),
  updateArtifact: jest.fn(),
  restoreArtifactRevision: jest.fn(),
  listArtifactRevisions: jest.fn(),
  normalizeArtifactRecord: (rec: any) => ({ ...rec, currentRev: rec.currentRev ?? 1 }),
}));

jest.mock('@/app/lib/artifacts/parseAuthor', () => ({
  parseArtifactAuthorFromRequest: () => ({ kind: 'user', email: 'u@x', name: 'User' }),
}));

jest.mock('fs/promises', () => ({
  __esModule: true,
  default: {
    mkdir: jest.fn(async () => {}),
    readdir: jest.fn(async () => ['my_first_document.json']),
    readFile: jest.fn(),
    writeFile: jest.fn(async () => {}),
    access: jest.fn(async () => {}),
    rename: jest.fn(async () => {}),
    unlink: jest.fn(async () => {}),
  },
  mkdir: jest.fn(async () => {}),
  readdir: jest.fn(async () => ['my_first_document.json']),
  readFile: jest.fn(),
  writeFile: jest.fn(async () => {}),
  access: jest.fn(async () => {}),
  rename: jest.fn(async () => {}),
  unlink: jest.fn(async () => {}),
}));

import {
  createArtifact as mockCreateArtifact,
  updateArtifact as mockUpdateArtifact,
  restoreArtifactRevision as mockRestoreArtifactRevision,
  listArtifactRevisions as mockListArtifactRevisions,
} from '@/app/lib/artifacts/storage';
import fs from 'fs/promises';

const mockCreate = mockCreateArtifact as jest.Mock;
const mockUpdate = mockUpdateArtifact as jest.Mock;
const mockRestore = mockRestoreArtifactRevision as jest.Mock;
const mockListRevs = mockListArtifactRevisions as jest.Mock;
const mockReadFile = fs.readFile as unknown as jest.Mock;

const HEAD = {
  id: 'my_first_document',
  name: 'My First Document',
  type: 'markdown',
  filename: 'my_first_document.md',
  createdAt: '2026-04-28T12:00:00.000Z',
  updatedAt: '2026-04-28T12:01:00.000Z',
  currentRev: 2,
  lastAuthor: { kind: 'agent', agentKey: 'hal', name: 'HAL' },
};

// listArtifactRevisions's real return type — the wrapper that the routes
// MUST unwrap before responding. Mocking with this exact shape is what
// makes these tests load-bearing: a regression that re-introduces the
// wrapper on the wire fails here instead of in the browser.
const LISTED = {
  currentRev: 2,
  revisions: [
    {
      rev: 1,
      artifactId: 'my_first_document',
      contentHash: 'h1',
      author: { kind: 'user', email: 'u@x', name: 'User' },
      parentRev: null,
      createdAt: '2026-04-28T12:00:00.000Z',
    },
    {
      rev: 2,
      artifactId: 'my_first_document',
      contentHash: 'h2',
      author: { kind: 'agent', agentKey: 'hal', name: 'HAL' },
      parentRev: 1,
      createdAt: '2026-04-28T12:01:00.000Z',
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListRevs.mockResolvedValue(LISTED);
  mockReadFile.mockImplementation(async (p: unknown) => {
    const s = String(p);
    if (s.endsWith('my_first_document.json')) {
      return JSON.stringify({
        id: 'my_first_document',
        name: 'My First Document',
        type: 'markdown',
        filename: 'my_first_document.md',
        createdAt: '1',
        updatedAt: '1',
        currentRev: 2,
      });
    }
    return '';
  });
});

function authedJsonReq(url: string, init: RequestInit = {}) {
  return new NextRequest(url, {
    ...init,
    headers: {
      'x-experience-id': 'hal-test-stub',
      'x-session-id': 'sess_test',
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

describe('artifact API revisions response shape', () => {
  it('GET /api/artifacts/list?expand=revisions returns revisions as a flat array on each item', async () => {
    const { GET } = await import('@/app/api/artifacts/list/route');
    const req = authedJsonReq(
      'http://localhost/api/artifacts/list?expand=revisions',
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    // The bug we're guarding against: revisions arriving as
    // { revisions: [...], currentRev: N } would silently fail
    // ArtifactContext's Array.isArray check, which is why the LibraryView
    // would render empty even though the API "returned" data.
    expect(Array.isArray(body[0].revisions)).toBe(true);
    expect(body[0].revisions).toHaveLength(2);
    expect(body[0].revisions[0]).toMatchObject({ rev: 1 });
  });

  it('POST /api/artifacts/create returns revisions as a flat array', async () => {
    mockCreate.mockResolvedValue({ artifact: HEAD });
    const { POST } = await import('@/app/api/artifacts/create/route');

    const req = authedJsonReq('http://localhost/api/artifacts/create', {
      method: 'POST',
      body: JSON.stringify({ name: 'My First Document', content: '# hi' }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.revisions)).toBe(true);
    expect(body.revisions[0]).toMatchObject({ rev: 1 });
  });

  it('POST /api/artifacts/[id]/update returns revisions as a flat array', async () => {
    mockUpdate.mockResolvedValue({
      artifact: HEAD,
      content: '# v2',
      noop: false,
    });
    const { POST } = await import('@/app/api/artifacts/[id]/update/route');

    const req = authedJsonReq(
      'http://localhost/api/artifacts/my_first_document/update',
      {
        method: 'POST',
        body: JSON.stringify({ content: '# v2' }),
      },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: 'my_first_document' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    // This is the exact shape that, when broken, crashed the production
    // VersionSwitcher with "revisions.find is not a function".
    expect(Array.isArray(body.revisions)).toBe(true);
    expect(body.revisions).toHaveLength(2);
    expect(body.revisions[1]).toMatchObject({ rev: 2 });
  });

  it('POST /api/artifacts/[id]/update skips revisions on noop', async () => {
    mockUpdate.mockResolvedValue({
      artifact: HEAD,
      content: '# v1',
      noop: true,
    });
    const { POST } = await import('@/app/api/artifacts/[id]/update/route');

    const req = authedJsonReq(
      'http://localhost/api/artifacts/my_first_document/update',
      {
        method: 'POST',
        body: JSON.stringify({ content: '# v1' }),
      },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: 'my_first_document' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.noop).toBe(true);
    // Noop responses don't refetch revisions — the client's cache is
    // already consistent with what it had before the call.
    expect(body.revisions).toBeUndefined();
    expect(mockListRevs).not.toHaveBeenCalled();
  });

  it('POST /api/artifacts/[id]/revisions (restore) returns revisions as a flat array', async () => {
    mockRestore.mockResolvedValue({
      artifact: HEAD,
      content: '# v1 restored',
    });
    const { POST } = await import('@/app/api/artifacts/[id]/revisions/route');

    const req = authedJsonReq(
      'http://localhost/api/artifacts/my_first_document/revisions',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'restore', rev: 1 }),
      },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: 'my_first_document' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.revisions)).toBe(true);
    expect(body.revisions).toHaveLength(2);
  });
});
