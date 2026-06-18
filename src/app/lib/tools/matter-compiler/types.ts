import { ToolResponse, ToolContext } from '@/app/lib/tools/types';

export interface Agent {
  name: string;
  voice: string;
  publicDescription: string;
  downstreamAgents: string[];
}

export interface Scene {
  path: string;
}

export interface Experience {
  version: string;
  status?: string;
  title: string;
  description: string;
  created?: string; // ISO 8601 datetime when experience was first created
  lastModified?: string; // ISO 8601 datetime when experience was last modified
  author?: string; // Name of the user who created the experience
  authorEmail?: string; // Email of the user who created the experience
  resources: {
    scenes: string[];
    sounds?: string[];
    instructions?: {
      agent?: Record<string, string>;
      supplemental?: Record<string, string>;
    };
  };
  agents: Record<string, Agent>;
  initialAgent: string;
  tools?: {
    plugins?: string[];
  };
}

export interface AgentOperation {
  type: 'create' | 'modify' | 'delete';
  id: string;
  data?: Partial<Agent>;
  setAsInitial?: boolean;
}

export interface SceneOperation {
  type: 'add' | 'modify' | 'delete';
  path: string;
}

export interface ExperienceOperation {
  type: 'modify';
  data: Partial<Experience>;
}

export interface MatterCompilerContext extends ToolContext {
  getResourceContent: (experienceId: string, path: string) => Promise<{ content: string; contentType: string; isText: boolean; fileUrl?: string }>;
  createFile: (experienceId: string, path: string, content: string, contentEncoding?: string) => Promise<void>;
  createDirectory: (experienceId: string, path: string) => Promise<void>;
  listResources: (experienceId: string) => Promise<{ path: string; type: 'file' | 'directory' }[]>;
}

export interface MatterCompilerResponse extends ToolResponse {
  success: boolean;
  data: {
    experienceId?: string;
    experience?: Experience;
    error?: string;
  };
} 