import { ExperienceToolContext, Resource } from './types';
import { generateExperienceId } from '@/app/lib/file-utils';

export class ExperienceManager implements ExperienceToolContext {
  private baseUrl = '/api/experience';
  private resourcesUrl = '/api/resources';
  private resourceContentUrl = '/api/resource-content';

  async createExperience(): Promise<string> {
    const experienceId = generateExperienceId();
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', experienceId })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error('Failed to create experience');
    }
    return experienceId;
  }

  async copyTemplate(templateExperienceId: string): Promise<string> {
    const newExperienceId = generateExperienceId();
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'copyTemplate', templateExperienceId, newExperienceId })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error('Failed to copy template');
    }
    return newExperienceId;
  }

  async createDirectory(experienceId: string, path: string): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createDirectory', experienceId, path })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error('Failed to create directory');
    }
  }

  async createFile(experienceId: string, path: string, content: string, contentEncoding?: string): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createFile', experienceId, path, content, contentEncoding })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error('Failed to create file');
    }
  }

  async deleteDirectory(experienceId: string, path: string): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteDirectory', experienceId, path })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error('Failed to delete directory');
    }
  }

  async deleteFile(experienceId: string, path: string): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteFile', experienceId, path })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error('Failed to delete file');
    }
  }

  async moveFile(experienceId: string, sourcePath: string, destinationPath: string): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'moveFile', experienceId, sourcePath, destinationPath })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error('Failed to move file');
    }
  }

  async moveDirectory(experienceId: string, sourcePath: string, destinationPath: string): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'moveDirectory', experienceId, sourcePath, destinationPath })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error('Failed to move directory');
    }
  }

  async listResources(experienceId: string): Promise<Resource[]> {
    const response = await fetch(`${this.resourcesUrl}?experienceId=${experienceId}`);
    const result = await response.json();
    if (!result.resources) {
      throw new Error('Failed to list resources');
    }
    return result.resources;
  }

  async getResourceContent(experienceId: string, path: string): Promise<{ content: string; contentType: string; isText: boolean; fileUrl?: string }> {
    const response = await fetch(`${this.resourceContentUrl}?experienceId=${experienceId}&path=${encodeURIComponent(path)}`);
    const result = await response.json();
    if (!result.content && !result.fileUrl) {
      throw new Error('Failed to get resource content');
    }
    return { 
      content: result.content || '', 
      contentType: result.contentType || 'text/plain',
      isText: result.isText || false,
      fileUrl: result.fileUrl
    };
  }
}

let experienceManagerInstance: ExperienceToolContext | null = null;

export const getExperienceManager = (): ExperienceToolContext => {
  if (!experienceManagerInstance) {
    experienceManagerInstance = new ExperienceManager();
  }
  return experienceManagerInstance;
}; 