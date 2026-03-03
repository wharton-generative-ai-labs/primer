/**
 * DelegationStatusManager
 * 
 * Handles sending delegation status updates via socket including:
 * - Status update messages
 * - Socket communication
 * - Error handling for status updates
 */

import { createModuleLogger } from '@/lib/logger';
import { env } from '@/config/env';

const logger = createModuleLogger('backend-agent-delegation-status');

export class DelegationStatusManager {
  /**
   * Get the socket server URL for internal backend-to-socket communication
   * In deployed environments, use NEXT_PUBLIC_SOCKET_SERVER_URL
   * In local development, use localhost with the configured port
   */
  private static getSocketServerUrl(): string {
    // In deployed environments, NEXT_PUBLIC_SOCKET_SERVER_URL should be set
    // This is the public URL of the server (e.g., https://your-app.onrender.com)
    const publicSocketUrl = env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    
    if (publicSocketUrl) {
      // Use the public socket URL for internal communication in deployed environments
      // This works because the server can reach itself via its public URL
      return publicSocketUrl;
    }
    
    // Fallback to localhost for local development
    const port = env.PORT || '3000';
    return `http://localhost:${port}`;
  }

  /**
   * Send a regular status message (like "Loading...", "Thinking...")
   */
  static async sendStatusMessage(
    sessionId: string,
    delegationId: string,
    message: string,
    agentName?: string
  ): Promise<void> {
    const baseUrl = this.getSocketServerUrl();
    const url = `${baseUrl}/api/socket-delegation-status`;
    
    logger.info({ 
      sessionId, 
      delegationId, 
      message, 
      agentName,
      baseUrl,
      url,
      env: {
        NODE_ENV: env.NODE_ENV,
        NEXT_PUBLIC_SOCKET_SERVER_URL: env.NEXT_PUBLIC_SOCKET_SERVER_URL,
        PORT: env.PORT
      }
    }, 'Attempting to send delegation status message');
    
    try {
      const fetchStart = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sessionId, 
          delegationId, 
          status: message, 
          agentName 
        }),
      });
      const fetchDuration = Date.now() - fetchStart;

      if (!response.ok) {
        const responseText = await response.text().catch(() => 'Could not read response body');
        logger.error({ 
          status: response.status, 
          statusText: response.statusText,
          responseText,
          baseUrl,
          url,
          fetchDuration
        }, 'Failed to send delegation status message - non-OK response');
      } else {
        logger.info({ message, baseUrl, url, fetchDuration }, 'Delegation status message sent successfully');
      }
    } catch (error) {
      logger.error({ 
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
        errorStack: error instanceof Error ? error.stack : undefined,
        baseUrl,
        url
      }, 'Error sending delegation status message - fetch threw exception');
    }
  }

  /**
   * Send a tool execution update
   */
  static async sendToolExecution(
    sessionId: string,
    delegationId: string,
    toolName: string,
    agentName?: string,
    action?: string
  ): Promise<void> {
    const baseUrl = this.getSocketServerUrl();
    const url = `${baseUrl}/api/socket-delegation-status`;
    
    logger.info({ 
      sessionId, 
      delegationId, 
      toolName, 
      action,
      agentName,
      baseUrl,
      url
    }, 'Attempting to send tool execution update');
    
    try {
      const fetchStart = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sessionId, 
          delegationId, 
          status: '', 
          agentName, 
          toolName, 
          action 
        }),
      });
      const fetchDuration = Date.now() - fetchStart;

      if (!response.ok) {
        const responseText = await response.text().catch(() => 'Could not read response body');
        logger.error({ 
          status: response.status, 
          statusText: response.statusText,
          responseText,
          baseUrl,
          url,
          fetchDuration
        }, 'Failed to send tool execution update - non-OK response');
      } else {
        logger.info({ toolName, action, baseUrl, url, fetchDuration }, 'Tool execution update sent successfully');
      }
    } catch (error) {
      logger.error({ 
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
        errorStack: error instanceof Error ? error.stack : undefined,
        baseUrl,
        url
      }, 'Error sending tool execution update - fetch threw exception');
    }
  }
}

