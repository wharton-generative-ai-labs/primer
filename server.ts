// Validate environment variables first - fail fast if missing
import './src/config/env';

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import OpenAI from 'openai';
import type { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from './src/app/types';
import { env, ensureEnvInitialized } from './src/config/env';
import { createModuleLogger } from './src/lib/logger';

// Initialize server in async IIFE to wait for env initialization
(async () => {
  // Ensure env is initialized before using it
  await ensureEnvInitialized();

  const logger = createModuleLogger('socket-server');

  const dev = env.NODE_ENV !== 'production';
  const hostname = 'localhost';
  const port = parseInt(env.PORT || '3000', 10);

  // Initialize Next.js
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY || '',
  });

// In-memory session store (simple implementation for the integrated server)
interface Session {
  id: string;
  created_at: number;
  last_active: number;
  status: 'connected' | 'disconnected';
  data: any;
}

class InMemorySessionStore {
  private sessions: Map<string, Session> = new Map();

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  set(id: string, session: Session): void {
    this.sessions.set(id, session);
  }

  update(id: string, updates: Partial<Session>): void {
    const existing = this.sessions.get(id);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        last_active: Date.now()
      };
      this.sessions.set(id, updated);
      
      if (updates.data) {
        logger.debug({
          sessionId: id,
          previousData: existing.data,
          newData: updated.data
        }, 'Session data updated');
      }
    }
  }
}

const sessionStore = new InMemorySessionStore();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '', true);
      
      // Handle toast notification endpoint
      if (parsedUrl.pathname === '/api/toast' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const { sessionId, message, type = 'default' } = JSON.parse(body);
            
            logger.debug({ sessionId, message, type, totalSockets: io.sockets.sockets.size }, 'Received toast notification');
            
            let toastsSent = 0;
            io.sockets.sockets.forEach((socket) => {
              if (socket.data.sessionId === sessionId || sessionId === 'current-session') {
                logger.debug({ socketId: socket.id, sessionId }, 'Emitting toast to socket');
                socket.emit('server:message', {
                  type: 'toast.show',
                  data: {
                    message,
                    type
                  }
                });
                toastsSent++;
              }
            });
            
            logger.debug({ toastsSent }, 'Total toasts sent');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (error) {
            logger.error(error, 'Error handling toast');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });
        return;
      }

      // Handle delegation status update endpoint
      if (parsedUrl.pathname === '/api/socket-delegation-status' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const { sessionId, delegationId, status, agentName, toolName, action } = JSON.parse(body);
            
            logger.debug({ sessionId, delegationId, status, agentName, toolName, action, totalSockets: io.sockets.sockets.size }, 'Received delegation status update');
            
            let updatesSent = 0;
            io.sockets.sockets.forEach((socket) => {
              if (socket.data.sessionId === sessionId) {
                logger.debug({ socketId: socket.id, sessionId }, 'Emitting delegation status to socket');
                socket.emit('server:message', {
                  type: 'delegation.status',
                  data: {
                    delegationId,
                    status,
                    agentName,
                    toolName,
                    action
                  }
                });
                updatesSent++;
              }
            });
            
            logger.debug({ updatesSent }, 'Total delegation status updates sent');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (error) {
            logger.error(error, 'Error handling delegation status');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });
        return;
      }
      
      // Let Next.js handle everything else
      await handle(req, res, parsedUrl);
    } catch (err) {
      logger.error(err, `Error occurred handling ${req.url}`);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO on the same server
  // CORS configuration: Use allowlist instead of wildcard for security
  // Build allowed origins list from environment variables or defaults
  const buildAllowedOrigins = (): string[] => {
    // If ALLOWED_ORIGINS is explicitly set, use it (highest priority)
    if (env.ALLOWED_ORIGINS) {
      return env.ALLOWED_ORIGINS.split(',').map((origin: string) => origin.trim());
    }
    
    // Otherwise, derive from NEXT_PUBLIC_SOCKET_SERVER_URL if available
    const socketServerUrl = env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    if (socketServerUrl) {
      try {
        const url = new URL(socketServerUrl);
        // Include both the socket server URL and the base origin (without path)
        const baseOrigin = `${url.protocol}//${url.host}`;
        return [socketServerUrl, baseOrigin];
      } catch (e) {
        logger.warn({ err: e }, 'Invalid NEXT_PUBLIC_SOCKET_SERVER_URL, falling back to defaults');
      }
    }
    
    // Default to localhost for development
    return [
      'http://localhost:3000',
      ...(dev ? ['http://localhost:3001', 'http://127.0.0.1:3000'] : [])
    ];
  };

  const allowedOrigins = buildAllowedOrigins();
  
  // Log allowed origins in development for debugging
  logger.debug({ allowedOrigins }, 'CORS allowed origins');

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman, etc.) in development only
        if (!origin && dev) {
          return callback(null, true);
        }
        
        // Check if origin is in allowlist
        if (origin && allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn({ origin, allowedOrigins }, 'CORS blocked origin');
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Helper function to create a new session
  const createNewSession = (sessionId: string) => {
    const session: Session = {
      id: sessionId,
      created_at: Date.now(),
      last_active: Date.now(),
      status: 'connected',
      data: {}
    };
    sessionStore.set(sessionId, session);
    return session;
  };

  io.on('connection', async (socket) => {
    logger.info({ socketId: socket.id }, 'Client connected');

    // Handle session restoration - sessions should only be created through the /play/ route
    // The socket server should ONLY adopt existing session IDs, never create new ones
    const existingSessionId = socket.handshake.auth.sessionId;
    if (existingSessionId) {
      const existingSession = sessionStore.get(existingSessionId);
      if (existingSession) {
        // Session exists in socket store, restore it
        socket.data.sessionId = existingSessionId;
        sessionStore.update(existingSessionId, { status: 'connected' });
        logger.debug({ sessionId: existingSessionId }, 'Restored session');
      } else {
        // Session not in socket store, but client has one (e.g. from file operations)
        // Adopt the client's session ID and create a socket session entry for it
        socket.data.sessionId = existingSessionId;
        createNewSession(existingSessionId);
        logger.debug({ sessionId: existingSessionId }, 'Adopted client session ID (not in socket store)');
      }
    } else {
      // No session ID from client - do NOT create a new one
      // Sessions should only be created through the /play/ route via ensureSession()
      // This connection can still receive broadcasts but won't have session-specific functionality
      logger.debug('Client connected without session ID - operating in session-less mode');
      socket.data.sessionId = undefined;
    }

    // Send welcome message with session info (or null if no session)
    // Note: This is socket.session.connected, distinct from OpenAI's session.created
    socket.emit('server:message', {
      type: 'socket.session.connected',
      session: socket.data.sessionId ? {
        id: socket.data.sessionId,
        connected_at: Date.now(),
        status: 'connected'
      } : null
    });

    // Sync notes on connection if we have both sessionId and experienceId
    const existingExperienceId = socket.handshake.auth.experienceId;
    const sessionIdForSync = socket.data.sessionId;
    if (sessionIdForSync && existingExperienceId) {
      socket.data.experienceId = existingExperienceId;

      // Track the active agent key server-side.
      // Prefer client-provided key (survives reconnects after transfers) over config default.
      const clientAgentKey = socket.handshake.auth.selectedAgentKey;
      try {
        const { ExperienceConfigLoader } = await import('./src/app/api/backend-agent/managers/ExperienceConfigLoader');
        const config = await ExperienceConfigLoader.loadExperienceConfig(existingExperienceId);
        socket.data.selectedAgentKey = clientAgentKey || config.initialAgent;
        logger.debug({ experienceId: existingExperienceId, selectedAgentKey: socket.data.selectedAgentKey, fromClient: !!clientAgentKey }, 'Set selectedAgentKey');
      } catch (err) {
        if (clientAgentKey) {
          socket.data.selectedAgentKey = clientAgentKey;
        }
        logger.warn({ experienceId: existingExperienceId, err }, 'Could not load experience config for selectedAgentKey');
      }
      
      // Load and sync notes asynchronously
      (async () => {
        try {
          const { createNoteStore } = await import('./src/app/lib/tools/server/NoteStore');
          const noteStore = createNoteStore(existingExperienceId, sessionIdForSync);
          const notes = await noteStore.getAllNotes();
          
          if (notes.length > 0) {
            logger.debug({ 
              sessionId: sessionIdForSync, 
              experienceId: existingExperienceId,
              noteCount: notes.length 
            }, 'Syncing notes on connection');
            
            socket.emit('ui.note.sync', { 
              notes,
              callId: `note_sync_${Date.now()}` // Provide a callId for the client handler
            });
          }
        } catch (error) {
          logger.error(error, 'Failed to sync notes on connection');
        }
      })();
    }

    // Handle incoming messages
    socket.on('client:message', async (data: { message: string | object }) => {
      logger.debug({ data }, 'Received raw message');
      let parsed: any;
      try {
        parsed = typeof data.message === 'string' ? JSON.parse(data.message) : data.message;
        logger.debug({
          type: parsed.type,
          session: parsed.session
        }, 'Parsed message');
      } catch (err) {
        logger.error({ err, message: data.message }, 'Failed to parse message');
        return;
      }

      if (parsed.type === 'session.update') {
        if (socket.data.sessionId) {
          const currentSession = sessionStore.get(socket.data.sessionId);
          logger.debug({
            sessionId: socket.data.sessionId,
            currentData: currentSession?.data,
            newData: parsed.session
          }, 'Updating session data');
          
          sessionStore.update(socket.data.sessionId, {
            data: {
              ...currentSession?.data,
              ...parsed.session
            }
          });
        } else {
          logger.error('No session ID found for update');
        }
      }

      if (parsed.type === 'conversation.item.create') {
        const userText = parsed.item.content[0]?.text;
        if (!userText) return;

        try {
          const sessionData = socket.data.sessionId ? sessionStore.get(socket.data.sessionId)?.data : null;
          
          const stream = openai.responses.stream({
            model: sessionData?.model,
            instructions: sessionData?.instructions,
            temperature: sessionData?.temperature !== undefined ? sessionData.temperature : 0.7,
            tools: sessionData?.tools,
            input: userText,
            stream: true,
            text: { format: { type: "text" } }
          });

          for await (const event of stream) {
            socket.emit('server:message', event);
          }
        } catch (err) {
          logger.error(err, 'OpenAI Responses API streaming error');
        }
        return;
      }
    });

    // Import the request manager
    const { getToolRequestManager, cleanupToolRequestManager } = await import('./src/app/lib/tools/server/ToolRequestManager');
    const requestManager = getToolRequestManager(socket.id);
    
    // Handle tool.call from client
    socket.on('tool.call', async (data) => {
      // Import logging utilities
      const { formatToolCallForLogging } = await import('./src/lib/log-utils');
      
      // Log at INFO level with all parameters (truncated for readability)
      logger.info(
        formatToolCallForLogging(data.toolName, data.args, data.callId),
        'Tool call received'
      );
      
      try {
        // Import tool implementations dynamically
        const { observe } = await import('./src/app/lib/tools/builtin/observe-tool');
        const { present } = await import('./src/app/lib/tools/builtin/present-tool');
        const { slide } = await import('./src/app/lib/tools/ui/slides');
        const { information } = await import('./src/app/lib/tools/builtin/information-tool');
        const { note } = await import('./src/app/lib/tools/builtin/note-tool');
        const { customComponent } = await import('./src/app/lib/tools/builtin/custom-component-tool');
        const { agent: agentTool } = await import('./src/app/lib/tools/builtin/agent-tool');
        
        // Map tool names to implementations
        const toolMap: Record<string, any> = {
          observe,
          present,
          slide,
          information,
          note,
          customComponent,
          agent: agentTool
        };
        
        const toolHandler = toolMap[data.toolName];
        if (!toolHandler) {
          logger.warn({ toolName: data.toolName }, 'Unknown tool called');
          socket.emit('tool.response', {
            callId: data.callId,
            status: 'error',
            data: { error: `Unknown tool: ${data.toolName}` }
          });
          return;
        }
        
        // Create a context for the tool execution
        // Get sessionId and experienceId from socket data or event data
        const sessionId = socket.data.sessionId || data.sessionId;
        const experienceId = data.experienceId || socket.data.experienceId;
        
        // Build the context based on what's available
        let context: any;
        
        if (experienceId && sessionId) {
          // Full context with artifact support - needed for tools like slide.showArtifact
          const { createServerToolContext } = await import('./src/app/api/backend-agent/utils/context');
          const { createInformationStore } = await import('./src/app/lib/tools/server/InformationStore');
          const { createNoteStore } = await import('./src/app/lib/tools/server/NoteStore');
          const baseContext = await createServerToolContext(experienceId, sessionId);
          
          // Create stores for this session
          const informationStore = createInformationStore(experienceId, sessionId);
          const noteStore = createNoteStore(experienceId, sessionId);
          
          context = {
            ...baseContext,
            informationStore,
            noteStore,
            requestManager,
            sendClientEvent: (event: any) => {
              // Send events back to the client
              if (event.type === 'ui.observe.request') {
                socket.emit('ui.observe.request', event.data);
              } else if (event.type === 'ui.element.show') {
                socket.emit('ui.element.show', event.data);
              } else if (event.type === 'ui.element.hide') {
                socket.emit('ui.element.hide', event.data);
              } else if (event.type === 'ui.element.move') {
                socket.emit('ui.element.move', event.data);
              } else if (event.type === 'ui.element.resize') {
                socket.emit('ui.element.resize', event.data);
              } else if (event.type === 'ui.element.maximize') {
                socket.emit('ui.element.maximize', event.data);
              } else if (event.type === 'ui.element.destroy') {
                socket.emit('ui.element.destroy', event.data);
              } else if (event.type === 'ui.slide.create') {
                socket.emit('ui.slide.create', event.data);
              } else if (event.type === 'ui.component.create') {
                socket.emit('ui.component.create', event.data);
              } else if (event.type === 'ui.component.updateState') {
                socket.emit('ui.component.updateState', event.data);
              } else if (event.type === 'ui.component.getState') {
                socket.emit('ui.component.getState', event.data);
              } else if (event.type === 'ui.component.clearCache') {
                socket.emit('ui.component.clearCache', event.data);
              } else if (event.type === 'ui.note.sync') {
                socket.emit('ui.note.sync', event.data);
              } else if (event.type === 'ui.note.display') {
                socket.emit('ui.note.display', event.data);
              } else if (event.type === 'ui.note.hide') {
                socket.emit('ui.note.hide', event.data);
              } else if (event.type === 'ui.note.delete') {
                socket.emit('ui.note.delete', event.data);
              } else if (event.type === 'ui.note.update') {
                socket.emit('ui.note.update', event.data);
              } else if (event.type === 'ui.note.getScreenDimensions') {
                socket.emit('ui.note.getScreenDimensions', event.data);
              }
            }
          };
          
          logger.debug({ experienceId, sessionId }, 'Created full tool context with artifact support');
        } else {
          // Minimal context for UI-only tools (observe, present, slide.show)
          // Note: Tools that need artifact/information/note access will fail gracefully
          
          // Create stores if we have the required IDs
          let informationStore;
          let noteStore;
          if (experienceId && sessionId) {
            const { createInformationStore } = await import('./src/app/lib/tools/server/InformationStore');
            const { createNoteStore } = await import('./src/app/lib/tools/server/NoteStore');
            informationStore = createInformationStore(experienceId, sessionId);
            noteStore = createNoteStore(experienceId, sessionId);
          }
          
          context = {
            sessionId,
            experienceId,
            informationStore,
            noteStore,
            requestManager,
            sendClientEvent: (event: any) => {
              // Send events back to the client
              if (event.type === 'ui.observe.request') {
                socket.emit('ui.observe.request', event.data);
              } else if (event.type === 'ui.element.show') {
                socket.emit('ui.element.show', event.data);
              } else if (event.type === 'ui.element.hide') {
                socket.emit('ui.element.hide', event.data);
              } else if (event.type === 'ui.element.move') {
                socket.emit('ui.element.move', event.data);
              } else if (event.type === 'ui.element.resize') {
                socket.emit('ui.element.resize', event.data);
              } else if (event.type === 'ui.element.maximize') {
                socket.emit('ui.element.maximize', event.data);
              } else if (event.type === 'ui.element.destroy') {
                socket.emit('ui.element.destroy', event.data);
              } else if (event.type === 'ui.slide.create') {
                socket.emit('ui.slide.create', event.data);
              } else if (event.type === 'ui.component.create') {
                socket.emit('ui.component.create', event.data);
              } else if (event.type === 'ui.component.updateState') {
                socket.emit('ui.component.updateState', event.data);
              } else if (event.type === 'ui.component.getState') {
                socket.emit('ui.component.getState', event.data);
              } else if (event.type === 'ui.component.clearCache') {
                socket.emit('ui.component.clearCache', event.data);
              } else if (event.type === 'ui.note.sync') {
                socket.emit('ui.note.sync', event.data);
              } else if (event.type === 'ui.note.display') {
                socket.emit('ui.note.display', event.data);
              } else if (event.type === 'ui.note.hide') {
                socket.emit('ui.note.hide', event.data);
              } else if (event.type === 'ui.note.delete') {
                socket.emit('ui.note.delete', event.data);
              } else if (event.type === 'ui.note.update') {
                socket.emit('ui.note.update', event.data);
              } else if (event.type === 'ui.note.getScreenDimensions') {
                socket.emit('ui.note.getScreenDimensions', event.data);
              }
            }
          };
          
          logger.debug({ sessionId, hasExperienceId: !!experienceId, hasStores: !!(informationStore && noteStore) }, 'Created minimal tool context');
        }
        
        // Enrich context for the agent tool (needs agents map and selectedAgentKey)
        if (data.toolName === 'agent') {
          if (!experienceId) {
            logger.warn({ socketExpId: socket.data.experienceId, dataExpId: data.experienceId }, 'No experienceId available for agent tool context enrichment');
          } else {
            try {
              const { ExperienceConfigLoader } = await import('./src/app/api/backend-agent/managers/ExperienceConfigLoader');
              const config = await ExperienceConfigLoader.loadExperienceConfig(experienceId);
              context.agents = config.agents;
              context.selectedAgentKey = socket.data.selectedAgentKey || data.selectedAgentKey || config.initialAgent;
            } catch (err) {
              logger.error({ experienceId, err }, 'Failed to load agent config for agent tool');
            }
          }
        }

        // Handle agent.delegate server-side (bypasses client-side delegate.ts which needs sessionStorage/globalSocket).
        // This blocks until the backend agent finishes so the result is returned to the
        // frontend agent as a function_call_output (matching the old client-side delegate.ts behaviour).
        // The client-side shim uses a 15-minute timeout for delegate calls.
        if (data.toolName === 'agent' && data.args?.action === 'delegate' && data.args?.agentType) {
          if (!experienceId || !sessionId) {
            socket.emit('tool.response', {
              callId: data.callId,
              status: 'error',
              data: { error: 'experienceId and sessionId are required for delegation' }
            });
            return;
          }

          const delegationId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          try {
            const { executeBackendAgentViaSocket } = await import('./src/app/lib/backend-agent-socket');
            const userInfo = socket.handshake.auth.userEmail
              ? { name: socket.handshake.auth.userName || null, email: socket.handshake.auth.userEmail }
              : undefined;

            await executeBackendAgentViaSocket({
              socket,
              requestManager,
              callId: data.callId,
              agentType: data.args.agentType,
              artifactIds: data.args.artifactIds || [],
              taskDescription: data.args.taskDescription,
              experienceId,
              sessionId,
              delegationId,
              imageNames: data.args.imageNames,
              userInfo
            });
          } catch (err) {
            // executeBackendAgentViaSocket has its own error handling that emits tool.response,
            // so this only fires for unexpected errors (e.g. import failure).
            logger.error({ delegationId, err }, 'Delegation failed unexpectedly');
          } finally {
            socket.emit('delegation:complete', { delegationId });
          }
          return;
        }

        // Execute the tool
        const result = await toolHandler(data.args, context);
        
        // Handle agent transfer side-effects
        if (data.toolName === 'agent' && data.args?.action === 'transfer' && result.status === 'success' && result.data?.did_transfer) {
          const { destination_agent, from_name, to_name, rationale } = result.data;
          socket.data.selectedAgentKey = destination_agent;
          socket.emit('agent.transfer.queue', {
            destinationKey: destination_agent,
            fromName: from_name,
            toName: to_name,
            rationale
          });
          logger.info({ from: from_name, to: to_name, destinationKey: destination_agent }, 'Agent transfer queued via socket');
        }

        // Send the result back to the client
        socket.emit('tool.response', {
          callId: data.callId,
          status: result.status,
          data: result.data
        });
      } catch (error) {
        logger.error(error, 'Error executing tool');
        socket.emit('tool.response', {
          callId: data.callId,
          status: 'error',
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    });
    
    // Handle tool.result from client (UI operation results)
    socket.on('tool.result', (data) => {
      logger.debug({ callId: data.callId, status: data.status }, 'Received tool.result from client');
      
      // Resolve the pending request
      if (data.status === 'success') {
        requestManager.resolvePendingRequest(data.callId, { status: data.status, data: data.data });
      } else {
        requestManager.rejectPendingRequest(data.callId, new Error(data.data?.error || 'UI operation failed'));
      }
    });
    
    // Handle ui.observe.response from client
    socket.on('ui.observe.response', (data) => {
      logger.debug({ callId: data.callId, elementCount: data.elements.length }, 'Received ui.observe.response from client');
      
      // Resolve the pending observe request
      requestManager.resolvePendingRequest(data.callId, {
        elements: data.elements,
        viewport: data.viewport,
        insets: data.insets
      });
    });
    
    // Handle component.event from client (user interaction with component)
    // Forward back to frontend for injection into realtime agent conversation
    socket.on('component.event', (data, ack) => {
      logger.info({ 
        instanceId: data.instanceId, 
        componentId: data.componentId, 
        eventType: data.eventType,
        socketId: socket.id
      }, 'Component event received, forwarding to agent');
      
      // Forward to frontend for agent consumption
      socket.emit('component.event.forward', data);
      
      // Send acknowledgment if callback provided
      if (typeof ack === 'function') {
        ack({ received: true });
      }
    });
    
    // Handle component.stateChange from client
    socket.on('component.stateChange', (data) => {
      logger.debug({ 
        instanceId: data.instanceId, 
        componentId: data.componentId 
      }, 'Component state change received');
      
      // Forward to frontend for agent consumption
      socket.emit('component.stateChange.forward', data);
    });

    // Handle agent.delegate from client - execute backend agent via socket
    socket.on('agent.delegate', async (data) => {
      logger.debug({ 
        callId: data.callId, 
        agentType: data.agentType, 
        delegationId: data.delegationId 
      }, 'Received agent.delegate from client');
      
      try {
        // Import backend agent execution logic
        const { executeBackendAgentViaSocket } = await import('./src/app/lib/backend-agent-socket');
        
        // Extract user info from socket handshake auth for authorship tracking
        const userInfo = socket.handshake.auth.userEmail
          ? { name: socket.handshake.auth.userName || null, email: socket.handshake.auth.userEmail }
          : undefined;

        // Execute backend agent with socket context
        await executeBackendAgentViaSocket({
          socket,
          requestManager,
          callId: data.callId,
          agentType: data.agentType,
          artifactIds: data.artifactIds || [],
          taskDescription: data.taskDescription,
          experienceId: data.experienceId,
          sessionId: data.sessionId,
          delegationId: data.delegationId,
          imageNames: data.imageNames,
          userInfo
        });
      } catch (error) {
        logger.error(error, 'Error in agent.delegate handler');
        socket.emit('tool.response', {
          callId: data.callId,
          status: 'error',
          data: {
            error: error instanceof Error ? error.message : 'Unknown error in delegation'
          }
        });
      }
    });

    // Handle agent.run from admin/management pages
    // Runs a backend agent directly via socket (no HTTP, no middleware).
    // Used by analytics and future admin helper agents.
    socket.on('agent.run', async (data, ack) => {
      const { runId, experienceId, sessionId, agentKey, taskDescription, artifactIds } = data;
      logger.debug({ runId, experienceId, agentKey }, 'Received agent.run from client');

      try {
        const { executeBackendAgent } = await import('./src/app/lib/backend-agent-core');
        const { createServerToolContext } = await import('./src/app/api/backend-agent/utils/context');

        const toolContext = await createServerToolContext(experienceId, sessionId);

        // Override toast to emit directly on this admin socket
        // (the default HTTP-based toast routes by sessionId, which doesn't
        //  match admin sockets that have no session binding)
        toolContext.toast = (options: { title: string; variant?: 'default' | 'destructive' }) => {
          socket.emit('server:message', {
            type: 'toast.show',
            data: {
              message: options.title,
              type: options.variant === 'destructive' ? 'destructive' : 'default',
            },
          });
        };

        const result = await executeBackendAgent({
          experienceId,
          sessionId,
          agentKey,
          taskDescription: taskDescription || '',
          artifactIds: artifactIds || [],
          toolContext,
          callbacks: {
            onStart: (agentName) => {
              socket.emit('agent.run:status', { runId, status: `Starting ${agentName}`, agentName });
            },
            onThinking: () => {
              socket.emit('agent.run:status', { runId, status: 'Thinking' });
            },
            onToolCall: (toolName, action) => {
              socket.emit('agent.run:status', { runId, status: 'tool', toolName, action });
            },
          },
        });

        socket.emit('agent.run:complete', {
          runId,
          status: 'success',
          message: result.message,
          totalToolCalls: result.totalToolCalls,
        });
      } catch (error) {
        logger.error(error, 'Error in agent.run handler');
        socket.emit('agent.run:complete', {
          runId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Acknowledge receipt so the client knows the server accepted the request
      if (typeof ack === 'function') {
        ack({ received: true });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      logger.info({ socketId: socket.id, reason }, 'Client disconnected');
      if (socket.data.sessionId) {
        sessionStore.update(socket.data.sessionId, { status: 'disconnected' });
      }
      // Clean up the request manager for this socket
      cleanupToolRequestManager(socket.id);
    });
  });

  httpServer.listen(port, (err?: Error) => {
    if (err) throw err;
    logger.info({ hostname, port }, 'Server ready');
    logger.info({ path: '/api/socketio' }, 'Socket.IO server ready');
  });
  });
})().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

