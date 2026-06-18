import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { ClassSessionsIndex, MemberSessionInfo, ClassesConfig } from '@/app/lib/types';
import { canManageClasses } from '@/app/lib/classAuth';
import { createModuleLogger } from '@/lib/logger';
import path from 'path';

const logger = createModuleLogger('sessions-index');

/**
 * GET - Retrieve the sessions index for a class
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const experienceId = searchParams.get('experienceId');
  const classId = searchParams.get('classId');

  try {
    const token = await getToken({ req: request });
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!experienceId || !classId) {
      return NextResponse.json(
        { error: 'experienceId and classId are required' },
        { status: 400 }
      );
    }

    const canManage = await canManageClasses(experienceId, token.email);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Not authorized to view sessions for this experience' },
        { status: 403 }
      );
    }

    const storage = StorageServiceFactory.getInstance();
    const indexPath = path.join(experienceId, 'class_data', classId, 'sessions_index.json');

    // Check if index exists
    if (await storage.fileExists(indexPath)) {
      const content = await storage.readFileAsText(indexPath);
      const index: ClassSessionsIndex = JSON.parse(content);
      return NextResponse.json({ index });
    }

    // Index doesn't exist, return empty response
    return NextResponse.json({ 
      index: null,
      message: 'Sessions index not yet built. POST to refresh.' 
    });

  } catch (error) {
    logger.error({ 
      err: error, 
      experienceId: experienceId || 'unknown', 
      classId: classId || 'unknown' 
    }, 'GET error');
    return NextResponse.json(
      { error: 'Failed to retrieve sessions index' },
      { status: 500 }
    );
  }
}

/**
 * POST - Build/refresh the sessions index for a class
 */
export async function POST(request: NextRequest) {
  let experienceId: string | undefined;
  let classId: string | undefined;

  try {
    const token = await getToken({ req: request });
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    experienceId = body.experienceId;
    classId = body.classId;

    if (!experienceId || !classId) {
      return NextResponse.json(
        { error: 'experienceId and classId are required' },
        { status: 400 }
      );
    }

    const storage = StorageServiceFactory.getInstance();

    const experienceConfigPath = path.join(experienceId, 'experience.json');
    if (!await storage.fileExists(experienceConfigPath)) {
      return NextResponse.json(
        { error: 'Experience not found' },
        { status: 404 }
      );
    }

    // Check authorization (author or user with MANAGE_ANY_CLASSES)
    const canManage = await canManageClasses(experienceId, token.email);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Not authorized to manage sessions for this experience' },
        { status: 403 }
      );
    }

    // Load classes configuration
    const classesPath = path.join(experienceId, 'classes.json');
    if (!await storage.fileExists(classesPath)) {
      return NextResponse.json(
        { error: 'No classes configured for this experience' },
        { status: 404 }
      );
    }

    const classesConfig: ClassesConfig = JSON.parse(await storage.readFileAsText(classesPath));
    const targetClass = classesConfig.classes.find(c => c.id === classId);
    
    if (!targetClass) {
      return NextResponse.json(
        { error: `Class ${classId} not found` },
        { status: 404 }
      );
    }

    // Build the sessions index
    const index = await buildSessionsIndex(storage, experienceId, classId, targetClass);

    // Save the index
    const indexPath = path.join(experienceId, 'class_data', classId, 'sessions_index.json');
    await storage.storeFile(indexPath, Buffer.from(JSON.stringify(index, null, 2)));

    return NextResponse.json({ 
      success: true, 
      index,
      message: `Indexed ${index.membersWithSessions} members with sessions out of ${index.totalMembers} total members`
    });

  } catch (error) {
    logger.error({ 
      err: error, 
      experienceId: experienceId || 'unknown', 
      classId: classId || 'unknown' 
    }, 'POST error');
    return NextResponse.json(
      { error: 'Failed to build sessions index' },
      { status: 500 }
    );
  }
}

/**
 * Build the sessions index by scanning session_data folders
 */
async function buildSessionsIndex(
  storage: ReturnType<typeof StorageServiceFactory.getInstance>,
  experienceId: string,
  classId: string,
  targetClass: { members: Array<{ email: string; name?: string }> }
): Promise<ClassSessionsIndex> {
  const sessionDataPath = path.join(experienceId, 'session_data');
  
  // Create a map of member emails for quick lookup
  const memberEmails = new Set(
    targetClass.members.map(m => m.email.toLowerCase())
  );
  const memberNames = new Map(
    targetClass.members.map(m => [m.email.toLowerCase(), m.name])
  );

  const index: ClassSessionsIndex = {
    classId,
    experienceId,
    lastUpdated: new Date().toISOString(),
    members: {},
    totalMembers: targetClass.members.length,
    membersWithSessions: 0
  };

  // List all session folders
  let sessionFolders: string[] = [];
  try {
    sessionFolders = await storage.listDirectories(sessionDataPath);
  } catch {
    // No session_data folder yet
    logger.debug({ sessionDataPath, experienceId, classId }, 'No session_data folder found');
    return index;
  }

  // Process each session folder (listDirectories returns paths relative to storage root, e.g. experienceId/session_data/sess_xyz)
  for (const folderPath of sessionFolders) {
    const sessionId = path.basename(folderPath);
    if (!sessionId.startsWith('sess_')) continue;

    const sessionMetaPath = path.join(folderPath, 'session.json');
    
    try {
      if (!await storage.fileExists(sessionMetaPath)) continue;

      const sessionMeta = JSON.parse(await storage.readFileAsText(sessionMetaPath));
      const email = sessionMeta.userEmail?.toLowerCase();
      
      if (!email || !memberEmails.has(email)) continue;

      // Check if analytics exist for this session
      const analyticsPath = path.join(folderPath, 'analytics', 'student_report.md');
      const hasAnalytics = await storage.fileExists(analyticsPath);
      
      let analyticsGeneratedAt: string | undefined;
      if (hasAnalytics) {
        const stats = await storage.getFileStats(analyticsPath);
        analyticsGeneratedAt = stats?.mtime.toISOString();
      }

      // Create session info
      const sessionInfo: MemberSessionInfo = {
        sessionId,
        startTime: sessionMeta.startTime,
        endTime: sessionMeta.endTime,
        hasAnalytics,
        analyticsGeneratedAt
      };

      // Add to member's sessions
      if (!index.members[email]) {
        index.members[email] = {
          sessions: [],
          totalSessions: 0,
          // Prefer name from class config; fall back to userName from session.json
          name: memberNames.get(email) || sessionMeta.userName || undefined
        };
      } else if (!index.members[email].name && sessionMeta.userName) {
        // Back-fill name from session data if class config didn't provide one
        index.members[email].name = sessionMeta.userName;
      }
      
      index.members[email].sessions.push(sessionInfo);
      index.members[email].totalSessions++;

    } catch (error) {
      logger.error({ err: error, folderPath, experienceId, classId }, 'Error processing session');
    }
  }

  // Sort sessions by start time and determine latest session
  for (const email of Object.keys(index.members)) {
    const member = index.members[email];
    member.sessions.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    if (member.sessions.length > 0) {
      member.latestSession = member.sessions[0].sessionId;
    }
  }

  // Count members with sessions
  index.membersWithSessions = Object.keys(index.members).filter(
    email => index.members[email].sessions.length > 0
  ).length;

  return index;
}

