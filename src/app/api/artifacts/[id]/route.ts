import { NextRequest, NextResponse } from 'next/server';
import { getExperienceArtifactsFolder } from '@/app/lib/file-utils';
import { isBinaryFileType } from '@/app/lib/artifact-utils';
import { createModuleLogger } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';

const logger = createModuleLogger('artifacts');

// Helper function to find metadata file by artifact ID
async function findMetadataFileByArtifactId(artifactsFolder: string, artifactId: string): Promise<string | null> {
  try {
    const files = await fs.readdir(artifactsFolder);
    const jsonFiles = files.filter((file: string) => file.endsWith('.json'));
    
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(artifactsFolder, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const metadata = JSON.parse(content);
        if (metadata.id === artifactId) {
          return file;
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Skip files that can't be parsed
        continue;
      }
    }
    return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return null;
  }
}

type Context = {
  params: Promise<{
    id: string
  }>
};

export async function GET(
  req: NextRequest,
  context: Context
) {
  let id: string | undefined;
  
  try {
    const experienceId = req.headers.get('x-experience-id');
    const sessionId = req.headers.get('x-session-id');
    
    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const params = await context.params;
    id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'Artifact ID is required' }, { status: 400 });
    }

    // Get the session-scoped artifacts folder path
    const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
    
    // Find the metadata file by searching for the artifact ID
    const metadataFilename = await findMetadataFileByArtifactId(artifactsFolder, id);
    if (!metadataFilename) {
      logger.error({ artifactId: id, artifactsFolder }, 'Artifact metadata not found');
      return NextResponse.json({ error: `Artifact ${id} not found` }, { status: 404 });
    }
    
    const metadataPath = path.join(artifactsFolder, metadataFilename);

    // Read the metadata file
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);

    // Read the content file
    const contentPath = path.join(artifactsFolder, metadata.filename);
    let content: string;
    
    try {
      if (isBinaryFileType(metadata.type)) {
        // For binary files, read as base64
        const buffer = await fs.readFile(contentPath);
        content = buffer.toString('base64');
      } else {
        // For text files, read as UTF-8
        content = await fs.readFile(contentPath, 'utf-8');
      }
    } catch (error) {
      logger.error({ err: error, filename: metadata.filename, artifactId: id }, 'Artifact content not found');
      return NextResponse.json({ error: `Artifact content not found: ${metadata.filename}` }, { status: 404 });
    }

    // Combine metadata and content for the response
    const artifact = {
      ...metadata,
      content
    };

    return NextResponse.json(artifact);
  } catch (error) {
    logger.error({ err: error, artifactId: id || 'unknown' }, 'Error reading artifact');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read artifact' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: Context
) {
  let id: string | undefined;
  
  try {
    const experienceId = req.headers.get('x-experience-id');
    const sessionId = req.headers.get('x-session-id');
    
    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const params = await context.params;
    id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'Artifact ID is required' }, { status: 400 });
    }

    // Get the session-scoped artifacts folder path
    const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
    
    // Find the metadata file by searching for the artifact ID
    const metadataFilename = await findMetadataFileByArtifactId(artifactsFolder, id);
    if (!metadataFilename) {
      logger.error({ artifactId: id, artifactsFolder }, 'Artifact metadata not found');
      return NextResponse.json({ error: `Artifact ${id} not found` }, { status: 404 });
    }
    
    const metadataPath = path.join(artifactsFolder, metadataFilename);

    // Read the metadata to get the content filename
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);

    // Delete the content file
    const contentPath = path.join(artifactsFolder, metadata.filename);
    try {
      await fs.unlink(contentPath);
    } catch (error) {
      logger.warn({ err: error, filename: metadata.filename, artifactId: id }, 'Content file not found during deletion');
      // Continue to delete metadata even if content file is missing
    }

    // Delete the metadata file
    await fs.unlink(metadataPath);

    return NextResponse.json({ success: true, message: `Artifact ${id} deleted successfully` });
  } catch (error) {
    logger.error({ err: error, artifactId: id || 'unknown' }, 'Error deleting artifact');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete artifact' },
      { status: 500 }
    );
  }
} 