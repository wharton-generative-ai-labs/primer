/**
 * Integration tests for GET /api/workflow-phases/state.
 *
 * Backed by a real temp dir so the read path exercises the same disk lookup
 * the route uses in production.
 *
 * @jest-environment node
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

let tempRoot: string;

beforeAll(async () => {
  tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), 'workflow-phases-state-route-'),
  );
  process.env.STORAGE_ROOT_PATH = tempRoot;
});

afterAll(async () => {
  delete process.env.STORAGE_ROOT_PATH;
  await fs.rm(tempRoot, { recursive: true, force: true });
});

import {
  getExperienceFolder,
  getSessionMetadataFilePath,
  type SessionMetadata,
} from '@/app/lib/file-utils';
import type { ExperienceConfig } from '@/app/lib/types';

import { GET } from '../route';

interface SeedOptions {
  experienceId: string;
  phases?: { id: string; title: string }[];
  initialAgent?: string;
}

async function seedExperience({
  experienceId,
  phases,
  initialAgent = 'tutor',
}: SeedOptions): Promise<void> {
  const folder = await getExperienceFolder(experienceId);
  await fs.mkdir(folder, { recursive: true });

  const config: ExperienceConfig = {
    version: '1.0',
    title: 'Test Experience',
    description: 'Test',
    initialAgent,
    aiConfigurations: {},
    resources: {
      scenes: [],
      sounds: [],
      instructions: { agent: {}, supplemental: {} },
    },
    agents: {
      [initialAgent]: {
        name: 'Tutor',
        publicDescription: 'Test',
        downstreamAgents: [],
      },
    },
    ...(phases ? { workflowPhases: phases } : {}),
  };

  await fs.writeFile(
    path.join(folder, 'experience.json'),
    JSON.stringify(config, null, 2),
  );
}

async function seedSession(
  experienceId: string,
  sessionId: string,
  overrides: Partial<SessionMetadata> = {},
): Promise<void> {
  const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  const metadata: SessionMetadata = {
    sessionId,
    experienceId,
    startTime: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    events: [],
    ...overrides,
  };
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

function makeRequest(
  experienceId: string | null,
  sessionId: string | null,
): NextRequest {
  const headers: Record<string, string> = {};
  if (experienceId) headers['x-experience-id'] = experienceId;
  if (sessionId) headers['x-session-id'] = sessionId;
  return new NextRequest('http://localhost:3000/api/workflow-phases/state', {
    method: 'GET',
    headers,
  });
}

describe('GET /api/workflow-phases/state', () => {
  it('returns 400 when x-experience-id header is missing', async () => {
    const req = makeRequest(null, 'sess-1');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when x-session-id header is missing', async () => {
    const req = makeRequest('exp-1', null);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns the full shape with phases, state, and completion flag', async () => {
    const experienceId = 'exp-state-full';
    const sessionId = 'sess-state-full';
    const phases = [
      { id: 'intro', title: 'Intro' },
      { id: 'design', title: 'Design' },
    ];
    await seedExperience({ experienceId, phases });
    await seedSession(experienceId, sessionId, {
      workflowPhaseState: {
        currentPhase: 'design',
        furthestPhase: 'design',
        visited: ['intro', 'design'],
        completedPhases: ['intro'],
        snapshots: {},
      },
      experienceCompleted: false,
    });

    const req = makeRequest(experienceId, sessionId);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toEqual({
      workflowPhaseState: {
        currentPhase: 'design',
        furthestPhase: 'design',
        visited: ['intro', 'design'],
        completedPhases: ['intro'],
        snapshots: {},
      },
      experienceCompleted: false,
      workflowPhases: phases,
    });
  });

  it('returns nulls and an empty phase list when the experience has no phases', async () => {
    const experienceId = 'exp-state-no-phases';
    const sessionId = 'sess-state-no-phases';
    await seedExperience({ experienceId }); // no phases
    await seedSession(experienceId, sessionId);

    const req = makeRequest(experienceId, sessionId);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toEqual({
      workflowPhaseState: null,
      experienceCompleted: false,
      workflowPhases: [],
    });
  });

  it('returns 404 when the session metadata file is missing', async () => {
    const experienceId = 'exp-state-missing-session';
    await seedExperience({
      experienceId,
      phases: [{ id: 'intro', title: 'Intro' }],
    });

    const req = makeRequest(experienceId, 'sess-does-not-exist');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('reflects experienceCompleted = true when persisted', async () => {
    const experienceId = 'exp-state-completed';
    const sessionId = 'sess-state-completed';
    await seedExperience({
      experienceId,
      phases: [
        { id: 'intro', title: 'Intro' },
        { id: 'design', title: 'Design' },
      ],
    });
    await seedSession(experienceId, sessionId, {
      workflowPhaseState: {
        currentPhase: 'design',
        furthestPhase: 'design',
        visited: ['intro', 'design'],
        completedPhases: ['intro', 'design'],
        snapshots: {},
      },
      experienceCompleted: true,
    });

    const req = makeRequest(experienceId, sessionId);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.experienceCompleted).toBe(true);
  });
});
