/**
 * Socket.IO event types for client-server communication.
 * Defines the type-safe contract between the client and server.
 */

import type { SessionArtifactRecord, ArtifactRevisionMeta } from '@/app/lib/artifacts/types';

// Tool calling events
export interface ToolCallEvent {
  callId: string;
  toolName: string;
  args: any;
  sessionId: string;
  experienceId?: string;
  selectedAgentKey?: string;
}

// Artifact mutation events fired by backend agent writes. The frontend
// merges these into ArtifactContext so the banner / switcher / library
// stay in sync without polling. User-initiated frontend writes use the
// REST response path instead — both eventually call the same
// mergeArtifactUpdate action.
export interface ArtifactChangedEvent {
  sessionId: string;
  artifactId: string;
  artifact: SessionArtifactRecord;
  revisions: ArtifactRevisionMeta[];
}

export interface ArtifactDeletedEvent {
  sessionId: string;
  artifactId: string;
}

export interface ToolResultEvent {
  callId: string;
  status: 'success' | 'error';
  data: any;
}

export interface ToolResponseEvent {
  callId: string;
  status: 'success' | 'error';
  data: any;
}

// Component events
export interface UIComponentCreateEvent {
  callId: string;
  componentId: string;
  initialState: Record<string, any>;
  experienceId?: string;
}

export interface UIComponentUpdateStateEvent {
  callId: string;
  instanceId: string;
  stateUpdates: Record<string, any>;
}

export interface UIComponentGetStateEvent {
  callId: string;
  instanceId: string;
}

export interface UIComponentClearCacheEvent {
  callId: string;
  componentId: string;
}

// Component runtime events (fired by user interaction with components)
export interface ComponentEventMessage {
  instanceId: string;
  componentId: string;
  eventType: string;
  eventData: any;
  timestamp: number;
}

export interface ComponentStateChangeMessage {
  instanceId: string;
  componentId: string;
  stateChanges: Record<string, any>;
  timestamp: number;
}

export interface UIObserveRequestEvent {
  callId: string;
}

export interface UISlideCreateEvent {
  callId: string;
  title: string;
  content: string;
  artifactId?: string;
  artifactName?: string;
  artifactType?: string;
}

export interface UISlideListEvent {
  callId: string;
}

export interface UISlideCloseEvent {
  callId: string;
  id: string;
}

export interface UIDocumentVisibilityEvent {
  callId: string;
  visible: boolean;
}

// Note UI events
export interface UINoteSyncEvent {
  callId: string;
  notes: any[];
}

export interface UINoteDisplayEvent {
  callId: string;
  note: any;
}

export interface UINoteHideEvent {
  callId: string;
  noteId: string;
}

export interface UINoteDeleteEvent {
  callId: string;
  noteId: string;
}

export interface UINoteUpdateEvent {
  callId: string;
  noteId: string;
  updates: any;
}

export interface UINoteGetScreenDimensionsEvent {
  callId: string;
}

// Agent delegation event
export interface AgentDelegateEvent {
  callId: string;
  agentType: string;
  artifactIds?: string[];
  taskDescription?: string;
  experienceId: string;
  sessionId: string;
  delegationId: string;
  imageNames?: string[];
}

export interface ServerToClientEvents {
  'server:message': (data: any) => void;
  'connect': () => void;
  'disconnect': () => void;
  'connect_error': (err: Error) => void;
  
  // UI tool events
  'ui.observe.request': (data: UIObserveRequestEvent) => void;
  'ui.slide.create': (data: UISlideCreateEvent) => void;
  'ui.slide.list': (data: UISlideListEvent) => void;
  'ui.slide.close': (data: UISlideCloseEvent) => void;
  'ui.document.visibility': (data: UIDocumentVisibilityEvent) => void;
  
  // Component events
  'ui.component.create': (data: UIComponentCreateEvent) => void;
  'ui.component.updateState': (data: UIComponentUpdateStateEvent) => void;
  'ui.component.getState': (data: UIComponentGetStateEvent) => void;
  'ui.component.clearCache': (data: UIComponentClearCacheEvent) => void;
  
  // Note UI events
  'ui.note.sync': (data: UINoteSyncEvent) => void;
  'ui.note.display': (data: UINoteDisplayEvent) => void;
  'ui.note.hide': (data: UINoteHideEvent) => void;
  'ui.note.delete': (data: UINoteDeleteEvent) => void;
  'ui.note.update': (data: UINoteUpdateEvent) => void;
  'ui.note.getScreenDimensions': (data: UINoteGetScreenDimensionsEvent) => void;
  
  // Tool response (final result for client-initiated calls)
  'tool.response': (data: ToolResponseEvent) => void;
  
  // Delegation events
  'delegation:status': (data: { sessionId: string; delegationId: string; status: string; agentName?: string }) => void;
  'delegation:tool': (data: { sessionId: string; delegationId: string; toolName: string; agentName?: string; action?: string }) => void;
  'delegation:complete': (data: { delegationId: string }) => void;

  // Agent transfer event (backend-first agent tool)
  'agent.transfer.queue': (data: { destinationKey: string; fromName: string; toName: string; rationale: string }) => void;
  
  // Component runtime events (forwarded back to frontend for agent consumption)
  'component.event.forward': (data: ComponentEventMessage) => void;
  'component.stateChange.forward': (data: ComponentStateChangeMessage) => void;
  
  // Admin agent run events (management pages)
  'agent.run:status': (data: { runId: string; status: string; agentName?: string; toolName?: string; action?: string }) => void;
  'agent.run:complete': (data: { runId: string; status: 'success' | 'error'; message?: string; totalToolCalls?: number; error?: string }) => void;

  // Backend-agent-driven artifact mutations (see ArtifactChangedEvent docs)
  'artifact.changed': (data: ArtifactChangedEvent) => void;
  'artifact.deleted': (data: ArtifactDeletedEvent) => void;
}

export interface ClientToServerEvents {
  'client:message': (data: {
    message: string;
    timestamp: number;
  }) => void;
  
  // Tool calling
  'tool.call': (data: ToolCallEvent) => void;
  
  // Tool results from UI operations
  'tool.result': (data: ToolResultEvent) => void;
  
  // Agent delegation
  'agent.delegate': (data: AgentDelegateEvent) => void;
  
  // Component runtime events (user interactions)
  'component.event': (data: ComponentEventMessage, ack?: (response: { received: boolean }) => void) => void;
  'component.stateChange': (data: ComponentStateChangeMessage) => void;
  
  // Admin agent run (management pages)
  'agent.run': (data: {
    runId: string;
    experienceId: string;
    sessionId: string;
    agentKey: string;
    taskDescription?: string;
    artifactIds?: string[];
    classId?: string;
  }, ack?: (response: { received: boolean }) => void) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  sessionId?: string;
  experienceId?: string;
  agentKey?: string;
  selectedAgentKey?: string;
}
