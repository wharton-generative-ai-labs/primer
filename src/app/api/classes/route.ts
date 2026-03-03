import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { Class, ClassesConfig, ClassSummary } from '@/app/lib/types';
import { Permission } from '@/config/auth';
import { hasMergedPermission, loadFileBasedUsers, saveFileBasedUsers, userExists } from '@/config/user-storage';
import { createModuleLogger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const logger = createModuleLogger('classes');

/**
 * Ensure a user has at least PLAYER role in the file-based users system.
 * This is called when adding someone to a class so they have proper session permissions.
 */
function ensurePlayerRole(email: string): void {
  // Only add if they don't already exist in the system
  if (!userExists(email)) {
    const userData = loadFileBasedUsers();
    const now = new Date().toISOString();
    
    userData.users[email] = {
      roles: ['PLAYER'],
      createdAt: now,
      modifiedAt: now
    };
    
    saveFileBasedUsers(userData);
    logger.debug({ email }, 'Added PLAYER role for class member');
  }
}

// Helper to get the classes.json path for an experience
function getClassesPath(experienceId: string): string {
  return path.join(experienceId, 'classes.json');
}

// Helper to get the experience.json path
function getExperiencePath(experienceId: string): string {
  return path.join(experienceId, 'experience.json');
}

// Helper to read classes config, returns empty config if file doesn't exist
async function readClassesConfig(experienceId: string): Promise<ClassesConfig> {
  const storage = StorageServiceFactory.getInstance();
  const classesPath = getClassesPath(experienceId);
  
  try {
    if (await storage.fileExists(classesPath)) {
      const content = await storage.readFile(classesPath);
      return JSON.parse(content.toString()) as ClassesConfig;
    }
  } catch (error) {
    logger.error({ err: error, experienceId }, 'Error reading classes config');
  }
  
  // Return empty config if file doesn't exist or can't be read
  return {
    classes: [],
    lastModified: new Date().toISOString()
  };
}

// Helper to write classes config
async function writeClassesConfig(experienceId: string, config: ClassesConfig): Promise<void> {
  const storage = StorageServiceFactory.getInstance();
  const classesPath = getClassesPath(experienceId);
  
  config.lastModified = new Date().toISOString();
  await storage.storeFile(classesPath, Buffer.from(JSON.stringify(config, null, 2)));
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
    logger.error({ err: error, experienceId }, 'Error reading experience config');
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
 * GET /api/classes?experienceId={id}
 * Returns all classes for an experience (for owners/admins)
 * 
 * GET /api/classes?experienceId={id}&checkAccess=true
 * Checks if current user has access to the experience via class membership
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userEmail = session?.user?.email;
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const experienceId = searchParams.get('experienceId');
    const checkAccess = searchParams.get('checkAccess') === 'true';
    
    if (!experienceId) {
      return NextResponse.json({ error: 'experienceId is required' }, { status: 400 });
    }
    
    const classesConfig = await readClassesConfig(experienceId);
    
    // If just checking access, return whether user is a member of any class
    if (checkAccess) {
      const hasAccess = classesConfig.classes.some(cls => 
        cls.isActive && cls.members.some(m => m.email.toLowerCase() === userEmail.toLowerCase())
      );
      return NextResponse.json({ hasAccess });
    }
    
    // For listing classes, user must be able to manage them
    const canManage = await canManageClasses(experienceId, userEmail);
    if (!canManage) {
      return NextResponse.json({ error: 'Not authorized to view classes' }, { status: 403 });
    }
    
    // Return class summaries (with member counts but not full member lists)
    const summaries: ClassSummary[] = classesConfig.classes.map(cls => ({
      id: cls.id,
      name: cls.name,
      description: cls.description,
      memberCount: cls.members.length,
      createdBy: cls.createdBy,
      createdAt: cls.createdAt,
      isActive: cls.isActive
    }));
    
    return NextResponse.json({ classes: summaries });
  } catch (error) {
    logger.error(error, 'Error in GET /api/classes');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/classes
 * Create a new class or manage class membership
 * 
 * Body for creating a class:
 * { action: 'create', experienceId, name, description? }
 * 
 * Body for adding members:
 * { action: 'addMembers', experienceId, classId, emails: string[] }
 * 
 * Body for removing members:
 * { action: 'removeMembers', experienceId, classId, emails: string[] }
 * 
 * Body for updating class:
 * { action: 'update', experienceId, classId, name?, description?, isActive? }
 * 
 * Body for deleting class:
 * { action: 'delete', experienceId, classId }
 */
export async function POST(request: NextRequest) {
  let action: string | undefined;
  
  try {
    const session = await getServerSession();
    const userEmail = session?.user?.email;
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    action = body.action;
    const { experienceId } = body;
    
    if (!experienceId) {
      return NextResponse.json({ error: 'experienceId is required' }, { status: 400 });
    }
    
    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }
    
    // Check if user can manage classes for this experience
    const canManage = await canManageClasses(experienceId, userEmail);
    if (!canManage) {
      return NextResponse.json({ error: 'Not authorized to manage classes' }, { status: 403 });
    }
    
    const classesConfig = await readClassesConfig(experienceId);
    
    switch (action) {
      case 'create': {
        const { name, description } = body;
        
        if (!name) {
          return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }
        
        const newClass: Class = {
          id: `class-${uuidv4().substring(0, 8)}`,
          name,
          description,
          createdBy: userEmail,
          createdAt: new Date().toISOString(),
          members: [],
          isActive: true
        };
        
        classesConfig.classes.push(newClass);
        await writeClassesConfig(experienceId, classesConfig);
        
        return NextResponse.json({ 
          success: true, 
          class: {
            id: newClass.id,
            name: newClass.name,
            description: newClass.description,
            memberCount: 0,
            createdBy: newClass.createdBy,
            createdAt: newClass.createdAt,
            isActive: newClass.isActive
          } as ClassSummary
        });
      }
      
      case 'addMembers': {
        const { classId, emails } = body;
        
        if (!classId) {
          return NextResponse.json({ error: 'classId is required' }, { status: 400 });
        }
        
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
          return NextResponse.json({ error: 'emails array is required' }, { status: 400 });
        }
        
        const classIndex = classesConfig.classes.findIndex(c => c.id === classId);
        if (classIndex === -1) {
          return NextResponse.json({ error: 'Class not found' }, { status: 404 });
        }
        
        const cls = classesConfig.classes[classIndex];
        const existingEmails = new Set(cls.members.map(m => m.email.toLowerCase()));
        const now = new Date().toISOString();
        let addedCount = 0;
        
        for (const email of emails) {
          const normalizedEmail = email.trim().toLowerCase();
          if (normalizedEmail && !existingEmails.has(normalizedEmail)) {
            cls.members.push({
              email: normalizedEmail,
              addedAt: now,
              addedBy: userEmail
            });
            existingEmails.add(normalizedEmail);
            addedCount++;
            
            // Grant PLAYER role to new class members so they have proper session permissions
            ensurePlayerRole(normalizedEmail);
          }
        }
        
        await writeClassesConfig(experienceId, classesConfig);
        
        return NextResponse.json({ 
          success: true, 
          addedCount,
          totalMembers: cls.members.length
        });
      }
      
      case 'removeMembers': {
        const { classId, emails } = body;
        
        if (!classId) {
          return NextResponse.json({ error: 'classId is required' }, { status: 400 });
        }
        
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
          return NextResponse.json({ error: 'emails array is required' }, { status: 400 });
        }
        
        const classIndex = classesConfig.classes.findIndex(c => c.id === classId);
        if (classIndex === -1) {
          return NextResponse.json({ error: 'Class not found' }, { status: 404 });
        }
        
        const cls = classesConfig.classes[classIndex];
        const emailsToRemove = new Set(emails.map((e: string) => e.trim().toLowerCase()));
        const originalCount = cls.members.length;
        
        cls.members = cls.members.filter(m => !emailsToRemove.has(m.email.toLowerCase()));
        
        await writeClassesConfig(experienceId, classesConfig);
        
        return NextResponse.json({ 
          success: true, 
          removedCount: originalCount - cls.members.length,
          totalMembers: cls.members.length
        });
      }
      
      case 'update': {
        const { classId, name, description, isActive } = body;
        
        if (!classId) {
          return NextResponse.json({ error: 'classId is required' }, { status: 400 });
        }
        
        const classIndex = classesConfig.classes.findIndex(c => c.id === classId);
        if (classIndex === -1) {
          return NextResponse.json({ error: 'Class not found' }, { status: 404 });
        }
        
        const cls = classesConfig.classes[classIndex];
        
        if (name !== undefined) cls.name = name;
        if (description !== undefined) cls.description = description;
        if (isActive !== undefined) cls.isActive = isActive;
        
        await writeClassesConfig(experienceId, classesConfig);
        
        return NextResponse.json({ 
          success: true,
          class: {
            id: cls.id,
            name: cls.name,
            description: cls.description,
            memberCount: cls.members.length,
            createdBy: cls.createdBy,
            createdAt: cls.createdAt,
            isActive: cls.isActive
          } as ClassSummary
        });
      }
      
      case 'delete': {
        const { classId } = body;
        
        if (!classId) {
          return NextResponse.json({ error: 'classId is required' }, { status: 400 });
        }
        
        const classIndex = classesConfig.classes.findIndex(c => c.id === classId);
        if (classIndex === -1) {
          return NextResponse.json({ error: 'Class not found' }, { status: 404 });
        }
        
        classesConfig.classes.splice(classIndex, 1);
        await writeClassesConfig(experienceId, classesConfig);
        
        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    logger.error({ err: error, action: action || 'unknown' }, 'Error in POST /api/classes');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

