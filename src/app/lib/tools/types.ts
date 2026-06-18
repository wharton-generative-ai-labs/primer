/**
 * Core type definitions for the tool system.
 * 
 * These types define the standard interfaces for tools, their responses,
 * and the context they receive when executed.
 */

import { ComponentEvent, ComponentStateChangeEvent } from './ui/components/types';
import type {
  WorkflowPhaseConfig,
  WorkflowPhaseState,
} from '@/app/lib/workflow-phases';

export interface ToolResponse {
  status: 'success' | 'error';
  data: any;
}

/** Operation accepted by `ToolContext.setWorkflowPhase`. */
export type WorkflowPhaseToolOp =
  | { kind: 'complete' | 'advance' | 'nextPhase' }
  | { kind: 'set' | 'setNext'; targetPhase: string }
  | { kind: 'markObjective'; id: string; note?: string };

/** Result returned by `ToolContext.setWorkflowPhase`. */
export interface WorkflowPhaseToolResult {
  result: boolean;
  message?: string;
  /** The current phase id after the op completes (post-state). */
  currentPhase?: string;
  /** The active forward override after the op completes (if any). */
  nextPhaseOverride?: string;
}

/** Snapshot of the current workflow phase exposed to the tool layer. */
export interface CurrentWorkflowPhaseInfo {
  id: string;
  title: string;
  index: number;
  total: number;
  isCompleted: boolean;
  nextPhaseOverride?: string;
  resolvedNextPhaseId?: string;
}

export interface ToolContext {
  functionCallId?: string;
  transcriptItems?: any[];
  selectedAgentKey?: string;
  agents?: Record<string, any>;
  experienceId?: string;
  /**
   * Session id for backend tool execution. Set by `createServerToolContext`;
   * undefined on browser-built contexts (which fall back to
   * `sessionStorage`). Tools that need a session id should prefer this field
   * before reaching for browser-only globals so they keep working when called
   * from a delegated backend agent.
   */
  sessionId?: string;
  /** Set by class analytics orchestration so analytics tools can resolve class scope. */
  classId?: string;
  setScene?: (scene: string) => void;
  showScene?: () => { result: boolean; message?: string };
  hideScene?: () => { result: boolean; message?: string };
  setDocumentVisible?: (visible: boolean) => void;
  sendClientEvent?: (event: any) => void;
  showFileUpload?: (prompt: string, functionCallId: string) => void;
  addTranscriptBreadcrumb?: (title: string, data: any) => void;
  addTranscriptHandoff?: (fromName: string | undefined, toName: string | undefined, rationale?: string) => void;
  setQueuedAgentTransfer?: (key: string | null) => void;
  showArtifact?: (id: string) => Promise<void>;
  listArtifacts?: () => Promise<any[]>;
  /** Read an artifact. Pass `rev` to fetch a specific past revision; omit to
   *  fetch the head. The `includeContent` flag is legacy and currently
   *  ignored by both implementations (head and revision fetches always
   *  include content). */
  getArtifact?: (id: string, includeContent?: boolean, rev?: number) => Promise<any>;
  createArtifact?: (
    name: string,
    content: string,
    type: string,
    metadata?: unknown,
    options?: { agentKey?: string },
  ) => Promise<any>;
  updateArtifact?: (
    id: string,
    content: string,
    metadata?: unknown,
    options?: { agentKey?: string },
  ) => Promise<void>;
  deleteArtifact?: (id: string) => Promise<void>;
  getSceneUrl?: (scene: string) => string;
  getAvailableScenes?: () => string[];
  addCustomScene?: (sceneName: string, imageUrl: string) => { result: boolean; message?: string };
  removeCustomScene?: (sceneName: string) => { result: boolean; message?: string };
  // Checklist management functions
  showChecklist?: (artifactId: string) => void;
  hideChecklist?: () => void;
  // Information store (backend-first, used by server-side tool handler)
  informationStore?: {
    getAllKeys: () => Promise<string[]>;
    get: (key: string) => Promise<string | null>;
    save: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<boolean>;
  };
  // Note store (backend-first, used by server-side tool handler)
  noteStore?: {
    getAllNotes: () => Promise<any[]>;
    getNote: (noteId: string) => Promise<any | null>;
    saveNote: (note: any) => Promise<void>;
    updateNote: (noteId: string, updates: any) => Promise<any | null>;
    deleteNote: (noteId: string) => Promise<boolean>;
  };
  // Request manager for socket communication
  requestManager?: {
    createPendingRequest: (callId: string, type: string, timeout: number) => Promise<any>;
    resolvePendingRequest: (callId: string, result: any) => void;
    rejectPendingRequest: (callId: string, error: Error) => void;
  };
  // Toast notification function
  toast?: (options: { title: string; variant?: 'default' | 'destructive' }) => void;
  
  // Custom component event callbacks
  onComponentEvent?: (event: ComponentEvent) => void;
  onComponentStateChange?: (event: ComponentStateChangeEvent) => void;
  
  // Experience management functions
  createExperience?: () => Promise<string>;
  copyTemplate?: (templateExperienceId: string) => Promise<string>;
  createDirectory?: (experienceId: string, path: string) => Promise<void>;
  createFile?: (experienceId: string, path: string, content: string, contentEncoding?: string) => Promise<void>;
  deleteDirectory?: (experienceId: string, path: string) => Promise<void>;
  deleteFile?: (experienceId: string, path: string) => Promise<void>;
  moveFile?: (experienceId: string, sourcePath: string, destinationPath: string) => Promise<void>;
  moveDirectory?: (experienceId: string, sourcePath: string, destinationPath: string) => Promise<void>;
  listResources?: (experienceId: string) => Promise<any[]>;
  getResourceContent?: (experienceId: string, path: string) => Promise<{ content: string; contentType: string; isText: boolean; fileUrl?: string }>;

  // Workflow-phase capabilities. Optional because not every consumer wires
  // them up (legacy contexts, isolated tests).
  /**
   * Apply a phase-state mutation. `complete` and `advance` operate on the
   * current phase. `set` jumps forward to a named phase (backward refused).
   * `setNext` records a forward override and does not navigate.
   */
  setWorkflowPhase?: (
    op: WorkflowPhaseToolOp,
    meta?: { trigger?: 'agent' | 'user' | 'system'; reason?: string },
  ) => Promise<WorkflowPhaseToolResult>;
  /** Returns metadata for the active phase or null if no phases are configured. */
  getCurrentWorkflowPhase?: () => CurrentWorkflowPhaseInfo | null;
  /** Returns the ordered phase list from the experience config. */
  getWorkflowPhases?: () => WorkflowPhaseConfig[];
  /** Optional accessor for the underlying state (visited, completed, override). */
  getWorkflowPhaseState?: () => WorkflowPhaseState | null;
  /**
   * Surfaces a UI prompt asking the user whether to revisit `phaseId`.
   * Does not transition. The UI consumer owns what to render.
   */
  suggestWorkflowPhaseReturn?: (phaseId: string, reason: string) => void;
  /**
   * Mark the entire experience complete. Routes to the workflow-phase
   * manager's `finishExperience` op (sets the `experienceCompleted` flag and
   * emits `EXPERIENCE_COMPLETED`). Idempotent: a second call after the flag
   * is already set returns `{ result: true }` but emits no new event.
   */
  finishExperience?: (reason?: string) => Promise<{ result: boolean }>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      [key: string]: any;
    }>;
    required: string[];
  };
  handler: (args: any, context: ToolContext) => Promise<ToolResponse>;
  requiredContext?: string[];
}

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  tools: ToolDefinition[];
}
