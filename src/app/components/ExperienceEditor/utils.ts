/**
 * Utility functions for the Experience Editor
 */

import { Resource, TreeNode } from './types';

/**
 * Builds a hierarchical file tree from a flat list of resources
 */
export function buildFileTree(resources: Resource[]): TreeNode[] {
  const root: TreeNode[] = [];
  
  // First add all directories to ensure the structure exists
  resources.filter(r => r.type === 'directory').forEach(resource => {
    const parts = resource.path.split('/');
    
    let currentLevel = root;
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/');
      const existing = currentLevel.find(node => node.name === part);
      
      if (existing) {
        currentLevel = existing.children;
      } else {
        const newNode: TreeNode = {
          name: part,
          path: path,
          type: 'folder',
          children: [],
          isExpanded: index === 0 // Only expand root level folders
        };
        currentLevel.push(newNode);
        currentLevel = newNode.children;
      }
    });
  });
  
  // Then add all files
  resources.filter(r => r.type === 'file').forEach(resource => {
    const parts = resource.path.split('/');
    
    let currentLevel = root;
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join('/');
      
      if (isFile) {
        const newNode: TreeNode = {
          name: part,
          path: path,
          type: 'file',
          children: []
        };
        currentLevel.push(newNode);
      } else {
        const existing = currentLevel.find(node => node.name === part);
        if (existing) {
          currentLevel = existing.children;
        } else {
          const newNode: TreeNode = {
            name: part,
            path: path,
            type: 'folder',
            children: [],
            isExpanded: index === 0 // Only expand root level folders
          };
          currentLevel.push(newNode);
          currentLevel = newNode.children;
        }
      }
    });
  });
  
  return root;
}

/**
 * Enriches session folders with metadata (user name, start time)
 */
export async function enrichSessionFolders(
  tree: TreeNode[], 
  experienceId: string, 
  currentSessionId: string | null
): Promise<TreeNode[]> {
  const enrichNode = async (node: TreeNode): Promise<TreeNode> => {
    // Check if this is a session folder (sess_* pattern inside session_data)
    const isSessionFolder = node.type === 'folder' && 
      node.name.startsWith('sess_') && 
      node.path.includes('session_data/');
    
    if (isSessionFolder) {
      const sessionId = node.name;
      const isCurrentSession = sessionId === currentSessionId;
      
      // Try to fetch session metadata
      try {
        const response = await fetch(
          `/api/session-metadata?experienceId=${experienceId}&sessionId=${sessionId}`
        );
        
        if (response.ok) {
          const metadata = await response.json();
          
          if (metadata) {
            // Create a human-readable display name
            let displayName = '';
            
            if (isCurrentSession) {
              displayName = 'Current Session 🟢';
            } else {
              const date = new Date(metadata.startTime);
              const dateStr = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              });
              const timeStr = date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
              });
              
              if (metadata.userName) {
                displayName = `${metadata.userName} - ${dateStr} ${timeStr}`;
              } else {
                displayName = `Session - ${dateStr} ${timeStr}`;
              }
            }
            
            return {
              ...node,
              displayName,
              isCurrentSession,
              sessionMetadata: {
                userName: metadata.userName,
                startTime: metadata.startTime
              },
              children: await Promise.all(node.children.map(enrichNode))
            };
          }
        }
      } catch (_error) {
        // Silently fail - session metadata is optional
      }
      
      // If metadata fetch failed or doesn't exist, still mark current session
      if (isCurrentSession) {
        return {
          ...node,
          displayName: '🟢 Current Session',
          isCurrentSession: true,
          children: await Promise.all(node.children.map(enrichNode))
        };
      }
    }
    
    // Recursively enrich children
    if (node.children.length > 0) {
      return {
        ...node,
        children: await Promise.all(node.children.map(enrichNode))
      };
    }
    
    return node;
  };
  
  return Promise.all(tree.map(enrichNode));
}

