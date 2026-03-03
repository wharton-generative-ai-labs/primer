/**
 * Core type definitions for the tool system.
 * 
 * These types define the standard interfaces for tools, their responses,
 * and the context they receive when executed.
 */

import { ComponentEvent, ComponentStateChangeEvent } from './ui/components/types';

export interface ToolResponse {
  status: 'success' | 'error';
  data: any;
}

export interface ToolContext {
  functionCallId?: string;
  transcriptItems?: any[];
  selectedAgentKey?: string;
  agents?: Record<string, any>;
  experienceId?: string;
  setScene?: (scene: string) => void;
  sendClientEvent?: (event: any) => void;
  showFileUpload?: (prompt: string, functionCallId: string) => void;
  addTranscriptBreadcrumb?: (title: string, data: any) => void;
  setQueuedAgentTransfer?: (key: string | null) => void;
  showArtifact?: (id: string) => Promise<void>;
  listArtifacts?: () => Promise<any[]>;
  getArtifact?: (id: string, includeContent?: boolean) => Promise<any>;
  createArtifact?: (name: string, content: string, type: string) => Promise<any>;
  updateArtifact?: (id: string, content: string) => Promise<void>;
  deleteArtifact?: (id: string) => Promise<void>;
  getSceneUrl?: (scene: string) => string;
  getAvailableScenes?: () => string[];
  addCustomScene?: (sceneName: string, imageUrl: string) => { result: boolean; message?: string };
  removeCustomScene?: (sceneName: string) => { result: boolean; message?: string };
  // Checklist management functions
  showChecklist?: (artifactId: string) => void;
  hideChecklist?: () => void;
  // Information store (backend-first, used by server-side tool handler)
  informationStore?: {
    getAllKeys: () => Promise<string[]>;
    get: (key: string) => Promise<string | null>;
    save: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<boolean>;
  };
  // Note store (backend-first, used by server-side tool handler)
  noteStore?: {
    getAllNotes: () => Promise<any[]>;
    getNote: (noteId: string) => Promise<any | null>;
    saveNote: (note: any) => Promise<void>;
    updateNote: (noteId: string, updates: any) => Promise<any | null>;
    deleteNote: (noteId: string) => Promise<boolean>;
  };
  // Request manager for socket communication
  requestManager?: {
    createPendingRequest: (callId: string, type: string, timeout: number) => Promise<any>;
    resolvePendingRequest: (callId: string, result: any) => void;
    rejectPendingRequest: (callId: string, error: Error) => void;
  };
  // Toast notification function
  toast?: (options: { title: string; variant?: 'default' | 'destructive' }) => void;
  
  // Custom component event callbacks
  onComponentEvent?: (event: ComponentEvent) => void;
  onComponentStateChange?: (event: ComponentStateChangeEvent) => void;
  
  // Experience management functions
  createExperience?: () => Promise<string>;
  copyTemplate?: (templateExperienceId: string) => Promise<string>;
  createDirectory?: (experienceId: string, path: string) => Promise<void>;
  createFile?: (experienceId: string, path: string, content: string, contentEncoding?: string) => Promise<void>;
  deleteDirectory?: (experienceId: string, path: string) => Promise<void>;
  deleteFile?: (experienceId: string, path: string) => Promise<void>;
  moveFile?: (experienceId: string, sourcePath: string, destinationPath: string) => Promise<void>;
  moveDirectory?: (experienceId: string, sourcePath: string, destinationPath: string) => Promise<void>;
  listResources?: (experienceId: string) => Promise<any[]>;
  getResourceContent?: (experienceId: string, path: string) => Promise<{ content: string; contentType: string; isText: boolean; fileUrl?: string }>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      [key: string]: any;
    }>;
    required: string[];
  };
  handler: (args: any, context: ToolContext) => Promise<ToolResponse>;
  requiredContext?: string[];
}

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  tools: ToolDefinition[];
}

