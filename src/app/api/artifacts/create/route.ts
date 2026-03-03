import { NextRequest, NextResponse } from 'next/server';
import { getExperienceArtifactsFolder, getSessionMetadataFilePath, SessionMetadata } from '@/app/lib/file-utils';
import { getContentFilename, getMetadataFilename, isBinaryFileType } from '@/app/lib/artifact-utils';
import fs from 'fs/promises';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('artifacts-create');

export async function POST(req: NextRequest) {
  try {
    const experienceId = req.headers.get('x-experience-id');
    const sessionId = req.headers.get('x-session-id');
    
    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const { name, content, type = 'markdown', agents, metadata, userName, userEmail } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (content === undefined) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Get the session-scoped artifacts folder path
    const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);

    // Create artifacts folder if it doesn't exist
    await fs.mkdir(artifactsFolder, { recursive: true });

    // Create or update session metadata
    const sessionMetadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
    const now = new Date().toISOString();
    
    try {
      await fs.access(sessionMetadataPath);
      // Metadata exists - update lastActivity
      const existingMetadata = JSON.parse(await fs.readFile(sessionMetadataPath, 'utf-8'));
      existingMetadata.lastActivity = now;
      await fs.writeFile(sessionMetadataPath, JSON.stringify(existingMetadata, null, 2));
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'ENOENT') {
        // Metadata doesn't exist, create it with user info from request
        // Note: This should rarely happen as session-init should create metadata first
        // This is a fallback for backward compatibility
        const sessionMetadata: SessionMetadata = {
          sessionId,
          experienceId,
          startTime: now,
          lastActivity: now,
          userName: userName || undefined,
          userEmail: userEmail || undefined,
          events: [], // Initialize with empty events array
        };
        await fs.writeFile(sessionMetadataPath, JSON.stringify(sessionMetadata, null, 2));
      }
    }

    const timestamp = new Date().toISOString();

    // Generate meaningful content filename with duplicate handling
    const baseContentFilename = getContentFilename('', type, name);
    let contentFilename = baseContentFilename;
    let counter = 1;
    
    // Check for duplicates and add counter if needed
    while (true) {
      const checkPath = path.join(artifactsFolder, contentFilename);
      try {
        await fs.access(checkPath);
        // File exists, increment counter and try again
        const extension = path.extname(baseContentFilename);
        const nameWithoutExt = path.basename(baseContentFilename, extension);
        contentFilename = `${nameWithoutExt}_(${counter})${extension}`;
        counter++;
      } catch {
        // File doesn't exist, we can use this filename
        break;
      }
    }

    // Use filename (without extension) as the ID
    const id = path.parse(contentFilename).name;

    const metadataFilename = getMetadataFilename(contentFilename);

    // Create the artifact metadata (without content)
    const artifact = {
      id,
      name,
      type,
      agents,
      metadata,
      filename: contentFilename, // Add pointer to content file
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Save the artifact metadata
    const metadataPath = path.join(artifactsFolder, metadataFilename);
    await fs.writeFile(
      metadataPath,
      JSON.stringify(artifact, null, 2)
    );

    // Save the content in a separate file
    const contentPath = path.join(artifactsFolder, contentFilename);
    if (isBinaryFileType(type)) {
      // For binary files, expect content to be base64 encoded
      const buffer = Buffer.from(content, 'base64');
      await fs.writeFile(contentPath, buffer);
    } else {
      // For text files, save as UTF-8
      await fs.writeFile(contentPath, content, 'utf-8');
    }

    return NextResponse.json(artifact);
  } catch (error) {
    logger.error(error, 'Error creating artifact');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create artifact' },
      { status: 500 }
    );
  }
} 