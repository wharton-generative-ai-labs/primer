import { NextRequest, NextResponse } from 'next/server';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('experience-readme');

type Context = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/experiences/[id]/readme
 * Fetches the README.md file for an experience
 * 
 * Query params:
 * - docPath: Optional path to a specific doc file (e.g., "docs/chemistry-demo-improvements.md")
 */
export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    const { id: experienceId } = await context.params;
    const { searchParams } = new URL(request.url);
    const docPath = searchParams.get('docPath');
    
    const storage = StorageServiceFactory.getInstance();
    
    // Determine which file to read
    let filePath: string;
    if (docPath) {
      // Validate that docPath doesn't try to escape the experience directory
      const normalizedDocPath = path.normalize(docPath);
      if (normalizedDocPath.includes('..') || path.isAbsolute(normalizedDocPath)) {
        return NextResponse.json(
          { error: 'Invalid document path' },
          { status: 400 }
        );
      }
      filePath = path.join(experienceId, normalizedDocPath);
    } else {
      filePath = path.join(experienceId, 'README.md');
    }
    
    // Check if file exists
    const exists = await storage.fileExists(filePath);
    if (!exists) {
      return NextResponse.json(
        { error: 'README not found' },
        { status: 404 }
      );
    }
    
    // Read the file
    const content = await storage.readFileAsText(filePath);
    
    return NextResponse.json({
      content,
      path: docPath || 'README.md'
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to fetch README');
    return NextResponse.json(
      { error: 'Failed to fetch README' },
      { status: 500 }
    );
  }
}
