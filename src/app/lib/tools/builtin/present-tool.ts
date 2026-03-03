import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('present-tool');

/**
 * Helper to persist note changes to NoteStore
 * Called after UI operations succeed to ensure notes are persisted
 */
async function persistNoteChange(
  noteStore: any,
  id: string, 
  updates: { x?: number; y?: number; w?: number; h?: number; visible?: boolean }
): Promise<void> {
  if (!noteStore) return;
  
  try {
    // Check if this ID corresponds to a note
    const note = await noteStore.getNote(id);
    if (note) {
      await noteStore.updateNote(id, updates);
      logger.debug({ noteId: id, updates }, 'Persisted note change to NoteStore');
    }
  } catch (error) {
    // Not a note or store error - that's fine, just skip persistence
    logger.debug({ id, error }, 'Could not persist to NoteStore (may not be a note)');
  }
}

/**
 * @tool present
 * @description Manage UI elements (slides, notes, components). Control visibility, position, size, and maximize state.
 * 
 * Coordinate System:
 * - All coordinates are relative to the content area (the usable presentation space)
 * - (0, 0) is the top-left corner of the content area
 * - x, y specify the top-left corner of the element
 * - Use the observe tool to see current viewport dimensions and element positions
 * 
 * Actions:
 * - show/hide: Toggle visibility (element remains in memory)
 * - destroy: Permanently remove element (slides, components, notes)
 * - move/resize: Position and size
 * - maximize/restore: Fullscreen toggle
 * 
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'show', 'hide', 'hideAll', 'move', 'resize', 'maximize', 'restore', 'destroy'
 * @param {string} args.id - UI element ID (for show, hide, move, resize, maximize, restore, destroy)
 * @param {number} args.x - X position in pixels (top-left corner, content-area-relative) (for move)
 * @param {number} args.y - Y position in pixels (top-left corner, content-area-relative) (for move)
 * @param {number} args.w - Width in pixels (for resize)
 * @param {number} args.h - Height in pixels (for resize)
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function present(
  args: {
    action: 'show' | 'hide' | 'hideAll' | 'move' | 'resize' | 'maximize' | 'restore' | 'destroy';
    id?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  },
  context: ToolContext
): Promise<ToolResponse> {
  try {
    // Check if we have the necessary context for socket communication
    if (!context.sendClientEvent) {
      return {
        status: 'error',
        data: { error: 'Socket communication not available in this context' }
      };
    }

    // Validate action
    const validActions = ['show', 'hide', 'hideAll', 'move', 'resize', 'maximize', 'restore', 'destroy'];
    if (!validActions.includes(args.action)) {
      return {
        status: 'error',
        data: { 
          error: `Invalid action: ${args.action}. Valid actions are: ${validActions.join(', ')}` 
        }
      };
    }

    // Generate a unique call ID for this request
    const callId = `present_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug({ callId, action: args.action, id: args.id }, 'Executing present action');

    // Validate action-specific requirements
    switch (args.action) {
      case 'show':
      case 'hide':
      case 'maximize':
      case 'restore':
      case 'destroy':
        if (!args.id) {
          return {
            status: 'error',
            data: { error: `id is required for ${args.action} action` }
          };
        }
        break;
      
      case 'move':
        if (!args.id) {
          return {
            status: 'error',
            data: { error: 'id is required for move action' }
          };
        }
        if (args.x === undefined || args.y === undefined) {
          return {
            status: 'error',
            data: { error: 'x and y coordinates are required for move action' }
          };
        }
        break;
      
      case 'resize':
        if (!args.id) {
          return {
            status: 'error',
            data: { error: 'id is required for resize action' }
          };
        }
        if (args.w === undefined || args.h === undefined) {
          return {
            status: 'error',
            data: { error: 'w (width) and h (height) are required for resize action' }
          };
        }
        break;
    }

    // Get the request manager from context
    const requestManager = (context as any).requestManager;
    if (!requestManager) {
      return {
        status: 'error',
        data: { error: 'Request manager not available in context' }
      };
    }

    // Create a pending request that will resolve when we receive the result from the client
    const resultPromise = requestManager.createPendingRequest(
      callId, 
      'tool_result', 
      5000
    ) as Promise<{ status: 'success' | 'error'; data: any }>;

    // Send the appropriate UI command to the client via socket
    switch (args.action) {
      case 'show':
        context.sendClientEvent({
          type: 'ui.element.show',
          data: { callId, id: args.id! }
        });
        break;
      
      case 'hide':
        context.sendClientEvent({
          type: 'ui.element.hide',
          data: { callId, id: args.id! }
        });
        break;
      
      case 'hideAll':
        context.sendClientEvent({
          type: 'ui.element.hide',
          data: { callId, id: '*' } // Special case: hide all
        });
        break;
      
      case 'move':
        context.sendClientEvent({
          type: 'ui.element.move',
          data: { callId, id: args.id!, x: args.x!, y: args.y! }
        });
        break;
      
      case 'resize':
        context.sendClientEvent({
          type: 'ui.element.resize',
          data: { callId, id: args.id!, w: args.w!, h: args.h! }
        });
        break;
      
      case 'maximize':
        context.sendClientEvent({
          type: 'ui.element.maximize',
          data: { callId, id: args.id!, maximized: true }
        });
        break;
      
      case 'restore':
        context.sendClientEvent({
          type: 'ui.element.maximize',
          data: { callId, id: args.id!, maximized: false }
        });
        break;
      
      case 'destroy':
        context.sendClientEvent({
          type: 'ui.element.destroy',
          data: { callId, id: args.id! }
        });
        break;
    }

    // Wait for the client to respond with the result
    const result = await resultPromise;

    logger.debug({ callId, result }, 'Received result from client');

    // If successful, persist changes to NoteStore for notes
    if (result.status === 'success' && args.id && context.noteStore) {
      switch (args.action) {
        case 'show':
          await persistNoteChange(context.noteStore, args.id, { visible: true });
          break;
        case 'hide':
          await persistNoteChange(context.noteStore, args.id, { visible: false });
          break;
        case 'move':
          await persistNoteChange(context.noteStore, args.id, { x: args.x, y: args.y });
          break;
        case 'resize':
          await persistNoteChange(context.noteStore, args.id, { w: args.w, h: args.h });
          break;
        case 'destroy':
          // For notes, delete from NoteStore
          try {
            await context.noteStore.deleteNote(args.id);
            logger.debug({ noteId: args.id }, 'Deleted note from NoteStore');
          } catch {
            // Not a note - that's fine
          }
          break;
      }
    }

    return result;
  } catch (error) {
    logger.error(error, 'Error in present tool');
    return {
      status: 'error',
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error in present tool' 
      }
    };
  }
}
