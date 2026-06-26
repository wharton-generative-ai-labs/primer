/**
 * Persisted artifact metadata (session artifact record / meta.json)
 */
export type SessionArtifactRecord = {
  id: string;
  name: string;
  type: string;
  filename: string;
  createdAt: string;
  updatedAt: string;
  /** Monotonic revision counter; absent on legacy artifacts until first rev-aware write */
  currentRev?: number;
  /** Author of the most recent rev. Denormalized from the head revision for
   *  tile-level display (LibraryView, etc.) without needing to fetch the
   *  revisions sidecar. Updated atomically with currentRev. */
  lastAuthor?: Author;
  agents?: unknown;
  metadata?: Record<string, unknown>;
};

export type Author =
  | { kind: 'user'; email: string; name?: string }
  | { kind: 'agent'; agentKey: string; name: string }
  | { kind: 'system' };

/** Resolved author input before persistence */
export type AuthorInput =
  | { kind: 'user'; email: string; name?: string }
  | { kind: 'agent'; agentKey: string }
  | { kind: 'system' };

export type ArtifactRevisionMeta = {
  rev: number;
  artifactId: string;
  contentHash: string;
  author: Author;
  workflowPhaseId?: string;
  parentRev: number | null;
  createdAt: string;
  message?: string;
};
