import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import {
  getExperienceFolder,
  getSessionMetadataFilePath,
  SessionMetadata,
  SessionEvent,
  SESSION_EVENTS,
} from '@/app/lib/file-utils';
import type { ExperienceConfig, ArtifactConfig } from '@/app/lib/types';
import {
  resolveInitialWorkflowPhase,
} from '@/app/lib/workflow-phases/loadWorkflowPhases';
import type { WorkflowPhaseState } from '@/app/lib/workflow-phases/types';
import { createArtifact } from '@/app/lib/artifacts/storage';
import { auditSessionCreated } from '@/lib/audit-logger';
import { createModuleLogger } from '@/lib/logger';
import { assertExperienceId } from '@/app/server-actions/_validation';

const logger = createModuleLogger('createFreshSessionRow');

interface CreateFreshSessionRowOptions {
  experienceId: string;
  userEmail: string;
  userName?: string;
  /**
   * Headers to forward to the audit logger so the IP/UA/path columns line up
   * with the originating request. Pass the result of `await headers()` from
   * `next/headers` (works in both RSCs and server actions).
   */
  requestHeaders: Headers;
}

/**
 * Generates a session id, materializes the on-disk session row
 * (`session_data/<id>/{session.json,artifacts/,uploads/}`), writes the
 * `session_started` event, and audits the creation. Used by both the
 * `chooseSessionAction` server action (when the user clicks Start Fresh) and
 * the play RSC (when the user lands on `/play/[id]` with no prior session) so
 * there's exactly one code path that creates a session.
 *
 * Throws if the disk writes fail. Callers in the RSC translate that into the
 * standard error screen; callers in the server action wrap it into a
 * `{ success: false, error }` shape.
 */
export async function createFreshSessionRow({
  experienceId,
  userEmail,
  userName,
  requestHeaders,
}: CreateFreshSessionRowOptions): Promise<string> {
  assertExperienceId(experienceId);

  const sessionId = `sess_${randomUUID()}`;
  const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
  const sessionDir = path.dirname(metadataPath);

  const now = new Date().toISOString();
  const sessionStartedEvent: SessionEvent = {
    event: SESSION_EVENTS.SESSION_STARTED,
    agent: 'system',
    timestamp: now,
    data: { userName, userEmail },
  };

  const events: SessionEvent[] = [sessionStartedEvent];

  // Seed workflow-phase state when the experience declares a phase list.
  // We read `experience.json` here (rather than asking callers to plumb the
  // config through) so the only code path that creates a session row also
  // owns its initial workflow-phase event — otherwise a session could exist
  // briefly with no `WORKFLOW_PHASE_ENTERED` for downstream consumers to key
  // off of. Experiences without phases keep the original shape (no
  // `workflowPhaseState`, no extra event).
  const experienceConfig = await loadExperienceConfigForSeed(experienceId);
  let workflowPhaseState: WorkflowPhaseState | undefined;
  if (experienceConfig?.workflowPhases && experienceConfig.workflowPhases.length > 0) {
    const initialPhaseId = resolveInitialWorkflowPhase(experienceConfig);
    if (initialPhaseId) {
      workflowPhaseState = {
        currentPhase: initialPhaseId,
        furthestPhase: initialPhaseId,
        visited: [initialPhaseId],
        completedPhases: [],
        snapshots: {},
      };
      events.push({
        event: SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
        agent: 'system',
        timestamp: now,
        data: {
          phase: initialPhaseId,
          trigger: 'system',
          direction: 'initial',
        },
      });
    }
  }

  const sessionMetadata: SessionMetadata = {
    sessionId,
    experienceId,
    startTime: now,
    lastActivity: now,
    userName,
    userEmail,
    events,
    ...(workflowPhaseState ? { workflowPhaseState } : {}),
  };

  // Make the session dir first (parent of the others), then materialize both
  // child dirs in parallel — they're independent and `recursive: true` is
  // idempotent if a previous run partially completed.
  await fs.mkdir(sessionDir, { recursive: true });
  await Promise.all([
    fs.mkdir(path.join(sessionDir, 'artifacts'), { recursive: true }),
    fs.mkdir(path.join(sessionDir, 'uploads'), { recursive: true }),
  ]);
  await fs.writeFile(metadataPath, JSON.stringify(sessionMetadata, null, 2));

  // Seed declared artifacts BEFORE returning. Previously this was the
  // client's job (ArtifactManager.loadArtifacts → POST /api/artifacts/create
  // per artifact), which raced the agent's first tool call: the realtime
  // session could connect and the agent could fire `checklist({...})`
  // before all the POSTs landed on disk. By seeding here, the session id is
  // never returned to the caller until every config-declared artifact is
  // already written. Failures on individual artifacts log but do not block —
  // matches the prior client-side tolerance.
  if (experienceConfig?.resources?.artifacts?.length) {
    await seedDeclaredArtifacts({
      experienceId,
      sessionId,
      userName,
      userEmail,
      artifacts: experienceConfig.resources.artifacts,
    });
  }

  logger.info({ sessionId, experienceId }, 'Created new session row');

  try {
    await auditSessionCreated(userEmail, { headers: requestHeaders }, {
      sessionId,
      experienceId,
      userName,
      userEmail,
    });
  } catch (auditError) {
    logger.error({ err: auditError, sessionId }, 'Failed to audit session creation');
  }

  return sessionId;
}

/**
 * Read each declared artifact's source file from the experience folder and
 * write it as a session artifact via {@link createArtifact}. Runs in parallel
 * (one filesystem write per artifact) and tolerates per-artifact failures so
 * a single bad reference can't lock a user out of the experience entirely.
 */
async function seedDeclaredArtifacts(params: {
  experienceId: string;
  sessionId: string;
  userName?: string;
  userEmail: string;
  artifacts: ArtifactConfig[];
}): Promise<void> {
  const { experienceId, sessionId, artifacts } = params;
  const experienceFolder = await getExperienceFolder(experienceId);

  await Promise.all(
    artifacts.map(async (artifact) => {
      if (!artifact?.file || !artifact?.name) return;
      try {
        const sourcePath = path.join(experienceFolder, artifact.file);
        const content = await fs.readFile(sourcePath, 'utf-8');
        await createArtifact({
          experienceId,
          sessionId,
          name: artifact.name,
          content,
          type: artifact.type || 'markdown',
          agents: artifact.agents,
          metadata: artifact.metadata,
          author: { kind: 'system' },
        });
      } catch (err) {
        logger.error(
          { err, artifactName: artifact.name, file: artifact.file },
          'Failed to seed declared artifact during session creation',
        );
      }
    }),
  );
}

/**
 * Best-effort read of `storage/{experienceId}/experience.json` for the workflow-
 * phase seed step. Returns `null` when the file is missing or unreadable so a
 * brand-new experience without a config on disk doesn't block session creation
 * — the seed step is opt-in (gated on `workflowPhases?.length > 0`), so a
 * missing config is functionally identical to "no phases declared". A parse
 * error is logged at debug level for the same reason.
 */
async function loadExperienceConfigForSeed(
  experienceId: string,
): Promise<ExperienceConfig | null> {
  try {
    const experienceFolder = await getExperienceFolder(experienceId);
    const configPath = path.join(experienceFolder, 'experience.json');
    const raw = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(raw) as ExperienceConfig;
  } catch (err) {
    logger.debug(
      { err, experienceId },
      'experience.json not loadable during session seed; skipping workflow-phase init',
    );
    return null;
  }
}
