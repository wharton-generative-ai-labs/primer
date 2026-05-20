import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useClientEvent } from './ClientEventContext';
import { useExperienceUrl } from '../hooks/useExperienceUrl';
import { getExistingSessionId } from '../lib/session-utils';
import type { ArtifactRevisionMeta, Author } from '@/app/lib/artifacts/types';
import type { PanelActiveContent, PanelStateRecord } from '@/app/lib/panel-state';
import {
  enrichPanelDocumentFromArtifacts,
  filterComponentEntriesFromPanel,
} from '@/app/lib/panel-state-restore';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { createModuleLogger } from '@/lib/logger';

const artifactLogger = createModuleLogger('ArtifactContext');

export type ActiveContent = PanelActiveContent;
export type { PanelStateRecord };

export interface Artifact {
  id: string;
  name: string;
  content: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  /** Revision counter when artifact uses session revision storage */
  currentRev?: number;
  /** Author of the most recent rev. Denormalized at write time so the library
   *  can render `Agent · Version N` without fetching the revisions sidecar. */
  lastAuthor?: Author;
  metadata?: {
    description?: string;
    tags?: string[];
    presentation?: {
      type: 'slide' | 'editor' | 'checklist' | 'none';
      options?: Record<string, any>;
    };
  };
}

/**
 * Document panel slot content — see {@link PanelActiveContent} in `@/app/lib/panel-state`.
 * Agents populate via slide / mermaid / customComponent tools.
 */

/**
 * Stable identity key for de-duping panel content. For documents we prefer
 * `artifactId` so multiple slide UUIDs targeting the same underlying
 * artifact don't multiply tiles in the All Documents panel; every
 * `slide.show` / `slide.showArtifact` call generates a fresh `slideId` (see
 * `useHandleServerEvent` `ui.slide.create` handler), so id-based dedup
 * misses re-shows of the same doc. Falls back to `kind:id` for documents
 * without an `artifactId` (ad-hoc slides) and for diagrams / components.
 *
 * Exported so the document panel can build a single deduped list combining
 * the active content with the past-document library for the All Documents
 * tab without risking double-render of the active doc.
 */
export function panelContentDedupKey(content: PanelActiveContent): string {
  if (content.kind === 'document' && content.artifactId) {
    return `doc:${content.artifactId}`;
  }
  return `${content.kind}:${content.id}`;
}

async function fetchArtifactsListFromApi(
  experienceId: string,
  sessionId: string,
): Promise<{
  artifacts: Artifact[];
  revisionsByArtifact: Record<string, ArtifactRevisionMeta[] | undefined>;
}> {
  const timestamp = Date.now();
  const response = await fetch(`/api/artifacts/list?expand=revisions&t=${timestamp}`, {
    headers: {
      'x-experience-id': experienceId,
      'x-session-id': sessionId,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list artifacts: ${response.statusText}`);
  }

  const data = await response.json();
  const rawList: Array<Artifact & { revisions?: ArtifactRevisionMeta[] }> = Array.isArray(data) ? data : [];

  const artifacts: Artifact[] = rawList.map(({ revisions: _r, ...rest }) => rest);
  const revisionsByArtifact: Record<string, ArtifactRevisionMeta[] | undefined> = {};
  for (const a of rawList) {
    if (Array.isArray(a.revisions)) revisionsByArtifact[a.id] = a.revisions;
  }

  return { artifacts, revisionsByArtifact };
}

interface ArtifactState {
  artifacts: Artifact[];
  isLoading: boolean;
  error: string | null;
  /** The AI's pointer: the document the agent most recently showed. */
  activeContent: ActiveContent | null;
  /** Previously-shown documents the user hasn't dismissed. Newest first. */
  library: ActiveContent[];
  /** If the user clicked a library item to view, this is that item's id.
   *  Otherwise the view follows `activeContent`. Reset whenever the AI shows
   *  new content (so "new stuff from the agent" always wins the viewport). */
  viewedContentId: string | null;
  /** Currently surfaced checklist artifact id, shown in the document
   *  panel's Checklist tab. Null hides the tab. */
  activeChecklistId: string | null;
  /** Which revision is focused in the doc panel per artifact */
  viewState: Record<string, { focusedRev: number }>;
  /** Lazy revision list metadata per artifact */
  revisionsByArtifact: Record<string, ArtifactRevisionMeta[] | undefined>;
}

interface ArtifactContextType {
  artifacts: Artifact[];
  isLoading: boolean;
  error: string | null;
  listArtifacts: () => Promise<Artifact[]>;
  /** Eager artifact list fetch for play load / resume (explicit ids). */
  bootstrapArtifactsForSession: (params: {
    experienceId: string;
    sessionId: string;
  }) => Promise<Artifact[]>;
  /** Restore persisted document panel snapshot; merges doc content from `artifactsSnapshot`. */
  seedPanelState: (record: PanelStateRecord, artifactsSnapshot: Artifact[]) => void;
  /** Clear panel slice (library, activeContent, viewedContentId, activeChecklistId)
   *  and stale revision sidecars. Called at the start of each experience bootstrap
   *  so cross-experience navigations don't leak documents from a prior session
   *  into the All Documents panel when no saved panel-state exists for the new one. */
  resetPanelState: () => void;
  createArtifact: (
    name: string,
    content: string,
    type: string,
    metadata?: Artifact['metadata'],
    options?: { agentKey?: string },
  ) => Promise<Artifact>;
  /** Read an artifact. Pass `rev` to fetch a specific past revision (used by
   *  the agent's `artifact.get(rev?)` tool when answering "explain this
   *  section" while the user is on a historical version). Omit for the
   *  head. */
  getArtifact: (artifactId: string, rev?: number) => Promise<Artifact | null>;
  updateArtifact: (
    artifactId: string,
    content: string,
    metadata?: Partial<Artifact['metadata']>,
    options?: { agentKey?: string },
  ) => Promise<void>;
  deleteArtifact: (artifactId: string) => Promise<void>;
  /** AI's current "active document" pointer. Displayed when the user isn't
   *  explicitly viewing a library item. */
  activeContent: ActiveContent | null;
  /** Previously-shown documents, newest first. */
  library: ActiveContent[];
  /** What's actually rendered in the document area — `activeContent` unless
   *  the user has clicked a library item to view. */
  viewedContent: ActiveContent | null;
  /** Display content. The current `activeContent` (if any) is pushed to the
   *  library, the new content becomes active, and the user's manual view
   *  override is cleared so the newly-shown doc is surfaced. */
  showContent: (content: ActiveContent) => void;
  /** Remove content. If `id` matches the active doc, the newest library item
   *  is promoted. If `id` matches a library item, it's just removed. */
  clearContent: (id?: string) => void;
  /** AI-callable: pull a library item back into the active slot. */
  focusDocument: (id: string) => void;
  /** User-callable: temporarily view a library item without changing the
   *  AI's active pointer. Pass `null` to snap back to `activeContent`. */
  viewDocument: (id: string | null) => void;
  /** Checklist artifact id currently surfaced in the document panel.
   *  Null means no checklist is active and the tab is hidden. */
  activeChecklistId: string | null;
  setActiveChecklist: (artifactId: string | null) => void;
  viewState: Record<string, { focusedRev: number }>;
  revisionsByArtifact: Record<string, ArtifactRevisionMeta[] | undefined>;
  setFocusedRev: (artifactId: string, rev: number) => void;
  ensureRevisionsList: (artifactId: string) => Promise<void>;
  restoreRevision: (artifactId: string, rev: number) => Promise<void>;
  /** Insert or replace an artifact + (optionally) its revisions list. Called
   *  by frontend write paths and by the backend-write socket listener so the
   *  banner / switcher / library all update from a single canonical action. */
  mergeArtifactUpdate: (params: {
    artifact: Artifact;
    revisions?: ArtifactRevisionMeta[];
  }) => void;
  /** Drop an artifact from local state by id. Mirrors mergeArtifactUpdate for
   *  the backend artifact.deleted socket path. */
  removeArtifactById: (artifactId: string) => void;
}

const defaultContextValue: ArtifactContextType = {
  artifacts: [],
  isLoading: false,
  error: null,
  listArtifacts: async () => [],
  bootstrapArtifactsForSession: async () => [],
  seedPanelState: () => {},
  resetPanelState: () => {},
  createArtifact: async () => ({ id: '', name: '', content: '', type: '', createdAt: '', updatedAt: '' }),
  getArtifact: async () => null,
  updateArtifact: async () => {},
  deleteArtifact: async () => {},
  activeContent: null,
  library: [],
  viewedContent: null,
  showContent: () => {},
  clearContent: () => {},
  focusDocument: () => {},
  viewDocument: () => {},
  activeChecklistId: null,
  setActiveChecklist: () => {},
  viewState: {},
  revisionsByArtifact: {},
  setFocusedRev: () => {},
  ensureRevisionsList: async () => {},
  restoreRevision: async () => {},
  mergeArtifactUpdate: () => {},
  removeArtifactById: () => {},
};

const ArtifactContext = createContext<ArtifactContextType>(defaultContextValue);

export function ArtifactProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ArtifactState>({
    artifacts: [],
    isLoading: false,
    error: null,
    activeContent: null,
    library: [],
    viewedContentId: null,
    activeChecklistId: null,
    viewState: {},
    revisionsByArtifact: {},
  });

  const setActiveChecklist = useCallback((artifactId: string | null) => {
    setState(prev => ({ ...prev, activeChecklistId: artifactId }));
  }, []);

  const showContent = useCallback((content: ActiveContent) => {
    setState(prev => {
      const incomingKey = panelContentDedupKey(content);
      // If we're just re-showing the already-active content (or a fresh slide
      // pointing to the same underlying artifact, since each slide.show call
      // mints a new slideId), swap in the new payload without demoting a
      // duplicate of the same doc into the library.
      if (
        prev.activeContent &&
        panelContentDedupKey(prev.activeContent) === incomingKey
      ) {
        return { ...prev, activeContent: content, viewedContentId: null };
      }
      const demoted = prev.activeContent;
      // De-dupe library by stable identity: drop any prior entry that points
      // to the same content (matches by id) or to the same underlying
      // document artifact (matches by artifactId), so multiple slide UUIDs
      // referencing one artifactId can't multiply tiles in All Documents.
      const filtered = prev.library.filter(
        item =>
          item.id !== content.id &&
          panelContentDedupKey(item) !== incomingKey,
      );
      const library = demoted ? [demoted, ...filtered] : filtered;
      return {
        ...prev,
        activeContent: content,
        library,
        viewedContentId: null,
      };
    });
  }, []);

  const clearContent = useCallback((id?: string) => {
    setState(prev => {
      // Dismissing a library item
      if (id && prev.activeContent?.id !== id) {
        const library = prev.library.filter(item => item.id !== id);
        const viewedContentId = prev.viewedContentId === id ? null : prev.viewedContentId;
        return { ...prev, library, viewedContentId };
      }
      // Dismissing the active doc — promote the newest library item if any,
      // so the document area doesn't suddenly blank.
      if (id && prev.activeContent?.id === id) {
        const [promoted, ...rest] = prev.library;
        return {
          ...prev,
          activeContent: promoted ?? null,
          library: rest,
          viewedContentId: null,
        };
      }
      // Called with no id: clear everything (legacy behavior).
      return { ...prev, activeContent: null, viewedContentId: null };
    });
  }, []);

  const focusDocument = useCallback((id: string) => {
    setState(prev => {
      if (prev.activeContent?.id === id) {
        return { ...prev, viewedContentId: null };
      }
      const target = prev.library.find(item => item.id === id);
      if (!target) return prev;
      const demoted = prev.activeContent;
      const filtered = prev.library.filter(item => item.id !== id);
      const library = demoted ? [demoted, ...filtered] : filtered;
      return {
        ...prev,
        activeContent: target,
        library,
        viewedContentId: null,
      };
    });
  }, []);

  const viewDocument = useCallback((id: string | null) => {
    setState(prev => {
      if (id === null) return { ...prev, viewedContentId: null };
      // Only honor the view if the id is actually something we have.
      const isActive = prev.activeContent?.id === id;
      const inLibrary = prev.library.some(item => item.id === id);
      if (!isActive && !inLibrary) return prev;
      return { ...prev, viewedContentId: isActive ? null : id };
    });
  }, []);

  const clientEventContext = useClientEvent();
  const { getExperienceId } = useExperienceUrl();
  const { data: session, status: sessionStatus } = useSession();
  const { toast } = useToast();
  const prevArtifactRev = useRef<Map<string, number>>(new Map());
  const artifactsRef = useRef(state.artifacts);
  artifactsRef.current = state.artifacts;
  const skipNextPanelPersistRef = useRef(false);

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

  // Seed viewState when new artifacts appear in the list
  useEffect(() => {
    setState((prev) => {
      let vs = prev.viewState;
      let changed = false;
      for (const a of prev.artifacts) {
        if (vs[a.id] === undefined) {
          vs = { ...vs, [a.id]: { focusedRev: a.currentRev ?? 1 } };
          changed = true;
        }
      }
      return changed ? { ...prev, viewState: vs } : prev;
    });
  }, [state.artifacts]);

  // On currentRev bump: auto-advance focusedRev when the user was on the
  // previous head ("Updated" banner case). Leave focusedRev alone otherwise
  // so a user reading a historical rev isn't yanked back to the latest by
  // an agent edit ("Historical" banner case — Restore is the only way out).
  //
  // We deliberately do NOT evict `revisionsByArtifact[id]` here. The
  // eviction was a holdover from the pre-eager-revisions design where the
  // bump arrived without a fresh list; today every bump comes through
  // `mergeArtifactUpdate` (frontend writes + the backend
  // `primer:artifact-changed` socket fan-out) with the revisions inlined.
  // Wiping the cache would defeat that — it would leave the
  // VersionSwitcher dropdown empty between an agent edit and the next
  // dropdown open. `ensureRevisionsList` is still wired as a lazy fallback
  // for any legacy path that mutates currentRev without a merge.
  useEffect(() => {
    setState((prev) => {
      let viewState = { ...prev.viewState };
      let changed = false;

      for (const a of prev.artifacts) {
        const id = a.id;
        const cr = a.currentRev ?? 1;
        const oldTracked = prevArtifactRev.current.get(id);

        if (oldTracked === undefined) {
          prevArtifactRev.current.set(id, cr);
          continue;
        }

        if (cr > oldTracked) {
          prevArtifactRev.current.set(id, cr);
          const foc = viewState[id]?.focusedRev ?? cr;
          if (foc === oldTracked) {
            viewState = { ...viewState, [id]: { focusedRev: cr } };
            changed = true;
          }
        } else {
          prevArtifactRev.current.set(id, cr);
        }
      }

      return changed ? { ...prev, viewState } : prev;
    });
  }, [state.artifacts]);

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
      const { artifacts, revisionsByArtifact } = await fetchArtifactsListFromApi(experienceId, sessionId);

      setState(prev => ({
        ...prev,
        artifacts,
        revisionsByArtifact: { ...prev.revisionsByArtifact, ...revisionsByArtifact },
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

  const bootstrapArtifactsForSession = useCallback(
    async ({ experienceId, sessionId }: { experienceId: string; sessionId: string }) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const { artifacts, revisionsByArtifact } = await fetchArtifactsListFromApi(experienceId, sessionId);
        setState((prev) => ({
          ...prev,
          artifacts,
          revisionsByArtifact: { ...prev.revisionsByArtifact, ...revisionsByArtifact },
          isLoading: false,
        }));
        return artifacts;
      } catch (error) {
        artifactLogger.warn({ err: error, experienceId, sessionId }, 'bootstrapArtifactsForSession failed');
        const errorMessage = error instanceof Error ? error.message : 'Failed to list artifacts';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
        return [];
      }
    },
    [],
  );

  const seedPanelState = useCallback((record: PanelStateRecord, artifactsSnapshot: Artifact[]) => {
    skipNextPanelPersistRef.current = true;

    let activeContent: PanelActiveContent | null = record.activeContent;
    if (activeContent?.kind === 'component') {
      artifactLogger.info(
        { id: activeContent.id, componentId: activeContent.componentId },
        'Skipping active component on panel restore (v1)',
      );
      activeContent = null;
    }

    let library = filterComponentEntriesFromPanel(record.library, (item) => {
      artifactLogger.info(
        { id: item.id, componentId: item.componentId },
        'Skipping library component entry on panel restore (v1)',
      );
    });
    const heads = artifactsSnapshot.map((a) => ({
      id: a.id,
      name: a.name,
      content: a.content,
    }));
    activeContent = enrichPanelDocumentFromArtifacts(activeContent, heads);
    library = library.map(
      (item) => enrichPanelDocumentFromArtifacts(item, heads) as PanelActiveContent,
    );

    // Drop legacy duplicates that may already be persisted on disk: prior
    // releases keyed library entries by slide UUID, so the same artifact
    // could appear multiple times. Keep the first occurrence (newest first
    // ordering is preserved) and skip any whose key matches the current
    // active content.
    const activeKey = activeContent ? panelContentDedupKey(activeContent) : null;
    const seenLibraryKeys = new Set<string>();
    library = library.filter((item) => {
      const key = panelContentDedupKey(item);
      if (activeKey && key === activeKey) return false;
      if (seenLibraryKeys.has(key)) return false;
      seenLibraryKeys.add(key);
      return true;
    });

    const validIds = new Set<string>();
    if (activeContent) validIds.add(activeContent.id);
    for (const item of library) {
      validIds.add(item.id);
    }
    let viewedContentId = record.viewedContentId;
    if (viewedContentId && !validIds.has(viewedContentId)) {
      viewedContentId = null;
    }

    setState((prev) => ({
      ...prev,
      activeContent,
      library,
      viewedContentId,
      activeChecklistId: record.activeChecklistId,
    }));
  }, []);

  // Wipe panel slice + revision sidecars when navigating between experiences
  // so the All Documents panel doesn't leak entries from a prior session.
  // Skip the next debounced PUT so the cleared snapshot doesn't overwrite the
  // incoming experience's saved panel-state on disk; bootstrap / seedPanelState
  // run immediately after this and own the next persist tick.
  const resetPanelState = useCallback(() => {
    skipNextPanelPersistRef.current = true;
    setState((prev) => ({
      ...prev,
      activeContent: null,
      library: [],
      viewedContentId: null,
      activeChecklistId: null,
      revisionsByArtifact: {},
    }));
  }, []);

  // Insert or replace an artifact in local state. If the caller has the
  // revisions list (from an API response or a socket payload), populate it;
  // otherwise leave it for the auto-advance effect to evict and re-fetch via
  // ensureRevisionsList. Stable identity so it can be safely referenced from
  // socket handlers without re-subscribing.
  const mergeArtifactUpdate = useCallback(
    ({ artifact, revisions }: { artifact: Artifact; revisions?: ArtifactRevisionMeta[] }) => {
      setState((prev) => {
        const idx = prev.artifacts.findIndex((a) => a.id === artifact.id);
        const prevArtifact = idx !== -1 ? prev.artifacts[idx] : undefined;
        const artifacts =
          idx === -1
            ? [...prev.artifacts, artifact]
            : prev.artifacts.map((a) => (a.id === artifact.id ? artifact : a));
        const revisionsByArtifact = revisions
          ? { ...prev.revisionsByArtifact, [artifact.id]: revisions }
          : prev.revisionsByArtifact;

        // Advance focusedRev atomically in the same setState so
        // DocumentContentWithRevisions never sees currentRev=NEW with
        // focusedRev=OLD and incorrectly fetches the old revision.
        // Only advances when the user was already on the previous head.
        const newRev = artifact.currentRev ?? 1;
        const oldRev = prevArtifact?.currentRev ?? 1;
        const currentFocused = prev.viewState[artifact.id]?.focusedRev;
        const shouldAdvance = newRev > oldRev && currentFocused === oldRev;
        const viewState = shouldAdvance
          ? { ...prev.viewState, [artifact.id]: { focusedRev: newRev } }
          : prev.viewState;

        return { ...prev, artifacts, revisionsByArtifact, viewState };
      });
    },
    [],
  );

  const removeArtifactById = useCallback((artifactId: string) => {
    setState((prev) => {
      const next = { ...prev.revisionsByArtifact };
      delete next[artifactId];
      const viewState = { ...prev.viewState };
      delete viewState[artifactId];
      return {
        ...prev,
        artifacts: prev.artifacts.filter((a) => a.id !== artifactId),
        revisionsByArtifact: next,
        viewState,
        viewedContentId:
          prev.viewedContentId === artifactId ? null : prev.viewedContentId,
      };
    });
  }, []);

  // Subscribe to backend-agent socket events. SocketController dispatches
  // these as window CustomEvents (same pattern as primer:component-event)
  // so we don't need a direct socket handle here. Without this, anything
  // the backend agent writes is invisible to the doc panel until the user
  // refreshes — banner, switcher, library all stay stale.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{
        artifactId: string;
        artifact: Artifact;
        revisions?: ArtifactRevisionMeta[];
      }>).detail;
      if (!detail?.artifact) return;
      mergeArtifactUpdate({ artifact: detail.artifact, revisions: detail.revisions });
    };

    const onDeleted = (e: Event) => {
      const detail = (e as CustomEvent<{ artifactId: string }>).detail;
      if (!detail?.artifactId) return;
      removeArtifactById(detail.artifactId);
    };

    window.addEventListener('primer:artifact-changed', onChanged);
    window.addEventListener('primer:artifact-deleted', onDeleted);
    return () => {
      window.removeEventListener('primer:artifact-changed', onChanged);
      window.removeEventListener('primer:artifact-deleted', onDeleted);
    };
  }, [mergeArtifactUpdate, removeArtifactById]);

  // Persist document panel snapshot for session resume (debounced).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (skipNextPanelPersistRef.current) {
      skipNextPanelPersistRef.current = false;
      return;
    }

    const experienceId = getExperienceId();
    const sessionId = getExistingSessionId();
    if (!experienceId || !sessionId) return;

    const timer = window.setTimeout(() => {
      const payload: PanelStateRecord = {
        activeContent: state.activeContent,
        library: state.library,
        viewedContentId: state.viewedContentId,
        activeChecklistId: state.activeChecklistId,
        updatedAt: new Date().toISOString(),
      };
      void fetch(`/api/sessions/${encodeURIComponent(sessionId)}/panel-state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-experience-id': experienceId,
        },
        body: JSON.stringify(payload),
      }).catch((err) => {
        artifactLogger.debug({ err }, 'panel-state PUT failed');
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    state.activeContent,
    state.library,
    state.viewedContentId,
    state.activeChecklistId,
    getExperienceId,
  ]);

  const createArtifact = useCallback(async (
    name: string,
    content: string,
    type: string,
    metadata?: Artifact['metadata'],
    options?: { agentKey?: string },
  ) => {
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
          'x-session-id': sessionId,
          ...(options?.agentKey ? { 'x-agent-key': options.agentKey } : {}),
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

      const data = (await response.json()) as Artifact & { revisions?: ArtifactRevisionMeta[] };
      const { revisions, ...artifact } = data;

      mergeArtifactUpdate({ artifact, revisions });
      setState((prev) => ({ ...prev, isLoading: false }));

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
  }, [getExperienceId, safelyEmitEvent, session, mergeArtifactUpdate]);

  const getArtifact = useCallback(async (artifactId: string, rev?: number) => {
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
      // Branch on rev: head fetch hits /api/artifacts/{id}, revision fetch
      // hits /api/artifacts/{id}/revisions/{rev}. Both return content +
      // metadata; the rev path also includes the per-rev author/timestamp.
      const url =
        rev !== undefined
          ? `/api/artifacts/${artifactId}/revisions/${rev}`
          : `/api/artifacts/${artifactId}`;
      const response = await fetch(url, {
        headers: {
          'x-experience-id': experienceId,
          'x-session-id': sessionId
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch artifact: ${response.statusText}`);
      }

      const artifact = await response.json();
      // Merge the head fetch back into local state so callers that just
      // wanted the canonical content body (e.g. ResultPhaseSurface filling
      // in the gap when the bootstrap list response lost a race against
      // the agent's write) cause a re-render — not just the imperative
      // caller. Skip on revision fetches: the revision endpoint returns a
      // historical body and merging it would clobber the head record's
      // content with stale text.
      if (rev === undefined && artifact && typeof artifact === 'object' && artifact.id) {
        mergeArtifactUpdate({ artifact: artifact as Artifact });
      }
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
  }, [getExperienceId, mergeArtifactUpdate]);

  const updateArtifact = useCallback(async (
    artifactId: string,
    content: string,
    metadata?: Partial<Artifact['metadata']>,
    options?: { agentKey?: string },
  ) => {
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
          'x-session-id': sessionId,
          ...(options?.agentKey ? { 'x-agent-key': options.agentKey } : {}),
        },
        body: JSON.stringify({
          content,
          metadata,
          userName: session?.user?.name,
          userEmail: session?.user?.email,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update artifact: ${response.statusText}`);
      }

      const updatedArtifact = (await response.json()) as Artifact & {
        content: string;
        revisions?: ArtifactRevisionMeta[];
        noop?: boolean;
      };

      if (updatedArtifact.noop) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const { revisions, noop: _noop, ...rest } = updatedArtifact;
      const merged: Artifact = { ...rest, content: rest.content };

      mergeArtifactUpdate({ artifact: merged, revisions });
      setState((prev) => ({ ...prev, isLoading: false }));

      safelyEmitEvent(
        {
          type: 'artifact.updated',
          artifact: {
            id: merged.id,
            name: merged.name,
            type: merged.type,
          },
        },
        'trigger response',
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update artifact';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
    }
  }, [getExperienceId, safelyEmitEvent, session, mergeArtifactUpdate]);

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

  const setFocusedRev = useCallback((artifactId: string, rev: number) => {
    setState((prev) => {
      const current = prev.viewState[artifactId]?.focusedRev;
      if (current === rev) return prev;
      // Fire-and-forget window event so RealtimeController can inject a
      // system message ("User is now viewing {doc} version {N}") into the
      // realtime conversation. Window events keep the context decoupled
      // from the realtime stack — same pattern as primer:component-event.
      // Skip when no artifact match is found (defensive; shouldn't happen
      // in practice).
      if (typeof window !== 'undefined') {
        const artifact = prev.artifacts.find((a) => a.id === artifactId);
        if (artifact) {
          window.dispatchEvent(
            new CustomEvent('primer:document-focus-rev-change', {
              detail: {
                artifactId,
                docName: artifact.name,
                rev,
                currentRev: artifact.currentRev ?? 1,
                source: 'user',
              },
            }),
          );
        }
      }
      return {
        ...prev,
        viewState: { ...prev.viewState, [artifactId]: { focusedRev: rev } },
      };
    });
  }, []);

  const ensureRevisionsList = useCallback(
    async (artifactId: string) => {
      const experienceId = getExperienceId();
      const sessionId = getExistingSessionId();
      if (!experienceId || !sessionId) return;

      const response = await fetch(`/api/artifacts/${artifactId}/revisions`, {
        headers: {
          'x-experience-id': experienceId,
          'x-session-id': sessionId,
        },
      });

      if (!response.ok) return;

      const data = (await response.json()) as { revisions: ArtifactRevisionMeta[] };
      setState((prev) => ({
        ...prev,
        revisionsByArtifact: { ...prev.revisionsByArtifact, [artifactId]: data.revisions },
      }));
    },
    [getExperienceId],
  );

  const restoreRevision = useCallback(
    async (artifactId: string, rev: number) => {
      const experienceId = getExperienceId();
      const sessionId = getExistingSessionId();
      if (!experienceId || !sessionId) return;

      const prevHead = artifactsRef.current.find((a) => a.id === artifactId)?.content;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(`/api/artifacts/${artifactId}/revisions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-experience-id': experienceId,
            'x-session-id': sessionId,
          },
          body: JSON.stringify({
            action: 'restore',
            rev,
            userName: session?.user?.name,
            userEmail: session?.user?.email,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to restore: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          artifact: Artifact;
          content: string;
          revisions?: ArtifactRevisionMeta[];
        };
        const merged: Artifact = {
          ...data.artifact,
          content: data.content,
        };

        mergeArtifactUpdate({ artifact: merged, revisions: data.revisions });
        // Snap the focusedRev pointer to the new head: restore appended a
        // fresh rev with the restored content, so what the user sees in the
        // doc panel must match.
        const newRev = merged.currentRev ?? 1;
        setState((prev) => ({
          ...prev,
          viewState: {
            ...prev.viewState,
            [artifactId]: { focusedRev: newRev },
          },
          isLoading: false,
        }));
        // Mirror setFocusedRev's window event so the agent learns that
        // the user is now on the (newly-created) head revision.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('primer:document-focus-rev-change', {
              detail: {
                artifactId,
                docName: merged.name,
                rev: newRev,
                currentRev: newRev,
                source: 'user',
              },
            }),
          );
        }

        toast({
          title: `Restored to version ${rev}`,
          action: (
            <ToastAction
              altText="Undo restore"
              onClick={() => {
                if (prevHead !== undefined) {
                  void updateArtifact(artifactId, prevHead);
                }
              }}
            >
              Undo
            </ToastAction>
          ),
          duration: 6000,
        });

        safelyEmitEvent(
          {
            type: 'artifact.updated',
            artifact: {
              id: merged.id,
              name: merged.name,
              type: merged.type,
            },
          },
          'trigger response',
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to restore revision';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
      }
    },
    [getExperienceId, safelyEmitEvent, session, toast, updateArtifact, mergeArtifactUpdate],
  );

  // viewedContent is derived: the explicitly-viewed library item if any,
  // otherwise the active doc. Kept on each render rather than in state so
  // library/active changes stay the single source of truth.
  const viewedContent =
    (state.viewedContentId
      ? state.library.find(item => item.id === state.viewedContentId) ?? null
      : null) ?? state.activeContent;

  return (
    <ArtifactContext.Provider
      value={{
        artifacts: state.artifacts,
        isLoading: state.isLoading,
        error: state.error,
        listArtifacts,
        bootstrapArtifactsForSession,
        seedPanelState,
        resetPanelState,
        createArtifact,
        getArtifact,
        updateArtifact,
        deleteArtifact,
        activeContent: state.activeContent,
        library: state.library,
        viewedContent,
        showContent,
        clearContent,
        focusDocument,
        viewDocument,
        activeChecklistId: state.activeChecklistId,
        setActiveChecklist,
        viewState: state.viewState,
        revisionsByArtifact: state.revisionsByArtifact,
        setFocusedRev,
        ensureRevisionsList,
        restoreRevision,
        mergeArtifactUpdate,
        removeArtifactById,
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
