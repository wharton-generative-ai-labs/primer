import { NextRequest, NextResponse } from 'next/server';
import { getExperienceArtifactsFolder } from '@/app/lib/file-utils';
import { createModuleLogger } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';

const logger = createModuleLogger('artifacts-list');

export async function GET(req: NextRequest) {
  const experienceId = req.headers.get('x-experience-id');
  const sessionId = req.headers.get('x-session-id');
  
  try {
    if (!experienceId) {
      return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
    }
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // No need to initialize from template - artifacts are created directly in user sessions by ConfigLoader

    // Get the session-scoped artifacts folder path
    const artifactsFolder = await getExperienceArtifactsFolder(experienceId, sessionId);

    // Create artifacts folder if it doesn't exist
    try {
      await fs.mkdir(artifactsFolder, { recursive: true });
    } catch (error) {
      logger.error({ err: error, artifactsFolder }, 'Error creating artifacts folder');
    }

    // List all files in the artifacts folder
    let files = await fs.readdir(artifactsFolder);
    
    // Filter out non-JSON metadata files
    files = files.filter(file => file.endsWith('.json'));

    // Read the metadata of each artifact
    const artifacts = await Promise.all(
      files.map(async (file) => {
        try {
          const filePath = path.join(artifactsFolder, file);
          const content = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(content);
        } catch (error) {
          logger.error({ err: error, file, artifactsFolder }, 'Error reading artifact metadata');
          return null;
        }
      })
    );

    // Filter out null values (failed reads)
    const validArtifacts = artifacts.filter(artifact => artifact !== null);

    return NextResponse.json(validArtifacts);
  } catch (error) {
    logger.error({ 
      err: error, 
      experienceId: experienceId || 'unknown', 
      sessionId: sessionId || 'unknown' 
    }, 'Error listing artifacts');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list artifacts' },
      { status: 500 }
    );
  }
} 