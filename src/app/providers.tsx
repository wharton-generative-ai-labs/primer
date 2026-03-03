'use client'

import { SessionProvider } from "next-auth/react"
import { FileUploadProvider } from './contexts/FileUploadContext';
import { ArtifactProvider } from './contexts/ArtifactContext';
import { ClientEventProvider } from './contexts/ClientEventContext';

// Default implementation for when sendClientEvent is not provided
const defaultSendClientEvent = (_eventObj: any, _eventNameSuffix?: string) => {
  // Silently fail - this is expected when sendClientEvent is not provided
};

export function NextAuthProvider({ children, sendClientEvent }: { 
  children: React.ReactNode,
  sendClientEvent?: ((eventObj: any, eventNameSuffix?: string) => void) | null
}) {
  return (
    <SessionProvider>
      <ClientEventProvider sendClientEvent={sendClientEvent || defaultSendClientEvent}>
        <FileUploadProvider>
          <ArtifactProvider>
            {children}
          </ArtifactProvider>
        </FileUploadProvider>
      </ClientEventProvider>
    </SessionProvider>
  )
} 