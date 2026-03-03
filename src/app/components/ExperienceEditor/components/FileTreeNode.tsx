/**
 * Component for rendering individual tree nodes (files and folders)
 */

import React from 'react';
import { File, ChevronRight, ChevronDown, Folder, Plus, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TreeNode } from '../types';

interface FileTreeNodeProps {
  node: TreeNode;
  level: number;
  selectedPath: string;
  onToggleFolder: (path: string) => void;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onDelete: (path: string, isDirectory: boolean) => void;
}

export function FileTreeNode({
  node,
  level,
  selectedPath,
  onToggleFolder,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onDelete
}: FileTreeNodeProps) {
  const paddingLeft = level * 16;

  if (node.type === 'folder') {
    // Use displayName if available, otherwise use node.name
    const folderDisplayName = node.displayName || node.name;
    // Add special styling for current session
    const folderClassName = node.isCurrentSession 
      ? "w-full justify-start text-terminal-directory hover:text-terminal-directory hover:bg-white/10 bg-green-500/20 border-l-2 border-green-500"
      : "w-full justify-start text-terminal-directory hover:text-terminal-directory hover:bg-white/10";
    
    return (
      <ContextMenu key={node.path}>
        <ContextMenuTrigger>
          <div>
            <Button
              onClick={() => onToggleFolder(node.path)}
              variant="ghost"
              className={folderClassName}
              style={{ paddingLeft: `${paddingLeft}px` }}
            >
              {node.isExpanded ? (
                <ChevronDown className="h-4 w-4 text-white/50" />
              ) : (
                <ChevronRight className="h-4 w-4 text-white/50" />
              )}
              <Folder className="h-4 w-4" />
              <span className="truncate">{folderDisplayName}</span>
            </Button>
            {node.isExpanded && node.children.map(child => (
              <FileTreeNode
                key={child.path}
                node={child}
                level={level + 1}
                selectedPath={selectedPath}
                onToggleFolder={onToggleFolder}
                onFileSelect={onFileSelect}
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                onDelete={onDelete}
              />
            ))}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onCreateFolder(node.path)}>
            <Plus className="h-4 w-4 mr-2" />
            New Folder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCreateFile(node.path)}>
            <Plus className="h-4 w-4 mr-2" />
            New File
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDelete(node.path, true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
  
  return (
    <ContextMenu key={node.path}>
      <ContextMenuTrigger>
        <Button
          onClick={() => onFileSelect(node.path)}
          variant="ghost"
          className={`w-full justify-start ${
            selectedPath === node.path
            ? 'bg-white/20 text-terminal-file hover:bg-white/20'
            : 'text-terminal-file hover:bg-white/10 hover:text-terminal-file'
          }`}
          style={{ paddingLeft: `${paddingLeft + 24}px` }}
        >
          <File className="h-4 w-4" />
          <span className="truncate">{node.name}</span>
        </Button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onDelete(node.path, false)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

