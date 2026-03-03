import { NextRequest, NextResponse } from 'next/server';
import { getSessionMetadataFilePath, SessionMetadata, SessionEvent, SESSION_EVENTS } from '@/app/lib/file-utils';
import fs from 'fs/promises';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';
import { auditSessionCreated } from '@/lib/audit-logger';

const logger = createModuleLogger('session-init');

/**
 * POST - Initialize a new session with folder structure and metadata
 * This should be called ONLY from the /play/ route when a new session is created.
 * 
 * Creates:
 * - Session folder: {experienceId}/session_data/{sessionId}/
 * - Session metadata: session.json with initial events including "session_started"
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

    const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
    const sessionDir = path.dirname(metadataPath);
    
    // Check if session already exists
    try {
      await fs.access(metadataPath);
      // Session already exists - return existing metadata
      const existingContent = await fs.readFile(metadataPath, 'utf-8');
      const existingMetadata: SessionMetadata = JSON.parse(existingContent);
      return NextResponse.json({ 
        success: true, 
        created: false, 
        metadata: existingMetadata 
      });
    } catch {
      // Session doesn't exist - create it
    }
    
    const now = new Date().toISOString();
    
    // Create the initial session_started event
    const sessionStartedEvent: SessionEvent = {
      event: SESSION_EVENTS.SESSION_STARTED,
      agent: 'system',
      timestamp: now,
      data: {
        userName: userName || undefined,
        userEmail: userEmail || undefined,
      }
    };
    
    const sessionMetadata: SessionMetadata = {
      sessionId,
      experienceId,
      startTime: now,
      lastActivity: now,
      userName: userName || undefined,
      userEmail: userEmail || undefined,
      events: [sessionStartedEvent],
    };

    // Create session directory structure
    await fs.mkdir(sessionDir, { recursive: true });
    
    // Also create artifacts subdirectory
    const artifactsDir = path.join(sessionDir, 'artifacts');
    await fs.mkdir(artifactsDir, { recursive: true });
    
    // Also create uploads subdirectory
    const uploadsDir = path.join(sessionDir, 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Write metadata file
    await fs.writeFile(metadataPath, JSON.stringify(sessionMetadata, null, 2));
    
    logger.info({ sessionId, experienceId }, 'Created new session');
    
    // Log audit event
    await auditSessionCreated(userEmail || 'anonymous', req, {
      sessionId,
      experienceId,
      userName: userName || undefined,
      userEmail: userEmail || undefined,
    });
    
    return NextResponse.json({ 
      success: true, 
      created: true, 
      metadata: sessionMetadata 
    });
  } catch (error) {
    logger.error(error, 'Error initializing session');
    return NextResponse.json(
      { error: 'Failed to initialize session' },
      { status: 500 }
    );
  }
}
