'use server';

import { revalidatePath } from 'next/cache';

import { getCachedSession } from '@/lib/getCachedSession';
import { Permission } from '@/config/auth';
import { hasMergedPermission } from '@/config/user-storage';
import { getEffectiveUserEmail } from '@/lib/devAuth';
import { createModuleLogger } from '@/lib/logger';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { resolveAndInstall } from '@/app/lib/modules/ModuleService';
import type { InstallResult } from '@/app/lib/modules/types';
import {
  EXPERIENCE_ID_RE,
  MODULE_ID_RE,
} from '@/app/server-actions/_validation';

const logger = createModuleLogger('catalog-actions');

async function requireUserEmail(): Promise<string> {
  const session = await getCachedSession();
  const userEmail = getEffectiveUserEmail(session?.user?.email);
  if (!userEmail) {
    throw new Error('Authentication required');
  }
  return userEmail;
}

export interface DeleteExperienceResult {
  success: boolean;
  error?: string;
}

/**
 * Deletes an experience after enforcing authorship/permission rules. Mirrors
 * the previous DELETE /api/experiences/[id] handler.
 */
export async function deleteExperience(experienceId: string): Promise<DeleteExperienceResult> {
  try {
    const userEmail = await requireUserEmail();

    if (!EXPERIENCE_ID_RE.test(experienceId)) {
      return { success: false, error: 'Invalid experience id' };
    }

    const storage = StorageServiceFactory.getInstance();
    const experiencePath = `${experienceId}/experience.json`;

    if (!(await storage.fileExists(experiencePath))) {
      return { success: false, error: 'Experience not found' };
    }

    const experienceText = await storage.readFileAsText(experiencePath);
    const experienceData = JSON.parse(experienceText);
    const isAuthor = experienceData.authorEmail === userEmail;

    if (!hasMergedPermission(userEmail, Permission.DELETE_EXPERIENCE) && !isAuthor) {
      return {
        success: false,
        error: 'You do not have permission to delete this experience',
      };
    }

    await storage.deleteDirectory(experienceId);
    logger.info({ experienceId }, 'Successfully deleted experience');

    revalidatePath('/');
    revalidatePath('/modules');
    return { success: true };
  } catch (error) {
    logger.error(error, 'Error deleting experience');
    return {
      success: false,
      error: 'Failed to delete experience',
    };
  }
}

export interface InstallModuleResult {
  success: boolean;
  error?: string;
  result?: InstallResult;
}

/**
 * Installs a module (and its dependencies) from the configured registry.
 * Mirrors the previous POST /api/modules/install handler.
 */
export async function installModule(moduleId: string): Promise<InstallModuleResult> {
  try {
    const userEmail = await requireUserEmail();

    if (!hasMergedPermission(userEmail, Permission.UPLOAD_EXPERIENCE)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (!moduleId || typeof moduleId !== 'string' || !MODULE_ID_RE.test(moduleId)) {
      return { success: false, error: 'Invalid module id' };
    }

    logger.info({ moduleId, userEmail }, 'Module install requested');
    const result = await resolveAndInstall(moduleId);

    if (result.errors.length > 0 && result.installed.length === 0) {
      return {
        success: false,
        error: result.errors.map((e) => e.error).join('; ') || 'Installation failed',
        result,
      };
    }

    revalidatePath('/');
    revalidatePath('/modules');
    return { success: true, result };
  } catch (error) {
    logger.error(error, 'Module install error');
    return {
      success: false,
      error: 'Installation failed',
    };
  }
}

/**
 * Bumps the catalog cache after a side-effect that originated outside a Server
 * Action — currently used after the legacy `/api/upload` zip endpoint succeeds.
 */
export async function revalidateExperiencesAction(): Promise<void> {
  revalidatePath('/');
}
