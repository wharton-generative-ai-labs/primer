/**
 * ExperienceIdExtractor
 * 
 * Utility for extracting experience IDs from configuration paths.
 * Handles various path formats.
 */

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ExperienceIdExtractor');

export class ExperienceIdExtractor {
    /**
     * Extract experience ID from a configuration path
     * 
     * Handles paths like:
     * - /api/storage/{experienceId}/experience.json
     * - /path/to/{experienceId}/experience.json
     * 
     * @throws Error if experience ID cannot be extracted
     */
    static extract(configPath: string): string {
        // Handle paths like /api/storage/{experienceId}/experience.json
        const apiStorageMatch = configPath.match(/\/api\/storage\/([^\/]+)\/experience\.json$/);
        if (apiStorageMatch) {
            const experienceId = apiStorageMatch[1];
            logger.debug({ configPath, experienceId }, 'Extracted experience ID from API storage path');
            return experienceId;
        }
        
        // Handle other possible formats, extract from the path before /experience.json
        const parts = configPath.split('/');
        const experienceJsonIndex = parts.findIndex(part => part === 'experience.json');
        if (experienceJsonIndex > 0) {
            const experienceId = parts[experienceJsonIndex - 1];
            logger.debug({ configPath, experienceId }, 'Extracted experience ID from generic path');
            return experienceId;
        }
        
        // Fallback: throw error if we can't extract experience ID
        logger.error({ configPath }, 'Could not extract experience ID from config path');
        throw new Error(`Could not extract experience ID from config path: ${configPath}`);
    }
}

