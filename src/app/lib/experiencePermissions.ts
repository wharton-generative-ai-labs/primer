/**
 * Experience-level permissions utilities
 * 
 * Access control is based on:
 * 1. Permissions (VIEW_ALL_EXPERIENCES for admin/editor/tester)
 * 2. Experience authorship (authorEmail in experience.json)
 * 3. Class membership (classes.json in each experience folder)
 */

import { Permission } from '@/config/auth';
import { hasMergedPermission, hasMergedRole } from '@/config/user-storage';
import { isClassMember } from '@/app/lib/classAuth';

/**
 * Centralized logic for determining if a user can see an experience in the catalog.
 * 
 * Rules:
 * 1. Users with VIEW_ALL_EXPERIENCES permission can see ALL experiences
 * 2. Educators can see:
 *    - Experiences they authored
 *    - Experiences with kind="meta" or kind="bundled"
 * 3. Class members can see experiences they are members of (via classes.json)
 * 
 * Note: These rules apply primarily to experiences without a `kind` field.
 * Experiences with kind="template" or kind="debugger" have separate visibility 
 * logic handled at the API layer (admin-only with explicit request params).
 */
export interface ExperienceCatalogVisibilityParams {
  experienceId: string;
  userEmail: string;
  authorEmail?: string;
  kind?: string;
}

export async function canViewExperienceInCatalog(
  params: ExperienceCatalogVisibilityParams
): Promise<boolean> {
  const { experienceId, userEmail, authorEmail, kind } = params;
  const emailLower = userEmail.toLowerCase();
  
  // Rule 1: Users with VIEW_ALL_EXPERIENCES permission can see all experiences
  if (hasMergedPermission(userEmail, Permission.VIEW_ALL_EXPERIENCES)) {
    return true;
  }
  
  // Check if user is an educator
  const isEducator = hasMergedRole(userEmail, 'EDUCATOR');
  
  // Rule 2a: Educators can see meta and bundled experiences
  if (isEducator && (kind === 'meta' || kind === 'bundled')) {
    return true;
  }
  
  // Rule 2b: Authors can see experiences they authored
  if (authorEmail && authorEmail.toLowerCase() === emailLower) {
    return true;
  }
  
  // Rule 3: Check if user is a class member for this experience
  if (await isClassMember(experienceId, userEmail)) {
    return true;
  }
  
  return false;
}
