import packageJson from '../package.json';
import { env } from '@/config/env';

/**
 * Version information interface
 */
export interface VersionInfo {
    version: string;
    gitCommit?: string;
    gitBranch?: string;
    buildTime?: string;
    environment: string;
}

/**
 * Returns the basic package version from package.json
 */
export function getPackageVersion(): string {
    return packageJson.version;
}

/**
 * Returns comprehensive version information including git details if available
 */
export function getVersionInfo(): VersionInfo {
    return {
        version: packageJson.version,
        gitCommit: env.NEXT_PUBLIC_GIT_COMMIT_SHA || undefined,
        gitBranch: env.NEXT_PUBLIC_GIT_BRANCH || undefined,
        buildTime: env.NEXT_PUBLIC_BUILD_TIME || undefined,
        environment: env.NODE_ENV || 'development'
    };
}

/**
 * Returns a formatted version string with optional git commit hash
 * @param format The format to use: 'short', 'full', or 'commit'
 */
export function getFormattedVersion(format: 'short' | 'full' | 'commit' = 'short'): string {
    const versionInfo = getVersionInfo();

    switch (format) {
        case 'short':
            return versionInfo.version;
        case 'commit':
            return versionInfo.gitCommit
                ? `${versionInfo.version}-${versionInfo.gitCommit.substring(0, 7)}`
                : versionInfo.version;
        case 'full':
            return `${versionInfo.version}${versionInfo.gitCommit ? `-${versionInfo.gitCommit.substring(0, 7)}` : ''
                }${versionInfo.gitBranch ? ` (${versionInfo.gitBranch})` : ''
                }${versionInfo.buildTime ? ` built on ${versionInfo.buildTime}` : ''
                }`;
    }
}