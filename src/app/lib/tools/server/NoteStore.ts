/**
 * NoteStore - Server-side note storage with file persistence
 * 
 * Stores notes for a session, persisted to disk in session_data.
 * Uses write-through caching: every operation writes to disk immediately.
 * 
 * Storage location: storage/{experienceId}/session_data/{sessionId}/notes.json
 */

import { createModuleLogger } from '@/lib/logger';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { PrimerUIElement } from '@/app/lib/ui/types';
import path from 'path';

const logger = createModuleLogger('NoteStore');

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
  /** Note color: yellow, pink, green, blue, purple, orange */
  color: string;
  /** Visual effect toggle */
  effect: boolean;
}

/** Default note dimensions */
export const NOTE_DEFAULTS = {
  w: 200,
  h: 150,
  minW: 100,
  minH: 100,
  maxW: 400,
  maxH: 400,
};

/**
 * Generate a title from note content (first ~60 chars, truncated at word boundary)
 */
export function generateNoteTitle(content: string): string {
  const maxLength = 60;
  const cleaned = content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  // Truncate at word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.5) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

interface NotesData {
  notes: Record<string, Note>;
  lastUpdated: string;
}

// In-memory cache per session
const sessionCaches = new Map<string, NotesData>();

/**
 * Get the storage path for notes data
 */
function getNotesPath(experienceId: string, sessionId: string): string {
  return path.join(experienceId, 'session_data', sessionId, 'notes.json');
}

/**
 * Get cache key for session
 */
function getCacheKey(experienceId: string, sessionId: string): string {
  return `${experienceId}:${sessionId}`;
}

/**
 * Load notes data from disk (or cache)
 */
async function loadNotes(experienceId: string, sessionId: string): Promise<NotesData> {
  const cacheKey = getCacheKey(experienceId, sessionId);
  
  // Check cache first
  const cached = sessionCaches.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Load from disk
  const storagePath = getNotesPath(experienceId, sessionId);
  const storage = StorageServiceFactory.getInstance();
  
  try {
    const exists = await storage.fileExists(storagePath);
    if (exists) {
      const content = await storage.readFileAsText(storagePath);
      const data = JSON.parse(content) as NotesData;
      sessionCaches.set(cacheKey, data);
      logger.debug({ experienceId, sessionId, noteCount: Object.keys(data.notes).length }, 'Loaded notes from disk');
      return data;
    }
  } catch (error) {
    logger.warn({ error, experienceId, sessionId }, 'Failed to load notes from disk, starting fresh');
  }
  
  // Return empty data if not found or error
  const emptyData: NotesData = {
    notes: {},
    lastUpdated: new Date().toISOString()
  };
  sessionCaches.set(cacheKey, emptyData);
  return emptyData;
}

/**
 * Save notes data to disk
 */
async function saveNotes(experienceId: string, sessionId: string, data: NotesData): Promise<void> {
  const storagePath = getNotesPath(experienceId, sessionId);
  const storage = StorageServiceFactory.getInstance();
  
  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(storagePath);
    try {
      await storage.createDirectory(parentDir);
    } catch {
      // Directory may already exist, that's ok
    }
    
    // Write data as a buffer
    const content = JSON.stringify(data, null, 2);
    await storage.storeFile(storagePath, Buffer.from(content, 'utf-8'));
    logger.debug({ experienceId, sessionId, noteCount: Object.keys(data.notes).length }, 'Saved notes to disk');
  } catch (error) {
    logger.error({ error, experienceId, sessionId }, 'Failed to save notes to disk');
    throw error;
  }
}

/**
 * NoteStore class - manages notes for a specific session
 */
export class NoteStore {
  private experienceId: string;
  private sessionId: string;
  
  constructor(experienceId: string, sessionId: string) {
    this.experienceId = experienceId;
    this.sessionId = sessionId;
  }
  
  /**
   * Get all notes
   */
  async getAllNotes(): Promise<Note[]> {
    const data = await loadNotes(this.experienceId, this.sessionId);
    return Object.values(data.notes);
  }
  
  /**
   * Get a note by ID
   */
  async getNote(noteId: string): Promise<Note | null> {
    const data = await loadNotes(this.experienceId, this.sessionId);
    return data.notes[noteId] ?? null;
  }
  
  /**
   * Save or update a note
   */
  async saveNote(note: Note): Promise<void> {
    const data = await loadNotes(this.experienceId, this.sessionId);
    data.notes[note.id] = note;
    data.lastUpdated = new Date().toISOString();
    
    // Update cache
    const cacheKey = getCacheKey(this.experienceId, this.sessionId);
    sessionCaches.set(cacheKey, data);
    
    // Write through to disk
    await saveNotes(this.experienceId, this.sessionId, data);
  }
  
  /**
   * Update specific fields of a note
   */
  async updateNote(noteId: string, updates: Partial<Note>): Promise<Note | null> {
    const data = await loadNotes(this.experienceId, this.sessionId);
    
    if (!data.notes[noteId]) {
      return null;
    }
    
    data.notes[noteId] = { ...data.notes[noteId], ...updates };
    data.lastUpdated = new Date().toISOString();
    
    // Update cache
    const cacheKey = getCacheKey(this.experienceId, this.sessionId);
    sessionCaches.set(cacheKey, data);
    
    // Write through to disk
    await saveNotes(this.experienceId, this.sessionId, data);
    
    return data.notes[noteId];
  }
  
  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<boolean> {
    const data = await loadNotes(this.experienceId, this.sessionId);
    
    if (!data.notes[noteId]) {
      return false;
    }
    
    delete data.notes[noteId];
    data.lastUpdated = new Date().toISOString();
    
    // Update cache
    const cacheKey = getCacheKey(this.experienceId, this.sessionId);
    sessionCaches.set(cacheKey, data);
    
    // Write through to disk
    await saveNotes(this.experienceId, this.sessionId, data);
    
    return true;
  }
  
  /**
   * Clear all notes (internal use only)
   */
  async clearAll(): Promise<void> {
    const emptyData: NotesData = {
      notes: {},
      lastUpdated: new Date().toISOString()
    };
    
    // Update cache
    const cacheKey = getCacheKey(this.experienceId, this.sessionId);
    sessionCaches.set(cacheKey, emptyData);
    
    // Write through to disk
    await saveNotes(this.experienceId, this.sessionId, emptyData);
    logger.info({ experienceId: this.experienceId, sessionId: this.sessionId }, 'Cleared all notes');
  }
}

/**
 * Factory function to create a NoteStore for a session
 */
export function createNoteStore(experienceId: string, sessionId: string): NoteStore {
  return new NoteStore(experienceId, sessionId);
}

/**
 * Clear the session cache (useful for testing or memory management)
 */
export function clearNoteSessionCache(experienceId: string, sessionId: string): void {
  const cacheKey = getCacheKey(experienceId, sessionId);
  sessionCaches.delete(cacheKey);
}

/**
 * Clear all session caches
 */
export function clearAllNoteSessionCaches(): void {
  sessionCaches.clear();
}
