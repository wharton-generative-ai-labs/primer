import { createModuleLogger } from '@/lib/logger';
import { env } from '@/config/env';

const logger = createModuleLogger('auth');

// Define permissions as constants for consistency
export enum Permission {
    PLAY_EXPERIENCE = 'play:experience',
    CREATE_EXPERIENCE = 'create:experience', 
    UPLOAD_EXPERIENCE = 'upload:experience',
    EDIT_ANY_EXPERIENCE = 'edit:any_experience', // Edit any experience (admin/editor/tester)
    EDIT_OWN_EXPERIENCE = 'edit:own_experience', // Edit only experiences you authored (educator)
    DUPLICATE_EXPERIENCE = 'duplicate:experience',
    DELETE_EXPERIENCE = 'delete:experience',
    LIST_EXPERIENCES = 'list:experiences',
    VIEW_ALL_EXPERIENCES = 'view:all_experiences', // See all experiences in catalog (admin/editor/tester)
    SWITCH_AGENTS = 'switch:agent',
    VIEW_TECHNICAL = 'view:technical',
    ENABLE_DEBUG = 'enable:debug',
    VIEW_SCRIPT = 'view:script',
    MANAGE_OWN_CLASS_MEMBERS = 'manage:own_class_members', // Manage class members for own experiences
    MANAGE_OWN_CLASSES = 'manage:own_classes', // Manage classes for own experiences
    MANAGE_ANY_CLASS_MEMBERS = 'manage:any_class_members', // Manage class members for any experience (admin)
    MANAGE_ANY_CLASSES = 'manage:any_classes', // Manage classes for any experience (admin)
    ADMIN_USERS = 'admin:users', // Administer user accounts and roles
    MAGIC = 'use:magic',
}

// Define valid role keys
// Note: ADD_MAGIC is an additive role meant to be combined with other roles
export type RoleKey = 'PLAYER' | 'EDUCATOR' | 'EDITOR' | 'TESTER' | 'ADMIN' | 'ADD_MAGIC';

// Define role interface and roles
export interface Role {
    key: RoleKey;
    permissions: Permission[];
}

// Roles database
// Note: Roles are all-encompassing (not additive) except for ADD_MAGIC which is meant to be combined
export const ROLES: Record<RoleKey, Role> = {
    PLAYER: {
        key: 'PLAYER',
        permissions: [
            Permission.PLAY_EXPERIENCE,
            Permission.LIST_EXPERIENCES,
        ]
    },
    EDUCATOR: {
        key: 'EDUCATOR',
        permissions: [
            Permission.PLAY_EXPERIENCE,
            Permission.CREATE_EXPERIENCE,
            Permission.UPLOAD_EXPERIENCE,
            Permission.EDIT_OWN_EXPERIENCE,
            Permission.DUPLICATE_EXPERIENCE,
            Permission.LIST_EXPERIENCES,
            Permission.MANAGE_OWN_CLASSES,
            Permission.MANAGE_OWN_CLASS_MEMBERS,
        ]
    },
    EDITOR: {
        key: 'EDITOR',
        permissions: [
            Permission.PLAY_EXPERIENCE,
            Permission.LIST_EXPERIENCES,
            Permission.VIEW_ALL_EXPERIENCES,
            Permission.DUPLICATE_EXPERIENCE,
            Permission.EDIT_ANY_EXPERIENCE,
            Permission.SWITCH_AGENTS,
            Permission.VIEW_TECHNICAL
        ]
    },
    TESTER: {
        key: 'TESTER',
        permissions: [
            Permission.PLAY_EXPERIENCE,
            Permission.LIST_EXPERIENCES,
            Permission.VIEW_ALL_EXPERIENCES,
            Permission.CREATE_EXPERIENCE,
            Permission.UPLOAD_EXPERIENCE,
            Permission.DUPLICATE_EXPERIENCE,
            Permission.EDIT_ANY_EXPERIENCE,
            Permission.SWITCH_AGENTS,
            Permission.VIEW_TECHNICAL,
            Permission.ENABLE_DEBUG,
        ]
    },
    ADMIN: {
        key: 'ADMIN',
        permissions: [
            Permission.PLAY_EXPERIENCE,
            Permission.CREATE_EXPERIENCE,
            Permission.UPLOAD_EXPERIENCE,
            Permission.EDIT_ANY_EXPERIENCE,
            Permission.DUPLICATE_EXPERIENCE,
            Permission.DELETE_EXPERIENCE,
            Permission.LIST_EXPERIENCES,
            Permission.VIEW_ALL_EXPERIENCES,
            Permission.SWITCH_AGENTS,
            Permission.VIEW_TECHNICAL,
            Permission.ENABLE_DEBUG,
            Permission.VIEW_SCRIPT,
            Permission.MANAGE_ANY_CLASS_MEMBERS,
            Permission.MANAGE_ANY_CLASSES,
            Permission.ADMIN_USERS
        ]
    },
    ADD_MAGIC: {
        key: 'ADD_MAGIC',
        permissions: [
            Permission.MAGIC
        ]
    }
};

// Type for user role mappings
type UserRoleMappings = Record<string, RoleKey[]>;

// Parse user role mappings from environment variable
// This works in both Edge Runtime and Node.js
const parseEnvUserRoleMappings = (): Record<string, Role[]> => {
    if (typeof window !== 'undefined') {
        return {};
    }

    try {
        const mappings = JSON.parse(env.USER_ROLE_MAPPINGS || '{}') as UserRoleMappings;
        const result: Record<string, Role[]> = {};
        
        Object.entries(mappings).forEach(([email, roleKeys]) => {
            result[email] = roleKeys.map(key => ROLES[key]);
        });
        
        return result;
    } catch (error) {
        logger.error(error, 'Failed to parse USER_ROLE_MAPPINGS');
        return {};
    }
};

// Get env-defined user emails (for checking if user is from env)
export const getEnvDefinedUserEmails = (): Set<string> => {
    if (typeof window !== 'undefined') {
        return new Set();
    }
    
    try {
        const mappings = JSON.parse(env.USER_ROLE_MAPPINGS || '{}') as UserRoleMappings;
        return new Set(Object.keys(mappings));
    } catch {
        return new Set();
    }
};

// Check if a user is defined in the environment variable
export const isEnvDefinedUser = (email: string): boolean => {
    return getEnvDefinedUserEmails().has(email);
};

// User roles table from environment variable
// This is used by middleware and is Edge Runtime compatible
export const USER_ROLES: Record<string, Role[]> = parseEnvUserRoleMappings();

// Server-side only helper functions
export const getUserRoles = (userEmail: string): Role[] => {
    if (typeof window !== 'undefined') {
        return [];
    }
    return USER_ROLES[userEmail] || [];
};

export const getUserPrivileges = (userEmail: string): Permission[] => {
    if (typeof window !== 'undefined') {
        return [];
    }
    const userRoles = USER_ROLES[userEmail];
    if (!userRoles) {
        return [];
    }
    const permissionSet = new Set<Permission>();

    userRoles.forEach(role => {
        role.permissions.forEach(permission => {
            permissionSet.add(permission);
        });
    });

    return Array.from(permissionSet);
};

export const hasPermission = (userEmail: string, permission: Permission): boolean => {
    if (typeof window !== 'undefined') {
        return false;
    }
    const userRoles = USER_ROLES[userEmail];
    if (!userRoles) {
        return false;
    }
    return userRoles.some(role =>
        role.permissions.includes(permission)
    );
};

export const hasRole = (userEmail: string, roleKey: RoleKey): boolean => {
    if (typeof window !== 'undefined') {
        return false;
    }
    const userRoles = USER_ROLES[userEmail];
    if (!userRoles) {
        return false;
    }
    return userRoles.some(role => role.key === roleKey);
};
