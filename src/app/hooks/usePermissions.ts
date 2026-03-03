import { useSession } from 'next-auth/react';
import { Permission } from '@/config/auth';
import { useCallback } from 'react';

export function usePermissions() {
    const { data: session } = useSession();
    const privileges = session?.user?.privileges || [];

    const can = useCallback((permission: Permission): boolean => {
        if (!session?.user) {
            return false;
        }
        return privileges.includes(permission);
    }, [session, privileges]);

    const cannot = useCallback((permission: Permission): boolean => {
        return !can(permission);
    }, [can]);

    return {
        can,
        cannot,
        isAuthenticated: !!session?.user,
        // Expose privileges for cases where you need to check multiple permissions efficiently
        privileges,
        // Helper methods for checking multiple permissions
        canAny: useCallback((permissions: Permission[]): boolean => {
            return permissions.some(can);
        }, [can]),
        canAll: useCallback((permissions: Permission[]): boolean => {
            return permissions.every(can);
        }, [can])
    };
}