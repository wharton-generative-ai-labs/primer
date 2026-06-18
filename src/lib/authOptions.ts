import { headers } from 'next/headers';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { Permission, Role } from '@/config/auth';
import { getMergedUserPrivileges, getMergedUserRolesForUser } from '@/config/user-storage';
import { auditAuthSuccess, auditLog } from '@/lib/audit-logger';
import { env } from '@/config/env';

const googleAuthConfigured = !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;

/**
 * Central NextAuth configuration — shared by the App Router API route and
 * `getServerSession` so the session shape (e.g. merged roles/privileges) is
 * identical for API routes, Server Components, and `SessionProvider` hydration.
 */
export const authOptions: NextAuthOptions = {
  providers: googleAuthConfigured
    ? [
        GoogleProvider({
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : [],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    signIn: async ({ user, account, profile: _profile }) => {
      if (user?.email) {
        const headersList = await headers();
        const userAgent = headersList.get('user-agent') || 'unknown';

        const auditRequest = {
          headers: new Headers({
            'user-agent': userAgent,
          }),
        };

        await auditAuthSuccess(user.email, auditRequest, {
          provider: account?.provider || 'google',
          providerAccountId: account?.providerAccountId,
        });
      }
      return true;
    },
    session: async ({ session }) => {
      if (session?.user?.email) {
        const privileges: Permission[] = getMergedUserPrivileges(session.user.email);
        const roles: Role[] = getMergedUserRolesForUser(session.user.email);

        return {
          ...session,
          user: {
            ...session.user,
            privileges,
            roles,
          },
        };
      }
      return session;
    },
  },
  events: {
    signOut: async ({ session, token }) => {
      if (session?.user?.email || token?.email) {
        const email = session?.user?.email || token?.email;
        if (email) {
          const headersList = await headers();
          const userAgent = headersList.get('user-agent') || 'unknown';

          const auditRequest = {
            headers: new Headers({
              'user-agent': userAgent,
            }),
          };
          await auditLog('auth.logout', email, auditRequest, {});
        }
      }
    },
  },
};
