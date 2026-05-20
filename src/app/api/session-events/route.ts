import { NextRequest, NextResponse } from 'next/server';
import { getSessionMetadataFilePath, SessionMetadata, SessionEvent } from '@/app/lib/file-utils';
import {
  mutateSessionMetadata,
  SessionMetadataNotFoundError,
} from '@/app/lib/sessions/mutateSessionMetadata';
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

    const now = new Date().toISOString();
    const newEvent: SessionEvent = {
      event,
      agent,
      timestamp: now,
      ...(data && { data }),
    };

    let totalEvents: number;
    try {
      // Per-session lock serializes parallel POSTs so an event can't be lost
      // to a last-writer-wins read-modify-write race.
      totalEvents = await mutateSessionMetadata<number>(
        experienceId,
        sessionId,
        async (metadata) => {
          // Backward compatibility: older session.json files predate the
          // events field. Initialize lazily inside the lock.
          if (!metadata.events) {
            metadata.events = [];
          }
          metadata.events.push(newEvent);
          metadata.lastActivity = now;
          return { metadata, result: metadata.events.length };
        },
      );
    } catch (error: unknown) {
      if (error instanceof SessionMetadataNotFoundError) {
        return NextResponse.json(
          { error: 'Session not found. Session must be initialized first.' },
          { status: 404 }
        );
      }
      throw error;
    }

    logger.debug({ event, agent, sessionId }, 'Added event to session');

    return NextResponse.json({
      success: true,
      event: newEvent,
      totalEvents,
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
