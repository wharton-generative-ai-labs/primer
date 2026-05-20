import { NextRequest, NextResponse } from 'next/server';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';
import { assertSafeExperienceId, assertSafeRelativePath } from '@/app/lib/file-utils';

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

    let filePath: string;
    try {
      assertSafeExperienceId(experienceId);
      if (docPath) {
        assertSafeRelativePath(docPath);
        filePath = path.join(experienceId, docPath);
      } else {
        filePath = path.join(experienceId, 'README.md');
      }
    } catch (validationError) {
      logger.warn({ err: validationError, experienceId, docPath }, 'Rejected unsafe readme request');
      return NextResponse.json({ error: 'Invalid document path' }, { status: 400 });
    }

    const storage = StorageServiceFactory.getInstance();
    
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
