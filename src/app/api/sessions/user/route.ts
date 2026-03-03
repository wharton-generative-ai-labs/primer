import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { SessionMetadata, SessionEvent, SESSION_EVENTS } from '@/app/lib/file-utils';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('sessions-user');

interface UserSessionResponse {
  session: SessionMetadata | null;
  hasArtifacts?: boolean;
  isCompleted?: boolean;
  lastEvent?: SessionEvent | null;
}

/**
 * GET /api/sessions/user?experienceId={id}
 * Returns the most recent session for the current user for the specified experience
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userEmail = session?.user?.email;

    logger.debug({ userEmail: userEmail || '(not authenticated)' }, 'Looking up sessions for user');

    if (!userEmail) {
      logger.debug('User not authenticated, returning null');
      return NextResponse.json({ session: null, reason: 'not_authenticated' });
    }
    
    const { searchParams } = new URL(request.url);
    const experienceId = searchParams.get('experienceId');
    
    if (!experienceId) {
      return NextResponse.json(
        { error: 'experienceId is required' },
        { status: 400 }
      );
    }
    
    const storage = StorageServiceFactory.getInstance();
    const sessionDataPath = path.join(experienceId, 'session_data');
    
    logger.debug({ sessionDataPath }, 'Checking path');
    
    // Check if session_data directory exists
    let sessionFolders: string[] = [];
    try {
      sessionFolders = await storage.listDirectories(sessionDataPath);
      logger.debug({ sessionFolders }, 'Found session folders');
    } catch (err) {
      // No session_data folder yet - no previous sessions
      logger.debug({ err }, 'No session_data folder found');
      return NextResponse.json({ session: null, reason: 'no_session_data_folder' } as UserSessionResponse);
    }
    
    // Find sessions belonging to this user
    let mostRecentSession: SessionMetadata | null = null;
    let mostRecentTime = 0;
    let hasArtifacts = false;
    let isCompleted = false;
    let lastEvent: SessionEvent | null = null;
    let sessionsChecked = 0;
    let sessionsMatchingUser = 0;
    
    for (const folderPath of sessionFolders) {
      // Extract just the folder name from the full path
      const folder = path.basename(folderPath);
      if (!folder.startsWith('sess_')) continue;
      sessionsChecked++;
      
      // Use the full path returned by listDirectories
      const sessionMetaPath = path.join(folderPath, 'session.json');
      
      try {
        if (!await storage.fileExists(sessionMetaPath)) {
          logger.debug({ folder }, 'No session.json found');
          continue;
        }
        
        const content = await storage.readFileAsText(sessionMetaPath);
        const sessionMeta: SessionMetadata = JSON.parse(content);
        
        logger.debug({ folder, email: sessionMeta.userEmail }, 'Checking session');
        
        // Check if this session belongs to the current user
        if (sessionMeta.userEmail?.toLowerCase() !== userEmail.toLowerCase()) {
          logger.debug({ sessionEmail: sessionMeta.userEmail, userEmail }, 'Email mismatch');
          continue;
        }
        
        sessionsMatchingUser++;
        
        // Use lastActivity if available, otherwise startTime
        const activityTime = sessionMeta.lastActivity || sessionMeta.startTime;
        const timestamp = new Date(activityTime).getTime();
        
        if (timestamp > mostRecentTime) {
          mostRecentTime = timestamp;
          mostRecentSession = sessionMeta;
          
          // Check if session is completed (has session_completed event)
          const events = sessionMeta.events || [];
          isCompleted = events.some(e => e.event === SESSION_EVENTS.SESSION_COMPLETED);
          
          // Get last event for context
          lastEvent = events.length > 0 ? events[events.length - 1] : null;
          
          // Check if this session has artifacts
          const artifactsPath = path.join(folderPath, 'artifacts');
          try {
            const artifactFiles = await storage.listFiles(artifactsPath);
            hasArtifacts = artifactFiles.length > 0;
          } catch {
            hasArtifacts = false;
          }
        }
      } catch (error) {
        logger.error({ err: error, folder }, 'Error reading session');
      }
    }

    logger.debug({
      sessionsChecked,
      sessionsMatchingUser,
      foundSession: mostRecentSession?.sessionId || null,
      hasArtifacts,
      isCompleted
    }, 'Summary');
    
    const response: UserSessionResponse = {
      session: mostRecentSession,
      hasArtifacts,
      isCompleted,
      lastEvent
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error(error, 'GET error');
    return NextResponse.json(
      { error: 'Failed to retrieve user sessions' },
      { status: 500 }
    );
  }
}
