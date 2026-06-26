// In-memory experience state for the harness. Plays the role of the three
// React contexts (Artifact, Layout, Transcript) in a single flat object.
import type { AgentConfig } from '../types';
import type { SessionEvent } from '../file-utils';
import { SESSION_EVENTS } from '../file-utils';
import type {
  WorkflowPhaseConfig,
  WorkflowPhaseState,
} from '../workflow-phases';
import type { Note } from '../tools/server/NoteStore';

export type DocumentTab = 'active' | 'notes' | 'library' | 'checklist';
export type WorkspaceLayout = 'document-only' | 'chat-only';

/** One snapshot in the harness in-memory revision chain (mirrors on-disk rev-N). */
export interface HarnessArtifactRevision {
  rev: number;
  content: string;
  createdAt: string;
}

export interface HarnessArtifact {
  id: string;
  name: string;
  type: string;
  content: string;
  /** Monotonic head revision; starts at 1 on create. */
  currentRev: number;
  /** Append-only history; last entry matches head `content` at `currentRev`. */
  revisions: HarnessArtifactRevision[];
}

export interface Slide {
  id: string;
  title: string;
  content: string;
  artifactId?: string;
}

export interface ChecklistState {
  id: string;
  title?: string;
  items: Array<{ text: string; done: boolean }>;
}

export interface HarnessState {
  experienceId: string;
  /**
   * Experience-level title from `experience.json`. The TUI uses this as the
   * fallback for the central `PhaseHeading`-equivalent display when the
   * current phase doesn't set its own `heading`. Optional because the harness
   * is sometimes booted with a synthetic config (tests, autoplay).
   */
  experienceTitle?: string;
  agents: Record<string, AgentConfig>;
  activeAgentKey: string;
  pendingAgentTransfer: string | null;

  // Artifact panel
  activeSlide: Slide | null;
  slideLibrary: Slide[];

  // Notes (sticky-note objects keyed by id). The shape mirrors the real
  // `Note` interface from NoteStore so the migrated `note` tool's
  // `noteStore` capability can read/write them directly.
  notes: Record<string, Note>;

  // Generic artifacts (note/artifact tools park here)
  artifacts: Record<string, HarnessArtifact>;

  // Information key/value store (cross-agent facts)
  information: Record<string, string>;

  // Visibility-driven layout
  sceneVisible: boolean;
  documentVisible: boolean;
  documentTab: DocumentTab;

  // Checklist
  activeChecklistId: string | null;
  checklists: Record<string, ChecklistState>;

  // Scene
  currentScene: string | null;

  // Audit — what the agent knows it did
  transcript: Array<{
    role: 'user' | 'assistant' | 'tool' | 'system';
    agentKey?: string;
    text?: string;
    toolName?: string;
    toolArgs?: unknown;
    toolResult?: unknown;
  }>;

  // Workflow-phase fields. Mirror the React-side seeding done by
  // createFreshSessionRow so the harness can drive the same phase semantics
  // through the shared real-tool handlers.
  workflowPhases: WorkflowPhaseConfig[];
  initialWorkflowPhase?: string;
  showPhaseCount?: boolean;
  workflowPhaseState: WorkflowPhaseState | null;
  experienceCompleted: boolean;
  /**
   * Append-only log of phase transition events. Mirrors the SessionEvents
   * emitted by `WorkflowPhaseManager.transition` in the real backend.
   */
  workflowPhaseEvents: SessionEvent[];
}

export interface CreateStateOptions {
  workflowPhases?: WorkflowPhaseConfig[];
  initialWorkflowPhase?: string;
  showPhaseCount?: boolean;
  /** Experience-level title for the TUI's heading display. */
  experienceTitle?: string;
}

export function createState(
  experienceId: string,
  agents: Record<string, AgentConfig>,
  initialAgentKey: string,
  _hasAudio: boolean,
  options: CreateStateOptions = {},
): HarnessState {
  const phases = options.workflowPhases ?? [];
  const initialPhaseId =
    options.initialWorkflowPhase ?? (phases.length > 0 ? phases[0].id : undefined);

  let workflowPhaseState: WorkflowPhaseState | null = null;
  const workflowPhaseEvents: SessionEvent[] = [];

  // Mirror createFreshSessionRow: when phases are declared, seed initial state
  // and append a WORKFLOW_PHASE_ENTERED event with direction=initial / trigger=system.
  if (phases.length > 0 && initialPhaseId) {
    workflowPhaseState = {
      currentPhase: initialPhaseId,
      furthestPhase: initialPhaseId,
      visited: [initialPhaseId],
      completedPhases: [],
      snapshots: {},
    };
    workflowPhaseEvents.push({
      event: SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
      agent: 'system',
      timestamp: new Date().toISOString(),
      data: {
        phase: initialPhaseId,
        trigger: 'system',
        direction: 'initial',
      },
    });
  }

  return {
    experienceId,
    experienceTitle: options.experienceTitle,
    agents,
    activeAgentKey: initialAgentKey,
    pendingAgentTransfer: null,
    activeSlide: null,
    slideLibrary: [],
    notes: {},
    artifacts: {},
    information: {},
    sceneVisible: false,
    documentVisible: false,
    documentTab: 'active',
    activeChecklistId: null,
    checklists: {},
    currentScene: null,
    transcript: [],
    workflowPhases: phases,
    initialWorkflowPhase: options.initialWorkflowPhase,
    showPhaseCount: options.showPhaseCount,
    workflowPhaseState,
    experienceCompleted: false,
    workflowPhaseEvents,
  };
}

export function stateSnapshot(s: HarnessState) {
  const layout: WorkspaceLayout = s.documentVisible ? 'document-only' : 'chat-only';

  // Phase summary block. `null` when no phases are configured — the TUI keys
  // off this to decide whether to render the `phase:` row at all.
  let phase: {
    index: number;
    total: number;
    currentId: string | null;
    currentTitle: string | null;
    completed: boolean;
    nextPhaseId: string | null;
    isOverride: boolean;
    experienceCompleted: boolean;
    showPhaseCount: boolean;
  } | null = null;
  if (s.workflowPhases.length > 0 && s.workflowPhaseState) {
    const phases = s.workflowPhases;
    const state = s.workflowPhaseState;
    const idx = phases.findIndex(p => p.id === state.currentPhase);
    const current = idx >= 0 ? phases[idx] : null;
    const arrayNextId =
      idx >= 0 && idx + 1 < phases.length ? phases[idx + 1].id : null;
    const overrideId = state.nextPhaseOverride ?? null;
    const nextPhaseId = overrideId ?? arrayNextId;
    const isOverride =
      overrideId !== null && overrideId !== undefined && overrideId !== arrayNextId;
    const completed = current
      ? state.completedPhases.includes(current.id)
      : false;
    phase = {
      index: idx,
      total: phases.length,
      currentId: current?.id ?? null,
      currentTitle: current?.title ?? null,
      completed,
      nextPhaseId,
      isOverride,
      experienceCompleted: s.experienceCompleted,
      // Default to `true` (count shown) when unset, matching the React UI.
      showPhaseCount: s.showPhaseCount !== false,
    };
  }

  // The TUI's top-panel "heading" follows the same rule as the React-side
  // `<PhaseHeading>`: the active phase's `heading` field if set; otherwise
  // the experience title. Returns `null` when neither is available.
  const currentPhaseConfig = s.workflowPhases.find(
    (p) => p.id === s.workflowPhaseState?.currentPhase,
  );
  const heading: string | null =
    currentPhaseConfig?.heading ?? s.experienceTitle ?? null;

  return {
    agent: { key: s.activeAgentKey, name: s.agents[s.activeAgentKey]?.name, pending: s.pendingAgentTransfer },
    heading,
    layout,
    panels: {
      chat: 'open',
      scene: s.sceneVisible ? 'open' : 'hidden',
      document: s.documentVisible ? 'open' : 'hidden',
      tab: s.documentTab,
    },
    activeSlide: s.activeSlide ? { id: s.activeSlide.id, title: s.activeSlide.title } : null,
    library: s.slideLibrary.map(l => ({ id: l.id, title: l.title })),
    artifacts: Object.values(s.artifacts).map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currentRev: a.currentRev,
    })),
    notes: Object.keys(s.notes),
    information: Object.keys(s.information),
    checklist: s.activeChecklistId
      ? (() => {
          // Migrated `checklist showProgress` points `activeChecklistId` at a
          // checklist *artifact* (markdown body with `- [ ]` / `- [x]` lines)
          // — not the legacy `state.checklists` map. Prefer the artifact's
          // content for progress; fall back to the legacy map for any
          // unmigrated callers.
          const id = s.activeChecklistId;
          const artifact = s.artifacts[id];
          if (artifact?.type === 'checklist' || artifact?.content?.match(/- \[[ x]\]/)) {
            const total = (artifact.content.match(/- \[[ x]\]/g) || []).length;
            const done = (artifact.content.match(/- \[x\]/g) || []).length;
            return { id, done, total };
          }
          return {
            id,
            done: s.checklists[id]?.items.filter(i => i.done).length ?? 0,
            total: s.checklists[id]?.items.length ?? 0,
          };
        })()
      : null,
    scene: { current: s.currentScene, visible: s.sceneVisible },
    phase,
  };
}
