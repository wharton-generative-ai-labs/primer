/**
 * Type definitions for the Experience Editor
 */

export interface Resource {
  path: string;
  content?: string;
  type: 'file' | 'directory';
}

export interface ResourceContent {
  content?: string;
  contentType: string;
  isText: boolean;
  fileUrl?: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: TreeNode[];
  isExpanded?: boolean;
  displayName?: string; // Human-readable display name
  isCurrentSession?: boolean; // Flag to highlight current session
  sessionMetadata?: {
    userName?: string;
    startTime?: string;
  };
}

export interface EditorProps {
  experienceId: string;
  visible?: boolean;
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
  hasUnsavedChanges?: boolean;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

