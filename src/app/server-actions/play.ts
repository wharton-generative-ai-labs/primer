'use server';

import { headers } from 'next/headers';

import { getCachedSession } from '@/lib/getCachedSession';
import { Permission } from '@/config/auth';
import { hasMergedPermission } from '@/config/user-storage';
import { canAccessExperience } from '@/app/lib/classAuth';
import {
  SessionEvent,
  SESSION_EVENTS,
} from '@/app/lib/file-utils';
import { auditSessionResumed } from '@/lib/audit-logger';
import { createFreshSessionRow } from '@/app/lib/sessions/createFreshSessionRow';
import {
  mutateSessionMetadata,
  SessionMetadataNotFoundError,
} from '@/app/lib/sessions/mutateSessionMetadata';
import { getEffectiveUserEmail } from '@/lib/devAuth';
import { createModuleLogger } from '@/lib/logger';
import {
  EXPERIENCE_ID_RE,
  SESSION_ID_RE,
} from '@/app/server-actions/_validation';

const logger = createModuleLogger('play-actions');

export type SessionDecision = 'continue' | 'fresh';

export interface ChooseSessionResult {
  success: boolean;
  /** The session id to install in the browser's `sessionStorage`. */
  sessionId?: string;
  error?: string;
}

/**
 * Server-authoritative version of the "Start Fresh / Continue Session" decision.
 *
 * The client invokes this from the {@link import('@/app/components/SessionRecoveryDialog').SessionRecoveryDialog}
 * via `useTransition`. By the time it returns, the disk row + audit trail and
 * the returned session id are guaranteed to match — there's no client-driven
 * race window where `sessionStorage` could hold an id that isn't yet on disk.
 *
 * For `decision === 'continue'`, `previousSessionId` MUST belong to the
 * authenticated user for this experience — otherwise we refuse, even though
 * the id arrived as a prop from the RSC (defense in depth: a malicious client
 * could swap it before invoking this action).
 *
 * The RSC handles the no-previous-session case directly via
 * {@link createFreshSessionRow}, so this action is only reached when the user
 * is making an explicit choice in the recovery dialog.
 */
export async function chooseSessionAction(
  experienceId: string,
  decision: SessionDecision,
  previousSessionId?: string,
): Promise<ChooseSessionResult> {
  try {
    if (!EXPERIENCE_ID_RE.test(experienceId)) {
      return { success: false, error: 'Invalid experience id' };
    }

    const session = await getCachedSession();
    const userEmail = getEffectiveUserEmail(session?.user?.email);
    if (!userEmail) {
      return { success: false, error: 'Authentication required' };
    }

    const hasPlayPermission = hasMergedPermission(userEmail, Permission.PLAY_EXPERIENCE);
    const accessResult = await canAccessExperience(experienceId, userEmail, hasPlayPermission);
    if (!accessResult.canAccess) {
      return { success: false, error: 'You do not have access to this experience' };
    }

    const userName = session?.user?.name || undefined;
    const requestHeaders = await headers();

    switch (decision) {
      case 'continue': {
        if (!previousSessionId || !SESSION_ID_RE.test(previousSessionId)) {
          return { success: false, error: 'Invalid session id' };
        }

        // Use the per-session mutation lock so two concurrent resume requests
        // (e.g. the recovery dialog double-click that the old comment called
        // out as the failure mode) cannot drop a `session_resumed` event to a
        // last-writer-wins race. The mutator surfaces the ownership-mismatch
        // outcome via the wrapped `result` channel so we can return without
        // mutating the file.
        let outcome: { ok: true } | { ok: false; reason: 'forbidden' };
        try {
          outcome = await mutateSessionMetadata<
            { ok: true } | { ok: false; reason: 'forbidden' }
          >(experienceId, previousSessionId, async (metadata) => {
            if (metadata.userEmail?.toLowerCase() !== userEmail.toLowerCase()) {
              logger.warn(
                {
                  experienceId,
                  previousSessionId,
                  owner: metadata.userEmail,
                  requester: userEmail,
                },
                'continue requested for a session owned by a different user',
              );
              return { metadata, result: { ok: false, reason: 'forbidden' } };
            }

            const now = new Date().toISOString();
            const resumedEvent: SessionEvent = {
              event: SESSION_EVENTS.SESSION_RESUMED,
              agent: 'system',
              timestamp: now,
              data: { userName, userEmail },
            };
            metadata.events = [...(metadata.events ?? []), resumedEvent];
            metadata.lastActivity = now;
            return { metadata, result: { ok: true } };
          });
        } catch (err) {
          if (err instanceof SessionMetadataNotFoundError) {
            logger.warn(
              { err, experienceId, previousSessionId },
              'continue requested but session metadata is unreadable',
            );
            return { success: false, error: 'Previous session could not be loaded' };
          }
          logger.warn(
            { err, experienceId, previousSessionId },
            'continue requested but session metadata is unreadable',
          );
          return { success: false, error: 'Previous session could not be loaded' };
        }

        if (!outcome.ok) {
          return { success: false, error: 'You do not have access to this session' };
        }

        try {
          await auditSessionResumed(userEmail, { headers: requestHeaders }, {
            sessionId: previousSessionId,
            experienceId,
          });
        } catch (auditError) {
          logger.error({ err: auditError, sessionId: previousSessionId }, 'Failed to audit session resume');
        }

        return { success: true, sessionId: previousSessionId };
      }

      case 'fresh': {
        const sessionId = await createFreshSessionRow({
          experienceId,
          userEmail,
          userName,
          requestHeaders,
        });
        return { success: true, sessionId };
      }

      default: {
        // Compile-time exhaustiveness check; the runtime fallback intentionally
        // does NOT echo `decision` back to the client (avoids reflecting
        // user-controlled input even though JSX-escaping makes it harmless in
        // the current consumer).
        const exhaustiveCheck: never = decision;
        void exhaustiveCheck;
        logger.warn(
          { experienceId, decision },
          'chooseSessionAction received unknown decision',
        );
        return { success: false, error: 'Failed to record session decision' };
      }
    }
  } catch (error) {
    logger.error({ err: error, experienceId, decision }, 'chooseSessionAction failed');
    return {
      success: false,
      error: 'Failed to record session decision',
    };
  }
}

