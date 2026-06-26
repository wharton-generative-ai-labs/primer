import { ToolResponse } from '@/app/lib/tools/types';

export interface Resource {
  path: string;
  type: 'file' | 'directory';
  content?: string;
}

export interface ExperienceToolContext {
  createExperience: () => Promise<string>;
  copyTemplate: (templateExperienceId: string) => Promise<string>;
  createDirectory: (experienceId: string, path: string) => Promise<void>;
  createFile: (experienceId: string, path: string, content: string, contentEncoding?: string) => Promise<void>;
  deleteDirectory: (experienceId: string, path: string) => Promise<void>;
  deleteFile: (experienceId: string, path: string) => Promise<void>;
  moveFile: (experienceId: string, sourcePath: string, destinationPath: string) => Promise<void>;
  moveDirectory: (experienceId: string, sourcePath: string, destinationPath: string) => Promise<void>;
  listResources: (experienceId: string) => Promise<Resource[]>;
  getResourceContent: (experienceId: string, path: string) => Promise<{ content: string; contentType: string; isText: boolean; fileUrl?: string }>;
}

export interface ExperienceToolResponse extends ToolResponse {
  data: {
    experienceId?: string;
    resources?: Resource[];
    content?: string;
    contentType?: string;
    isText?: boolean;
    fileUrl?: string;
    error?: string;
  };
} 