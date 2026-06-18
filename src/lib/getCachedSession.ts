import 'server-only';

import { cache } from 'react';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDevAuthEmail, isDevAuthBypassEnabled } from '@/lib/devAuth';
import { getMergedUserPrivileges, getMergedUserRolesForUser } from '@/config/user-storage';

// Far-future expires so SessionProvider treats the synth session as live.
// 100 years is well beyond any realistic dev session lifetime.
const DEV_SESSION_EXPIRES_MS = 100 * 365 * 24 * 60 * 60 * 1000;

const buildDevSession = (): Session => {
  const email = getDevAuthEmail();
  return {
    user: {
      email,
      name: email,
      privileges: getMergedUserPrivileges(email),
      roles: getMergedUserRolesForUser(email),
    },
    expires: new Date(Date.now() + DEV_SESSION_EXPIRES_MS).toISOString(),
  };
};

/**
 * Per-request memoized `getServerSession(authOptions)`. Resolving the session
 * runs the `session` callback (which hydrates roles/privileges via
 * `getMergedUserPrivileges`) — caching avoids paying that cost twice when the
 * same request reaches both an RSC and a server action.
 *
 * When dev auth bypass is enabled and no real NextAuth session exists, we
 * synthesize one so client `useSession()` consumers see `'authenticated'`
 * status (matching server-side `getEffectiveUserEmail` behavior).
 *
 * `cache()` scope is one render pass, so cross-request leakage is impossible.
 */
export const getCachedSession = cache(async (): Promise<Session | null> => {
  const session = await getServerSession(authOptions);
  if (session) {
    return session;
  }
  if (isDevAuthBypassEnabled()) {
    return buildDevSession();
  }
  return null;
});
