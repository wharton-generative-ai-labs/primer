/**
 * Socket.IO event types for client-server communication.
 * Defines the type-safe contract between the client and server.
 */

// Tool calling events
export interface ToolCallEvent {
  callId: string;
  toolName: string;
  args: any;
  sessionId: string;
  experienceId?: string;
  selectedAgentKey?: string;
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

// UI manipulation events
export interface UIElementShowEvent {
  callId: string;
  id: string;
}

export interface UIElementHideEvent {
  callId: string;
  id: string;
}

export interface UIElementMoveEvent {
  callId: string;
  id: string;
  x: number;
  y: number;
}

export interface UIElementResizeEvent {
  callId: string;
  id: string;
  w: number;
  h: number;
}

export interface UIElementMaximizeEvent {
  callId: string;
  id: string;
  maximized: boolean;
}

export interface UIElementDestroyEvent {
  callId: string;
  id: string;
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

export interface UIObserveResponseEvent {
  callId: string;
  elements: any[]; // PrimerUIElement[]
  viewport: {
    width: number;
    height: number;
  };
  insets: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export interface UISlideCreateEvent {
  callId: string;
  title: string;
  content: string;
  artifactId?: string;
  artifactName?: string;
  artifactType?: string;
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
  
  // UI manipulation events
  'ui.element.show': (data: UIElementShowEvent) => void;
  'ui.element.hide': (data: UIElementHideEvent) => void;
  'ui.element.move': (data: UIElementMoveEvent) => void;
  'ui.element.resize': (data: UIElementResizeEvent) => void;
  'ui.element.maximize': (data: UIElementMaximizeEvent) => void;
  'ui.element.destroy': (data: UIElementDestroyEvent) => void;
  'ui.observe.request': (data: UIObserveRequestEvent) => void;
  'ui.slide.create': (data: UISlideCreateEvent) => void;
  
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
  
  // UI state response
  'ui.observe.response': (data: UIObserveResponseEvent) => void;
  
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

