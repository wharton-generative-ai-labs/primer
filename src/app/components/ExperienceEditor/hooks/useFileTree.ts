/**
 * Custom hook for managing file tree state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { TreeNode } from '../types';
import { buildFileTree, enrichSessionFolders } from '../utils';
import logger from '@/lib/logger';

interface UseFileTreeOptions {
  experienceId: string;
  currentSessionId: string | null;
}

export function useFileTree({ experienceId, currentSessionId }: UseFileTreeOptions) {
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadResources = useCallback(async () => {
    setError(null);
    
    if (!experienceId) {
      setError('No experience ID provided');
      return;
    }
    
    const apiUrl = `/api/resources?experienceId=${experienceId}`;
    
    try {
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        
        try {
          // Try to parse as JSON if possible
          const errorJson = JSON.parse(errorText);
          throw new Error(`Failed to load resources: ${response.status} ${response.statusText} - ${errorJson.error || ''} ${errorJson.details || ''}`);
        } catch {
          // If not JSON or parse fails, use text
          throw new Error(`Failed to load resources: ${response.status} ${response.statusText} - ${errorText}`);
        }
      }
      
      const data = await response.json();
      
      if (!data.resources || !Array.isArray(data.resources)) {
        setError('Invalid resource data structure');
        return;
      }
      
      const tree = buildFileTree(data.resources);
      
      // Enrich session folders with metadata
      const enrichedTree = await enrichSessionFolders(tree, experienceId, currentSessionId);
      
      setFileTree(enrichedTree);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load resource list';
      logger.error({ error, experienceId }, 'Failed to load resources');
      setError(errorMessage);
    }
  }, [experienceId, currentSessionId]);

  // Load resource tree when experienceId or currentSessionId changes
  useEffect(() => {
    if (experienceId && currentSessionId !== undefined) {
      loadResources();
    }
  }, [experienceId, currentSessionId, loadResources]);

  const toggleFolder = useCallback((path: string) => {
    setFileTree(prevTree => {
      const updateNode = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map(node => {
          if (node.path === path) {
            return { ...node, isExpanded: !node.isExpanded };
          }
          if (node.children.length > 0) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      };
      return updateNode(prevTree);
    });
  }, []);

  return {
    fileTree,
    error,
    setError,
    loadResources,
    toggleFolder
  };
}

