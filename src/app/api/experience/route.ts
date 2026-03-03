import { NextRequest, NextResponse } from 'next/server';
import { ExperienceManagementService } from '@/app/lib/experience/ExperienceManagementService';
import { getToken } from 'next-auth/jwt';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('experience');

export async function POST(request: NextRequest) {
    try {
        // Verify authentication
        const token = await getToken({ req: request });
        if (!token?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, experienceId, path, content, contentEncoding, sourcePath, destinationPath, templateExperienceId, newExperienceId } = await request.json();

        if (!experienceId && !newExperienceId) {
            return NextResponse.json({ error: 'Experience ID is required' }, { status: 400 });
        }

        const experienceService = new ExperienceManagementService();

        switch (action) {
            case 'create':
                await experienceService.createExperience(experienceId);
                return NextResponse.json({ success: true });

            case 'copyTemplate':
                if (!templateExperienceId || !newExperienceId) {
                    return NextResponse.json({ error: 'Template experience ID and new experience ID are required' }, { status: 400 });
                }
                await experienceService.copyTemplate(templateExperienceId, newExperienceId);
                return NextResponse.json({ success: true });

            case 'delete':
                await experienceService.deleteExperience(experienceId);
                return NextResponse.json({ success: true });

            case 'createDirectory':
                if (!path) {
                    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
                }
                await experienceService.createDirectory(experienceId, path);
                return NextResponse.json({ success: true });

            case 'deleteDirectory':
                if (!path) {
                    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
                }
                await experienceService.deleteDirectory(experienceId, path);
                return NextResponse.json({ success: true });

            case 'createFile':
                if (!path || content === undefined) {
                    return NextResponse.json({ error: 'Path and content are required' }, { status: 400 });
                }
                
                // Handle different content encodings
                let buffer: Buffer;
                
                if (contentEncoding === 'base64') {
                    // For base64-encoded content (binary files), decode it first
                    buffer = Buffer.from(content, 'base64');
                } else {
                    // For regular text content, use UTF-8 encoding
                    buffer = Buffer.from(content, 'utf-8');
                }
                
                await experienceService.createFile(experienceId, path, buffer);
                return NextResponse.json({ success: true });

            case 'deleteFile':
                if (!path) {
                    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
                }
                await experienceService.deleteFile(experienceId, path);
                return NextResponse.json({ success: true });

            case 'moveFile':
                if (!sourcePath || !destinationPath) {
                    return NextResponse.json({ error: 'Source and destination paths are required' }, { status: 400 });
                }
                await experienceService.moveFile(experienceId, sourcePath, destinationPath);
                return NextResponse.json({ success: true });

            case 'moveDirectory':
                if (!sourcePath || !destinationPath) {
                    return NextResponse.json({ error: 'Source and destination paths are required' }, { status: 400 });
                }
                await experienceService.moveDirectory(experienceId, sourcePath, destinationPath);
                return NextResponse.json({ success: true });

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        logger.error(error, 'Experience management error');
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to perform operation' },
            { status: 500 }
        );
    }
} 