/**
 * Note Tool - Backend-first implementation
 * 
 * Manages sticky notes on screen. Data is stored on the server,
 * persisted to disk in session_data/{sessionId}/notes.json.
 * 
 * Note-specific operations: display, changeColor, toggleEffect, get, list, delete
 * UI manipulation (move, resize, show, hide): Use the 'present' tool instead
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';
import { generateUUID } from '@/app/lib/uuid';
import { Note, NOTE_DEFAULTS, generateNoteTitle } from '@/app/lib/tools/server/NoteStore';

const logger = createModuleLogger('note-tool');

const validColors = ['yellow', 'pink', 'green', 'blue', 'purple', 'orange'];

/**
 * @tool note
 * @description Manage sticky notes. Use 'display' to create, 'list' to see all, 'get' for details, 'delete' to remove. For moving/resizing/showing/hiding notes, use the 'present' tool.
 */
export async function note(args: {
  action: 'display' | 'changeColor' | 'toggleEffect' | 'get' | 'list' | 'delete';
  noteId?: string;
  content?: string;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  color?: string | null;
}, context: ToolContext): Promise<ToolResponse> {
  logger.debug({ action: args.action, noteId: args.noteId }, 'note tool called');
  
  // Check for required context
  if (!context.noteStore) {
    logger.warn('note tool called without noteStore in context');
    return {
      status: 'error',
      data: { error: 'Note store not available in context' }
    };
  }
  
  // Check for socket communication (needed for UI operations)
  if (!context.sendClientEvent || !context.requestManager) {
    logger.warn('note tool called without socket communication in context');
    return {
      status: 'error',
      data: { error: 'Socket communication not available' }
    };
  }
  
  try {
    switch (args.action) {
      case 'display': {
        if (!args.content) {
          return {
            status: 'error',
            data: { error: 'content is required for display action' }
          };
        }

        const noteId = generateUUID();
        
        // Get screen dimensions for random positioning if not specified
        let screenWidth = 800;
        let screenHeight = 600;
        
        if (args.x === undefined || args.x === null || args.y === undefined || args.y === null) {
          const callId = `note_dimensions_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const dimensionsPromise = context.requestManager.createPendingRequest(callId, 'tool_result', 5000);
          
          context.sendClientEvent({
            type: 'ui.note.getScreenDimensions',
            data: { callId }
          });
          
          const dimensionsResult = await dimensionsPromise;
          screenWidth = dimensionsResult.width || 800;
          screenHeight = dimensionsResult.height || 600;
        }
        
        // Use provided dimensions or defaults
        const noteW = args.w ?? NOTE_DEFAULTS.w;
        const noteH = args.h ?? NOTE_DEFAULTS.h;
        
        const noteItem: Note = {
          id: noteId,
          kind: 'note',
          content: args.content,
          title: generateNoteTitle(args.content),
          x: args.x ?? Math.random() * (screenWidth - noteW),
          y: args.y ?? Math.random() * (screenHeight - noteH),
          w: noteW,
          h: noteH,
          color: args.color ?? validColors[Math.floor(Math.random() * validColors.length)],
          visible: true,
          zIndex: 10000,
          effect: false
        };

        // Save to store
        await context.noteStore.saveNote(noteItem);
        
        // Send display event to frontend
        const displayCallId = `note_display_ui_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const displayPromise = context.requestManager.createPendingRequest(displayCallId, 'tool_result', 5000);
        
        context.sendClientEvent({
          type: 'ui.note.display',
          data: { callId: displayCallId, note: noteItem }
        });
        
        await displayPromise;
        
        logger.debug({ noteId, title: noteItem.title }, 'note display completed');
        return {
          status: 'success',
          data: {
            noteId: noteItem.id,
            title: noteItem.title,
            message: `Note created. Use 'present' tool to move/resize/show/hide.`
          }
        };
      }

      case 'changeColor': {
        if (!args.noteId || !args.color) {
          return {
            status: 'error',
            data: { error: 'noteId and color are required for changeColor action' }
          };
        }

        if (!validColors.includes(args.color)) {
          return {
            status: 'error',
            data: { error: `Invalid color. Must be one of: ${validColors.join(', ')}` }
          };
        }

        const noteItem = await context.noteStore.getNote(args.noteId);
        if (!noteItem) {
          return {
            status: 'error',
            data: { error: 'Note not found' }
          };
        }

        const updatedNote = await context.noteStore.updateNote(args.noteId, { color: args.color });
        
        // Send update event to frontend
        const callId = `note_color_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const resultPromise = context.requestManager.createPendingRequest(callId, 'tool_result', 5000);
        
        context.sendClientEvent({
          type: 'ui.note.update',
          data: { callId, noteId: args.noteId, updates: { color: args.color } }
        });
        
        await resultPromise;
        
        logger.debug({ noteId: args.noteId, color: args.color }, 'note changeColor completed');
        return {
          status: 'success',
          data: updatedNote
        };
      }

      case 'toggleEffect': {
        if (!args.noteId) {
          return {
            status: 'error',
            data: { error: 'noteId is required for toggleEffect action' }
          };
        }

        const noteItem = await context.noteStore.getNote(args.noteId);
        if (!noteItem) {
          return {
            status: 'error',
            data: { error: 'Note not found' }
          };
        }

        const updatedNote = await context.noteStore.updateNote(args.noteId, { effect: !noteItem.effect });
        
        // Send update event to frontend
        const callId = `note_effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const resultPromise = context.requestManager.createPendingRequest(callId, 'tool_result', 5000);
        
        context.sendClientEvent({
          type: 'ui.note.update',
          data: { callId, noteId: args.noteId, updates: { effect: updatedNote?.effect } }
        });
        
        await resultPromise;
        
        logger.debug({ noteId: args.noteId }, 'note toggleEffect completed');
        return {
          status: 'success',
          data: updatedNote
        };
      }

      case 'get': {
        if (!args.noteId) {
          return {
            status: 'error',
            data: { error: 'noteId is required for get action' }
          };
        }

        const noteItem = await context.noteStore.getNote(args.noteId);
        if (!noteItem) {
          return {
            status: 'error',
            data: { error: 'Note not found' }
          };
        }

        logger.debug({ noteId: args.noteId }, 'note get completed');
        return {
          status: 'success',
          data: noteItem
        };
      }

      case 'list': {
        const allNotes = await context.noteStore.getAllNotes();
        
        logger.debug({ noteCount: allNotes.length }, 'note list completed');
        return {
          status: 'success',
          data: allNotes
        };
      }

      case 'delete': {
        if (!args.noteId) {
          return {
            status: 'error',
            data: { error: 'noteId is required for delete action' }
          };
        }

        const deleted = await context.noteStore.deleteNote(args.noteId);
        if (!deleted) {
          return {
            status: 'error',
            data: { error: 'Note not found' }
          };
        }
        
        // Send delete event to frontend
        const callId = `note_delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const resultPromise = context.requestManager.createPendingRequest(callId, 'tool_result', 5000);
        
        context.sendClientEvent({
          type: 'ui.note.delete',
          data: { callId, noteId: args.noteId }
        });
        
        await resultPromise;
        
        logger.debug({ noteId: args.noteId }, 'note delete completed');
        return {
          status: 'success',
          data: { message: `Note ${args.noteId} deleted` }
        };
      }

      default:
        return {
          status: 'error',
          data: { error: `Invalid action: ${args.action}. Valid actions are: display, changeColor, toggleEffect, get, list, delete` }
        };
    }
  } catch (error) {
    logger.error({ error, action: args.action }, 'note tool error');
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'An error occurred' }
    };
  }
}
