/**
 * Session Event Tool
 * 
 * Allows AI agents to log events to the session and read event history.
 * Useful for tracking session progress, phase transitions, and completion status.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { SESSION_EVENTS } from '@/app/lib/file-utils';

// Helper to get session ID from sessionStorage
function getSessionId(): string | null {
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('primer:session-id');
  }
  return null;
}

// Helper to get experience ID from URL
function getExperienceId(): string | null {
  if (typeof window !== 'undefined') {
    const match = window.location.pathname.match(/\/play\/([^/]+)/);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * @tool sessionEvent
 * @description Log and read session events. Use 'create' to log progress events (like phase changes), 
 *              'read' to get the most recent event(s), 'readAll' to get full event history.
 *              Use 'session_completed' event when the user has finished the experience.
 */
export async function sessionEvent(args: {
  action: 'create' | 'read' | 'readAll';
  event?: string;
  data?: Record<string, any>;
  last?: number;
}, context: ToolContext): Promise<ToolResponse> {
  const sessionId = getSessionId();
  const experienceId = context.experienceId || getExperienceId();
  
  if (!sessionId || !experienceId) {
    return {
      status: 'error',
      data: { 
        error: 'Session or experience not available. Session events require an active session.' 
      }
    };
  }

  // Get agent name from context
  const agentName = context.selectedAgentKey || 'unknown';

  switch (args.action) {
    case 'create': {
      if (!args.event) {
        return {
          status: 'error',
          data: { error: 'event parameter is required for create action' }
        };
      }

      try {
        const response = await fetch('/api/session-events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-experience-id': experienceId,
            'x-session-id': sessionId,
          },
          body: JSON.stringify({
            event: args.event,
            agent: agentName,
            data: args.data,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          return {
            status: 'error',
            data: { error: errorData.error || 'Failed to create event' }
          };
        }

        const result = await response.json();
        return {
          status: 'success',
          data: {
            message: `Event "${args.event}" logged successfully`,
            event: result.event,
            totalEvents: result.totalEvents,
          }
        };
      } catch (error) {
        return {
          status: 'error',
          data: { error: `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}` }
        };
      }
    }

    case 'read': {
      try {
        const last = args.last || 1;
        const response = await fetch(`/api/session-events?last=${last}`, {
          method: 'GET',
          headers: {
            'x-experience-id': experienceId,
            'x-session-id': sessionId,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          return {
            status: 'error',
            data: { error: errorData.error || 'Failed to read events' }
          };
        }

        const result = await response.json();
        return {
          status: 'success',
          data: {
            events: result.events,
            totalEvents: result.totalEvents,
          }
        };
      } catch (error) {
        return {
          status: 'error',
          data: { error: `Failed to read events: ${error instanceof Error ? error.message : 'Unknown error'}` }
        };
      }
    }

    case 'readAll': {
      try {
        const response = await fetch('/api/session-events', {
          method: 'GET',
          headers: {
            'x-experience-id': experienceId,
            'x-session-id': sessionId,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          return {
            status: 'error',
            data: { error: errorData.error || 'Failed to read events' }
          };
        }

        const result = await response.json();
        return {
          status: 'success',
          data: {
            events: result.events,
            totalEvents: result.totalEvents,
          }
        };
      } catch (error) {
        return {
          status: 'error',
          data: { error: `Failed to read events: ${error instanceof Error ? error.message : 'Unknown error'}` }
        };
      }
    }

    default:
      return {
        status: 'error',
        data: { error: `Invalid action: ${args.action}` }
      };
  }
}

// Export well-known event types for convenience
export { SESSION_EVENTS };
