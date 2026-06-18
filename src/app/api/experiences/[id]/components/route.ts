/**
 * API endpoint for listing custom components
 * 
 * GET /api/experiences/[id]/components
 * Returns: { components: ComponentInfo[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';
import { ComponentInfo } from '@/app/lib/tools/ui/components/types';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';

const logger = createModuleLogger('ComponentsListAPI');

/**
 * GET handler - List all components for an experience
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: experienceId } = await params;
    
    logger.info(`Listing components for experience: ${experienceId}`);
    
    const storage = StorageServiceFactory.getInstance();
    
    // Read experience.json to get component list
    const experienceConfigPath = path.join(
      experienceId,
      'experience.json'
    );
    
    const exists = await storage.fileExists(experienceConfigPath);
    if (!exists) {
      logger.warn(`Experience not found: ${experienceId}`);
      return NextResponse.json(
        { error: `Experience not found: ${experienceId}` },
        { status: 404 }
      );
    }
    
    const configData = await storage.readFileAsText(experienceConfigPath);
    const config = JSON.parse(configData);
    
    // Extract components from resources
    const components: ComponentInfo[] = config.resources?.components || [];
    
    logger.info(`Found ${components.length} components for experience: ${experienceId}`);
    
    return NextResponse.json({
      components
    });
  } catch (error) {
    logger.error(error, 'Error listing components');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
