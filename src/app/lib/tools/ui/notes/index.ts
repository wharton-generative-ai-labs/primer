/**
 * Notes plugin public API
 * Exports managers, components, and types for external use
 * 
 * Notes are now integrated with UIElementManager for observe/present support:
 * - Notes register with UIElementManager when displayed
 * - Position/size/visibility are synced between NotesManager and UIElementManager
 * - Notes are visible via the 'observe' tool
 * - Notes can be manipulated via the 'present' tool
 */

export { getNotesManager, subscribeToStateUpdates, syncNoteFromUIElement } from './NotesManager';
export { NotesComponent } from './NotesComponent';
export type { Note, NotesManagerContext } from './NotesManager';

