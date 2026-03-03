import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Permission, ROLES, RoleKey, isEnvDefinedUser } from '@/config/auth';
import { 
  getFileBasedUsersData, 
  saveFileBasedUsers, 
  hasMergedPermission,
  FileBasedUser
} from '@/config/user-storage';
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/app/lib/rate-limit';
import { createModuleLogger } from '@/lib/logger';
import { auditAuthorizationFailure, auditAdminAction } from '@/lib/audit-logger';
import { env } from '@/config/env';

const logger = createModuleLogger('admin-users');

// Types for API responses
interface UserInfo {
  email: string;
  roles: RoleKey[];
  source: 'env' | 'file';
  createdAt?: string;
  modifiedAt?: string;
}

/**
 * GET /api/admin/users
 * Returns all users (both env-defined and file-based)
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for admin operations (sensitive endpoint)
    const identifier = getClientIdentifier(request);
    const limitResult = rateLimit(identifier, rateLimitConfigs.strict);
    
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: limitResult.message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limitResult.max.toString(),
            'X-RateLimit-Remaining': limitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(limitResult.resetTime).toISOString(),
            'Retry-After': Math.ceil((limitResult.resetTime - Date.now()) / 1000).toString()
          }
        }
      );
    }

    const session = await getServerSession();
    const userEmail = session?.user?.email;
    
    if (!userEmail) {
      await auditAuthorizationFailure('anonymous', request, {
        path: '/api/admin/users',
        method: 'GET',
        reason: 'no_session',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user has ADMIN_USERS permission (using merged data)
    if (!hasMergedPermission(userEmail, Permission.ADMIN_USERS)) {
      await auditAuthorizationFailure(userEmail, request, {
        path: '/api/admin/users',
        method: 'GET',
        reason: 'insufficient_permissions',
        requiredPermission: Permission.ADMIN_USERS,
      });
      return NextResponse.json({ error: 'Not authorized to manage users' }, { status: 403 });
    }
    
    // Get env-defined users
    const envMappings = JSON.parse(env.USER_ROLE_MAPPINGS || '{}') as Record<string, RoleKey[]>;
    
    // Get file-based users
    const fileData = getFileBasedUsersData();
    
    // Combine into user list
    const users: UserInfo[] = [];
    
    // Add env-defined users
    for (const [email, roles] of Object.entries(envMappings)) {
      users.push({
        email,
        roles,
        source: 'env'
      });
    }
    
    // Add file-based users (exclude any that might be in env)
    for (const [email, userData] of Object.entries(fileData.users)) {
      if (!isEnvDefinedUser(email)) {
        users.push({
          email,
          roles: userData.roles,
          source: 'file',
          createdAt: userData.createdAt,
          modifiedAt: userData.modifiedAt
        });
      }
    }
    
    // Sort by email
    users.sort((a, b) => a.email.localeCompare(b.email));
    
    // Return available roles for the UI
    const availableRoles = Object.keys(ROLES) as RoleKey[];
    
    return NextResponse.json({ 
      users,
      availableRoles
    });
  } catch (error) {
    logger.error(error, 'Error in GET /api/admin/users');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/users
 * Create, update, or delete file-based users
 * 
 * Body for creating/updating a user:
 * { action: 'upsert', email: string, roles: RoleKey[] }
 * 
 * Body for deleting a user:
 * { action: 'delete', email: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for admin operations (sensitive endpoint)
    const identifier = getClientIdentifier(request);
    const limitResult = rateLimit(identifier, rateLimitConfigs.strict);
    
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: limitResult.message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limitResult.max.toString(),
            'X-RateLimit-Remaining': limitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(limitResult.resetTime).toISOString(),
            'Retry-After': Math.ceil((limitResult.resetTime - Date.now()) / 1000).toString()
          }
        }
      );
    }

    const session = await getServerSession();
    const userEmail = session?.user?.email;
    
    if (!userEmail) {
      await auditAuthorizationFailure('anonymous', request, {
        path: '/api/admin/users',
        method: 'POST',
        reason: 'no_session',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user has ADMIN_USERS permission (using merged data)
    if (!hasMergedPermission(userEmail, Permission.ADMIN_USERS)) {
      await auditAuthorizationFailure(userEmail, request, {
        path: '/api/admin/users',
        method: 'POST',
        reason: 'insufficient_permissions',
        requiredPermission: Permission.ADMIN_USERS,
      });
      return NextResponse.json({ error: 'Not authorized to manage users' }, { status: 403 });
    }
    
    const body = await request.json();
    const { action, email, roles } = body;
    
    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }
    
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    
    // Validate email format
    if (!normalizedEmail.includes('@')) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    
    // Cannot modify env-defined users
    if (isEnvDefinedUser(normalizedEmail)) {
      return NextResponse.json({ 
        error: 'Cannot modify users defined in environment variables' 
      }, { status: 400 });
    }
    
    // Get current file-based users
    const fileData = getFileBasedUsersData();
    
    switch (action) {
      case 'upsert': {
        if (!roles || !Array.isArray(roles) || roles.length === 0) {
          return NextResponse.json({ error: 'roles array is required' }, { status: 400 });
        }
        
        // Validate roles
        const validRoles = Object.keys(ROLES) as RoleKey[];
        for (const role of roles) {
          if (!validRoles.includes(role)) {
            return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
          }
        }
        
        const now = new Date().toISOString();
        const existingUser = fileData.users[normalizedEmail];
        
        const userData: FileBasedUser = {
          roles: roles as RoleKey[],
          createdAt: existingUser?.createdAt || now,
          modifiedAt: now
        };
        
        fileData.users[normalizedEmail] = userData;
        
        if (!saveFileBasedUsers(fileData)) {
          return NextResponse.json({ error: 'Failed to save user data' }, { status: 500 });
        }
        
        // Log admin action
        await auditAdminAction(userEmail, request, 'user.upsert', {
          targetUser: normalizedEmail,
          roles: userData.roles,
          isNewUser: !existingUser,
        });
        
        return NextResponse.json({ 
          success: true,
          user: {
            email: normalizedEmail,
            roles: userData.roles,
            source: 'file' as const,
            createdAt: userData.createdAt,
            modifiedAt: userData.modifiedAt
          }
        });
      }
      
      case 'delete': {
        if (!fileData.users[normalizedEmail]) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        
        delete fileData.users[normalizedEmail];
        
        if (!saveFileBasedUsers(fileData)) {
          return NextResponse.json({ error: 'Failed to save user data' }, { status: 500 });
        }
        
        // Log admin action
        await auditAdminAction(userEmail, request, 'user.delete', {
          targetUser: normalizedEmail,
        });
        
        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    logger.error(error, 'Error in POST /api/admin/users');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
