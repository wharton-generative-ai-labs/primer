import { useSession } from 'next-auth/react';
import { Permission } from '@/config/auth';
import { useCallback } from 'react';
import { getDevAuthPrivileges, isDevAuthBypassEnabled } from '@/lib/devAuth';

export function usePermissions() {
    const { data: session } = useSession();
    const bypassEnabled = isDevAuthBypassEnabled();
    const privileges = session?.user?.privileges || (bypassEnabled ? getDevAuthPrivileges() : []);

    const can = useCallback((permission: Permission): boolean => {
        if (!session?.user && !bypassEnabled) {
            return false;
        }
        return privileges.includes(permission);
    }, [session, privileges, bypassEnabled]);

    const cannot = useCallback((permission: Permission): boolean => {
        return !can(permission);
    }, [can]);

    return {
        can,
        cannot,
        isAuthenticated: !!session?.user || bypassEnabled,
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
