import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { AgentConfig } from "../lib/types";
import { useHandleServerEvent } from "../hooks/useHandleServerEvent";
import { createModuleLogger } from "@/lib/logger";
import { env } from "@/config/env";
import { setGlobalSocket } from "@/app/lib/tools/client/tool-calling-shim";
import type {
  UIObserveRequestEvent,
  UISlideCreateEvent,
  UIDocumentVisibilityEvent,
  UIComponentCreateEvent,
  UIComponentUpdateStateEvent,
  UIComponentGetStateEvent,
  UIComponentClearCacheEvent,
  ToolResponseEvent,
  ArtifactChangedEvent,
  ArtifactDeletedEvent
} from "@/app/types/socket";

const logger = createModuleLogger('SocketController');

// Define types for Socket and io to use until we load the actual library
type Socket = any;
type IoFunction = (url: string, options: any) => Socket;

interface SocketControllerProps {
  selectedAgentKey: string;
  agents: Record<string, AgentConfig>;
  toolsRegistered?: boolean;
  isDebugModeEnabled: boolean;
  aiConfigurations?: Record<string, any>;
  selectedAgentAiConfiguration?: string;
  showChecklist?: (artifactId: string) => void;
  hideChecklist?: () => void;
  autoConnect?: boolean;
  experienceId?: string;
  setQueuedAgentTransfer?: (key: string | null) => void;
  addTranscriptBreadcrumb?: (message: string, data?: any) => void;
}

export interface SocketControllerRef {
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
}

export const SocketController = forwardRef<SocketControllerRef, SocketControllerProps>(({
  selectedAgentKey,
  agents,
  toolsRegistered: _toolsRegistered,
  isDebugModeEnabled,
  aiConfigurations: _aiConfigurations,
  selectedAgentAiConfiguration: _selectedAgentAiConfiguration,
  showChecklist,
  hideChecklist,
  autoConnect: _autoConnect = false,
  experienceId,
  setQueuedAgentTransfer: onQueuedAgentTransfer,
  addTranscriptBreadcrumb: onTranscriptBreadcrumb,
}, ref) => {
  const socketRef = useRef<Socket | null>(null);
  const ioRef = useRef<IoFunction | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const experienceIdRef = useRef<string | undefined>(experienceId);
  const selectedAgentKeyRef = useRef<string | undefined>(selectedAgentKey);
  selectedAgentKeyRef.current = selectedAgentKey;
  const isConnectingRef = useRef<boolean>(false);

  // SocketController handles socket events for UI operations (slides, components, notes, etc.)
  // but does NOT handle conversation injection - that's RealtimeController's job.
  // The sendClientEvent here is a no-op since conversation events go through RealtimeController.
  const handleServerEvent = useHandleServerEvent({
    setSessionStatus: () => {},
    selectedAgentKey,
    agents,
    sendClientEvent: (_eventObj: any, _eventNameSuffix?: string) => {
      // No-op: Conversation events (conversation.item.create, response.create) should go
      // through RealtimeController, not SocketController. SocketController only handles
      // socket-based UI operations like slides, notes, components, etc.
    },
    setIsAIAudioPlaying: () => {},
    setQueuedAgentTransfer: () => {},
    isDebugModeEnabled,
    showChecklist,
    hideChecklist,
    onSessionUpdated: () => {},
  });

  const connectToSocket = async () => {
    if (isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;

    try {
      // Dynamically import socket.io-client to work around ESM compatibility issues
      if (!ioRef.current) {
        try {
          const socketIO = await import('socket.io-client');
          ioRef.current = socketIO.io;
        } catch (error) {
          logger.error(error, 'Failed to load socket.io-client');
          isConnectingRef.current = false;
          return;
        }
      }
      
      // Try to restore existing session ID from sessionStorage
      const existingSessionId = sessionStorage.getItem('primer:session-id');
      if (existingSessionId && !sessionIdRef.current) {
        sessionIdRef.current = existingSessionId;
      }
      
      const socketUrl = env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3000';

      logger.info({ 
        socketUrl, 
        sessionId: sessionIdRef.current,
        existingSessionId,
        hasSessionId: !!sessionIdRef.current
      }, 'Connecting to socket server');

      const socket = ioRef.current(socketUrl, {
        path: '/api/socketio',
        addTrailingSlash: false,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        auth: {
          sessionId: sessionIdRef.current,
          experienceId: experienceIdRef.current,
          selectedAgentKey: selectedAgentKeyRef.current,
          userName: sessionStorage.getItem('primer:user-name') || undefined,
          userEmail: sessionStorage.getItem('primer:user-email') || undefined
        }
      });

      socketRef.current = socket;

      socket.io.engine.on('upgradeError', (error: Error) => {
        logger.error(error, 'Transport upgrade error');
      });

      socket.on('connect', () => {
        logger.info({ 
          socketId: socket.id, 
          sessionId: sessionIdRef.current,
          transport: socket.io.engine?.transport?.name
        }, 'Socket connected successfully');
        // Set global socket for server-first tools
        setGlobalSocket(socket);
      });

      socket.on('disconnect', () => {
        // Clear global socket
        setGlobalSocket(null);
      });

      socket.on('connect_error', (error: Error & { description?: string; context?: any }) => {
        logger.error({
          err: error,
          message: error.message,
          description: error.description,
          context: error.context,
          transport: socket.io.engine?.transport?.name
        }, 'Socket connection error');
      });

      socket.on('server:message', (data: any) => {
        // Log all server messages for debugging
        logger.debug({ 
          messageType: data.type, 
          data: data.data,
          sessionId: sessionIdRef.current,
          socketId: socket.id
        }, 'Received server:message');
        
        // Handle delegation status updates
        if (data.type === 'delegation.status') {
          logger.info({ 
            delegationId: data.data.delegationId,
            status: data.data.status,
            agentName: data.data.agentName,
            toolName: data.data.toolName,
            action: data.data.action,
            sessionId: sessionIdRef.current
          }, 'Processing delegation.status message');
          
          import('@/app/lib/tools/delegation/DelegationManager').then(({ getDelegationManager }) => {
            const manager = getDelegationManager();
            manager.updateDelegationStatus(
              data.data.delegationId, 
              data.data.status, 
              data.data.agentName,
              data.data.toolName,
              data.data.action
            );
            logger.info({ delegationId: data.data.delegationId }, 'Delegation status updated in manager');
          }).catch((error) => {
            logger.error({ error }, 'Failed to import DelegationManager');
          });
        }
        
        if (data.type === 'socket.session.connected' && data.session?.id) {
          const existingStorageId = sessionStorage.getItem('primer:session-id');
          
          // Only update ref if we have an existing session in storage. The
          // /play/ RSC + chooseSessionAction own session creation now; the
          // socket adopts the id, never mints one.
          if (existingStorageId) {
            sessionIdRef.current = data.session.id;
            
            // Warn if there's a mismatch (shouldn't happen normally)
            if (existingStorageId !== data.session.id) {
              logger.warn({ storage: existingStorageId, socket: data.session.id }, 'Session ID mismatch');
            }
          }
        }
        
        handleServerEvent.current(data);
      });

      // Listen for direct UI events from server-first tools
      socket.on('ui.observe.request', (data: UIObserveRequestEvent) => {
        handleServerEvent.current({ type: 'ui.observe.request', data });
      });

      socket.on('ui.slide.create', (data: UISlideCreateEvent) => {
        handleServerEvent.current({ type: 'ui.slide.create', data });
      });

      socket.on('ui.slide.list', (data: { callId: string }) => {
        handleServerEvent.current({ type: 'ui.slide.list', data });
      });

      socket.on('ui.slide.close', (data: { callId: string; id: string }) => {
        handleServerEvent.current({ type: 'ui.slide.close', data });
      });

      socket.on('ui.document.visibility', (data: UIDocumentVisibilityEvent) => {
        handleServerEvent.current({ type: 'ui.document.visibility', data });
      });

      // Component tool UI events
      socket.on('ui.component.create', (data: UIComponentCreateEvent) => {
        handleServerEvent.current({ type: 'ui.component.create', data });
      });

      socket.on('ui.component.updateState', (data: UIComponentUpdateStateEvent) => {
        handleServerEvent.current({ type: 'ui.component.updateState', data });
      });

      socket.on('ui.component.getState', (data: UIComponentGetStateEvent) => {
        handleServerEvent.current({ type: 'ui.component.getState', data });
      });

      socket.on('ui.component.clearCache', (data: UIComponentClearCacheEvent) => {
        handleServerEvent.current({ type: 'ui.component.clearCache', data });
      });

      // Component runtime events - dispatch as custom DOM events for RealtimeController to handle
      // This avoids race conditions with socket availability
      socket.on('component.event.forward', (data: any) => {
        logger.info({ componentId: data.componentId, eventType: data.eventType }, 'Received component.event.forward, dispatching DOM event');
        window.dispatchEvent(new CustomEvent('primer:component-event', { detail: data }));
      });

      socket.on('component.stateChange.forward', (data: any) => {
        logger.debug({ componentId: data.componentId }, 'Received component.stateChange.forward');
        window.dispatchEvent(new CustomEvent('primer:component-state-change', { detail: data }));
      });

      // Backend agent artifact mutations: dispatch as window events so
      // ArtifactContext can call mergeArtifactUpdate / removeArtifactById
      // without us needing a direct context handle here. Same pattern as
      // primer:component-event above.
      socket.on('artifact.changed', (data: ArtifactChangedEvent) => {
        logger.debug({ artifactId: data.artifactId }, 'Received artifact.changed');
        window.dispatchEvent(new CustomEvent('primer:artifact-changed', { detail: data }));
      });

      socket.on('artifact.deleted', (data: ArtifactDeletedEvent) => {
        logger.debug({ artifactId: data.artifactId }, 'Received artifact.deleted');
        window.dispatchEvent(new CustomEvent('primer:artifact-deleted', { detail: data }));
      });

      // Note tool UI events
      socket.on('ui.note.sync', (data: any) => {
        handleServerEvent.current({ type: 'ui.note.sync', data });
      });

      socket.on('ui.note.display', (data: any) => {
        handleServerEvent.current({ type: 'ui.note.display', data });
      });

      socket.on('ui.note.hide', (data: any) => {
        handleServerEvent.current({ type: 'ui.note.hide', data });
      });

      socket.on('ui.note.delete', (data: any) => {
        handleServerEvent.current({ type: 'ui.note.delete', data });
      });

      socket.on('ui.note.update', (data: any) => {
        handleServerEvent.current({ type: 'ui.note.update', data });
      });

      socket.on('ui.note.getScreenDimensions', (data: any) => {
        handleServerEvent.current({ type: 'ui.note.getScreenDimensions', data });
      });

      socket.on('tool.response', (data: ToolResponseEvent) => {
        handleServerEvent.current({ type: 'tool.response', data });
      });

      // Listen for delegation status updates
      socket.on('delegation:status', (data: any) => {
        logger.debug({ delegationId: data.delegationId, status: data.status }, 'Received delegation:status');
        import('@/app/lib/tools/delegation/DelegationManager').then(({ getDelegationManager }) => {
          const manager = getDelegationManager();
          manager.updateDelegationStatus(
            data.delegationId,
            data.status,
            data.agentName
          );
        }).catch((error) => {
          logger.error({ error }, 'Failed to import DelegationManager');
        });
      });

      // Listen for delegation tool execution updates
      socket.on('delegation:tool', (data: any) => {
        logger.debug({ delegationId: data.delegationId, toolName: data.toolName }, 'Received delegation:tool');
        import('@/app/lib/tools/delegation/DelegationManager').then(({ getDelegationManager }) => {
          const manager = getDelegationManager();
          manager.updateDelegationStatus(
            data.delegationId,
            '',
            data.agentName,
            data.toolName,
            data.action
          );
        }).catch((error) => {
          logger.error({ error }, 'Failed to import DelegationManager');
        });
      });

      // Listen for delegation completion (server-initiated delegations)
      socket.on('delegation:complete', (data: { delegationId: string }) => {
        logger.debug({ delegationId: data.delegationId }, 'Received delegation:complete');
        import('@/app/lib/tools/delegation/DelegationManager').then(({ getDelegationManager }) => {
          getDelegationManager().completeDelegation(data.delegationId);
        }).catch((error) => {
          logger.error({ error }, 'Failed to import DelegationManager');
        });
      });

      // Listen for agent transfer events from backend-first agent tool
      socket.on('agent.transfer.queue', (data: { destinationKey: string; fromName: string; toName: string; rationale: string }) => {
        logger.info({ from: data.fromName, to: data.toName, destinationKey: data.destinationKey }, 'Received agent.transfer.queue');
        onQueuedAgentTransfer?.(data.destinationKey);
        onTranscriptBreadcrumb?.("Agent transfer queued", {
          from: data.fromName,
          to: data.toName,
          rationale: data.rationale
        });
      });

    } catch (err) {
      logger.error(err, 'Error connecting to socket');
    } finally {
      isConnectingRef.current = false;
    }
  };

  const disconnectFromSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setGlobalSocket(null);
  };

  const reconnectToSocket = async () => {
    disconnectFromSocket();
    await connectToSocket();
  };

  useImperativeHandle(ref, () => ({
    connect: () => connectToSocket(),
    disconnect: disconnectFromSocket,
    reconnect: () => reconnectToSocket(),
  }));

  // Effect to handle cleanup on unmount
  useEffect(() => {
    // Connection is handled manually via the ref.connect() method rather than automatically on mount.
    // Only handle cleanup on unmount
    return () => {
      disconnectFromSocket();
    };
  }, []); // Empty dependency array - only runs on mount/unmount

  return null;
});

SocketController.displayName = 'SocketController';
