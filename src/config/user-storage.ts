/**
 * Server-only user storage utilities
 * This file uses Node.js APIs and should NOT be imported in middleware or client code
 */

import * as fs from 'fs';
import * as path from 'path';
import { RoleKey, ROLES, Role, Permission, isEnvDefinedUser } from './auth';
import { createModuleLogger } from '@/lib/logger';
import { env } from '@/config/env';

const logger = createModuleLogger('user-storage');

// File-based user storage interface
export interface FileBasedUser {
    roles: RoleKey[];
    createdAt: string;
    modifiedAt: string;
}

export interface FileBasedUsersData {
    users: Record<string, FileBasedUser>;
}

// Path to file-based users storage
const getUsersFilePath = (): string => {
    // Use STORAGE_ROOT_PATH environment variable if set, otherwise default to process.cwd()/storage
    const storageRoot = env.STORAGE_ROOT_PATH || path.join(process.cwd(), 'storage');
    return path.join(storageRoot, 'config', 'users.json');
};

// Load file-based users
export const loadFileBasedUsers = (): FileBasedUsersData => {
    try {
        const filePath = getUsersFilePath();
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content) as FileBasedUsersData;
        }
    } catch (error) {
        logger.error(error, 'Failed to load file-based users');
    }
    
    return { users: {} };
};

// Save file-based users
export const saveFileBasedUsers = (data: FileBasedUsersData): boolean => {
    try {
        const filePath = getUsersFilePath();
        const dirPath = path.dirname(filePath);
        
        // Ensure directory exists
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        logger.error(error, 'Failed to save file-based users');
        return false;
    }
};

// Get file-based users data (for API use)
export const getFileBasedUsersData = (): FileBasedUsersData => {
    return loadFileBasedUsers();
};

// Get merged user roles (env + file-based)
// This combines both sources, with env taking precedence
export const getMergedUserRoles = (): Record<string, Role[]> => {
    // Parse env users
    const envMappings = JSON.parse(env.USER_ROLE_MAPPINGS || '{}') as Record<string, RoleKey[]>;
    const result: Record<string, Role[]> = {};
    
    // Add env users first
    Object.entries(envMappings).forEach(([email, roleKeys]) => {
        result[email] = roleKeys.map(key => ROLES[key]);
    });
    
    // Add file-based users (only if not in env)
    const fileData = loadFileBasedUsers();
    Object.entries(fileData.users).forEach(([email, userData]) => {
        if (!result[email]) {
            result[email] = userData.roles.map(key => ROLES[key]);
        }
    });
    
    return result;
};

// Check if a user exists (in either env or file-based storage)
export const userExists = (email: string): boolean => {
    if (isEnvDefinedUser(email)) {
        return true;
    }
    const fileData = loadFileBasedUsers();
    return email in fileData.users;
};

// Get user roles from merged sources
export const getMergedUserRolesForUser = (email: string): Role[] => {
    const allUsers = getMergedUserRoles();
    return allUsers[email] || [];
};

// Get user privileges from merged sources
export const getMergedUserPrivileges = (email: string): Permission[] => {
    const roles = getMergedUserRolesForUser(email);
    const permissionSet = new Set<Permission>();
    
    roles.forEach(role => {
        role.permissions.forEach(permission => {
            permissionSet.add(permission);
        });
    });
    
    return Array.from(permissionSet);
};

// Check if user has permission (from merged sources)
export const hasMergedPermission = (email: string, permission: Permission): boolean => {
    const roles = getMergedUserRolesForUser(email);
    return roles.some(role => role.permissions.includes(permission));
};

// Check if user has a specific role (from merged sources)
export const hasMergedRole = (email: string, roleKey: RoleKey): boolean => {
    const roles = getMergedUserRolesForUser(email);
    return roles.some(role => role.key === roleKey);
};

