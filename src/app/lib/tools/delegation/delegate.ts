
import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { getDelegationManager } from './DelegationManager';
import { getExistingSessionId } from '@/app/lib/session-utils';
import { v4 as uuidv4 } from 'uuid';
import { createModuleLogger } from '@/lib/logger';
import { getGlobalSocket } from '@/app/lib/tools/client/tool-calling-shim';
import { DELEGATION_SETTINGS } from '@/config/constants';

const logger = createModuleLogger('delegate');

// Function to generate a unique delegation ID
function generateDelegationId(): string {
  return `del_${Date.now()}_${uuidv4().substring(0, 8)}`;
}

/**
 * @tool
 * @description Delegate a task to a backend agent to perform complex processing
 * @param {string} args.agentType - The friendly name of the agent to delegate to (e.g. "Design Agent", "Casting Director")
 * @param {string[]} args.artifactIds - Optional array of artifact IDs that contain the data needed for the task
 * @param {string} args.taskDescription - Optional description of what the agent should do
 * @param {string[]} args.imageNames - Optional array of image names for image generation tasks
 */
export async function delegate(args: {
  agentType: string;
  artifactIds?: string[];
  taskDescription?: string;
  imageNames?: string[];
}, context: ToolContext): Promise<ToolResponse> {
  // Generate a unique delegation ID
  const delegationId = generateDelegationId();
  
  // Register the delegation in the manager (show the overlay)
  const delegationManager = getDelegationManager();
  delegationManager.startDelegation(delegationId, args.agentType);
  
  try {
    // Validate that we have an experience ID
    if (!context.experienceId) {
      throw new Error('Experience ID is required for delegation');
    }

    const sessionId = getExistingSessionId();
    if (!sessionId) {
      throw new Error('No active session. Delegation requires an active experience session.');
    }

    // Get the global socket for communication
    const socket = getGlobalSocket();
    if (!socket || !socket.connected) {
      throw new Error('Socket connection not available for delegation');
    }

    // Generate a unique call ID for this delegation
    const callId = `delegate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create a promise that will resolve when we get the response
    const resultPromise = new Promise<ToolResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Delegation timeout after ${DELEGATION_SETTINGS.TIMEOUT_DESCRIPTION}`));
      }, DELEGATION_SETTINGS.TIMEOUT_MS);

      // Listen for the response
      const responseHandler = (data: any) => {
        if (data.callId === callId) {
          clearTimeout(timeout);
          socket.off('tool.response', responseHandler);
          
          if (data.status === 'success') {
            delegationManager.completeDelegation(delegationId);
            resolve({
              status: 'success',
              data: data.data
            });
          } else {
            delegationManager.completeDelegation(delegationId);
            reject(new Error(data.data?.error || 'Backend agent failed'));
          }
        }
      };

      socket.on('tool.response', responseHandler);
    });

    // Send the delegation request via socket
    socket.emit('agent.delegate', {
      callId,
      agentType: args.agentType,
      artifactIds: args.artifactIds || [],
      taskDescription: args.taskDescription,
      experienceId: context.experienceId,
      sessionId,
      delegationId,
      imageNames: args.imageNames
    });

    logger.debug({ callId, agentType: args.agentType, delegationId }, 'Sent delegation request via socket');

    // Wait for the result
    const result = await resultPromise;
    return result;

  } catch (error) {
    delegationManager.completeDelegation(delegationId);
    logger.error(error, 'Error delegating task');
    
    return {
      status: 'error' as const,
      data: { 
        message: `Failed to delegate task to ${args.agentType}: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
} 