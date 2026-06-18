/**
 * Note Tool - Backend-first implementation
 *
 * Manages sticky notes that render in the Document Panel's Notes tab. Data is
 * stored on the server and persisted to disk in session_data/{sessionId}/notes.json.
 *
 * Actions: display, changeColor, get, list, delete.
 *
 * Per the panel-layout-and-tool-redesign spec, notes no longer have x/y/w/h or
 * a floating "effect" — the grid layout handles positioning and there's no
 * floating surface for effects. The schema has been stripped accordingly; the
 * impl still accepts/ignores positioning params for any old persisted data.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';
import { generateUUID } from '@/app/lib/uuid';
import { Note, NOTE_DEFAULTS, generateNoteTitle } from '@/app/lib/tools/server/NoteStore';

const logger = createModuleLogger('note-tool');

const validColors = ['yellow', 'pink', 'green', 'blue', 'purple', 'orange'];

/**
 * @tool note
 * @description Manage sticky notes in the document panel's Notes tab. Use 'add' to create a note, 'list' to see all, 'get' for details, 'changeColor' to recolor, and 'delete' to remove. ('display' and 'create' are accepted aliases for 'add' so the realtime model has more than one natural verb to reach for.)
 */
export async function note(args: {
  action: 'add' | 'create' | 'display' | 'changeColor' | 'get' | 'list' | 'delete';
  noteId?: string;
  content?: string;
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

  // The realtime model reaches for `add` (and occasionally `create`) when it
  // wants a new sticky note — `display` is an awkward verb for "create". We
  // keep `display` as the canonical internal action so existing prompts and
  // any in-the-wild persisted state still resolve, but normalize the model's
  // natural verbs at the boundary.
  const action =
    args.action === 'add' || args.action === 'create' ? 'display' : args.action;

  try {
    switch (action) {
      case 'display': {
        if (!args.content) {
          return {
            status: 'error',
            data: { error: 'content is required for display action' }
          };
        }

        const noteId = generateUUID();

        // x/y/w/h are retained on the Note type for persistence compatibility
        // but no longer drive rendering (notes live in the Notes tab grid).
        // Use defaults; no screen-dimension round-trip needed any more.
        const noteItem: Note = {
          id: noteId,
          kind: 'note',
          content: args.content,
          title: generateNoteTitle(args.content),
          x: 0,
          y: 0,
          w: NOTE_DEFAULTS.w,
          h: NOTE_DEFAULTS.h,
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
            message: 'Note created in the document panel Notes tab.'
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

      // toggleEffect removed with the split-panel redesign — notes render in
      // a grid and have no floating surface for effects. See
      // docs/superpowers/specs/2026-04-15-panel-layout-and-tool-redesign.md §5.4.

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
          data: { error: `Invalid action: ${args.action}. Valid actions are: add, list, get, changeColor, delete` }
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
