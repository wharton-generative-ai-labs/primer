/**
 * Browser-side session-id helpers.
 *
 * Sessions are materialized exclusively on the server: either by the play RSC
 * (`/play/[id]` with no previous session → `createFreshSessionRow`) or by
 * `chooseSessionAction` from the recovery dialog. The browser never generates
 * its own session ids — these helpers only read or persist a server-issued id
 * into per-tab `sessionStorage`.
 */

const SESSION_KEY = 'primer:session-id';

/**
 * Get the current session id if one exists. Returns `null` for read-only
 * checks where no session is acceptable (most call sites). Never creates one.
 */
export function getExistingSessionId(): string | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  return sessionStorage.getItem(SESSION_KEY);
}

/**
 * Install a server-issued session id into `sessionStorage` for the current tab.
 * Overwrites any existing value (e.g., when the recovery dialog returns the
 * resumed session's id, or when the RSC pre-creates a fresh one).
 */
export function setSessionId(sessionId: string): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
}
