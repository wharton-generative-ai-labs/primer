/**
 * Sidebar component displaying the file tree
 */

import React from 'react';
import { TreeNode } from '../types';
import { FileTreeNode } from './FileTreeNode';

interface FileTreeSidebarProps {
  fileTree: TreeNode[];
  selectedPath: string;
  sidebarWidth: number;
  onToggleFolder: (path: string) => void;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onDelete: (path: string, isDirectory: boolean) => void;
}

export function FileTreeSidebar({
  fileTree,
  selectedPath,
  sidebarWidth,
  onToggleFolder,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onDelete
}: FileTreeSidebarProps) {
  return (
    <div 
      className="border-r border-border p-4 overflow-auto bg-muted/40 flex-shrink-0" 
      style={{ width: sidebarWidth }}
    >
      <div className="space-y-1">
        {fileTree.map(node => (
          <FileTreeNode
            key={node.path}
            node={node}
            level={0}
            selectedPath={selectedPath}
            onToggleFolder={onToggleFolder}
            onFileSelect={onFileSelect}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

