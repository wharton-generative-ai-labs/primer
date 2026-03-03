import { NextRequest, NextResponse } from 'next/server';
import { getExperienceArtifactsFolder } from '@/app/lib/file-utils';
import { isBinaryFileType } from '@/app/lib/artifact-utils';
import fs from 'fs/promises';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('artifacts-update');

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

export async function POST(
  req: NextRequest,
  context: Context
) {
  try {
    const experienceId = req.headers.get('x-experience-id');
    const sessionId = req.headers.get('x-session-id');
    
    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Artifact ID is required' }, { status: 400 });
    }
    
    const body = await req.json();
    const { content, metadata } = body;

    if (content === undefined) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Get the session-scoped artifacts folder path
    const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);
    
    // Find the metadata file by searching for the artifact ID
    const metadataFilename = await findMetadataFileByArtifactId(artifactsFolder, id);
    if (!metadataFilename) {
      return NextResponse.json({ error: `Artifact ${id} not found` }, { status: 404 });
    }
    
    const metadataPath = path.join(artifactsFolder, metadataFilename);

    // Read the existing metadata
    const metadataData = await fs.readFile(metadataPath, 'utf-8');
    const artifactMetadata = JSON.parse(metadataData);

    // Update the metadata
    const updatedArtifact = {
      ...artifactMetadata,
      metadata: metadata ? { ...artifactMetadata.metadata, ...metadata } : artifactMetadata.metadata,
      updatedAt: new Date().toISOString(),
    };

    // Save the updated metadata
    await fs.writeFile(metadataPath, JSON.stringify(updatedArtifact, null, 2));

    // Update the content file
    const contentPath = path.join(artifactsFolder, updatedArtifact.filename);
    if (isBinaryFileType(updatedArtifact.type)) {
      // For binary files, expect content to be base64 encoded
      const buffer = Buffer.from(content, 'base64');
      await fs.writeFile(contentPath, buffer);
    } else {
      // For text files, save as UTF-8
      await fs.writeFile(contentPath, content, 'utf-8');
    }

    // Return the updated artifact with content for the response
    return NextResponse.json({
      ...updatedArtifact,
      content
    });
  } catch (error) {
    logger.error(error, 'Error updating artifact');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update artifact' },
      { status: 500 }
    );
  }
} 