'use client'

import type { Session } from "next-auth"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme-provider"
import { FileUploadProvider } from './contexts/FileUploadContext';
import { ArtifactProvider } from './contexts/ArtifactContext';
import { ClientEventProvider } from './contexts/ClientEventContext';

// Default implementation for when sendClientEvent is not provided
const defaultSendClientEvent = (_eventObj: any, _eventNameSuffix?: string) => {
  // Silently fail - this is expected when sendClientEvent is not provided
};

export function NextAuthProvider({ children, sendClientEvent, session }: {
  children: React.ReactNode,
  sendClientEvent?: ((eventObj: any, eventNameSuffix?: string) => void) | null
  session?: Session | null
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider
        session={session}
        refetchOnWindowFocus={false}
        refetchInterval={0}
      >
        <ClientEventProvider sendClientEvent={sendClientEvent || defaultSendClientEvent}>
          <FileUploadProvider>
            <ArtifactProvider>
              {children}
            </ArtifactProvider>
          </FileUploadProvider>
        </ClientEventProvider>
      </SessionProvider>
    </ThemeProvider>
  )
} 