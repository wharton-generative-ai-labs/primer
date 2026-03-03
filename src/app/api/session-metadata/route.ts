import { NextRequest, NextResponse } from 'next/server';
import { getSessionMetadataFilePath, SessionMetadata } from '@/app/lib/file-utils';
import fs from 'fs/promises';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('session-metadata');

/**
 * POST - Create or update session metadata
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { experienceId, sessionId, userName, userEmail } = body;
    
    if (!experienceId || !sessionId) {
      return NextResponse.json(
        { error: 'Experience ID and Session ID are required' },
        { status: 400 }
      );
    }
    
    const now = new Date().toISOString();
    const sessionMetadata: SessionMetadata = {
      sessionId,
      experienceId,
      startTime: now,
      lastActivity: now,
      userName: userName || undefined,
      userEmail: userEmail || undefined,
      events: [], // Initialize with empty events array
    };

    const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
    const sessionDir = path.dirname(metadataPath);
    
    // Create session directory if it doesn't exist
    await fs.mkdir(sessionDir, { recursive: true });
    
    // Write metadata file
    await fs.writeFile(metadataPath, JSON.stringify(sessionMetadata, null, 2));
    
    return NextResponse.json({ success: true, metadata: sessionMetadata });
  } catch (error) {
    logger.error(error, 'Error creating session metadata');
    return NextResponse.json(
      { error: 'Failed to create session metadata' },
      { status: 500 }
    );
  }
}

/**
 * GET - Read session metadata
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const experienceId = searchParams.get('experienceId');
    const sessionId = searchParams.get('sessionId');
    
    if (!experienceId || !sessionId) {
      return NextResponse.json(
        { error: 'Experience ID and Session ID are required' },
        { status: 400 }
      );
    }

    const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
    
    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      const metadata: SessionMetadata = JSON.parse(content);
      return NextResponse.json(metadata);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'ENOENT') {
        // File doesn't exist - return null
        return NextResponse.json(null);
      }
      throw error;
    }
  } catch (error) {
    logger.error(error, 'Error reading session metadata');
    return NextResponse.json(
      { error: 'Failed to read session metadata' },
      { status: 500 }
    );
  }
}

