/**
 * @jest-environment node
 */

import fs from 'fs/promises';
import { GET, PUT } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/getCachedSession', () => ({
  getCachedSession: jest.fn(),
}));

jest.mock('@/lib/devAuth', () => ({
  getEffectiveUserEmail: (email: string | undefined | null) => email ?? null,
}));

jest.mock('@/app/lib/file-utils', () => ({
  getSessionMetadataFilePath: jest.fn(async () => '/tmp/mock/session.json'),
  getSessionPanelStateFilePath: jest.fn(async () => '/tmp/mock/panel-state.json'),
}));

const mockGetCachedSession = jest.requireMock('@/lib/getCachedSession').getCachedSession as jest.Mock;

describe('/api/sessions/[id]/panel-state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCachedSession.mockResolvedValue({
      user: { email: 'owner@test.edu', name: 'Owner' },
    });
  });

  it('GET returns 401 when unauthenticated', async () => {
    mockGetCachedSession.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/sessions/sess_x/panel-state', {
      headers: { 'x-experience-id': 'exp12345678901' },
    });
    const res = await GET(req, { params: Promise.resolve({ id: 'sess_x' }) });
    expect(res.status).toBe(401);
  });

  it('GET returns 403 when session metadata owner differs', async () => {
    jest.spyOn(fs, 'readFile').mockImplementation(async (p: unknown) => {
      const pathStr = String(p);
      if (pathStr.includes('session.json')) {
        return JSON.stringify({
          sessionId: 'sess_own',
          experienceId: 'exp12345678901',
          startTime: new Date().toISOString(),
          userEmail: 'someone.else@test.edu',
          events: [],
        });
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    const req = new NextRequest('http://localhost/api/sessions/sess_own/panel-state', {
      headers: { 'x-experience-id': 'exp12345678901' },
    });
    const res = await GET(req, { params: Promise.resolve({ id: 'sess_own' }) });
    expect(res.status).toBe(403);
  });

  it('GET returns panel record when file exists and user owns session', async () => {
    const panelPayload = {
      activeContent: null,
      library: [],
      viewedContentId: null,
      activeChecklistId: null,
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    jest.spyOn(fs, 'readFile').mockImplementation(async (p: unknown) => {
      const pathStr = String(p);
      if (pathStr.includes('session.json')) {
        return JSON.stringify({
          sessionId: 'sess_own',
          experienceId: 'exp12345678901',
          startTime: new Date().toISOString(),
          userEmail: 'owner@test.edu',
          events: [],
        });
      }
      if (pathStr.includes('panel-state.json')) {
        return JSON.stringify(panelPayload);
      }
      throw new Error('unexpected read');
    });

    const req = new NextRequest('http://localhost/api/sessions/sess_own/panel-state', {
      headers: { 'x-experience-id': 'exp12345678901' },
    });
    const res = await GET(req, { params: Promise.resolve({ id: 'sess_own' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updatedAt).toBe(panelPayload.updatedAt);
  });

  it('PUT round-trips valid payload when user owns session', async () => {
    const writes: string[] = [];
    jest.spyOn(fs, 'readFile').mockImplementation(async (p: unknown) => {
      const pathStr = String(p);
      if (pathStr.includes('session.json')) {
        return JSON.stringify({
          sessionId: 'sess_own',
          experienceId: 'exp12345678901',
          startTime: new Date().toISOString(),
          userEmail: 'owner@test.edu',
          events: [],
        });
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(fs, 'writeFile').mockImplementation(async (_p, data) => {
      writes.push(String(data));
    });
    jest.spyOn(fs, 'rename').mockResolvedValue(undefined);
    jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);

    const payload = {
      activeContent: null,
      library: [],
      viewedContentId: null,
      activeChecklistId: null,
      updatedAt: new Date().toISOString(),
    };

    const req = new NextRequest('http://localhost/api/sessions/sess_own/panel-state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-experience-id': 'exp12345678901' },
      body: JSON.stringify(payload),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: 'sess_own' }) });
    expect(res.status).toBe(200);
    expect(writes.length).toBeGreaterThan(0);
    expect(JSON.parse(writes[0])).toMatchObject({ updatedAt: payload.updatedAt });
  });
});
