/**
 * API endpoint for loading custom components
 * 
 * Phase 0: Runtime Validation
 * 
 * GET /api/experiences/[id]/components/[componentId]
 * Returns: { code: string, metadata: ComponentInfo }
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';
import { ComponentInfo } from '@/app/lib/tools/ui/components/types';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';

const logger = createModuleLogger('ComponentAPI');

/**
 * GET handler - Load component code and metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; componentId: string }> }
) {
  try {
    const { id: experienceId, componentId } = await params;
    
    logger.info(`Loading component: ${componentId} for experience: ${experienceId}`);
    
    const storage = StorageServiceFactory.getInstance();
    
    // Build path to component file (relative to storage root)
    const componentPath = path.join(
      experienceId,
      'resources',
      'components',
      `${componentId}.jsx`
    );
    
    // Check if file exists
    const exists = await storage.fileExists(componentPath);
    if (!exists) {
      logger.warn(`Component not found: ${componentPath}`);
      return NextResponse.json(
        { error: `Component not found: ${componentId}` },
        { status: 404 }
      );
    }
    
    // Read component code
    const code = await storage.readFileAsText(componentPath);
    
    // Try to read metadata from experience.json
    let metadata: ComponentInfo | null = null;
    
    try {
      const experienceConfigPath = path.join(
        experienceId,
        'experience.json'
      );
      
      const configData = await storage.readFileAsText(experienceConfigPath);
      const config = JSON.parse(configData);
      
      // Find component metadata
      if (config.resources?.components) {
        metadata = config.resources.components.find(
          (c: ComponentInfo) => c.id === componentId
        );
      }
    } catch (_error) {
      logger.warn(`Could not read experience.json for metadata`);
    }
    
    // If no metadata found, create minimal metadata
    if (!metadata) {
      metadata = {
        id: componentId,
        name: componentId,
        description: 'Custom component',
        file: `resources/components/${componentId}.jsx`
      };
    }
    
    logger.info(`Component loaded successfully: ${componentId}`);
    
    return NextResponse.json({
      code,
      metadata
    });
  } catch (error) {
    logger.error(error, 'Error loading component');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

