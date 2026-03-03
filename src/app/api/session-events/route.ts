import { NextRequest, NextResponse } from 'next/server';
import { getSessionMetadataFilePath, SessionMetadata, SessionEvent } from '@/app/lib/file-utils';
import { createModuleLogger } from '@/lib/logger';
import fs from 'fs/promises';

const logger = createModuleLogger('session-events');

/**
 * POST - Add a new event to the session
 * 
 * Body: { event: string, agent: string, data?: object }
 * Headers: x-experience-id, x-session-id
 */
export async function POST(req: NextRequest) {
  try {
    const experienceId = req.headers.get('x-experience-id');
    const sessionId = req.headers.get('x-session-id');
    
    if (!experienceId || !sessionId) {
      return NextResponse.json(
        { error: 'Experience ID and Session ID are required (via headers)' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { event, agent, data } = body;
    
    if (!event || !agent) {
      return NextResponse.json(
        { error: 'Event type and agent are required' },
        { status: 400 }
      );
    }

    const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
    
    // Read existing metadata
    let metadata: SessionMetadata;
    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(content);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'ENOENT') {
        return NextResponse.json(
          { error: 'Session not found. Session must be initialized first.' },
          { status: 404 }
        );
      }
      throw error;
    }
    
    // Ensure events array exists (backward compatibility)
    if (!metadata.events) {
      metadata.events = [];
    }
    
    const now = new Date().toISOString();
    
    // Create the new event
    const newEvent: SessionEvent = {
      event,
      agent,
      timestamp: now,
      ...(data && { data }),
    };
    
    // Add event to array
    metadata.events.push(newEvent);
    
    // Update lastActivity
    metadata.lastActivity = now;
    
    // Write updated metadata
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    logger.debug({ event, agent, sessionId }, 'Added event to session');
    
    return NextResponse.json({ 
      success: true, 
      event: newEvent,
      totalEvents: metadata.events.length
    });
  } catch (error) {
    logger.error(error, 'Error adding event');
    return NextResponse.json(
      { error: 'Failed to add session event' },
      { status: 500 }
    );
  }
}

/**
 * GET - Read session events
 * 
 * Query params:
 * - last: number (optional) - return only the last N events
 * 
 * Headers: x-experience-id, x-session-id
 */
export async function GET(req: NextRequest) {
  try {
    const experienceId = req.headers.get('x-experience-id');
    const sessionId = req.headers.get('x-session-id');
    
    if (!experienceId || !sessionId) {
      return NextResponse.json(
        { error: 'Experience ID and Session ID are required (via headers)' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const lastN = searchParams.get('last');

    const metadataPath = await getSessionMetadataFilePath(experienceId, sessionId);
    
    // Read existing metadata
    let metadata: SessionMetadata;
    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(content);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'ENOENT') {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      throw error;
    }
    
    // Ensure events array exists (backward compatibility)
    const events = metadata.events || [];
    
    // Return requested events
    if (lastN) {
      const n = parseInt(lastN, 10);
      if (isNaN(n) || n < 1) {
        return NextResponse.json(
          { error: 'Invalid "last" parameter - must be a positive integer' },
          { status: 400 }
        );
      }
      return NextResponse.json({ 
        events: events.slice(-n),
        totalEvents: events.length
      });
    }
    
    return NextResponse.json({ 
      events,
      totalEvents: events.length
    });
  } catch (error) {
    logger.error(error, 'Error reading events');
    return NextResponse.json(
      { error: 'Failed to read session events' },
      { status: 500 }
    );
  }
}
