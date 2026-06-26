/**
 * Custom Component Tool
 * 
 * Phase 0: Runtime Validation
 * 
 * Allows agents to show, hide, and interact with custom React components.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { getComponentManager, createComponentManager } from './components/ComponentManager';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CustomComponentTool');

// Helper to get session ID from sessionStorage
function getSessionId(): string | null {
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('primer:session-id');
  }
  return null;
}

/**
 * Custom component tool handler.
 * 
 * Actions:
 * - show: Display a component with initial state
 * - hide: Remove a component from display
 * - updateState: Update component state (agent-controlled)
 * - getState: Read current component state
 * - list: List all loaded components
 * - clearCache: Clear compiled component cache (force reload)
 */
export async function customComponent(
  args: {
    action: 'show' | 'hide' | 'updateState' | 'getState' | 'list' | 'clearCache';
    componentId?: string;
    instanceId?: string;
    initialState?: Record<string, any>;
    stateUpdates?: Record<string, any>;
  },
  context: ToolContext
): Promise<ToolResponse> {
  try {
    const { action, componentId, instanceId, initialState, stateUpdates } = args;
    
    logger.info(`Custom component action: ${action}`, { componentId, instanceId });
    
    let manager = getComponentManager();
    
    // Lazy initialization: if manager doesn't exist but Babel does, create it now
    if (!manager && typeof window !== 'undefined' && (window as any).Babel) {
      const sessionId = getSessionId();
      const experienceId = context.experienceId;
      
      if (sessionId && experienceId) {
        try {
          manager = createComponentManager(experienceId, sessionId);
          logger.info('ComponentManager lazily initialized', { experienceId, sessionId });
        } catch (error) {
          logger.error(error, 'Failed to lazily initialize ComponentManager');
        }
      }
    }
    
    if (!manager) {
      return {
        status: 'error',
        data: { 
          error: 'Component manager not initialized. Ensure Babel has loaded.' 
        }
      };
    }
    
    switch (action) {
      case 'show': {
        if (!componentId) {
          return {
            status: 'error',
            data: { error: 'componentId is required for show action' }
          };
        }
        
        // Show component with callbacks
        const newInstanceId = await manager.showComponent(
          componentId,
          initialState || {},
          context.onComponentEvent,
          context.onComponentStateChange
        );
        
        return {
          status: 'success',
          data: {
            instanceId: newInstanceId,
            componentId,
            message: `Component ${componentId} shown successfully`
          }
        };
      }
      
      case 'hide': {
        if (!instanceId) {
          return {
            status: 'error',
            data: { error: 'instanceId is required for hide action' }
          };
        }
        
        manager.hideComponent(instanceId);
        
        return {
          status: 'success',
          data: {
            instanceId,
            message: `Component instance ${instanceId} hidden successfully`
          }
        };
      }
      
      case 'updateState': {
        if (!instanceId) {
          return {
            status: 'error',
            data: { error: 'instanceId is required for updateState action' }
          };
        }
        
        if (!stateUpdates) {
          return {
            status: 'error',
            data: { error: 'stateUpdates is required for updateState action' }
          };
        }
        
        manager.updateComponentState(instanceId, stateUpdates);
        
        // Get updated state
        const newState = manager.getComponentState(instanceId);
        
        return {
          status: 'success',
          data: {
            instanceId,
            state: newState,
            message: `Component state updated successfully`
          }
        };
      }
      
      case 'getState': {
        if (!instanceId) {
          return {
            status: 'error',
            data: { error: 'instanceId is required for getState action' }
          };
        }
        
        const state = manager.getComponentState(instanceId);
        
        return {
          status: 'success',
          data: {
            instanceId,
            state,
            message: `Component state retrieved successfully`
          }
        };
      }
      
      case 'list': {
        const components = await manager.listComponents();
        const activeInstances = manager.listActiveInstances();
        
        return {
          status: 'success',
          data: {
            components,
            activeInstances,
            message: `Found ${components.length} components, ${activeInstances.length} active instances`
          }
        };
      }
      
      case 'clearCache': {
        if (!componentId) {
          return {
            status: 'error',
            data: { error: 'componentId is required for clearCache action' }
          };
        }
        
        manager.clearComponentCache(componentId);
        
        return {
          status: 'success',
          data: {
            componentId,
            message: `Cache cleared for component: ${componentId}. Next show will reload from disk.`
          }
        };
      }
      
      default:
        return {
          status: 'error',
          data: { 
            error: `Unknown action: ${action}. Valid actions: show, hide, updateState, getState, list, clearCache` 
          }
        };
    }
  } catch (error) {
    logger.error(error, 'Error in customComponent tool');
    return {
      status: 'error',
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }
    };
  }
}

