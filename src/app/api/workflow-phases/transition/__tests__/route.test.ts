/**
 * Integration tests for POST /api/workflow-phases/transition.
 *
 * Each test points the storage root at a temp dir so the route hits real disk
 * through `getSessionMetadataFilePath` + `getExperienceFolder`. That way the
 * `mutateSessionMetadata` lock + atomic write paths remain under test.
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
    path.join(os.tmpdir(), 'workflow-phases-transition-route-'),
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

import { POST } from '../route';

interface SeedOptions {
  experienceId: string;
  phases?: { id: string; title: string }[];
  initialAgent?: string;
  /**
   * Override `initialWorkflowPhase` on disk. Lets a test reproduce the
   * corruption shape (initialWorkflowPhase pointing at an id
   * that no longer exists in the renamed phase list).
   */
  initialWorkflowPhase?: string;
}

async function seedExperience({
  experienceId,
  phases,
  initialAgent = 'tutor',
  initialWorkflowPhase,
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
    ...(initialWorkflowPhase ? { initialWorkflowPhase } : {}),
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

async function readSession(
  experienceId: string,
  sessionId: string,
): Promise<SessionMetadata> {
  const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
  const raw = await fs.readFile(metadataPath, 'utf-8');
  return JSON.parse(raw);
}

function makeRequest(
  experienceId: string | null,
  sessionId: string | null,
  body: unknown,
): NextRequest {
  const headers: Record<string, string> = {};
  if (experienceId) headers['x-experience-id'] = experienceId;
  if (sessionId) headers['x-session-id'] = sessionId;
  return new NextRequest(
    'http://localhost:3000/api/workflow-phases/transition',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
  );
}

describe('POST /api/workflow-phases/transition', () => {
  it('returns 400 when x-experience-id header is missing', async () => {
    const req = makeRequest(null, 'sess-1', { op: { kind: 'init' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Experience ID and Session ID are required/);
  });

  it('returns 400 when x-session-id header is missing', async () => {
    const req = makeRequest('exp-no-session', null, { op: { kind: 'init' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the session metadata file is missing', async () => {
    const experienceId = 'exp-missing-session';
    await seedExperience({
      experienceId,
      phases: [
        { id: 'intro', title: 'Intro' },
        { id: 'design', title: 'Design' },
      ],
    });

    const req = makeRequest(experienceId, 'sess-does-not-exist', {
      op: { kind: 'init' },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 200 with all result fields for a valid init op', async () => {
    const experienceId = 'exp-init';
    const sessionId = 'sess-init';
    await seedExperience({
      experienceId,
      phases: [
        { id: 'intro', title: 'Intro' },
        { id: 'design', title: 'Design' },
      ],
    });
    await seedSession(experienceId, sessionId);

    const req = makeRequest(experienceId, sessionId, {
      op: { kind: 'init' },
      trigger: 'system',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toEqual(
      expect.objectContaining({
        newState: expect.objectContaining({
          currentPhase: 'intro',
          furthestPhase: 'intro',
          visited: ['intro'],
          completedPhases: [],
        }),
        experienceCompleted: false,
        eventsAppended: expect.arrayContaining([
          expect.objectContaining({
            event: 'workflow_phase_entered',
            data: expect.objectContaining({
              phase: 'intro',
              direction: 'initial',
            }),
          }),
        ]),
        systemMessage: expect.any(String),
      }),
    );
    expect(data.systemMessage).not.toBeNull();

    // Verify persisted to disk.
    const persisted = await readSession(experienceId, sessionId);
    expect(persisted.workflowPhaseState?.currentPhase).toBe('intro');
    expect(persisted.experienceCompleted).toBe(false);
    expect(persisted.events.map((e) => e.event)).toContain(
      'workflow_phase_entered',
    );
    expect(persisted.lastActivity).toBeDefined();
  });

  it('defaults trigger to "user" when omitted from the request body', async () => {
    const experienceId = 'exp-default-trigger';
    const sessionId = 'sess-default-trigger';
    await seedExperience({
      experienceId,
      phases: [
        { id: 'intro', title: 'Intro' },
        { id: 'design', title: 'Design' },
      ],
    });
    await seedSession(experienceId, sessionId);

    const req = makeRequest(experienceId, sessionId, { op: { kind: 'init' } });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    const enteredEvent = (
      data.eventsAppended as Array<{ event: string; data: Record<string, unknown> }>
    ).find((e) => e.event === 'workflow_phase_entered');
    expect(enteredEvent?.data.trigger).toBe('user');
  });

  it('adds the current phase to completedPhases on op: complete', async () => {
    const experienceId = 'exp-complete';
    const sessionId = 'sess-complete';
    await seedExperience({
      experienceId,
      phases: [
        { id: 'intro', title: 'Intro' },
        { id: 'design', title: 'Design' },
      ],
    });
    await seedSession(experienceId, sessionId, {
      workflowPhaseState: {
        currentPhase: 'intro',
        furthestPhase: 'intro',
        visited: ['intro'],
        completedPhases: [],
        snapshots: {},
      },
    });

    const req = makeRequest(experienceId, sessionId, {
      op: { kind: 'complete' },
      trigger: 'agent',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.newState.completedPhases).toEqual(['intro']);
    expect(data.systemMessage).toBeNull();
    expect(data.eventsAppended).toEqual([
      expect.objectContaining({
        event: 'phase_completed',
        data: expect.objectContaining({ phase: 'intro', trigger: 'agent' }),
      }),
    ]);

    const persisted = await readSession(experienceId, sessionId);
    expect(persisted.workflowPhaseState?.completedPhases).toEqual(['intro']);
  });

  it('lands navigation events for op: advance after complete', async () => {
    const experienceId = 'exp-advance';
    const sessionId = 'sess-advance';
    await seedExperience({
      experienceId,
      phases: [
        { id: 'intro', title: 'Intro' },
        { id: 'design', title: 'Design' },
      ],
    });
    await seedSession(experienceId, sessionId, {
      workflowPhaseState: {
        currentPhase: 'intro',
        furthestPhase: 'intro',
        visited: ['intro'],
        completedPhases: ['intro'], // already completed via prior `complete` call
        snapshots: {},
      },
    });

    const req = makeRequest(experienceId, sessionId, {
      op: { kind: 'advance' },
      trigger: 'user',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.newState.currentPhase).toBe('design');
    expect(data.newState.visited).toEqual(['intro', 'design']);
    expect(data.experienceCompleted).toBe(false);

    const eventNames = (data.eventsAppended as Array<{ event: string }>).map(
      (e) => e.event,
    );
    // Already completed, so no implicit phase_completed; navigation only.
    expect(eventNames).toEqual([
      'workflow_phase_left',
      'workflow_phase_entered',
    ]);
    expect(data.systemMessage).toEqual(expect.any(String));

    const persisted = await readSession(experienceId, sessionId);
    expect(persisted.workflowPhaseState?.currentPhase).toBe('design');
  });

  // Regression test: the build agent renamed the
  // template's phase ids (`mentor` → `mentor-phase`, …) without updating
  // `initialWorkflowPhase`, which silently corrupted the experience config.
  // The session was then seeded with `currentPhase: 'mentor'` (no validation
  // at seed time), and the first agent-driven `nextPhase` blew up at
  // `loadWorkflowPhases(config)`. Before the fix that error was a plain
  // `Error`, so the route returned a generic 500 with
  // `"Failed to perform workflow-phase transition"` — the agent never saw
  // the actionable message and couldn't self-correct. After the fix the
  // loader throws `InvalidPhaseError`, the route's existing 400 path
  // handles it, and the real message reaches the caller.
  it('returns 400 with the loader\'s message when initialWorkflowPhase is orphaned by a phase rename', async () => {
    const experienceId = 'exp-orphaned-initial';
    const sessionId = 'sess-orphaned-initial';
    await seedExperience({
      experienceId,
      phases: [
        { id: 'mentor-phase', title: 'Mentor Phase' },
        { id: 'practice-phase', title: 'Practice Phase' },
        { id: 'feedback-phase', title: 'Feedback Phase' },
      ],
      initialWorkflowPhase: 'mentor',
    });
    await seedSession(experienceId, sessionId, {
      // Mirror the real session.json: currentPhase is the
      // orphaned "mentor" because createFreshSessionRow trusts
      // resolveInitialWorkflowPhase without validation.
      workflowPhaseState: {
        currentPhase: 'mentor',
        furthestPhase: 'mentor',
        visited: ['mentor'],
        completedPhases: [],
        snapshots: {},
      },
    });

    const req = makeRequest(experienceId, sessionId, {
      op: { kind: 'nextPhase' },
      trigger: 'agent',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/initialWorkflowPhase "mentor" does not match/);
    // Pin the negative too — pre-fix this would have been a 500 with the
    // generic catch-all message. A regression here means we silently
    // downgraded back to 500 and lost the actionable detail.
    expect(data.error).not.toMatch(/Failed to perform workflow-phase transition/);
  });

  it('returns 400 with InvalidPhaseError message for an unknown set target', async () => {
    const experienceId = 'exp-invalid-set';
    const sessionId = 'sess-invalid-set';
    await seedExperience({
      experienceId,
      phases: [
        { id: 'intro', title: 'Intro' },
        { id: 'design', title: 'Design' },
      ],
    });
    await seedSession(experienceId, sessionId, {
      workflowPhaseState: {
        currentPhase: 'intro',
        furthestPhase: 'intro',
        visited: ['intro'],
        completedPhases: [],
        snapshots: {},
      },
    });

    const req = makeRequest(experienceId, sessionId, {
      op: { kind: 'set', targetPhase: 'no-such-phase' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Unknown workflow phase id "no-such-phase"/);
  });

  it('returns 400 when op is missing from the body', async () => {
    const experienceId = 'exp-no-op';
    const sessionId = 'sess-no-op';
    await seedExperience({
      experienceId,
      phases: [
        { id: 'intro', title: 'Intro' },
        { id: 'design', title: 'Design' },
      ],
    });
    await seedSession(experienceId, sessionId);

    const req = makeRequest(experienceId, sessionId, { trigger: 'user' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('serializes concurrent requests on the same session through mutateSessionMetadata', async () => {
    const experienceId = 'exp-concurrent';
    const sessionId = 'sess-concurrent';
    await seedExperience({
      experienceId,
      phases: [
        { id: 'intro', title: 'Intro' },
        { id: 'design', title: 'Design' },
        { id: 'review', title: 'Review' },
      ],
    });
    await seedSession(experienceId, sessionId, {
      workflowPhaseState: {
        currentPhase: 'intro',
        furthestPhase: 'intro',
        visited: ['intro'],
        completedPhases: ['intro'],
        snapshots: {},
      },
    });

    // First call advances intro -> design.
    // Second call (queued behind the first via the per-session lock) must
    // observe design as the current phase and advance design -> review.
    const reqA = makeRequest(experienceId, sessionId, {
      op: { kind: 'advance' },
      trigger: 'user',
    });
    const reqB = makeRequest(experienceId, sessionId, {
      op: { kind: 'advance' },
      trigger: 'user',
    });

    const [resA, resB] = await Promise.all([POST(reqA), POST(reqB)]);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const dataA = await resA.json();
    const dataB = await resB.json();

    // Both requests must serialize through the lock: one advances intro->design
    // and the other advances design->review. The ordering of which request wins
    // the lock first is not guaranteed by Promise.all, so we only assert the
    // set of outcomes rather than their assignment to A vs B.
    const phases = [dataA.newState.currentPhase, dataB.newState.currentPhase].sort();
    expect(phases).toEqual(['design', 'review']);

    // Whichever request landed second must have observed the first's mutation,
    // meaning the visited array for the 'review' result must be fully built up.
    const reviewResult = dataA.newState.currentPhase === 'review' ? dataA : dataB;
    expect(reviewResult.newState.visited).toEqual(['intro', 'design', 'review']);

    const persisted = await readSession(experienceId, sessionId);
    expect(persisted.workflowPhaseState?.currentPhase).toBe('review');
    expect(persisted.workflowPhaseState?.visited).toEqual([
      'intro',
      'design',
      'review',
    ]);
  });
});
