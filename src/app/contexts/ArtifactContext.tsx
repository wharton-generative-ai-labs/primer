import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useClientEvent } from './ClientEventContext';
import { useExperienceUrl } from '../hooks/useExperienceUrl';
import { getExistingSessionId } from '../lib/session-utils';

export interface Artifact {
  id: string;
  name: string;
  content: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    description?: string;
    tags?: string[];
    presentation?: {
      type: 'slide' | 'editor' | 'checklist' | 'none';
      options?: Record<string, any>;
    };
  };
}

interface ArtifactState {
  artifacts: Artifact[];
  isLoading: boolean;
  error: string | null;
}

interface ArtifactContextType {
  artifacts: Artifact[];
  isLoading: boolean;
  error: string | null;
  listArtifacts: () => Promise<Artifact[]>;
  createArtifact: (name: string, content: string, type: string, metadata?: Artifact['metadata']) => Promise<Artifact>;
  getArtifact: (artifactId: string) => Promise<Artifact | null>;
  updateArtifact: (artifactId: string, content: string, metadata?: Partial<Artifact['metadata']>) => Promise<void>;
  deleteArtifact: (artifactId: string) => Promise<void>;
}

const defaultContextValue: ArtifactContextType = {
  artifacts: [],
  isLoading: false,
  error: null,
  listArtifacts: async () => [],
  createArtifact: async () => ({ id: '', name: '', content: '', type: '', createdAt: '', updatedAt: '' }),
  getArtifact: async () => null,
  updateArtifact: async () => {},
  deleteArtifact: async () => {},
};

const ArtifactContext = createContext<ArtifactContextType>(defaultContextValue);

export function ArtifactProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ArtifactState>({
    artifacts: [],
    isLoading: false,
    error: null,
  });

  const clientEventContext = useClientEvent();
  const { getExperienceId } = useExperienceUrl();
  const { data: session, status: sessionStatus } = useSession();

  // Store user info in sessionStorage so ConfigLoader can access it
  useEffect(() => {
    if (session?.user) {
      sessionStorage.setItem('primer:user-name', session.user.name || '');
      sessionStorage.setItem('primer:user-email', session.user.email || '');
    } else {
      sessionStorage.removeItem('primer:user-name');
      sessionStorage.removeItem('primer:user-email');
    }
  }, [session, sessionStatus]);

  // Function to safely send client events
  const safelyEmitEvent = useCallback((eventObj: any, eventNameSuffix?: string) => {
    if (typeof clientEventContext?.sendClientEvent === 'function') {
      clientEventContext.sendClientEvent(eventObj, eventNameSuffix);
    }
  }, [clientEventContext]);

  const listArtifacts = useCallback(async () => {
    const experienceId = getExperienceId();
    if (!experienceId) {
      setState(prev => ({ ...prev, error: 'No experience ID found' }));
      return [];
    }

    const sessionId = getExistingSessionId();
    if (!sessionId) {
      // No active session - this is expected when not in /play/ route
      return [];
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Add cache-busting timestamp to prevent browser caching
      const timestamp = Date.now();
      const response = await fetch(`/api/artifacts/list?t=${timestamp}`, {
        headers: {
          'x-experience-id': experienceId,
          'x-session-id': sessionId,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list artifacts: ${response.statusText}`);
      }

      const data = await response.json();
      const artifacts = Array.isArray(data) ? data : [];
      
      setState(prev => ({
        ...prev,
        artifacts,
        isLoading: false
      }));
      
      return artifacts;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to list artifacts';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      return [];
    }
  }, [getExperienceId]);

  const createArtifact = useCallback(async (name: string, content: string, type: string, metadata?: Artifact['metadata']) => {
    const experienceId = getExperienceId();
    if (!experienceId) {
      setState(prev => ({ ...prev, error: 'No experience ID found' }));
      throw new Error('No experience ID found');
    }

    const sessionId = getExistingSessionId();
    if (!sessionId) {
      const error = 'No active session. Artifacts can only be created during an active experience session.';
      setState(prev => ({ ...prev, error }));
      throw new Error(error);
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      
      const response = await fetch('/api/artifacts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-experience-id': experienceId,
          'x-session-id': sessionId
        },
        body: JSON.stringify({ 
          name, 
          content, 
          type, 
          metadata,
          // Include user info for session metadata
          userName: session?.user?.name,
          userEmail: session?.user?.email
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create artifact: ${response.statusText}`);
      }

      const artifact = await response.json();
      
      setState(prev => ({
        ...prev,
        artifacts: [...prev.artifacts, artifact],
        isLoading: false
      }));

      safelyEmitEvent({
        type: "artifact.created",
        artifact: {
          id: artifact.id,
          name: artifact.name,
          type: artifact.type
        }
      }, "trigger response");

      return artifact;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create artifact';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      throw error;
    }
  }, [getExperienceId, safelyEmitEvent, session]);

  const getArtifact = useCallback(async (artifactId: string) => {
    const experienceId = getExperienceId();
    if (!experienceId) {
      setState(prev => ({ ...prev, error: 'No experience ID found' }));
      return null;
    }

    const sessionId = getExistingSessionId();
    if (!sessionId) {
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/artifacts/${artifactId}`, {
        headers: {
          'x-experience-id': experienceId,
          'x-session-id': sessionId
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch artifact: ${response.statusText}`);
      }

      const artifact = await response.json();
      return artifact;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch artifact';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      return null;
    }
  }, [getExperienceId]);

  const updateArtifact = useCallback(async (artifactId: string, content: string, metadata?: Partial<Artifact['metadata']>) => {
    const experienceId = getExperienceId();
    if (!experienceId) {
      setState(prev => ({ ...prev, error: 'No experience ID found' }));
      return;
    }

    const sessionId = getExistingSessionId();
    if (!sessionId) {
      const error = 'No active session. Artifacts can only be updated during an active experience session.';
      setState(prev => ({ ...prev, error }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/artifacts/${artifactId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-experience-id': experienceId,
          'x-session-id': sessionId
        },
        body: JSON.stringify({ content, metadata })
      });

      if (!response.ok) {
        throw new Error(`Failed to update artifact: ${response.statusText}`);
      }

      const updatedArtifact = await response.json();
      
      setState(prev => ({
        ...prev,
        artifacts: prev.artifacts.map(a => a.id === artifactId ? updatedArtifact : a),
        isLoading: false
      }));

      safelyEmitEvent({
        type: "artifact.updated",
        artifact: {
          id: updatedArtifact.id,
          name: updatedArtifact.name,
          type: updatedArtifact.type
        }
      }, "trigger response");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update artifact';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
    }
  }, [getExperienceId, safelyEmitEvent]);

  const deleteArtifact = useCallback(async (artifactId: string) => {
    const experienceId = getExperienceId();
    if (!experienceId) {
      setState(prev => ({ ...prev, error: 'No experience ID found' }));
      return;
    }

    const sessionId = getExistingSessionId();
    if (!sessionId) {
      const error = 'No active session. Artifacts can only be deleted during an active experience session.';
      setState(prev => ({ ...prev, error }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/artifacts/${artifactId}`, {
        method: 'DELETE',
        headers: {
          'x-experience-id': experienceId,
          'x-session-id': sessionId
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete artifact: ${response.statusText}`);
      }
      
      // Instead of filtering local state, fetch fresh data from the API using our listArtifacts function
      try {
        const freshArtifacts = await listArtifacts();
        
        setState(prev => ({
          ...prev,
          artifacts: freshArtifacts,
          isLoading: false
        }));
      } catch (_listError) {
        // If fetching fresh list fails, fall back to filtering local state
        setState(prev => ({
          ...prev,
          artifacts: prev.artifacts.filter(a => a.id !== artifactId),
          isLoading: false
        }));
      }

      safelyEmitEvent({
        type: "artifact.deleted",
        artifactId
      }, "trigger response");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete artifact';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
    }
  }, [getExperienceId, safelyEmitEvent, listArtifacts]);

  return (
    <ArtifactContext.Provider
      value={{
        artifacts: state.artifacts,
        isLoading: state.isLoading,
        error: state.error,
        listArtifacts,
        createArtifact,
        getArtifact,
        updateArtifact,
        deleteArtifact
      }}
    >
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifact() {
  const context = useContext(ArtifactContext);
  if (!context) {
    throw new Error('useArtifact must be used within an ArtifactProvider');
  }
  return context;
} 