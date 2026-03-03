import { NextResponse } from 'next/server';
import { ResourceDefinition, ResourceMetadata } from '@/app/lib/resource-types';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('resources');

// Configurable list of files to exclude from resource listings
const EXCLUDED_FILES = ['.DS_Store'];

interface ResourceCatalogItem {
  metadata: ResourceMetadata;
  url: string;
}

// In-memory cache of available resources
// In a production environment, this would be replaced with a proper database
const resourceCatalog = new Map<string, ResourceDefinition<any>>();

// Helper function to check if a file should be excluded
const shouldExcludeFile = (file: string): boolean => {
  return EXCLUDED_FILES.some(excludedFile => file.includes(excludedFile));
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resourceId = url.searchParams.get('id');
  const resourceType = url.searchParams.get('type');
  const experienceId = url.searchParams.get('experienceId');
  
  logger.debug({ resourceId, resourceType, experienceId }, 'Resources API called');

  // If experienceId is provided, list resources for that experience
  if (experienceId) {
    try {
      const storage = StorageServiceFactory.getInstance();
      const resources: { path: string; type: 'file' | 'directory' }[] = [];
      
      // First get all files (recursive)
      const allFiles = await storage.listFiles(experienceId);
      allFiles.forEach(file => {
        if (!shouldExcludeFile(file)) {
          resources.push({ path: file, type: 'file' });
        }
      });

      // Then get all directories (including root level and subdirectories)
      const processDirectory = async (dir: string) => {
        const dirs = await storage.listDirectories(dir);
        for (const subDir of dirs) {
          resources.push({ path: subDir, type: 'directory' });
          // Recursively process subdirectories
          await processDirectory(subDir);
        }
      };

      // Start processing from the root
      await processDirectory(experienceId);
      
      return NextResponse.json({ resources });
    } catch (error: unknown) {
      logger.error(error, 'Error listing experience resources');
      const errorMessage = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Failed to list resources', details: errorMessage }, 
        { status: 500 }
      );
    }
  }

  // If no parameters, return the catalog of available resources
  if (!resourceId && !resourceType) {
    const catalog: ResourceCatalogItem[] = Array.from(resourceCatalog.values()).map(resource => ({
      metadata: resource.metadata,
      url: `/api/resources/${resource.metadata.type}/${resource.metadata.id}`
    }));
    
    return NextResponse.json({ resources: catalog });
  }

  // If type is specified but no id, return all resources of that type
  if (resourceType && !resourceId) {
    const resources = Array.from(resourceCatalog.values())
      .filter(resource => resource.metadata.type === resourceType)
      .map(resource => ({
        metadata: resource.metadata,
        url: `/api/resources/${resource.metadata.type}/${resource.metadata.id}`
      }));
    
    return NextResponse.json({ resources });
  }

  // If both type and id are specified, return the specific resource
  if (resourceType && resourceId) {
    const resource = Array.from(resourceCatalog.values())
      .find(r => r.metadata.type === resourceType && r.metadata.id === resourceId);
    
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }
    
    return NextResponse.json(resource);
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}