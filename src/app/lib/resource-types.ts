import { Tool } from './types';

export interface ResourceMetadata {
  id: string;
  type: 'tool' | 'component' | 'scene' | string;
  version: string;
  name: string;
  description: string;
}

export interface ResourceDefinition<T> {
  metadata: ResourceMetadata;
  definition: T;
  source?: string;
}

export interface ResourceProcessor<T> {
  process(resource: ResourceDefinition<T>): Promise<T>;
}

export interface ResourceValidator<T> {
  validate(resource: ResourceDefinition<T>): Promise<boolean>;
}

export interface RegistryOptions {
  validateResources?: boolean;
  processResources?: boolean;
}

// Type guard for Tool resources
export function isToolResource(resource: ResourceDefinition<any>): resource is ResourceDefinition<Tool> {
  return resource.metadata.type === 'tool';
} 