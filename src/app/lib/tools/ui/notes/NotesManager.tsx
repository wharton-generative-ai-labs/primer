"use client";

import type { PrimerUIElement } from '@/app/lib/ui/types';

/**
 * Note interface - extends PrimerUIElement with note-specific properties
 * 
 * Notes are registered with UIElementManager so they can be:
 * - Observed via the 'observe' tool
 * - Manipulated via the 'present' tool (move, resize, show, hide)
 * 
 * Inherits from PrimerUIElement: id, kind, title, x, y, w, h, visible, zIndex
 * Note-specific properties: content, color, effect
 */
export interface Note extends Omit<PrimerUIElement, 'maximized' | 'anchoredTo' | 'preAnchorState'> {
  /** Always 'note' - narrowed from UIElementKind */
  kind: 'note';
  /** Note content (markdown supported) */
  content: string;
  /** Note color: yellow, pink, green, blue, purple, orange */
  color: string;
  /** Visual effect toggle */
  effect: boolean;
}

import { getUIElementManager } from '@/app/lib/ui/UIElementManager';

// Store notes in memory for client-side management
const notes: Record<string, Note> = {};

// Add state update listeners
let stateUpdateListeners: (() => void)[] = [];

// Function to notify listeners of state changes
const notifyStateUpdate = () => {
  stateUpdateListeners.forEach(listener => listener());
};

/**
 * Convert a Note to a PrimerUIElement for UIElementManager registration
 */
function noteToPrimerUIElement(note: Note): PrimerUIElement {
  return {
    id: note.id,
    kind: 'note',
    title: note.title,
    x: note.x,
    y: note.y,
    w: note.w,
    h: note.h,
    visible: note.visible,
    zIndex: note.zIndex,
  };
}

/**
 * Sync note state from UIElementManager updates
 * (Called when present tool manipulates the note via UIElementManager)
 */
function syncNoteFromUIElement(noteId: string, uiElement: PrimerUIElement): void {
  if (notes[noteId]) {
    notes[noteId] = {
      ...notes[noteId],
      x: uiElement.x,
      y: uiElement.y,
      w: uiElement.w,
      h: uiElement.h,
      visible: uiElement.visible,
      zIndex: uiElement.zIndex,
    };
  }
}

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
    
    // Register with UIElementManager for observe/present integration
    const uiManager = getUIElementManager();
    const uiElement = noteToPrimerUIElement(note);
    
    // Check if already registered
    const existing = uiManager.get(note.id);
    if (existing) {
      // Update existing element
      uiManager.update(note.id, uiElement);
    } else {
      // Register new element with proper z-index
      uiElement.zIndex = uiManager.getNextZIndex();
      uiManager.register(uiElement);
      notes[note.id].zIndex = uiElement.zIndex;
    }
    
    notifyStateUpdate();
  }

  hideNote(noteId: string): void {
    if (notes[noteId]) {
      notes[noteId].visible = false;
      
      // Update UIElementManager
      const uiManager = getUIElementManager();
      uiManager.hide(noteId);
      
      notifyStateUpdate();
    }
  }

  deleteNote(noteId: string): void {
    if (notes[noteId]) {
      // Remove from local storage
      delete notes[noteId];
      
      // Unregister from UIElementManager
      const uiManager = getUIElementManager();
      uiManager.unregister(noteId);
      
      notifyStateUpdate();
    }
  }

  updateNote(noteId: string, updates: Partial<Note>): void {
    if (notes[noteId]) {
      notes[noteId] = { ...notes[noteId], ...updates };
      
      // Sync relevant updates to UIElementManager
      const uiManager = getUIElementManager();
      const uiUpdates: Partial<PrimerUIElement> = {};
      
      if (updates.x !== undefined) uiUpdates.x = updates.x;
      if (updates.y !== undefined) uiUpdates.y = updates.y;
      if (updates.w !== undefined) uiUpdates.w = updates.w;
      if (updates.h !== undefined) uiUpdates.h = updates.h;
      if (updates.visible !== undefined) uiUpdates.visible = updates.visible;
      if (updates.zIndex !== undefined) uiUpdates.zIndex = updates.zIndex;
      if (updates.title !== undefined) uiUpdates.title = updates.title;
      
      if (Object.keys(uiUpdates).length > 0) {
        uiManager.update(noteId, uiUpdates);
      }
      
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
    const uiManager = getUIElementManager();
    
    // Unregister old notes from UIElementManager
    Object.keys(notes).forEach(key => {
      uiManager.unregister(key);
      delete notes[key];
    });
    
    // Add notes from storage and register with UIElementManager
    storageNotes.forEach(note => {
      if (note && note.visible) {
        notes[note.id] = note;
        
        const uiElement = noteToPrimerUIElement(note);
        uiManager.register(uiElement);
      }
    });
    
    notifyStateUpdate();
  }
}

// Export sync function for use by UIElementManager subscriber
export { syncNoteFromUIElement }

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

