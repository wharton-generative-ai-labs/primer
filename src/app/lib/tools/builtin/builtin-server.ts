'use server';

/**
 * Server-only builtin tools that require Node.js APIs.
 * These tools are only registered and executed in server-side contexts.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('builtin-server');

// Helper to get session ID (same as in builtin.ts)
function getPluginSessionId(): string {
    const SESSION_KEY = 'primer_plugin_session_id';
    
    // Try to get from sessionStorage (browser context)
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        let sessionId = sessionStorage.getItem(SESSION_KEY);
        
        if (!sessionId) {
            // Generate a new session ID if one doesn't exist
            const generateUUID = () => {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            };
            sessionId = `sess_${generateUUID()}`;
            sessionStorage.setItem(SESSION_KEY, sessionId);
        }
        
        return sessionId;
    }
    
    // Fallback for server-side or when sessionStorage is not available
    return 'sess_fallback';
}

// Internal utility for getSceneDescription tool
async function convertUrlToBase64(url: string): Promise<string> {
    // If it's a relative URL, read from the file system
    if (url.startsWith('/')) {
        const [fs, path] = await Promise.all([
            import('fs/promises'),
            import('path')
        ]);
        const publicPath = path.join(process.cwd(), 'public', url);
        const buffer = await fs.readFile(publicPath);
        
        // Detect mime type from extension
        const ext = path.extname(url).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml'
        };
        const mimeType = mimeTypes[ext] || 'image/png';
        
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }
    
    // For absolute URLs, fetch and convert
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    
    return `data:${contentType};base64,${buffer.toString('base64')}`;
}

/**
 * @tool getSceneDescription
 * @description Request a description of the image in a scene.
 * @param {object} args - The arguments for the tool
 * @param {string} args.scene - The current scene.
 * @param {object} context - The context object
 * @param {Function} context.getSceneUrl - Function to get scene URL
 * @returns {Promise<ToolResponse>} Tool response object with scene description
 */
export async function getSceneDescription({ scene }: { scene: string }, context: ToolContext): Promise<ToolResponse> {
    if (!context.getSceneUrl) {
        return {
            status: 'error',
            data: { error: 'getSceneUrl not available in context' }
        };
    }

    logger.debug({ scene }, 'getSceneDescription');

    const sceneUrl = context.getSceneUrl(scene);
    logger.debug({ sceneUrl }, 'Scene URL resolved');

    try {
        // Check if the URL is relative - if so, convert to base64
        const isLocalImage = sceneUrl.startsWith('/');
        const image_url = isLocalImage ? await convertUrlToBase64(sceneUrl) : sceneUrl;
        logger.debug({ isLocalImage, imageUrlType: isLocalImage ? 'data with base64' : 'remote url' }, 'Image URL prepared');

        const prompt = "We are transcribing images. The output is markdown. Please only output the markdown, no preamble or supplementary comments.\n\nDescribe the image.";
        const model = "gpt-4o-mini";

        // Call OpenAI directly instead of through HTTP
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI();
        
        const content: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" }> = [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url, detail: "auto" as const }
        ];

        const response = await openai.responses.create({
            model,
            input: [{ role: "user", content }]
        });

        const outputContent = response.output;

        logger.debug({ outputLength: outputContent?.length }, 'OpenAI Response received');

        return {
            status: 'success',
            data: outputContent
        } as ToolResponse;
    } catch (error) {
        return {
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Failed to get scene description' }
        } as ToolResponse;
    }
}

/**
 * @tool listUploadedFiles
 * @description List all files that have been uploaded by users.
 * @param {object} args - The arguments for the tool
 * @param {object} context - The context object
 * @param {string} context.experienceId - The ID of the current experience
 * @returns {Promise<ToolResponse>} Tool response object with list of files
 */
export async function listUploadedFiles(_args: Record<string, never>, context: ToolContext): Promise<ToolResponse> {
    if (!context.experienceId) {
        return {
            status: 'error',
            data: { error: 'experienceId not available in context' }
        };
    }

    logger.debug({ experienceId: context.experienceId }, 'listUploadedFiles executing');

    try {
        const sessionId = getPluginSessionId();
        
        // Dynamic imports for server-side modules
        const [
            { StorageServiceFactory },
            { getSessionUploadPath, getFileInfoUrl },
            path
        ] = await Promise.all([
            import('@/app/lib/storage/StorageServiceFactory'),
            import('@/app/lib/file-utils'),
            import('path')
        ]);
        
        const storage = StorageServiceFactory.getInstance();
        const basePath = getSessionUploadPath(context.experienceId, sessionId);
        
        logger.debug({ basePath }, 'List files base path');
        
        // Check if directory exists
        const exists = await storage.fileExists(basePath);
        if (!exists) {
            return {
                status: 'success',
                data: []
            };
        }

        const files = await storage.listFiles(basePath);

        // Get file info for each file
        const fileInfos = await Promise.all(
            files.map(async (filePath) => {
                const stats = await storage.getFileStats(filePath);
                if (!stats) return null;

                const fileName = path.basename(filePath);
                const uploadId = path.basename(filePath, path.extname(filePath));
                const fileInfoUrl = getFileInfoUrl(fileName);

                return {
                    success: true,
                    fileInfoUrl,
                    uploadId,
                    fileName,
                    fileType: path.extname(filePath).slice(1), // Remove the dot
                    fileSize: stats.size
                };
            })
        );

        // Filter out any null values from files that couldn't be processed
        const validFileInfos = fileInfos.filter((info): info is NonNullable<typeof info> => info !== null);

        return {
            status: 'success',
            data: validFileInfos
        };
    } catch (error) {
        logger.error(error, 'Error listing files');
        return {
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Failed to list files' }
        };
    }
}

/**
 * @tool getFileInfo
 * @description Get the content and metadata for an uploaded file. If the user says they uploaded a file, or you don't think you received one yet, check this.
 * @param {object} args - The arguments for the tool
 * @param {string} args.fileInfoUrl - The file info URL returned from the upload endpoint.
 * @param {object} context - The context object
 * @param {string} context.experienceId - The ID of the current experience
 * @returns {Promise<ToolResponse>} Tool response object with file info
 */
export async function getFileInfo(args: { fileInfoUrl: string }, context: ToolContext): Promise<ToolResponse> {
    if (!context.experienceId) {
        return {
            status: 'error',
            data: { error: 'experienceId not available in context' }
        };
    }

    logger.debug({ fileInfoUrl: args.fileInfoUrl }, 'getFileInfo');

    try {
        const sessionId = getPluginSessionId();
        
        // Extract filename from URL (format: /api/file-info/{fileName})
        const fileName = args.fileInfoUrl.split('/').pop();
        if (!fileName) {
            throw new Error('Invalid fileInfoUrl: could not extract filename');
        }
        
        // Dynamic imports for server-side modules
        const [
            { StorageServiceFactory },
            { getSessionUploadPath },
            path,
            { FileProcessor }
        ] = await Promise.all([
            import('@/app/lib/storage/StorageServiceFactory'),
            import('@/app/lib/file-utils'),
            import('path'),
            import('@/app/lib/fileProcessing/FileProcessor')
        ]);
        
        const basePath = getSessionUploadPath(context.experienceId, sessionId);
        const filePath = path.join(basePath, fileName);
        
        const storage = StorageServiceFactory.getInstance();
        
        // Check if file exists
        const exists = await storage.fileExists(filePath);
        if (!exists) {
            throw new Error('File not found');
        }

        // Process the file using FileProcessor
        const fileProcessor = new FileProcessor(storage);
        const analysis = await fileProcessor.processFile(filePath);

        return {
            status: 'success',
            data: {
                success: true,
                filePath,
                ...analysis
            }
        };
    } catch (error) {
        return {
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Failed to get file info' }
        };
    }
}

