"use client";
import React, { useEffect, useState } from 'react';
import { getNotesManager, subscribeToStateUpdates, Note } from './NotesManager';
import { getUIElementManager, subscribeToUIElements } from '@/app/lib/ui/UIElementManager';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PASTEL_COLORS = {
  yellow: '#FFF9B1',
  pink: '#FFE4E1',
  green: '#E8F5E9',
  blue: '#E3F2FD',
  purple: '#F3E5F5',
  orange: '#FFF3E0'
};

/** Default note dimensions */
const NOTE_DEFAULTS = {
  w: 200,
  h: 150,
  minW: 100,
  minH: 100,
  maxW: 400,
  maxH: 400,
};

export const NotesComponent: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draggingNote, setDraggingNote] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingNote, setResizingNote] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Subscribe to notes manager state updates
  useEffect(() => {
    const unsubscribe = subscribeToStateUpdates(() => {
      const manager = getNotesManager();
      setNotes(manager.getVisibleNotes());
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to UIElementManager updates (for present tool integration)
  useEffect(() => {
    const unsubscribe = subscribeToUIElements(() => {
      const notesManager = getNotesManager();
      const uiManager = getUIElementManager();
      
      // Sync position/size changes from UIElementManager to NotesManager
      notesManager.getAllNotes().forEach(note => {
        const uiElement = uiManager.get(note.id);
        if (uiElement && uiElement.kind === 'note') {
          // Check if UI element has different position/size than note
          if (
            note.x !== uiElement.x ||
            note.y !== uiElement.y ||
            note.w !== uiElement.w ||
            note.h !== uiElement.h ||
            note.visible !== uiElement.visible ||
            note.zIndex !== uiElement.zIndex
          ) {
            // Update note from UIElementManager (triggered by present tool)
            notesManager.updateNote(note.id, {
              x: uiElement.x,
              y: uiElement.y,
              w: uiElement.w,
              h: uiElement.h,
              visible: uiElement.visible,
              zIndex: uiElement.zIndex,
            });
          }
        }
      });
      
      setNotes(notesManager.getVisibleNotes());
    });
    return () => unsubscribe();
  }, []);

  // Initial sync
  useEffect(() => {
    const manager = getNotesManager();
    setNotes(manager.getVisibleNotes());
  }, []);

  const updateNotePosition = (noteId: string, x: number, y: number, w?: number, h?: number) => {
    const manager = getNotesManager();
    const updates: Partial<Note> = { x, y };
    if (w !== undefined) updates.w = w;
    if (h !== undefined) updates.h = h;
    
    manager.updateNote(noteId, updates);
  };

  const handleMouseDown = (e: React.MouseEvent, noteId: string) => {
    const manager = getNotesManager();
    const note = manager.getNote(noteId);
    if (!note) return;

    // Find the highest zIndex among all notes
    const allNotes = manager.getAllNotes();
    const maxZIndex = allNotes.reduce((max, n) => Math.max(max, n.zIndex), 0);
    // If this note is not already the topmost, update its zIndex
    if (note.zIndex <= maxZIndex) {
      manager.updateNote(noteId, { zIndex: maxZIndex + 1 });
    }

    setDraggingNote(noteId);
    setDragOffset({
      x: e.clientX - note.x,
      y: e.clientY - note.y
    });
  };

  const handleTouchStart = (e: React.TouchEvent, noteId: string) => {
    const manager = getNotesManager();
    const note = manager.getNote(noteId);
    if (!note) return;

    // Find the highest zIndex among all notes
    const allNotes = manager.getAllNotes();
    const maxZIndex = allNotes.reduce((max, n) => Math.max(max, n.zIndex), 0);
    // If this note is not already the topmost, update its zIndex
    if (note.zIndex <= maxZIndex) {
      manager.updateNote(noteId, { zIndex: maxZIndex + 1 });
    }

    setDraggingNote(noteId);
    setDragOffset({
      x: e.touches[0].clientX - note.x,
      y: e.touches[0].clientY - note.y
    });
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, noteId: string) => {
    e.stopPropagation(); // Prevent drag from starting
    const manager = getNotesManager();
    const note = manager.getNote(noteId);
    if (!note) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setResizingNote(noteId);
    setResizeStart({
      x: clientX,
      y: clientY,
      w: note.w || NOTE_DEFAULTS.w,
      h: note.h || NOTE_DEFAULTS.h
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    const manager = getNotesManager();
    
    if (resizingNote) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      const newW = Math.max(NOTE_DEFAULTS.minW, Math.min(NOTE_DEFAULTS.maxW, resizeStart.w + deltaX));
      const newH = Math.max(NOTE_DEFAULTS.minH, Math.min(NOTE_DEFAULTS.maxH, resizeStart.h + deltaY));

      const note = manager.getNote(resizingNote);
      if (note) {
        updateNotePosition(resizingNote, note.x, note.y, newW, newH);
      }
    } else if (draggingNote) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      updateNotePosition(draggingNote, newX, newY);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    const manager = getNotesManager();
    
    if (resizingNote) {
      const deltaX = e.touches[0].clientX - resizeStart.x;
      const deltaY = e.touches[0].clientY - resizeStart.y;
      const newW = Math.max(NOTE_DEFAULTS.minW, Math.min(NOTE_DEFAULTS.maxW, resizeStart.w + deltaX));
      const newH = Math.max(NOTE_DEFAULTS.minH, Math.min(NOTE_DEFAULTS.maxH, resizeStart.h + deltaY));

      const note = manager.getNote(resizingNote);
      if (note) {
        updateNotePosition(resizingNote, note.x, note.y, newW, newH);
      }
    } else if (draggingNote) {
      const newX = e.touches[0].clientX - dragOffset.x;
      const newY = e.touches[0].clientY - dragOffset.y;

      updateNotePosition(draggingNote, newX, newY);
    }
  };

  const handleDragEnd = async () => {
    // Position updates are already handled in move events
    // Just clear the dragging state
    if (resizingNote) {
      setResizingNote(null);
    } else if (draggingNote) {
      setDraggingNote(null);
    }
  };

  useEffect(() => {
    if (draggingNote || resizingNote) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [draggingNote, resizingNote, dragOffset, resizeStart, notes]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {notes.map(note => (
        <div
          key={note.id}
          onMouseDown={(e) => handleMouseDown(e, note.id)}
          onTouchStart={(e) => handleTouchStart(e, note.id)}
          style={{
            position: 'fixed',
            left: note.x,
            top: note.y,
            width: note.w || NOTE_DEFAULTS.w,
            height: note.h || NOTE_DEFAULTS.h,
            backgroundColor: PASTEL_COLORS[note.color as keyof typeof PASTEL_COLORS] || note.color,
            color: '#333',
            padding: '12px',
            borderRadius: '2px',
            // Layered shadow for realistic lifted paper effect
            boxShadow: '2px 2px 4px rgba(0,0,0,0.15), 4px 4px 8px rgba(0,0,0,0.1)',
            cursor: 'move',
            minWidth: NOTE_DEFAULTS.minW,
            minHeight: NOTE_DEFAULTS.minH,
            maxWidth: NOTE_DEFAULTS.maxW,
            maxHeight: NOTE_DEFAULTS.maxH,
            overflow: 'auto',
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            fontSize: '14px',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            userSelect: draggingNote === note.id || resizingNote === note.id ? 'none' : 'text',
            display: note.visible ? 'block' : 'none',
            zIndex: note.zIndex,
            pointerEvents: 'auto',
            transform: note.effect ? 'rotate(-2deg) scale(1.02)' : 'none',
            transition: note.effect ? 'transform 0.3s ease' : 'none'
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
          <div
            onMouseDown={(e) => handleResizeStart(e, note.id)}
            onTouchStart={(e) => handleResizeStart(e, note.id)}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: '20px',
              height: '20px',
              cursor: 'nwse-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRight: '2px solid rgba(0,0,0,0.15)',
                borderBottom: '2px solid rgba(0,0,0,0.15)'
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

