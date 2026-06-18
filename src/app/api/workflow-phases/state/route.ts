/**
 * GET /api/workflow-phases/state
 *
 * Read-only window into a session's workflow-phase state. Mirrors the on-disk
 * `session.json` (`workflowPhaseState`, `experienceCompleted`) plus the
 * authored phase list from `experience.json`. Used by the client provider to
 * hydrate after mount and to recover from external state changes.
 *
 * No lock is taken — callers tolerate eventual consistency for a read.
 *
 * Headers: `x-experience-id`, `x-session-id` (both required).
 *
 * Response: `{ workflowPhaseState, experienceCompleted, workflowPhases }`.
 *           When the experience declares no phases, returns
 *           `{ workflowPhaseState: null, experienceCompleted: false,
 *              workflowPhases: [] }`.
 *
 * Errors:
 *   - 400 if either header is missing.
 *   - 404 if the session metadata file is missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

import {
  getExperienceFolder,
  getSessionMetadataFilePath,
  type SessionMetadata,
} from '@/app/lib/file-utils';
import type { ExperienceConfig } from '@/app/lib/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('workflow-phases-state');

async function loadExperienceConfig(experienceId: string): Promise<ExperienceConfig> {
  const experienceFolder = await getExperienceFolder(experienceId);
  const experienceFilePath = path.join(experienceFolder, 'experience.json');
  const raw = await fs.readFile(experienceFilePath, 'utf-8');
  return JSON.parse(raw) as ExperienceConfig;
}

export async function GET(req: NextRequest) {
  const experienceId = req.headers.get('x-experience-id');
  const sessionId = req.headers.get('x-session-id');

  if (!experienceId || !sessionId) {
    return NextResponse.json(
      { error: 'Experience ID and Session ID are required (via headers)' },
      { status: 400 },
    );
  }

  let metadata: SessionMetadata;
  try {
    const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
    const raw = await fs.readFile(metadataPath, 'utf-8');
    metadata = JSON.parse(raw) as SessionMetadata;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'ENOENT'
    ) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    logger.error(error, 'Error reading session metadata');
    return NextResponse.json(
      { error: 'Failed to read session metadata' },
      { status: 500 },
    );
  }

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

  const workflowPhases = config.workflowPhases ?? [];

  if (workflowPhases.length === 0) {
    return NextResponse.json({
      workflowPhaseState: null,
      experienceCompleted: false,
      workflowPhases: [],
    });
  }

  return NextResponse.json({
    workflowPhaseState: metadata.workflowPhaseState ?? null,
    experienceCompleted: metadata.experienceCompleted ?? false,
    workflowPhases,
  });
}
