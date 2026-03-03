import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('custom-component-tool');

/**
 * @tool customComponent
 * @description Manage custom React components for interactive learning experiences.
 * 
 * Actions:
 * - list: List available components defined in the experience (server-side)
 * - create: Instantiate a component, returns instanceId for use with 'present' tool
 * - updateState: Update component state (agent-controlled)
 * - getState: Read current component state
 * - clearCache: Clear compiled component cache (force reload on next create)
 * 
 * For window management (show/hide/move/resize/destroy), use the 'present' tool.
 * For observing active components on screen, use the 'observe' tool.
 * 
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'list', 'create', 'updateState', 'getState', 'clearCache'
 * @param {string} args.componentId - Component ID (required for create, clearCache)
 * @param {string} args.instanceId - Instance ID (required for updateState, getState)
 * @param {object} args.initialState - Initial state for the component (optional for create)
 * @param {object} args.stateUpdates - State updates to apply (required for updateState)
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function customComponent(
  args: {
    action: 'list' | 'create' | 'updateState' | 'getState' | 'clearCache';
    componentId?: string;
    instanceId?: string;
    initialState?: Record<string, any>;
    stateUpdates?: Record<string, any>;
  },
  context: ToolContext
): Promise<ToolResponse> {
  try {
    const { action, componentId, instanceId, initialState, stateUpdates } = args;
    
    logger.debug({ action, componentId, instanceId }, 'Custom component action');

    // Validate action
    const validActions = ['list', 'create', 'updateState', 'getState', 'clearCache'];
    if (!validActions.includes(action)) {
      return {
        status: 'error',
        data: { 
          error: `Invalid action: ${action}. Valid actions are: ${validActions.join(', ')}` 
        }
      };
    }

    // Handle 'list' action server-side (no socket needed)
    if (action === 'list') {
      return await handleListAction(context);
    }

    // All other actions need socket communication
    if (!context.sendClientEvent) {
      return {
        status: 'error',
        data: { error: 'Socket communication not available in this context' }
      };
    }

    const requestManager = (context as any).requestManager;
    if (!requestManager) {
      return {
        status: 'error',
        data: { error: 'Request manager not available in context' }
      };
    }

    // Generate a unique call ID for this request
    const callId = `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate and handle action-specific logic
    switch (action) {
      case 'create': {
        if (!componentId) {
          return {
            status: 'error',
            data: { error: 'componentId is required for create action' }
          };
        }

        // Optionally validate componentId exists in experience.json
        // (Frontend will also validate, but this provides earlier feedback)
        if (context.getResourceContent && context.experienceId) {
          try {
            const experienceContent = await context.getResourceContent(context.experienceId, 'experience.json');
            if (experienceContent.isText) {
              const experience = JSON.parse(experienceContent.content);
              const components = experience.resources?.components || [];
              const componentExists = components.some((c: any) => c.id === componentId);
              if (!componentExists) {
                return {
                  status: 'error',
                  data: { 
                    error: `Component '${componentId}' not found. Available components: ${components.map((c: any) => c.id).join(', ') || 'none'}` 
                  }
                };
              }
            }
          } catch (e) {
            // If we can't read experience.json, let the frontend handle validation
            logger.warn({ componentId, error: e }, 'Could not validate componentId server-side');
          }
        }

        // Create a pending request
        const resultPromise = requestManager.createPendingRequest(
          callId,
          'tool_result',
          10000 // Longer timeout for component compilation
        ) as Promise<{ status: 'success' | 'error'; data: any }>;

        // Send the create command to the client
        // Include experienceId for ComponentManager initialization
        context.sendClientEvent({
          type: 'ui.component.create',
          data: { 
            callId, 
            componentId, 
            initialState: initialState || {},
            experienceId: context.experienceId
          }
        });

        const result = await resultPromise;
        logger.debug({ callId, result }, 'Create result from client');
        return result;
      }

      case 'updateState': {
        if (!instanceId) {
          return {
            status: 'error',
            data: { error: 'instanceId is required for updateState action' }
          };
        }
        if (!stateUpdates || Object.keys(stateUpdates).length === 0) {
          return {
            status: 'error',
            data: { error: 'stateUpdates is required for updateState action' }
          };
        }

        const resultPromise = requestManager.createPendingRequest(
          callId,
          'tool_result',
          5000
        ) as Promise<{ status: 'success' | 'error'; data: any }>;

        context.sendClientEvent({
          type: 'ui.component.updateState',
          data: { callId, instanceId, stateUpdates }
        });

        const result = await resultPromise;
        logger.debug({ callId, result }, 'UpdateState result from client');
        return result;
      }

      case 'getState': {
        if (!instanceId) {
          return {
            status: 'error',
            data: { error: 'instanceId is required for getState action' }
          };
        }

        const resultPromise = requestManager.createPendingRequest(
          callId,
          'tool_result',
          5000
        ) as Promise<{ status: 'success' | 'error'; data: any }>;

        context.sendClientEvent({
          type: 'ui.component.getState',
          data: { callId, instanceId }
        });

        const result = await resultPromise;
        logger.debug({ callId, result }, 'GetState result from client');
        return result;
      }

      case 'clearCache': {
        if (!componentId) {
          return {
            status: 'error',
            data: { error: 'componentId is required for clearCache action' }
          };
        }

        const resultPromise = requestManager.createPendingRequest(
          callId,
          'tool_result',
          5000
        ) as Promise<{ status: 'success' | 'error'; data: any }>;

        context.sendClientEvent({
          type: 'ui.component.clearCache',
          data: { callId, componentId }
        });

        const result = await resultPromise;
        logger.debug({ callId, result }, 'ClearCache result from client');
        return result;
      }

      default:
        return {
          status: 'error',
          data: { error: `Unknown action: ${action}` }
        };
    }
  } catch (error) {
    logger.error(error, 'Error in customComponent tool');
    return {
      status: 'error',
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error in customComponent tool' 
      }
    };
  }
}

/**
 * Handle 'list' action - reads component definitions from experience.json
 * This is fully server-side and doesn't need socket communication
 */
async function handleListAction(context: ToolContext): Promise<ToolResponse> {
  try {
    if (!context.getResourceContent) {
      return {
        status: 'error',
        data: { error: 'getResourceContent not available in context' }
      };
    }

    if (!context.experienceId) {
      return {
        status: 'error',
        data: { error: 'experienceId not available in context' }
      };
    }

    const experienceContent = await context.getResourceContent(context.experienceId, 'experience.json');
    
    if (!experienceContent.isText) {
      return {
        status: 'error',
        data: { error: 'Experience file is not text' }
      };
    }

    const experience = JSON.parse(experienceContent.content);
    const components = experience.resources?.components || [];

    logger.debug({ experienceId: context.experienceId, componentCount: components.length }, 'Listed components');

    return {
      status: 'success',
      data: {
        components,
        count: components.length,
        message: `Found ${components.length} component${components.length !== 1 ? 's' : ''} defined in this experience`
      }
    };
  } catch (error) {
    logger.error(error, 'Error listing components');
    return {
      status: 'error',
      data: { 
        error: error instanceof Error ? error.message : 'Failed to list components' 
      }
    };
  }
}
