import { NextResponse } from 'next/server';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { FILE_UPLOAD_LIMITS } from '@/config/constants';
import path from 'path';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('save-resource');

export async function POST(request: Request) {
    try {
        const { experienceId, path: resourcePath, content } = await request.json();
        
        logger.debug({ experienceId, resourcePath }, 'Request received');

        // Input validation
        if (!experienceId?.trim() || !resourcePath?.trim() || content === undefined) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Check content size
        const contentSize = new TextEncoder().encode(content).length;
        if (contentSize > FILE_UPLOAD_LIMITS.RESOURCE_MAX_SIZE) {
            return NextResponse.json({ error: 'Content exceeds size limit' }, { status: 400 });
        }

        const storage = StorageServiceFactory.getInstance();
        
        // Check if resourcePath already starts with experienceId
        // This handles cases where the client already includes experienceId in the path
        let fullPath;
        if (resourcePath.startsWith(`${experienceId}/`) || resourcePath === experienceId) {
            fullPath = resourcePath;
            logger.debug({ fullPath }, 'Resource path already includes experienceId, using as is');
        } else {
            fullPath = path.join(experienceId, resourcePath);
            logger.debug({ fullPath }, 'Constructed full path');
        }

        // Verify the experience directory exists by checking for experience.json
        const experienceConfigPath = path.join(experienceId, 'experience.json');
        const experienceExists = await storage.fileExists(experienceConfigPath);
        if (!experienceExists) {
            logger.warn({ experienceId }, 'Experience not found');
            return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
        }

        // Store the file
        logger.debug({ fullPath, contentLength: content.length }, 'Saving content');
        await storage.storeFile(fullPath, Buffer.from(content, 'utf8'));
        logger.debug({ fullPath }, 'File saved successfully');

        // Update lastModified timestamp in experience.json
        try {
            const configContent = await storage.readFile(experienceConfigPath);
            const config = JSON.parse(configContent.toString());
            config.lastModified = new Date().toISOString();
            await storage.storeFile(experienceConfigPath, Buffer.from(JSON.stringify(config, null, 2), 'utf8'));
            logger.debug('Updated lastModified timestamp');
        } catch (error) {
            logger.warn(error, 'Failed to update lastModified timestamp');
            // Don't fail the save operation if we can't update the timestamp
        }

        return NextResponse.json({
            success: true,
            message: 'Resource saved successfully'
        });
    } catch (error) {
        logger.error(error, 'Failed to save resource');
        return NextResponse.json(
            { error: 'Failed to save resource' },
            { status: 500 }
        );
    }
}