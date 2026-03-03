/**
 * File Management Tool
 * 
 * Manages user file uploads and file operations.
 * Provides actions to list, retrieve, and request file uploads.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { getExistingSessionId } from '@/app/lib/session-utils';

// Note: The file tool uses getExistingSessionId() from session-utils
// instead of managing its own session storage

/**
 * @tool file
 * @description Manage user file uploads. Use 'listUploaded' to see uploaded files, 'getInfo' to read file content, 'requestUpload' to ask for a file.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'listUploaded', 'getInfo', 'requestUpload'
 * @param {string} args.fileInfoUrl - File info URL (required for getInfo)
 * @param {string} args.prompt - Prompt to show user (required for requestUpload)
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function file(args: {
    action: 'listUploaded' | 'getInfo' | 'requestUpload';
    fileInfoUrl?: string;
    prompt?: string;
}, context: ToolContext): Promise<ToolResponse> {
    switch (args.action) {
        case 'listUploaded': {
            // Client-side: call the HTTP API endpoint
            // Server-side: register.ts routes to serverTools.listUploadedFiles directly
            if (!context.experienceId) {
                return {
                    status: 'error',
                    data: { error: 'experienceId not available in context' }
                };
            }

            const sessionId = getExistingSessionId();
            if (!sessionId) {
                return {
                    status: 'error',
                    data: { error: 'No active session. File operations require an active experience session.' }
                };
            }

            try {
                const response = await fetch('/api/user-upload/list', {
                    method: 'GET',
                    headers: {
                        'x-experience-id': context.experienceId,
                        'x-session-id': sessionId,
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    return {
                        status: 'error',
                        data: { error: errorData.error || `Failed to list files: ${response.status}` }
                    };
                }

                const files = await response.json();
                return {
                    status: 'success',
                    data: files
                };
            } catch (error) {
                return {
                    status: 'error',
                    data: { error: error instanceof Error ? error.message : 'Failed to list files' }
                };
            }
        }

        case 'getInfo': {
            // Client-side: call the HTTP API endpoint
            // Server-side: register.ts routes to serverTools.getFileInfo directly
            if (!context.experienceId) {
                return {
                    status: 'error',
                    data: { error: 'experienceId not available in context' }
                };
            }
            if (!args.fileInfoUrl) {
                return {
                    status: 'error',
                    data: { error: 'fileInfoUrl is required for getInfo action' }
                };
            }

            const sessionIdForGetInfo = getExistingSessionId();
            if (!sessionIdForGetInfo) {
                return {
                    status: 'error',
                    data: { error: 'No active session. File operations require an active experience session.' }
                };
            }

            try {
                // The fileInfoUrl is in format /api/file-info/{fileName}
                const response = await fetch(args.fileInfoUrl, {
                    method: 'GET',
                    headers: {
                        'x-experience-id': context.experienceId,
                        'x-session-id': sessionIdForGetInfo,
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    return {
                        status: 'error',
                        data: { error: errorData.error || `Failed to get file info: ${response.status}` }
                    };
                }

                const fileInfo = await response.json();
                return {
                    status: 'success',
                    data: fileInfo
                };
            } catch (error) {
                return {
                    status: 'error',
                    data: { error: error instanceof Error ? error.message : 'Failed to get file info' }
                };
            }
        }

        case 'requestUpload': {
            if (!context.showFileUpload || !context.functionCallId) {
                return {
                    status: 'error',
                    data: { error: 'showFileUpload or functionCallId not available in context' }
                };
            }
            if (!args.prompt) {
                return {
                    status: 'error',
                    data: { error: 'prompt is required for requestUpload action' }
                };
            }
            context.showFileUpload(args.prompt, context.functionCallId);
            return {
                status: 'success',
                data: { message: 'Waiting for user file upload' }
            };
        }

        default:
            return {
                status: 'error',
                data: { error: `Invalid action: ${args.action}. Valid actions are: listUploaded, getInfo, requestUpload` }
            };
    }
}

