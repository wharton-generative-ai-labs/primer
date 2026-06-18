import {
  findUserSession,
  type UserSessionLookup,
} from '@/app/lib/sessions/findUserSession';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('getInitialSessionState');

interface GetInitialSessionStateOptions {
  experienceId: string;
  userEmail: string;
}

export interface InitialSessionState {
  /**
   * Most-recent session row for `userEmail` against `experienceId`, or
   * `null` when the user has never opened this experience (or all prior
   * sessions are unreadable).
   */
  previousSession: UserSessionLookup | null;
}

/**
 * Wraps {@link findUserSession} so the play RSC has a single "what's the
 * starting state for this user/experience?" call instead of an inline
 * try/catch — and so the same lookup can be streamed as a single promise to
 * `PlayClient` once the route switches to the streamed sessionPromise model
 * (see Slice 4 of the play loading flow redesign plan).
 *
 * Soft-fails I/O errors to `previousSession: null` to match the legacy
 * behaviour (a missing session_data folder, a corrupt session.json, or any
 * other read failure should never lock the user out of an experience —
 * worst case the recovery dialog is skipped and a fresh row is started).
 *
 * Intentionally does NOT call {@link createFreshSessionRow}. That step has
 * disk + audit side effects and must stay gated behind the RSC's
 * access/dependency checks; running it speculatively in parallel would
 * create phantom session rows for users whose access is ultimately denied.
 */
export async function getInitialSessionState({
  experienceId,
  userEmail,
}: GetInitialSessionStateOptions): Promise<InitialSessionState> {
  try {
    const previousSession = await findUserSession(experienceId, userEmail);
    // Completed sessions are terminal — the user finished the experience and
    // the work product (built experience, completed roleplay, etc.) is already
    // persisted elsewhere. Don't offer to resume; treat the user as starting
    // fresh. They can still navigate to a specific older session via direct
    // links if they want to review.
    if (previousSession?.isCompleted) {
      return { previousSession: null };
    }
    return { previousSession };
  } catch (err) {
    logger.warn(
      { err, experienceId },
      'findUserSession failed; treating as no previous session',
    );
    return { previousSession: null };
  }
}
