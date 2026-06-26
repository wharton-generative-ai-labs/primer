/**
 * Registration function for session tools.
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { sessionEvent } from './session';

/**
 * Register session tools with the ToolRegistry.
 */
export async function registerSessionTools(): Promise<void> {
  const registry = ToolRegistry.getInstance();

  await registry.register({
    type: 'function',
    name: 'sessionEvent',
    description: `Log and read session events for tracking progress. Use 'create' to log events like:
- 'phase_started' with data: { phase: 'introduction' } when beginning a new phase
- 'phase_completed' when finishing a phase
- 'session_completed' when the user has finished the entire experience
Use 'read' to get the most recent event, 'readAll' to see full history.
Events help with session recovery and analytics.`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['create', 'read', 'readAll']
        },
        event: {
          type: 'string',
          description: 'Event type to log (required for create). Common types: session_started, phase_started, phase_completed, session_completed'
        },
        data: {
          type: 'object',
          description: 'Optional additional data for the event (e.g., { phase: "introduction" })'
        },
        last: {
          type: 'number',
          description: 'Number of recent events to return (for read action, default: 1)'
        }
      },
      required: ['action']
    }
  }, sessionEvent);
}
