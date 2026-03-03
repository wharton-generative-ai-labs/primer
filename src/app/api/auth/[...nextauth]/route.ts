import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { headers } from 'next/headers'
import { Permission, Role } from '@/config/auth'
import { getMergedUserPrivileges, getMergedUserRolesForUser } from '@/config/user-storage'
import { auditAuthSuccess, auditLog } from '@/lib/audit-logger'
import { env } from '@/config/env'

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    signIn: async ({ user, account, profile: _profile }) => {
      // Log successful authentication
      if (user?.email) {
        // Get user agent from request headers
        const headersList = await headers()
        const userAgent = headersList.get('user-agent') || 'unknown'
        
        // Create a minimal request-like object for audit logging
        const auditRequest = {
          headers: new Headers({
            'user-agent': userAgent,
          }),
        };
        
        await auditAuthSuccess(
          user.email,
          auditRequest,
          {
            provider: account?.provider || 'google',
            providerAccountId: account?.providerAccountId,
          }
        );
      }
      return true;
    },
    session: async ({ session }) => {
      if (session?.user?.email) {
        // Use merged user data (env + file-based users)
        const privileges: Permission[] = getMergedUserPrivileges(session.user.email);
        const roles: Role[] = getMergedUserRolesForUser(session.user.email);

        return {
          ...session,
          user: {
            ...session.user,
            privileges,
            roles
          }
        }
      }
      return session;
    }
  },
  events: {
    signOut: async ({ session, token }) => {
      // Log logout
      if (session?.user?.email || token?.email) {
        const email = session?.user?.email || token?.email;
        if (email) {
          // Get user agent from request headers
          const headersList = await headers()
          const userAgent = headersList.get('user-agent') || 'unknown'
          
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
})

export { handler as GET, handler as POST }
