import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { canAccessExperience, getClassInfoForUser } from '@/app/lib/classAuth';
import { Permission } from '@/config/auth';
import { hasMergedPermission } from '@/config/user-storage';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('classes-check-access');

/**
 * GET /api/classes/check-access?experienceId={id}
 * Checks if the current user can access an experience
 * Returns access status and reason (permission, owner, class, or none)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userEmail = session?.user?.email;
    
    if (!userEmail) {
      return NextResponse.json({ 
        canAccess: false, 
        reason: 'not_authenticated' 
      });
    }
    
    const { searchParams } = new URL(request.url);
    const experienceId = searchParams.get('experienceId');
    
    if (!experienceId) {
      return NextResponse.json({ error: 'experienceId is required' }, { status: 400 });
    }
    
    // Check if user has general play permission (using merged user data)
    const hasPlayPermission = hasMergedPermission(userEmail, Permission.PLAY_EXPERIENCE);
    
    // Check access
    const accessResult = await canAccessExperience(experienceId, userEmail, hasPlayPermission);
    
    // If accessing via class, include class info
    if (accessResult.reason === 'class') {
      const classInfo = await getClassInfoForUser(experienceId, userEmail);
      return NextResponse.json({
        ...accessResult,
        classInfo
      });
    }
    
    return NextResponse.json(accessResult);
  } catch (error) {
    logger.error(error, 'Error in GET /api/classes/check-access');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
