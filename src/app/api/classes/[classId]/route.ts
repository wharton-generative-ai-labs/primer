import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { ClassesConfig } from '@/app/lib/types';
import { Permission } from '@/config/auth';
import { hasMergedPermission } from '@/config/user-storage';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('classes-classId');

// Helper to get the classes.json path for an experience
function getClassesPath(experienceId: string): string {
  return path.join(experienceId, 'classes.json');
}

// Helper to get the experience.json path
function getExperiencePath(experienceId: string): string {
  return path.join(experienceId, 'experience.json');
}

// Helper to read classes config
async function readClassesConfig(experienceId: string): Promise<ClassesConfig | null> {
  const storage = StorageServiceFactory.getInstance();
  const classesPath = getClassesPath(experienceId);
  
  try {
    if (await storage.fileExists(classesPath)) {
      const content = await storage.readFile(classesPath);
      return JSON.parse(content.toString()) as ClassesConfig;
    }
  } catch (error) {
    logger.warn({ experienceId, err: error }, 'Error reading classes config');
  }
  
  return null;
}

// Helper to check if user is the experience owner
async function isExperienceOwner(experienceId: string, userEmail: string): Promise<boolean> {
  const storage = StorageServiceFactory.getInstance();
  const experiencePath = getExperiencePath(experienceId);
  
  try {
    if (await storage.fileExists(experiencePath)) {
      const content = await storage.readFile(experiencePath);
      const config = JSON.parse(content.toString());
      return config.authorEmail === userEmail;
    }
  } catch (error) {
    logger.warn({ experienceId, err: error }, 'Error reading experience config');
  }
  
  return false;
}

// Helper to check if user can manage classes for an experience
async function canManageClasses(experienceId: string, userEmail: string): Promise<boolean> {
  // MANAGE_ANY_CLASSES allows managing classes for any experience (admin)
  if (hasMergedPermission(userEmail, Permission.MANAGE_ANY_CLASSES)) {
    return true;
  }
  
  // MANAGE_OWN_CLASSES requires user to be the experience owner
  if (hasMergedPermission(userEmail, Permission.MANAGE_OWN_CLASSES)) {
    return await isExperienceOwner(experienceId, userEmail);
  }
  
  return false;
}

/**
 * GET /api/classes/[classId]?experienceId={id}
 * Returns full class details including member list
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { classId } = await params;
    const { searchParams } = new URL(request.url);
    const experienceId = searchParams.get('experienceId');
    
    if (!experienceId) {
      return NextResponse.json({ error: 'experienceId is required' }, { status: 400 });
    }
    
    // Check if user can manage classes for this experience
    const canManage = await canManageClasses(experienceId, userEmail);
    if (!canManage) {
      return NextResponse.json({ error: 'Not authorized to view class details' }, { status: 403 });
    }
    
    const classesConfig = await readClassesConfig(experienceId);
    if (!classesConfig) {
      return NextResponse.json({ error: 'No classes found' }, { status: 404 });
    }
    
    const cls = classesConfig.classes.find(c => c.id === classId);
    if (!cls) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    
    return NextResponse.json({ class: cls });
  } catch (error) {
    logger.error(error, 'Error in GET /api/classes/[classId]');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

