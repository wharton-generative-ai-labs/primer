/**
 * POST /api/workflow-phases/transition
 *
 * Wraps `WorkflowPhaseManager.transition` in `mutateSessionMetadata` so that
 * concurrent transition POSTs on the same session serialize through the
 * per-session lock. The pure transition logic owns the new state, the events
 * to append, and the system-message string the agent should be told about; the
 * route is thin glue that loads the experience config, calls the manager, and
 * persists the result atomically.
 *
 * Headers: `x-experience-id`, `x-session-id` (both required).
 *
 * Body: `{ op: TransitionOp, trigger?: 'user' | 'agent' | 'system',
 *          reason?: string, currentSnapshot?: WorkflowPhaseSnapshot }`.
 *        `trigger` defaults to `'user'`.
 *
 * Response: `{ newState, experienceCompleted, eventsAppended, systemMessage,
 *              restoredSnapshot, unmetObjectives }`.
 *
 * Errors:
 *   - 400 if either header is missing.
 *   - 400 on `InvalidPhaseError` / `NoNextPhaseError` from the manager.
 *   - 404 on `SessionMetadataNotFoundError` from the lock helper.
 *   - 500 otherwise.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

import {
  getExperienceFolder,
  type SessionEvent,
} from '@/app/lib/file-utils';
import {
  mutateSessionMetadata,
  SessionMetadataNotFoundError,
} from '@/app/lib/sessions/mutateSessionMetadata';
import {
  InvalidPhaseError,
  NoNextPhaseError,
  transition,
  type TransitionOp,
  type TransitionRequest,
  type TransitionResult,
} from '@/app/lib/workflow-phases/WorkflowPhaseManager';
import type { WorkflowPhaseSnapshot } from '@/app/lib/workflow-phases';
import type { ExperienceConfig } from '@/app/lib/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('workflow-phases-transition');

interface TransitionRequestBody {
  op: TransitionOp;
  trigger?: TransitionRequest['trigger'];
  reason?: string;
  currentSnapshot?: WorkflowPhaseSnapshot;
}

async function loadExperienceConfig(experienceId: string): Promise<ExperienceConfig> {
  const experienceFolder = await getExperienceFolder(experienceId);
  const experienceFilePath = path.join(experienceFolder, 'experience.json');
  const raw = await fs.readFile(experienceFilePath, 'utf-8');
  return JSON.parse(raw) as ExperienceConfig;
}

export async function POST(req: NextRequest) {
  const experienceId = req.headers.get('x-experience-id');
  const sessionId = req.headers.get('x-session-id');

  if (!experienceId || !sessionId) {
    return NextResponse.json(
      { error: 'Experience ID and Session ID are required (via headers)' },
      { status: 400 },
    );
  }

  let body: TransitionRequestBody;
  try {
    body = (await req.json()) as TransitionRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  if (!body || typeof body !== 'object' || !body.op || typeof body.op !== 'object') {
    return NextResponse.json(
      { error: 'Request body must include an `op` object' },
      { status: 400 },
    );
  }

  const transitionReq: TransitionRequest = {
    op: body.op,
    trigger: body.trigger ?? 'user',
    reason: body.reason,
    currentSnapshot: body.currentSnapshot,
  };

  let config: ExperienceConfig;
  try {
    config = await loadExperienceConfig(experienceId);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'ENOENT'
    ) {
      return NextResponse.json(
        { error: `Experience configuration not found for "${experienceId}".` },
        { status: 404 },
      );
    }
    logger.error(error, 'Error loading experience config');
    return NextResponse.json(
      { error: 'Failed to load experience configuration' },
      { status: 500 },
    );
  }

  let result: TransitionResult;
  try {
    result = await mutateSessionMetadata<TransitionResult>(
      experienceId,
      sessionId,
      async (metadata) => {
        const transitionResult = transition(
          config,
          metadata.workflowPhaseState,
          metadata.experienceCompleted ?? false,
          transitionReq,
        );

        if (!metadata.events) {
          metadata.events = [];
        }
        for (const event of transitionResult.eventsToAppend) {
          metadata.events.push(event satisfies SessionEvent);
        }
        metadata.workflowPhaseState = transitionResult.newState;
        metadata.experienceCompleted = transitionResult.experienceCompleted;
        metadata.lastActivity = new Date().toISOString();

        return { metadata, result: transitionResult };
      },
    );
  } catch (error: unknown) {
    if (error instanceof SessionMetadataNotFoundError) {
      return NextResponse.json(
        { error: 'Session not found. Session must be initialized first.' },
        { status: 404 },
      );
    }
    if (error instanceof InvalidPhaseError || error instanceof NoNextPhaseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error(error, 'Error performing workflow-phase transition');
    return NextResponse.json(
      { error: 'Failed to perform workflow-phase transition' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    newState: result.newState,
    experienceCompleted: result.experienceCompleted,
    eventsAppended: result.eventsToAppend,
    systemMessage: result.systemMessage,
    restoredSnapshot: result.restoredSnapshot,
    unmetObjectives: result.unmetObjectives,
  });
}
