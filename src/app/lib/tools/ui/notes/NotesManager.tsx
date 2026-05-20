"use client";

import type { PrimerUIElement } from '@/app/lib/ui/types';

/**
 * Note interface - extends PrimerUIElement with note-specific properties
 * 
 * Notes are rendered in the document panel's Notes tab. Position and size are
 * retained for persistence compatibility but do not drive the panel layout.
 * 
 * Inherits from PrimerUIElement: id, kind, title, x, y, w, h, visible, zIndex
 * Note-specific properties: content, color, effect
 */
export interface Note extends Omit<PrimerUIElement, 'maximized' | 'anchoredTo' | 'preAnchorState'> {
  /** Always 'note' - narrowed from UIElementKind */
  kind: 'note';
  /** Note content (markdown supported) */
  content: string;
  /**
   * Note color (drives the tile background in the Notes tab).
   * Preferred values: 'amber' | 'yellow' | 'pink' | 'orange' (Figma 520:7927).
   * Legacy values 'green' | 'blue' | 'purple' still parse but collapse onto the
   * closest warm tone in the renderer; unknown values fall back to amber.
   * Kept as `string` (not a union) for backward compatibility with stored
   * sessions.
   */
  color: string;
  /** Visual effect toggle */
  effect: boolean;
}

// Store notes in memory for client-side management
const notes: Record<string, Note> = {};

// Add state update listeners
let stateUpdateListeners: (() => void)[] = [];

// Function to notify listeners of state changes
const notifyStateUpdate = () => {
  stateUpdateListeners.forEach(listener => listener());
};

// Notes manager interface
export interface NotesManagerContext {
  displayNote: (note: Note) => void;
  hideNote: (noteId: string) => void;
  deleteNote: (noteId: string) => void;
  updateNote: (noteId: string, updates: Partial<Note>) => void;
  getNote: (noteId: string) => Note | null;
  getAllNotes: () => Note[];
  getVisibleNotes: () => Note[];
  syncFromStorage: (storageNotes: Note[]) => void;
}

class NotesManager implements NotesManagerContext {
  displayNote(note: Note): void {
    notes[note.id] = note;
    notifyStateUpdate();
  }

  hideNote(noteId: string): void {
    if (notes[noteId]) {
      notes[noteId].visible = false;
      notifyStateUpdate();
    }
  }

  deleteNote(noteId: string): void {
    if (notes[noteId]) {
      delete notes[noteId];
      notifyStateUpdate();
    }
  }

  updateNote(noteId: string, updates: Partial<Note>): void {
    if (notes[noteId]) {
      notes[noteId] = { ...notes[noteId], ...updates };
      notifyStateUpdate();
    }
  }

  getNote(noteId: string): Note | null {
    return notes[noteId] || null;
  }

  getAllNotes(): Note[] {
    return Object.values(notes);
  }

  getVisibleNotes(): Note[] {
    return Object.values(notes).filter(note => note.visible);
  }

  syncFromStorage(storageNotes: Note[]): void {
    Object.keys(notes).forEach(key => {
      delete notes[key];
    });
    
    storageNotes.forEach(note => {
      if (note && note.visible) {
        notes[note.id] = note;
      }
    });
    
    notifyStateUpdate();
  }
}

// Singleton instance
let notesManagerInstance: NotesManager | null = null;

export const getNotesManager = (): NotesManager => {
  if (!notesManagerInstance) {
    notesManagerInstance = new NotesManager();
  }
  return notesManagerInstance;
};

// State update subscription
export const subscribeToStateUpdates = (listener: () => void): (() => void) => {
  stateUpdateListeners.push(listener);
  return () => {
    stateUpdateListeners = stateUpdateListeners.filter(l => l !== listener);
  };
};
