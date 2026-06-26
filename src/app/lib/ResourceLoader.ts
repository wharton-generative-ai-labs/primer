import { Tool } from './types';
import { ResourceDefinition } from './resource-types';

export interface ResourceLoaderOptions {
  baseUrl?: string;
  cache?: boolean;
}

export class ResourceLoader {
  private baseUrl: string;
  private cache: Map<string, any>;
  private useCache: boolean;

  constructor(options: ResourceLoaderOptions = {}) {
    this.baseUrl = options.baseUrl || '/api/resources';
    this.cache = new Map();
    this.useCache = options.cache ?? true;
  }

  private getCacheKey(type: string, id: string, format?: string): string {
    return `${type}:${id}${format ? `:${format}` : ''}`;
  }

  private async fetchFromApi<T>(endpoint: string): Promise<T> {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  }

  async getResource<T>(type: string, id: string, format?: string): Promise<T> {
    const cacheKey = this.getCacheKey(type, id, format);
    
    // Check cache first
    if (this.useCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Build the API URL
    const url = new URL(`${this.baseUrl}/${type}`);
    url.searchParams.set('id', id);
    if (format) {
      url.searchParams.set('format', format);
    }

    // Fetch the resource
    const resource = await this.fetchFromApi<T>(url.toString());

    // Cache the result if caching is enabled
    if (this.useCache) {
      this.cache.set(cacheKey, resource);
    }

    return resource;
  }

  async getTool(id: string, format: 'json' | 'js' = 'json'): Promise<Tool> {
    return this.getResource<Tool>('tools', id, format);
  }

  async listResources(type?: string): Promise<ResourceDefinition<any>[]> {
    const url = new URL(this.baseUrl);
    if (type) {
      url.searchParams.set('type', type);
    }
    
    const { resources } = await this.fetchFromApi<{ resources: ResourceDefinition<any>[] }>(url.toString());
    return resources;
  }

  async listTools(): Promise<Tool[]> {
    const { tools } = await this.fetchFromApi<{ tools: Tool[] }>(`${this.baseUrl}/tools`);
    return tools;
  }

  clearCache(): void {
    this.cache.clear();
  }

  invalidateCache(type: string, id: string): void {
    const cacheKey = this.getCacheKey(type, id);
    this.cache.delete(cacheKey);
  }
} 