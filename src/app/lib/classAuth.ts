import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { ClassesConfig } from '@/app/lib/types';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';
import { Permission } from '@/config/auth';
import { hasMergedPermission } from '@/config/user-storage';

const logger = createModuleLogger('classAuth');

/**
 * Check if a user has access to an experience via class membership
 * This is a server-side utility function
 */
export async function isClassMember(experienceId: string, userEmail: string): Promise<boolean> {
  const storage = StorageServiceFactory.getInstance();
  const classesPath = path.join(experienceId, 'classes.json');
  
  try {
    if (await storage.fileExists(classesPath)) {
      const content = await storage.readFile(classesPath);
      const config = JSON.parse(content.toString()) as ClassesConfig;
      
      // Check if user is a member of any active class
      return config.classes.some(cls => 
        cls.isActive && cls.members.some(m => m.email.toLowerCase() === userEmail.toLowerCase())
      );
    }
  } catch (error) {
    logger.error(error, 'Error checking class membership');
  }
  
  return false;
}

/**
 * Check if a user is the owner of an experience
 */
export async function isExperienceOwner(experienceId: string, userEmail: string): Promise<boolean> {
  const storage = StorageServiceFactory.getInstance();
  const experiencePath = path.join(experienceId, 'experience.json');
  
  try {
    if (await storage.fileExists(experiencePath)) {
      const content = await storage.readFile(experiencePath);
      const config = JSON.parse(content.toString());
      return config.authorEmail === userEmail;
    }
  } catch (error) {
    logger.error(error, 'Error checking experience ownership');
  }
  
  return false;
}

/**
 * Check if a user can manage classes (and thus class-related data like analytics) for an experience.
 * Returns true if user has MANAGE_ANY_CLASSES (admin) or has MANAGE_OWN_CLASSES and is the experience owner.
 * Use this for classes API, analytics sessions-index, and analytics run.
 */
export async function canManageClasses(experienceId: string, userEmail: string): Promise<boolean> {
  if (hasMergedPermission(userEmail, Permission.MANAGE_ANY_CLASSES)) {
    return true;
  }
  if (hasMergedPermission(userEmail, Permission.MANAGE_OWN_CLASSES)) {
    return await isExperienceOwner(experienceId, userEmail);
  }
  return false;
}

/**
 * Comprehensive check if a user can access an experience
 * Returns true if user is:
 * 1. In USER_ROLES with PLAY_EXPERIENCE permission, OR
 * 2. The owner of the experience, OR
 * 3. A member of an active class for this experience
 */
export async function canAccessExperience(
  experienceId: string, 
  userEmail: string,
  hasPlayPermission: boolean
): Promise<{ canAccess: boolean; reason: 'permission' | 'owner' | 'class' | 'none' }> {
  // Check if user has general play permission
  if (hasPlayPermission) {
    return { canAccess: true, reason: 'permission' };
  }
  
  // Check if user is experience owner
  if (await isExperienceOwner(experienceId, userEmail)) {
    return { canAccess: true, reason: 'owner' };
  }
  
  // Check if user is a class member
  if (await isClassMember(experienceId, userEmail)) {
    return { canAccess: true, reason: 'class' };
  }
  
  return { canAccess: false, reason: 'none' };
}

/**
 * Get class info for a user accessing an experience
 * Returns the class name if user is a class member
 */
export async function getClassInfoForUser(
  experienceId: string, 
  userEmail: string
): Promise<{ className: string; classId: string } | null> {
  const storage = StorageServiceFactory.getInstance();
  const classesPath = path.join(experienceId, 'classes.json');
  
  try {
    if (await storage.fileExists(classesPath)) {
      const content = await storage.readFile(classesPath);
      const config = JSON.parse(content.toString()) as ClassesConfig;
      
      for (const cls of config.classes) {
        if (cls.isActive && cls.members.some(m => m.email.toLowerCase() === userEmail.toLowerCase())) {
          return { className: cls.name, classId: cls.id };
        }
      }
    }
  } catch (error) {
    logger.error(error, 'Error getting class info');
  }
  
  return null;
}

