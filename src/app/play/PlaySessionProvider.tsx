'use client'

import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'

/**
 * Overrides the root SessionProvider's refetch defaults for the play experience.
 * We disable window-focus refetches and polling so a mid-session tab switch or
 * 5-minute interval doesn't re-render the session tree and potentially disrupt
 * an active agent conversation or Socket.IO connection.
 *
 * Accepts a server-hydrated `session` so the provider is populated immediately
 * on mount, preventing a loading window where session-gated UI (e.g. Sign Out)
 * would briefly disappear when navigating in and out of the play route.
 */
export function PlaySessionProvider({
    children,
    session,
}: {
    children: React.ReactNode
    session?: Session | null
}) {
    return (
        <SessionProvider session={session} refetchOnWindowFocus={false} refetchInterval={0}>
            {children}
        </SessionProvider>
    )
}
