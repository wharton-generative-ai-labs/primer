/**
 * Shape guards for ids that arrive from the client and flow into raw `fs`
 * paths. Defense in depth against path traversal: the storage layer's
 * `startsWith(baseDir)` check is the only barrier today, so we reject anything
 * that doesn't match a tight allowlist before it reaches `path.join`.
 */

export const EXPERIENCE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
export const SESSION_ID_RE = /^sess_[A-Za-z0-9_-]+$/;
export const MODULE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export function assertExperienceId(id: string): void {
  if (!EXPERIENCE_ID_RE.test(id)) {
    throw new Error('Invalid experience id');
  }
}

export function assertSessionId(id: string): void {
  if (!SESSION_ID_RE.test(id)) {
    throw new Error('Invalid session id');
  }
}

export function assertModuleId(id: string): void {
  if (!MODULE_ID_RE.test(id)) {
    throw new Error('Invalid module id');
  }
}
