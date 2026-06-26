/**
 * Client-side tool calling shim
 * 
 * This provides a generic stub that allows client-side AI agents (like realtime)
 * to call tools that execute on the server. The stub sends a socket message to
 * the server and waits for the response.
 */

import { ToolContext, ToolResponse, ToolDefinition } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';
import type { Socket } from 'socket.io-client';

const logger = createModuleLogger('tool-calling-shim');

// Store the socket reference globally so tools can access it
let globalSocket: Socket | null = null;

export function setGlobalSocket(socket: Socket | null) {
  globalSocket = socket;
  logger.debug({ connected: socket?.connected }, 'Global socket updated');
}

export function getGlobalSocket(): Socket | null {
  return globalSocket;
}

// Store for pending tool call promises
const pendingToolCalls = new Map<string, {
  resolve: (result: ToolResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

const DEFAULT_TOOL_TIMEOUT_MS = 30_000;
const LONG_RUNNING_TOOL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes (matches DELEGATION_SETTINGS)

function getTimeoutForCall(toolName: string, args: any): number {
  if (toolName === 'agent' && args?.action === 'delegate') {
    return LONG_RUNNING_TOOL_TIMEOUT_MS;
  }
  return DEFAULT_TOOL_TIMEOUT_MS;
}

/**
 * Create a client-side tool stub that forwards calls to the server
 */
export function createToolStub(toolName: string, toolDefinition: ToolDefinition) {
  return {
    ...toolDefinition,
    handler: async (args: any, context: ToolContext): Promise<ToolResponse> => {
      try {
        // Check if we have socket communication available
        if (!globalSocket || !globalSocket.connected) {
          logger.error({ toolName, socketConnected: globalSocket?.connected }, 'Socket not available');
          return {
            status: 'error',
            data: { error: 'Socket connection not available' }
          };
        }

        // Generate a unique call ID
        const callId = `tool_${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timeoutMs = getTimeoutForCall(toolName, args);
        
        logger.debug({ callId, toolName, args, timeoutMs, experienceId: context.experienceId }, 'Sending tool call to server via Socket.IO');

        // Create a promise that will resolve when we receive the response
        const resultPromise = new Promise<ToolResponse>((resolve, reject) => {
          const timeout = setTimeout(() => {
            pendingToolCalls.delete(callId);
            reject(new Error(`Timeout waiting for tool response from server: ${toolName}`));
          }, timeoutMs);

          pendingToolCalls.set(callId, { resolve, reject, timeout });
        });

        // Send the tool call to the server via Socket.IO
        globalSocket.emit('tool.call', {
          callId,
          toolName,
          args,
          sessionId: 'current-session',
          experienceId: context.experienceId,
          selectedAgentKey: context.selectedAgentKey
        });

        // Wait for the server to respond
        const result = await resultPromise;

        logger.debug({ callId, toolName, result }, 'Received tool response from server');

        return result;
      } catch (error) {
        logger.error(error, `Error in tool stub for ${toolName}`);
        return {
          status: 'error',
          data: { 
            error: error instanceof Error ? error.message : `Unknown error in ${toolName}` 
          }
        };
      }
    }
  };
}

/**
 * Handle tool.response event from server
 * This is called when the server sends back the final result of a tool call
 */
export function handleToolResponse(data: {
  callId: string;
  status: 'success' | 'error';
  data: any;
}) {
  logger.debug({ callId: data.callId, status: data.status }, 'Received tool.response from server');
  
  const pending = pendingToolCalls.get(data.callId);
  if (!pending) {
    logger.warn({ callId: data.callId }, 'Received tool.response for unknown callId');
    return;
  }

  // Clear the timeout
  clearTimeout(pending.timeout);
  
  // Remove from pending map
  pendingToolCalls.delete(data.callId);
  
  // Resolve the promise
  pending.resolve({
    status: data.status,
    data: data.data
  });
}

/**
 * Clean up any pending tool calls (e.g., on disconnect)
 */
export function cleanupPendingToolCalls() {
  logger.debug({ count: pendingToolCalls.size }, 'Cleaning up pending tool calls');
  
  for (const [_callId, pending] of pendingToolCalls.entries()) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('Socket disconnected'));
  }
  
  pendingToolCalls.clear();
}
