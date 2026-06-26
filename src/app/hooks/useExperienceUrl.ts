import { useCallback } from 'react';
import { usePathname } from 'next/navigation';

export function useExperienceUrl() {
    const pathname = usePathname();

    const updateUrl = useCallback((experienceId: string) => {
        const newUrl = `/play/${experienceId}`;
        window.history.replaceState({}, '', newUrl);
    }, []);

    const resetUrl = useCallback(() => {
        window.history.replaceState({}, '', '/');
    }, []);

    const getExperienceId = useCallback(() => {
        // Extract experienceId from the path
        if (pathname.startsWith('/play/')) {
            const pathParts = pathname.split('/');
            if (pathParts.length >= 3 && pathParts[2]) {
                return pathParts[2];
            }
        }
        
        return null;
    }, [pathname]);

    return {
        updateUrl,
        resetUrl,
        getExperienceId,
    };
}