/**
 * Backend Agent Socket Execution
 * 
 * Executes backend agents via Socket.IO instead of HTTP.
 * This allows backend agents to use UI tools (observe/present) that require socket communication.
 *
 * Delegates to the shared backend-agent-core for the actual tool-call loop,
 * adding socket-specific status events and tool context.
 */

import { createModuleLogger } from '@/lib/logger';
import type { ToolContext } from '@/app/lib/tools/types';
import { executeBackendAgent } from '@/app/lib/backend-agent-core';

const logger = createModuleLogger('backend-agent-socket');

interface BackendAgentSocketParams {
  socket: any; // Socket instance
  requestManager: any; // ToolRequestManager instance
  callId: string;
  agentType: string;
  artifactIds: string[];
  taskDescription?: string;
  experienceId: string;
  sessionId: string;
  delegationId: string;
  imageNames?: string[];
  userInfo?: { name?: string | null; email?: string | null };
}

/**
 * Execute a backend agent via socket with streaming responses
 */
export async function executeBackendAgentViaSocket(params: BackendAgentSocketParams): Promise<void> {
  const {
    socket,
    requestManager,
    callId,
    agentType,
    artifactIds,
    taskDescription,
    experienceId,
    sessionId,
    delegationId,
    userInfo
  } = params;

  try {
    logger.debug({
      agentType,
      artifactIds,
      taskDescription,
      experienceId,
      sessionId,
      delegationId
    }, 'Executing backend agent via socket');

    // Create socket-aware tool context
    const toolContext = await createSocketToolContext({
      experienceId,
      sessionId,
      delegationId,
      socket,
      requestManager,
      userInfo
    });

    const result = await executeBackendAgent({
      experienceId,
      sessionId,
      agentKey: agentType,
      taskDescription: taskDescription || '',
      artifactIds: artifactIds || [],
      toolContext,
      callbacks: {
        onStart: (agentName) => {
          socket.emit('delegation:status', {
            sessionId,
            delegationId,
            status: `Starting ${agentName}`,
            agentName
          });
        },
        onThinking: () => {
          socket.emit('delegation:status', {
            sessionId,
            delegationId,
            status: 'Thinking'
          });
        },
        onToolCall: (toolName, action) => {
          socket.emit('delegation:tool', {
            sessionId,
            delegationId,
            toolName,
            agentName: agentType,
            action
          });
        },
      },
    });

    // Send final response
    socket.emit('tool.response', {
      callId,
      status: 'success',
      data: {
        message: result.message,
        agentType,
        artifactIds
      }
    });

  } catch (error) {
    logger.error(error, 'Error executing backend agent via socket');
    socket.emit('tool.response', {
      callId,
      status: 'error',
      data: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

/**
 * Create a socket-aware tool context for backend agents
 */
async function createSocketToolContext(params: {
  experienceId: string;
  sessionId: string;
  delegationId: string;
  socket: any;
  requestManager: any;
  userInfo?: { name?: string | null; email?: string | null };
}): Promise<ToolContext> {
  const { experienceId, sessionId, delegationId, socket, requestManager, userInfo } = params;

  // Import the base server tool context
  const { createServerToolContext } = await import('@/app/api/backend-agent/utils/context');

  // Create base context (pass userInfo for authorship tracking on created experiences)
  const baseContext = await createServerToolContext(experienceId, sessionId, delegationId, userInfo);

  // Extend with socket capabilities
  const socketContext: any = {
    ...baseContext,
    requestManager,
    sendClientEvent: (event: { type: string; data: any }) => {
      logger.debug({ type: event.type }, 'Sending client event via socket');
      socket.emit(event.type, event.data);
    }
  };

  return socketContext;
}
