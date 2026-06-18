/**
 * @jest-environment node
 *
 * Pins that `/api/artifacts/list` inlines the content body for small text
 * artifacts (markdown, json, checklist, …) and stays metadata-only for
 * binary types (png, pdf, zip, …).
 *
 * Background: ResultPhaseSurface — and other tag-based readers — find a
 * tagged artifact in `useArtifact().artifacts` and immediately read
 * `artifact.content`. If the list endpoint returns metadata-only, the read
 * resolves to undefined and the surface stalls in its "Waiting for build…"
 * placeholder forever (or until a separate `getArtifact(id)` fetch fires,
 * which after bootstrap nothing does on its own). Inlining the body for
 * non-binary artifacts on the list response closes that gap; the binary
 * carve-out keeps the response from ballooning with base64-encoded blobs
 * that no list consumer actually reads.
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
  listArtifactRevisions: jest.fn(async () => ({ revisions: [], currentRev: 1 })),
  normalizeArtifactRecord: (rec: any) => ({ ...rec, currentRev: rec.currentRev ?? 1 }),
}));

jest.mock('fs/promises', () => ({
  __esModule: true,
  default: {
    mkdir: jest.fn(async () => {}),
    readdir: jest.fn(),
    readFile: jest.fn(),
  },
  mkdir: jest.fn(async () => {}),
  readdir: jest.fn(),
  readFile: jest.fn(),
}));

import fs from 'fs/promises';

const mockReaddir = fs.readdir as unknown as jest.Mock;
const mockReadFile = fs.readFile as unknown as jest.Mock;

function authedReq(url: string) {
  return new NextRequest(url, {
    headers: {
      'x-experience-id': 'exp_test',
      'x-session-id': 'sess_test',
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/artifacts/list inlines content for non-binary artifacts', () => {
  it('inlines content body for markdown artifacts', async () => {
    mockReaddir.mockResolvedValue(['result_experience_id.json']);
    mockReadFile.mockImplementation(async (p: unknown) => {
      const s = String(p);
      if (s.endsWith('result_experience_id.json')) {
        return JSON.stringify({
          id: 'result_experience_id',
          name: 'Result: Experience ID',
          type: 'markdown',
          filename: 'result_experience_id.md',
          createdAt: '2026-04-28T12:00:00.000Z',
          updatedAt: '2026-04-28T12:01:00.000Z',
          currentRev: 1,
          metadata: { tags: ['result:experience-id'] },
        });
      }
      if (s.endsWith('result_experience_id.md')) {
        // The actual experience id the orchestrator wrote into the
        // tagged artifact — this is what ResultPhaseSurface reads off
        // `artifact.content` to render the Play CTA.
        return 'exp_built_abc123';
      }
      throw new Error(`unexpected read: ${s}`);
    });

    const { GET } = await import('@/app/api/artifacts/list/route');
    const res = await GET(authedReq('http://localhost/api/artifacts/list'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('result_experience_id');
    expect(body[0].content).toBe('exp_built_abc123');
  });

  it('omits content body for binary artifacts (png/pdf/etc)', async () => {
    mockReaddir.mockResolvedValue(['hero_image.json']);
    mockReadFile.mockImplementation(async (p: unknown) => {
      const s = String(p);
      if (s.endsWith('hero_image.json')) {
        return JSON.stringify({
          id: 'hero_image',
          name: 'Hero Image',
          type: 'png',
          filename: 'hero_image.png',
          createdAt: '2026-04-28T12:00:00.000Z',
          updatedAt: '2026-04-28T12:00:00.000Z',
          currentRev: 1,
        });
      }
      throw new Error(
        `binary content should not be read on the list path: ${s}`,
      );
    });

    const { GET } = await import('@/app/api/artifacts/list/route');
    const res = await GET(authedReq('http://localhost/api/artifacts/list'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('hero_image');
    // Binary artifacts deliberately stay metadata-only on the list
    // response — the response would balloon with base64 blobs no list
    // consumer actually reads.
    expect(body[0].content).toBeUndefined();
  });

  it('still returns metadata when an inlined content read fails', async () => {
    // Defense in depth: a missing/unreadable content file for one
    // artifact must not poison the whole list response.
    mockReaddir.mockResolvedValue(['broken.json']);
    mockReadFile.mockImplementation(async (p: unknown) => {
      const s = String(p);
      if (s.endsWith('broken.json')) {
        return JSON.stringify({
          id: 'broken',
          name: 'Broken Doc',
          type: 'markdown',
          filename: 'broken.md',
          createdAt: '2026-04-28T12:00:00.000Z',
          updatedAt: '2026-04-28T12:00:00.000Z',
          currentRev: 1,
        });
      }
      if (s.endsWith('broken.md')) {
        throw new Error('ENOENT');
      }
      throw new Error(`unexpected read: ${s}`);
    });

    const { GET } = await import('@/app/api/artifacts/list/route');
    const res = await GET(authedReq('http://localhost/api/artifacts/list'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('broken');
    // Metadata still flows through; content is just absent.
    expect(body[0].content).toBeUndefined();
  });
});
