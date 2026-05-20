/**
 * Notes plugin public API
 * Exports the note manager and types for external use.
 * 
 * Notes are rendered inside the document panel's Notes tab. Visibility is
 * driven by note state, not by floating UI element commands.
 */

export { getNotesManager, subscribeToStateUpdates } from './NotesManager';
export type { Note, NotesManagerContext } from './NotesManager';
