/**
 * Tool Request Manager
 * 
 * Manages pending tool requests and their promise resolvers on the server side.
 * This allows tools to send requests to clients and await responses.
 */

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('tool-request-manager');

interface PendingRequest<T = any> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  type: 'observe' | 'tool_result';
}

class ToolRequestManager {
  private pendingRequests: Map<string, PendingRequest> = new Map();

  /**
   * Create a pending request that will be resolved when a response is received
   */
  createPendingRequest<T>(
    callId: string,
    type: 'observe' | 'tool_result',
    timeoutMs: number = 5000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(callId);
        reject(new Error(`Timeout waiting for ${type} response (callId: ${callId})`));
      }, timeoutMs);

      this.pendingRequests.set(callId, {
        resolve,
        reject,
        timeout,
        type
      });

      logger.debug({ callId, type, timeoutMs }, 'Created pending request');
    });
  }

  /**
   * Resolve a pending request with a value
   */
  resolvePendingRequest(callId: string, value: any): boolean {
    const pending = this.pendingRequests.get(callId);
    if (!pending) {
      logger.warn({ callId }, 'Attempted to resolve unknown pending request');
      return false;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(callId);
    pending.resolve(value);
    
    logger.debug({ callId, type: pending.type }, 'Resolved pending request');
    return true;
  }

  /**
   * Reject a pending request with an error
   */
  rejectPendingRequest(callId: string, error: Error): boolean {
    const pending = this.pendingRequests.get(callId);
    if (!pending) {
      logger.warn({ callId }, 'Attempted to reject unknown pending request');
      return false;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(callId);
    pending.reject(error);
    
    logger.debug({ callId, type: pending.type, error: error.message }, 'Rejected pending request');
    return true;
  }

  /**
   * Clean up all pending requests (e.g., on disconnect)
   */
  cleanup(): void {
    logger.debug({ count: this.pendingRequests.size }, 'Cleaning up pending requests');
    
    for (const [_callId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    
    this.pendingRequests.clear();
  }

  /**
   * Get the number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

// Create a singleton instance per socket connection
// We'll store these in a map keyed by socket ID
const requestManagers = new Map<string, ToolRequestManager>();

export function getToolRequestManager(socketId: string): ToolRequestManager {
  let manager = requestManagers.get(socketId);
  if (!manager) {
    manager = new ToolRequestManager();
    requestManagers.set(socketId, manager);
  }
  return manager;
}

export function cleanupToolRequestManager(socketId: string): void {
  const manager = requestManagers.get(socketId);
  if (manager) {
    manager.cleanup();
    requestManagers.delete(socketId);
  }
}
