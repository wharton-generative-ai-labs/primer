/**
 * Tests for `createFreshSessionRow`'s workflow-phase seed step.
 *
 * `createFreshSessionRow` reads `storage/{experienceId}/experience.json` to
 * decide whether to seed `workflowPhaseState`. We can't redirect that path via
 * `STORAGE_ROOT_PATH` here because the env validation snapshot is captured at
 * module load (long before any `beforeAll` we could write); see
 * `src/config/env.ts`. Instead, each test resolves the real storage location
 * via `getExperienceFolder` and writes / removes its own experience config so
 * the SUT exercises real disk reads end to end.
 *
 * Audit logging is mocked out: the side-effect isn't part of this task and a
 * real call would touch the audit-log directory.
 *
 * @jest-environment node
 */

import fs from 'fs/promises';
import path from 'path';

import type { ExperienceConfig } from '@/app/lib/types';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases/types';

jest.mock('@/lib/audit-logger', () => ({
  auditSessionCreated: jest.fn().mockResolvedValue(undefined),
}));

import { createFreshSessionRow } from '@/app/lib/sessions/createFreshSessionRow';
import {
  getExperienceFolder,
  getSessionMetadataFilePath,
  SessionMetadata,
  SESSION_EVENTS,
} from '@/app/lib/file-utils';

const cleanupDirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    cleanupDirs.map((dir) =>
      fs.rm(dir, { recursive: true, force: true }).catch(() => {}),
    ),
  );
});

async function writeExperienceConfig(
  experienceId: string,
  overrides: Partial<ExperienceConfig> & {
    workflowPhases?: WorkflowPhaseConfig[];
    initialWorkflowPhase?: string;
  },
): Promise<void> {
  const experienceFolder = await getExperienceFolder(experienceId);
  await fs.mkdir(experienceFolder, { recursive: true });
  cleanupDirs.push(experienceFolder);
  const fullConfig: ExperienceConfig = {
    version: '1.0.0',
    title: 'Test',
    description: 'Test experience',
    resources: {
      scenes: [],
      sounds: [],
      instructions: { agent: {}, supplemental: {} },
    },
    agents: {},
    ...overrides,
  };
  await fs.writeFile(
    path.join(experienceFolder, 'experience.json'),
    JSON.stringify(fullConfig, null, 2),
  );
}

async function readSession(
  experienceId: string,
  sessionId: string,
): Promise<SessionMetadata> {
  const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
  const raw = await fs.readFile(metadataPath, 'utf-8');
  return JSON.parse(raw);
}

function makeRequestHeaders(): Headers {
  return new Headers({ 'x-forwarded-for': '127.0.0.1' });
}

function uniqueId(prefix: string): string {
  // Pid + hi-res time keeps test runs across worktrees from colliding when
  // they share the storage dir.
  return `${prefix}-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

describe('createFreshSessionRow workflow-phase seed', () => {
  it('does not seed workflowPhaseState when the experience declares no phases', async () => {
    const experienceId = uniqueId('exp-no-phases');
    await writeExperienceConfig(experienceId, {});

    const sessionId = await createFreshSessionRow({
      experienceId,
      userEmail: 'student@example.com',
      userName: 'Student',
      requestHeaders: makeRequestHeaders(),
    });

    const session = await readSession(experienceId, sessionId);
    expect(session.workflowPhaseState).toBeUndefined();
    expect(session.events).toHaveLength(1);
    expect(session.events[0].event).toBe(SESSION_EVENTS.SESSION_STARTED);
    expect(
      session.events.find(
        (e) => e.event === SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
      ),
    ).toBeUndefined();
  });

  it('seeds workflowPhaseState from the first phase when no initialWorkflowPhase is set', async () => {
    const experienceId = uniqueId('exp-phases-default');
    const phases: WorkflowPhaseConfig[] = [
      { id: 'design', title: 'Design' },
      { id: 'build', title: 'Build' },
      { id: 'review', title: 'Review' },
    ];
    await writeExperienceConfig(experienceId, { workflowPhases: phases });

    const sessionId = await createFreshSessionRow({
      experienceId,
      userEmail: 'student@example.com',
      userName: 'Student',
      requestHeaders: makeRequestHeaders(),
    });

    const session = await readSession(experienceId, sessionId);
    expect(session.workflowPhaseState).toEqual({
      currentPhase: 'design',
      furthestPhase: 'design',
      visited: ['design'],
      completedPhases: [],
      snapshots: {},
    });

    const enteredEvent = session.events.find(
      (e) => e.event === SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    );
    expect(enteredEvent).toBeDefined();
    expect(enteredEvent?.agent).toBe('system');
    expect(enteredEvent?.data).toEqual({
      phase: 'design',
      trigger: 'system',
      direction: 'initial',
    });
    // Same timestamp as session_started — the seed runs in the same
    // synchronous tick, so they share the stamp.
    const startedEvent = session.events.find(
      (e) => e.event === SESSION_EVENTS.SESSION_STARTED,
    );
    expect(enteredEvent?.timestamp).toBe(startedEvent?.timestamp);
  });

  it('respects an explicit initialWorkflowPhase override', async () => {
    const experienceId = uniqueId('exp-phases-override');
    const phases: WorkflowPhaseConfig[] = [
      { id: 'design', title: 'Design' },
      { id: 'build', title: 'Build' },
      { id: 'review', title: 'Review' },
    ];
    await writeExperienceConfig(experienceId, {
      workflowPhases: phases,
      initialWorkflowPhase: 'build',
    });

    const sessionId = await createFreshSessionRow({
      experienceId,
      userEmail: 'student@example.com',
      userName: 'Student',
      requestHeaders: makeRequestHeaders(),
    });

    const session = await readSession(experienceId, sessionId);
    expect(session.workflowPhaseState).toEqual({
      currentPhase: 'build',
      furthestPhase: 'build',
      visited: ['build'],
      completedPhases: [],
      snapshots: {},
    });
    const enteredEvent = session.events.find(
      (e) => e.event === SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
    );
    expect(enteredEvent?.data?.phase).toBe('build');
    expect(enteredEvent?.data?.direction).toBe('initial');
    expect(enteredEvent?.data?.trigger).toBe('system');
  });
});
