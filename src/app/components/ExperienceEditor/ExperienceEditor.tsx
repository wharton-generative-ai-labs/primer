/**
 * Main Experience Editor component
 * Refactored for better maintainability and separation of concerns
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EditorProps } from './types';
import { useFileTree, useFileContent, useResizing } from './hooks';
import { 
  FileTreeSidebar, 
  EditorPane, 
  UnsavedChangesDialog, 
  CreateDialog, 
  DeleteDialog, 
  MoveDialog 
} from './components';
import logger from '@/lib/logger';

export function ExperienceEditor({ 
  experienceId, 
  visible, 
  onUnsavedChangesChange, 
  hasUnsavedChanges: parentHasUnsavedChanges 
}: EditorProps) {
  // State for current session
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // State for file selection
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  
  // State for dialogs
  const [contextMenuPath, setContextMenuPath] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [isDirectory, setIsDirectory] = useState(false);
  const [moveDestination, setMoveDestination] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Custom hooks
  const { sidebarWidth, startResizing } = useResizing();
  const { fileTree, error: treeError, setError: setTreeError, loadResources, toggleFolder } = useFileTree({
    experienceId,
    currentSessionId
  });
  const {
    content,
    loading,
    saveStatus,
    error: contentError,
    hasUnsavedChanges,
    contentType,
    fileUrl,
    isText,
    setError: setContentError,
    handleContentChange,
    handleSave,
    resetUnsavedChanges,
    reloadFile
  } = useFileContent({
    experienceId,
    selectedPath,
    onUnsavedChangesChange
  });

  // Get current session ID from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      const sessionId = sessionStorage.getItem('primer:session-id');
      setCurrentSessionId(sessionId);
    }
  }, []);

  // Focus input when create dialog opens
  useEffect(() => {
    if (showCreateDialog) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [showCreateDialog]);

  // Prompt before closing if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Sync with parent's hasUnsavedChanges state
  useEffect(() => {
    if (parentHasUnsavedChanges === false) {
      resetUnsavedChanges();
    }
  }, [parentHasUnsavedChanges, resetUnsavedChanges]);

  // File selection handler
  const handleFileSelect = useCallback((path: string) => {
    if (hasUnsavedChanges) {
      setPendingPath(path);
    } else {
      setSelectedPath(path);
    }
  }, [hasUnsavedChanges]);

  const confirmFileSelect = useCallback(() => {
    if (pendingPath) {
      setSelectedPath(pendingPath);
      setPendingPath(null);
    }
  }, [pendingPath]);

  // File/folder operations
  const handleCreate = useCallback(async (path: string, isDirectory: boolean) => {
    try {
      const response = await fetch('/api/experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isDirectory ? 'createDirectory' : 'createFile',
          experienceId,
          path,
          content: isDirectory ? undefined : ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create');
      }

      await loadResources();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create';
      logger.error({ error, experienceId, path, isDirectory }, 'Failed to create resource');
      setTreeError(errorMessage);
    }
  }, [experienceId, loadResources, setTreeError]);

  const handleDelete = useCallback(async (path: string, isDirectory: boolean) => {
    try {
      const response = await fetch('/api/experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isDirectory ? 'deleteDirectory' : 'deleteFile',
          experienceId,
          path
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      // If we're deleting the currently selected file/directory, clear the editor
      if (path === selectedPath || (isDirectory && selectedPath?.startsWith(path + '/'))) {
        setSelectedPath('');
      }

      await loadResources();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete';
      logger.error({ error, experienceId, path, isDirectory }, 'Failed to delete resource');
      setTreeError(errorMessage);
    }
  }, [experienceId, selectedPath, loadResources, setTreeError]);

  const handleMove = useCallback(async (sourcePath: string, destinationPath: string, isDirectory: boolean) => {
    try {
      const response = await fetch('/api/experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isDirectory ? 'moveDirectory' : 'moveFile',
          experienceId,
          sourcePath,
          destinationPath
        })
      });

      if (!response.ok) {
        throw new Error('Failed to move');
      }

      await loadResources();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to move';
      logger.error({ error, experienceId, sourcePath, destinationPath, isDirectory }, 'Failed to move resource');
      setTreeError(errorMessage);
    }
  }, [experienceId, loadResources, setTreeError]);

  // Context menu handlers
  const handleCreateFile = useCallback((path: string) => {
    setContextMenuPath(path);
    setIsDirectory(false);
    setShowCreateDialog(true);
  }, []);

  const handleCreateFolder = useCallback((path: string) => {
    setContextMenuPath(path);
    setIsDirectory(true);
    setShowCreateDialog(true);
  }, []);

  const handleDeleteClick = useCallback((path: string, isDir: boolean) => {
    setContextMenuPath(path);
    setIsDirectory(isDir);
    setShowDeleteDialog(true);
  }, []);

  return (
    <div className={`h-full w-full -mt-2 bg-background flex overflow-hidden ${visible === false ? 'hidden' : ''}`}>
      {/* Left sidebar with resource tree */}
      <FileTreeSidebar
        fileTree={fileTree}
        selectedPath={selectedPath}
        sidebarWidth={sidebarWidth}
        onToggleFolder={toggleFolder}
        onFileSelect={handleFileSelect}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
        onDelete={handleDeleteClick}
      />

      {/* Resize handle */}
      <div
        className="w-1 cursor-col-resize bg-transparent hover:bg-border active:bg-border/80 transition-colors"
        onMouseDown={startResizing}
      />

      {/* Editor pane */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        <EditorPane
          experienceId={experienceId}
          selectedPath={selectedPath}
          content={content}
          loading={loading}
          saveStatus={saveStatus}
          error={contentError || treeError}
          hasUnsavedChanges={hasUnsavedChanges}
          contentType={contentType}
          fileUrl={fileUrl}
          isText={isText}
          fileTree={fileTree}
          onContentChange={handleContentChange}
          onSave={handleSave}
          onErrorDismiss={() => {
            setContentError(null);
            setTreeError(null);
          }}
          onReloadFile={reloadFile}
        />
      </div>

      {/* Dialogs */}
      <UnsavedChangesDialog
        open={!!pendingPath}
        onOpenChange={(open) => !open && setPendingPath(null)}
        onConfirm={confirmFileSelect}
      />

      <CreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        isDirectory={isDirectory}
        contextMenuPath={contextMenuPath}
        newName={newName}
        onNewNameChange={setNewName}
        onCreate={handleCreate}
        inputRef={inputRef}
      />

      <DeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        isDirectory={isDirectory}
        contextMenuPath={contextMenuPath}
        onDelete={handleDelete}
      />

      <MoveDialog
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
        contextMenuPath={contextMenuPath}
        moveDestination={moveDestination}
        onMoveDestinationChange={setMoveDestination}
        onMove={handleMove}
      />
    </div>
  );
}

