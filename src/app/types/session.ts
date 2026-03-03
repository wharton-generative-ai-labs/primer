/**
 * Session management types for the application.
 * Used by the server to track user sessions.
 */

export interface Session {
  id: string;
  created_at: number;
  last_active: number;
  status: 'connected' | 'disconnected';
  data: Record<string, any>;
}

export interface SessionStore {
  sessions: Map<string, Session>;
  get: (id: string) => Session | undefined;
  set: (id: string, session: Session) => void;
  delete: (id: string) => void;
  update: (id: string, updates: Partial<Session>) => void;
}

