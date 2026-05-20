import { NextResponse } from 'next/server';
import { StorageServiceFactory } from '@/app/lib/storage/StorageServiceFactory';
import { getContentType } from '@/app/lib/mimeTypes';
import { createModuleLogger } from '@/lib/logger';
import path from 'path';
import { assertSafeExperienceId, assertSafeRelativePath } from '@/app/lib/file-utils';

const logger = createModuleLogger('resource-content');

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const experienceId = searchParams.get('experienceId');
    const resourcePath = searchParams.get('path');

    if (!experienceId || !resourcePath) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let fullPath: string;
    try {
        assertSafeExperienceId(experienceId);
        const relative = resourcePath.startsWith(`${experienceId}/`)
            ? resourcePath.slice(experienceId.length + 1)
            : resourcePath;
        assertSafeRelativePath(relative);
        fullPath = path.join(experienceId, relative);
    } catch (validationError) {
        logger.warn({ err: validationError, experienceId, resourcePath }, 'Rejected unsafe resource-content request');
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    try {
        const storage = StorageServiceFactory.getInstance();

        // Check if file exists
        const exists = await storage.fileExists(fullPath);
        if (!exists) {
            logger.debug({ fullPath, experienceId, resourcePath }, 'Resource not found');
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        // Get the content type based on file extension
        const ext = path.extname(resourcePath);
        const contentType = getContentType(ext);
        const isText = contentType.startsWith('text/') || 
                      contentType === 'application/json' ||
                      contentType === 'application/javascript' ||
                      contentType === 'application/typescript';

        // For text files, return the content directly
        if (isText) {
            const content = await storage.readFileAsText(fullPath);
            return NextResponse.json({ 
                content,
                contentType,
                isText: true
            });
        }

        // For binary files (images, etc), return a URL to access the file
        const fileUrl = `/api/storage/${fullPath}`;
        return NextResponse.json({
            contentType,
            isText: false,
            fileUrl
        });

    } catch (error) {
        logger.error({ err: error, experienceId, resourcePath }, 'Failed to get resource content');
        return NextResponse.json(
            { error: 'Failed to load resource' },
            { status: 500 }
        );
    }
}