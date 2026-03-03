/**
 * Custom hook for managing file content loading and saving
 */

import { useState, useEffect, useCallback } from 'react';
import { SaveStatus } from '../types';
import logger from '@/lib/logger';

interface UseFileContentOptions {
  experienceId: string;
  selectedPath: string;
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
}

export function useFileContent({ 
  experienceId, 
  selectedPath, 
  onUnsavedChangesChange 
}: UseFileContentOptions) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [contentType, setContentType] = useState<string>('');
  const [fileUrl, setFileUrl] = useState<string>('');
  const [isText, setIsText] = useState(true);

  // Load selected resource content
  const loadContent = useCallback(async () => {
    if (!selectedPath) return;

    setLoading(true);
    setError(null);
    
    const apiUrl = `/api/resource-content?experienceId=${experienceId}&path=${encodeURIComponent(selectedPath)}`;
    
    try {
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('Failed to load content');
      }
      
      const data = await response.json();
      
      setContentType(data.contentType);
      setIsText(data.isText);
      
      if (data.isText && data.content !== undefined) {
        setContent(data.content);
        setOriginalContent(data.content);
        setHasUnsavedChanges(false);
        onUnsavedChangesChange?.(false);
      } else if (!data.isText && data.fileUrl) {
        setFileUrl(data.fileUrl);
        setContent('');
        setOriginalContent('');
        setHasUnsavedChanges(false);
        onUnsavedChangesChange?.(false);
      }
    } catch (error) {
      const errorMessage = 'Failed to load file content';
      logger.error({ error, experienceId, selectedPath }, errorMessage);
      setError(errorMessage);
      setContent('');
      setOriginalContent('');
    } finally {
      setLoading(false);
    }
  }, [experienceId, selectedPath, onUnsavedChangesChange]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    const hasChanges = newContent !== originalContent;
    setHasUnsavedChanges(hasChanges);
    onUnsavedChangesChange?.(hasChanges);
  }, [originalContent, onUnsavedChangesChange]);

  // Save file
  const handleSave = useCallback(async () => {
    if (!selectedPath) return;

    setSaveStatus('saving');
    setError(null);
    
    try {
      const response = await fetch('/api/save-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId,
          path: selectedPath,
          content
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }
      
      await response.json();

      setSaveStatus('saved');
      setOriginalContent(content);
      setHasUnsavedChanges(false);
      onUnsavedChangesChange?.(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save file';
      logger.error({ error, experienceId, selectedPath }, 'Failed to save file');
      setError(errorMessage);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [experienceId, selectedPath, content, onUnsavedChangesChange]);

  // Reset unsaved changes state
  const resetUnsavedChanges = useCallback(() => {
    setHasUnsavedChanges(false);
    onUnsavedChangesChange?.(false);
  }, [onUnsavedChangesChange]);

  return {
    content,
    loading,
    saveStatus,
    error,
    hasUnsavedChanges,
    contentType,
    fileUrl,
    isText,
    setError,
    handleContentChange,
    handleSave,
    resetUnsavedChanges,
    reloadFile: loadContent
  };
}

