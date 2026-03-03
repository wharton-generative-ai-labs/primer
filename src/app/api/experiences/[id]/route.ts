import { NextRequest, NextResponse } from 'next/server';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { getToken } from 'next-auth/jwt';
import { Permission } from '@/config/auth';
import { hasMergedPermission } from '@/config/user-storage';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('experiences-id');

interface Context {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(
  req: NextRequest,
  context: Context
) {
  try {
    // Check authentication
    const token = await getToken({ req });
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: experienceId } = await context.params;
    
    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }

    const storage = StorageServiceFactory.getInstance();

    // Check if the experience exists
    const experiencePath = `${experienceId}/experience.json`;
    const experienceExists = await storage.fileExists(experiencePath);
    if (!experienceExists) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    // Load the experience to check authorship
    const experienceText = await storage.readFileAsText(experiencePath);
    const experienceData = JSON.parse(experienceText);
    const isAuthor = experienceData.authorEmail === token.email;

    // Check permission: either has DELETE_EXPERIENCE permission OR is the author (using merged user data)
    if (!hasMergedPermission(token.email, Permission.DELETE_EXPERIENCE) && !isAuthor) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to delete this experience' }, { status: 403 });
    }

    // Delete the entire experience directory
    await storage.deleteDirectory(experienceId);

    logger.info({ experienceId }, 'Successfully deleted experience');
    return NextResponse.json({ 
      success: true, 
      message: `Experience ${experienceId} deleted successfully` 
    });
  } catch (error) {
    logger.error(error, 'Error deleting experience');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete experience' },
      { status: 500 }
    );
  }
}

