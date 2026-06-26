/**
 * Harness implementation of the shared `ToolContext` interface.
 *
 * The harness historically maintained its own parallel set of tool handlers
 * (see `tools.ts`). To kill the drift risk between those shadow handlers and
 * the real tools in `src/app/lib/tools/builtin/*`, migrated tools route through
 * this context. Each capability mutates `HarnessState` directly (no socket /
 * React-context bounce) and emits `state.change` summaries via the sink so
 * observers (TUI, autoplay) can refresh.
 *
 * Capabilities live here for the migrated tools: scene, workflowPhase,
 * finishExperience, information, note, artifact, checklist, observe.
 * Unmigrated tools still go through the shadow handlers in `tools.ts`.
 * When a future migration moves a shadow handler to the shared path,
 * add the capabilities it needs here.
 */

import type { Sink } from './sink';
import type { HarnessArtifact, HarnessState } from './state';
import type {
  CurrentWorkflowPhaseInfo,
  ToolContext,
  WorkflowPhaseToolOp,
  WorkflowPhaseToolResult,
} from '@/app/lib/tools/types';
import type { SoundToolContext } from '@/app/lib/tools/sound/types';
import type { ExperienceConfig } from '@/app/lib/types';
import type {
  WorkflowPhaseConfig,
  WorkflowPhaseState,
} from '@/app/lib/workflow-phases';
import {
  InvalidPhaseError,
  NoNextPhaseError,
  transition,
  type TransitionOp,
} from '@/app/lib/workflow-phases/WorkflowPhaseManager';
import type { Note } from '@/app/lib/tools/server/NoteStore';

/**
 * Build a synthesized `sendClientEvent` + `requestManager` pair that fulfils
 * tool round-trips entirely in-process. The real backend emits a UI event over
 * the socket, the client handler operates on real React state and replies via
 * `tool.result`; here we short-circuit by inspecting each event and resolving
 * the matching pending request directly against `HarnessState`.
 *
 * Tools that aren't yet migrated may still be invoked through the harness via
 * unrelated paths and emit unknown events; in that case we just no-op (the
 * pending request, if any, will time out — but that's the same as in
 * production without a connected client).
 */
function buildSocketShim(state: HarnessState): {
  sendClientEvent: NonNullable<ToolContext['sendClientEvent']>;
  requestManager: NonNullable<ToolContext['requestManager']>;
} {
  type Pending = { resolve: (value: any) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout };
  const pending = new Map<string, Pending>();

  const requestManager: NonNullable<ToolContext['requestManager']> = {
    createPendingRequest: (callId, _type, timeoutMs) => {
      return new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(callId);
          reject(new Error(`Timeout waiting for tool_result (callId: ${callId})`));
        }, timeoutMs);
        pending.set(callId, { resolve, reject, timeout });
      });
    },
    resolvePendingRequest: (callId, value) => {
      const p = pending.get(callId);
      if (!p) return;
      clearTimeout(p.timeout);
      pending.delete(callId);
      p.resolve(value);
    },
    rejectPendingRequest: (callId, error) => {
      const p = pending.get(callId);
      if (!p) return;
      clearTimeout(p.timeout);
      pending.delete(callId);
      p.reject(error);
    },
  };

  /**
   * Resolve the pending request for `callId` with `data`, mirroring how the
   * client-side `useHandleServerEvent` would after handling the UI event.
   * If no pending request exists, do nothing (some events are fire-and-forget).
   */
  const resolve = (callId: string | undefined, data: any) => {
    if (!callId) return;
    requestManager.resolvePendingRequest(callId, { status: 'success', data });
  };

  const sendClientEvent: NonNullable<ToolContext['sendClientEvent']> = (event) => {
    const evt = event as { type: string; data?: any };
    const data = evt.data ?? {};

    switch (evt.type) {
      case 'ui.note.display': {
        // Mirror useHandleServerEvent#ui.note.display: persist the note and
        // reply with { noteId }. The note has already been saved to the
        // (in-memory) store by note-tool — this just confirms display.
        if (data.note) {
          state.notes[data.note.id] = data.note as Note;
        }
        // Show the document panel so the notes tab is reachable, mirroring
        // the implicit visibility the React panel provides on display.
        state.documentVisible = true;
        state.documentTab = 'notes';
        resolve(data.callId, { noteId: data.note?.id });
        break;
      }
      case 'ui.note.update': {
        if (data.noteId && data.updates && state.notes[data.noteId]) {
          state.notes[data.noteId] = { ...state.notes[data.noteId], ...data.updates };
        }
        resolve(data.callId, { updated: true });
        break;
      }
      case 'ui.note.delete': {
        if (data.noteId) delete state.notes[data.noteId];
        resolve(data.callId, { deleted: true });
        break;
      }
      case 'ui.slide.create': {
        // Mirror the React handler: push the existing active slide to the
        // library and install the new one. `artifactId`/`artifactName`/
        // `artifactType` may be present when the call originated from the
        // `showArtifact` action; persist them so `observe` can reflect the
        // slide's origin.
        if (state.activeSlide) {
          state.slideLibrary.push(state.activeSlide);
        }
        const slide: HarnessState['activeSlide'] = {
          id: newId('slide'),
          title: data.title ?? '',
          content: data.content ?? '',
          ...(data.artifactId ? { artifactId: data.artifactId as string } : {}),
        };
        state.activeSlide = slide;
        state.documentVisible = true;
        state.documentTab = 'active';
        resolve(data.callId, { slideId: slide.id });
        break;
      }
      case 'ui.slide.list': {
        const items = state.slideLibrary.map((s) => ({
          id: s.id,
          title: s.title,
        }));
        if (state.activeSlide) {
          items.push({
            id: state.activeSlide.id,
            title: `${state.activeSlide.title} (active)`,
          });
        }
        resolve(data.callId, { slides: items });
        break;
      }
      case 'ui.slide.close': {
        if (state.activeSlide?.id === data.id) {
          state.activeSlide = null;
          resolve(data.callId, { closed: data.id });
          break;
        }
        const idx = state.slideLibrary.findIndex((s) => s.id === data.id);
        if (idx !== -1) {
          state.slideLibrary.splice(idx, 1);
          resolve(data.callId, { closed: data.id });
        } else {
          resolve(data.callId, {
            closed: null,
            error: `slide ${data.id} not found`,
          });
        }
        break;
      }
      case 'ui.observe.request': {
        // Build the same payload shape produced by the React handler in
        // useHandleServerEvent (case "ui.observe.request").
        const arrangement: 'document-only' | 'chat-only' =
          state.documentVisible ? 'document-only' : 'chat-only';

        const summariseSlide = (
          s: { id: string; title: string; artifactId?: string } | null,
        ) => {
          if (!s) return null;
          const base = {
            id: s.id,
            name: s.title,
            kind: s.artifactId ? ('artifact' as const) : ('document' as const),
          };
          if (!s.artifactId) return base;
          const artifact = state.artifacts[s.artifactId];
          const currentRev = artifact?.currentRev ?? 1;
          return { ...base, currentRev, focusedRev: currentRev };
        };

        const noteItems = Object.values(state.notes).map((n) => ({
          id: n.id,
          title: n.title || n.content?.split('\n')[0]?.slice(0, 60) || '(untitled)',
          color: n.color,
        }));

        const activeAgent = state.agents[state.activeAgentKey];

        resolve(data.callId, {
          layout: {
            arrangement,
            sceneVisible: state.sceneVisible,
            documentVisible: state.documentVisible,
            chatVisible: true,
          },
          activeDocument: summariseSlide(state.activeSlide),
          viewedDocument: summariseSlide(state.activeSlide),
          library: state.slideLibrary.map(summariseSlide).filter(Boolean),
          notes: { count: noteItems.length, items: noteItems },
          scene: { current: state.currentScene, visible: state.sceneVisible, available: [] },
          currentTab: state.documentTab,
          conversation: {
            currentAgent: activeAgent
              ? { key: state.activeAgentKey, name: activeAgent.name }
              : null,
            pendingAgent: null,
            isReconnecting: false,
          },
        });
        break;
      }
      default:
        // Unknown / unmigrated event: nothing to do. If a pending request was
        // registered for this callId it will time out — same as production
        // without a client.
        break;
    }
  };

  return { sendClientEvent, requestManager };
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface BuildHarnessToolContextArgs {
  state: HarnessState;
  sink: Sink;
  callId: string;
}

/**
 * Build a `ToolContext` backed by `HarnessState`. The returned object is a
 * fresh closure over the live `state` reference — tool handlers can mutate it
 * directly. The `callId` is stashed on `functionCallId` so handlers that emit
 * client events can correlate them to the originating tool call.
 */
export function buildHarnessToolContext(
  args: BuildHarnessToolContextArgs,
): ToolContext & SoundToolContext {
  const { state, sink, callId } = args;

  /**
   * Build a minimal `ExperienceConfig` from `HarnessState` for the workflow-
   * phase manager. The manager only reads `workflowPhases`, `agents`, and
   * `initialWorkflowPhase` — everything else is irrelevant. Cast through
   * `unknown` keeps the literal lean.
   */
  const buildExperienceConfig = (): ExperienceConfig => {
    return {
      agents: state.agents,
      workflowPhases: state.workflowPhases,
      initialWorkflowPhase: state.initialWorkflowPhase,
    } as unknown as ExperienceConfig;
  };

  // Synthesised socket round-trip used by `note` and `observe` (which call
  // `sendClientEvent` and await `requestManager.createPendingRequest`). The
  // pair is shared inside this context so the request raised in `note` is
  // resolved by the same shim's `sendClientEvent`.
  const { sendClientEvent, requestManager } = buildSocketShim(state);

  return {
    functionCallId: callId,
    experienceId: state.experienceId,
    selectedAgentKey: state.activeAgentKey,
    agents: state.agents,
    sendClientEvent,
    requestManager,

    // ── Agent transfer capabilities ──────────────────────────────────────
    /** Queue a destination agent for handoff. The harness's autoplay /
     * dispatch loop consumes `state.pendingAgentTransfer` separately to
     * actually swap the active agent — same shape as the React side, where
     * `useAgentSwitching` consumes the queued key. Accepts `null` to clear
     * a pending transfer (matches the canonical ToolContext signature). */
    setQueuedAgentTransfer: (key: string | null) => {
      state.pendingAgentTransfer = key;
      sink.emit({
        kind: 'state.change',
        summary: { pendingAgentTransfer: key },
      });
    },
    /** Record a structured handoff in the transcript. The harness has no
     * transcript UI, so we emit the sink's `agent.handoff` event observers
     * (TUI, sink consumers) can render. The real `addTranscriptHandoff`
     * accepts `from`/`to` as `string | undefined`; we fall back to an empty
     * string so the sink event always has the documented field shape. */
    addTranscriptHandoff: (fromName, toName, rationale) => {
      sink.emit({
        kind: 'agent.handoff',
        from: fromName ?? '',
        to: toName ?? '',
        rationale,
      });
    },

    // ── Toast / sound capabilities ───────────────────────────────────────
    /** The harness has no toast UI. We log it as a `state.change` summary so
     * the TUI / autoplay observer surfaces "toast: {title}" alongside the
     * other state events. The variant is preserved so consumers can style
     * destructive notifications differently if they want. */
    toast: ({ title, variant }) => {
      sink.emit({
        kind: 'state.change',
        summary: { toast: { title, variant: variant ?? 'default' } },
      });
    },

    /** Toggle the document panel without changing the active slide. The
     * real `slide` tool prefers this capability over firing a socket event.
     * Mirrors the existing shadow behavior and the React-side setter. */
    setDocumentVisible: (visible: boolean) => {
      state.documentVisible = visible;
      sink.emit({
        kind: 'state.change',
        summary: { documentVisible: visible },
      });
    },

    /** No real audio playback in the harness — just record what would have
     * played. The TUI surfaces this in the state feed so authors testing
     * narrative cues see "sound: success.mp3" without needing audio output. */
    getAvailableSounds: () => [],
    playSound: (sound, options) => {
      sink.emit({
        kind: 'state.change',
        summary: {
          sound: {
            name: sound,
            volume: options?.volume,
            loop: options?.loop ?? false,
          },
        },
      });
      return { result: true };
    },

    // ── Scene capabilities ────────────────────────────────────────────────
    /** Sets the active scene and reveals it. The real handler calls this
     * for side-effects only and reports back via `data: context.setScene(...)`
     * — since `setScene`'s type returns `void`, the LLM sees `undefined` data.
     * Matches the real-tool behavior; that's fine. */
    setScene: (scene: string) => {
      state.currentScene = scene;
      state.sceneVisible = true;
      sink.emit({
        kind: 'state.change',
        summary: { scene: state.currentScene, sceneVisible: true },
      });
    },
    /** Reveals the scene panel without changing the selected scene. */
    showScene: () => {
      state.sceneVisible = true;
      sink.emit({
        kind: 'state.change',
        summary: { sceneVisible: true },
      });
      return { result: true };
    },
    /** Hides the scene panel without changing the selected scene. */
    hideScene: () => {
      state.sceneVisible = false;
      sink.emit({
        kind: 'state.change',
        summary: { sceneVisible: false },
      });
      return { result: true };
    },
    /** The harness has no scene catalog (no resource manifest loaded) — return
     * an empty list, mirroring the original shadow handler's behavior. */
    getAvailableScenes: () => [],
    /** No-op success: the harness doesn't persist custom scene resources, but
     * we return success so the LLM doesn't think the request failed. */
    addCustomScene: (_sceneName: string, _imageUrl: string) => ({ result: true }),
    /** No-op success — see `addCustomScene`. */
    removeCustomScene: (_sceneName: string) => ({ result: true }),

    // ── Workflow-phase capabilities ───────────────────────────────────────
    /**
     * Apply a phase-state mutation via `WorkflowPhaseManager.transition`. The
     * harness reuses the same pure transition logic the real backend does, so
     * phase semantics (forward-only navigation, override consumption,
     * implicit completion on advance, etc.) match exactly.
     */
    setWorkflowPhase: async (
      op: WorkflowPhaseToolOp,
      meta?: { trigger?: 'agent' | 'user' | 'system'; reason?: string },
    ): Promise<WorkflowPhaseToolResult> => {
      try {
        const config = buildExperienceConfig();
        // Map the tool-layer op to the manager-layer op. The two share the
        // same `kind`s for the cases the tool supports; the manager has
        // additional kinds (`init`, `goTo`, etc.) the tool doesn't expose.
        let transitionOp: TransitionOp;
        switch (op.kind) {
          case 'complete':
            transitionOp = { kind: 'complete' };
            break;
          case 'advance':
            transitionOp = { kind: 'advance' };
            break;
          case 'nextPhase':
            transitionOp = { kind: 'nextPhase' };
            break;
          case 'set':
            transitionOp = { kind: 'set', targetPhase: op.targetPhase };
            break;
          case 'setNext':
            transitionOp = { kind: 'setNext', targetPhase: op.targetPhase };
            break;
          case 'markObjective':
            transitionOp = { kind: 'markObjective', id: op.id, ...(op.note ? { note: op.note } : {}) };
            break;
        }

        const result = transition(
          config,
          state.workflowPhaseState ?? undefined,
          state.experienceCompleted,
          {
            op: transitionOp,
            trigger: meta?.trigger ?? 'agent',
            reason: meta?.reason,
          },
        );
        state.workflowPhaseState = result.newState;
        state.experienceCompleted = result.experienceCompleted;
        state.workflowPhaseEvents.push(...result.eventsToAppend);

        sink.emit({
          kind: 'state.change',
          summary: {
            workflowPhase: result.newState.currentPhase,
            nextPhaseOverride: result.newState.nextPhaseOverride ?? null,
            experienceCompleted: result.experienceCompleted,
          },
        });

        return {
          result: true,
          currentPhase: result.newState.currentPhase,
          nextPhaseOverride: result.newState.nextPhaseOverride,
        };
      } catch (err) {
        if (err instanceof InvalidPhaseError || err instanceof NoNextPhaseError) {
          return { result: false, message: err.message };
        }
        // Unknown error — bubble up the message; the tool layer wraps it as
        // `status: 'error'` for the LLM.
        return {
          result: false,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },

    /** Snapshot of the active phase, plus pre-resolved next-phase metadata
     * (override-aware). Returns `null` when no phases are configured. */
    getCurrentWorkflowPhase: (): CurrentWorkflowPhaseInfo | null => {
      const phases = state.workflowPhases;
      const phaseState = state.workflowPhaseState;
      if (phases.length === 0 || !phaseState || !phaseState.currentPhase) {
        return null;
      }
      const idx = phases.findIndex(p => p.id === phaseState.currentPhase);
      if (idx < 0) return null;
      const current = phases[idx];
      const arrayNextId = idx + 1 < phases.length ? phases[idx + 1].id : undefined;
      const overrideId = phaseState.nextPhaseOverride;
      const resolvedNextPhaseId = overrideId ?? arrayNextId;
      return {
        id: current.id,
        title: current.title,
        index: idx,
        total: phases.length,
        isCompleted: phaseState.completedPhases.includes(current.id),
        nextPhaseOverride: overrideId,
        resolvedNextPhaseId,
      };
    },

    /** Ordered phase config, exactly as authored. */
    getWorkflowPhases: (): WorkflowPhaseConfig[] => state.workflowPhases,

    /** Underlying phase state — the workflowPhase tool's `discover` action
     * uses this for the visited / completed / furthest sets. */
    getWorkflowPhaseState: (): WorkflowPhaseState | null => state.workflowPhaseState,

    /** Surface a UI prompt asking the user whether to revisit `phaseId`.
     * Does not mutate state — the real consumers (web client) own the prompt
     * UI. The harness emits a state-change marker so observers can log it. */
    suggestWorkflowPhaseReturn: (phaseId: string, reason: string) => {
      sink.emit({
        kind: 'state.change',
        summary: {
          workflowSuggestReturn: { phase: phaseId, reason },
        },
      });
    },

    /**
     * Idempotently mark the experience complete. Routes through the manager's
     * `finishExperience` op so harness behavior matches the real path exactly
     * — including when no phases are declared. (In practice the tool is no
     * longer registered for phase-less experiences, so this branch should be
     * unreachable from the LLM; but if it is invoked directly via the harness
     * API, we fail the same way the real path does instead of silently
     * succeeding.)
     */
    finishExperience: async (reason?: string): Promise<{ result: boolean }> => {
      // Idempotent: a second call after the flag is already set is a no-op.
      if (state.experienceCompleted) {
        return { result: true };
      }
      const config = buildExperienceConfig();
      try {
        const result = transition(
          config,
          state.workflowPhaseState ?? undefined,
          state.experienceCompleted,
          {
            op: { kind: 'finishExperience' },
            trigger: 'agent',
            reason,
          },
        );
        state.workflowPhaseState = result.newState;
        state.experienceCompleted = result.experienceCompleted;
        state.workflowPhaseEvents.push(...result.eventsToAppend);
        sink.emit({
          kind: 'state.change',
          summary: { experienceCompleted: true, reason },
        });
        return { result: true };
      } catch (_err) {
        // Surface manager errors as `result: false` — the tool wrapper turns
        // it into an LLM-visible error. This is also where the no-phases case
        // now lands (manager throws InvalidPhaseError), matching the real
        // path's behavior exactly.
        return { result: false };
      }
    },

    // ── Information store ─────────────────────────────────────────────────
    /**
     * Backed directly by `state.information`. The real `information` tool
     * uses these four async methods; promises resolve synchronously since
     * everything is in-memory.
     */
    informationStore: {
      getAllKeys: async () => Object.keys(state.information),
      get: async (key) => (key in state.information ? state.information[key] : null),
      save: async (key, value) => {
        state.information[key] = String(value);
        sink.emit({
          kind: 'state.change',
          summary: { information: Object.keys(state.information) },
        });
      },
      delete: async (key) => {
        if (!(key in state.information)) return false;
        delete state.information[key];
        sink.emit({
          kind: 'state.change',
          summary: { information: Object.keys(state.information) },
        });
        return true;
      },
    },

    // ── Note store ────────────────────────────────────────────────────────
    /**
     * Backed by `state.notes` (keyed by note id). Mirrors the real
     * `NoteStore` API the `note` tool calls. The `note` tool also fires
     * `ui.note.*` events through `sendClientEvent`; the socket shim above
     * applies those mutations to `state.notes` and resolves the awaiting
     * pending request, so the round-trip completes in-process.
     */
    noteStore: {
      getAllNotes: async () => Object.values(state.notes),
      getNote: async (noteId) => state.notes[noteId] ?? null,
      saveNote: async (note) => {
        state.notes[note.id] = note;
      },
      updateNote: async (noteId, updates) => {
        if (!state.notes[noteId]) return null;
        state.notes[noteId] = { ...state.notes[noteId], ...updates };
        return state.notes[noteId];
      },
      deleteNote: async (noteId) => {
        if (!state.notes[noteId]) return false;
        delete state.notes[noteId];
        return true;
      },
    },

    // ── Artifact storage ──────────────────────────────────────────────────
    /**
     * Backed by `state.artifacts`. The harness mirrors the on-disk artifact
     * service — same shape (`{id, name, type, content, metadata?}`) so the
     * `artifact` and `checklist` tools work unchanged.
     */
    listArtifacts: async () => Object.values(state.artifacts),
    getArtifact: async (id, _includeContent, rev) => {
      const a = state.artifacts[id];
      if (!a) throw new Error(`Artifact not found: ${id}`);
      if (rev === undefined) return a;
      const entry = a.revisions.find(r => r.rev === rev);
      if (!entry) return null;
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        content: entry.content,
        rev: entry.rev,
      };
    },
    createArtifact: async (name, content, type) => {
      const id = newId('art');
      const createdAt = new Date().toISOString();
      const created: HarnessArtifact = {
        id,
        name,
        type,
        content,
        currentRev: 1,
        revisions: [{ rev: 1, content, createdAt }],
      };
      state.artifacts[id] = created;
      sink.emit({
        kind: 'state.change',
        summary: { artifacts: Object.keys(state.artifacts) },
      });
      return created;
    },
    updateArtifact: async (id, content) => {
      const a = state.artifacts[id];
      if (!a) throw new Error(`Artifact not found: ${id}`);
      if (a.content === content) return;
      const createdAt = new Date().toISOString();
      const nextRev = a.currentRev + 1;
      a.content = content;
      a.currentRev = nextRev;
      a.revisions.push({ rev: nextRev, content, createdAt });
      sink.emit({
        kind: 'state.change',
        summary: { artifactUpdated: id, currentRev: nextRev },
      });
    },
    deleteArtifact: async (id) => {
      if (!state.artifacts[id]) throw new Error(`Artifact not found: ${id}`);
      delete state.artifacts[id];
      sink.emit({
        kind: 'state.change',
        summary: { artifacts: Object.keys(state.artifacts) },
      });
    },

    // ── Checklist UI hook ─────────────────────────────────────────────────
    /**
     * `checklist showProgress` calls `context.showChecklist(id)` to surface
     * the checklist artifact in the document panel. Mirror that by setting
     * `activeChecklistId` and revealing the checklist tab.
     */
    showChecklist: (artifactId: string) => {
      state.activeChecklistId = artifactId;
      state.documentVisible = true;
      state.documentTab = 'checklist';
      sink.emit({
        kind: 'state.change',
        summary: { checklist: artifactId, documentVisible: true },
      });
    },
    hideChecklist: () => {
      state.activeChecklistId = null;
      sink.emit({
        kind: 'state.change',
        summary: { checklist: null },
      });
    },
  };
}
