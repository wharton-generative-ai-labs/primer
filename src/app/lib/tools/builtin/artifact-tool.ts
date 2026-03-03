/**
 * Artifact Management Tool
 * 
 * Manages artifacts (documents, images, files) that can be created,
 * edited, and displayed during experiences.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('artifact-tool');

/**
 * @tool artifact
 * @description Manage artifact files (documents, images, etc.). Artifacts are for FILE STORAGE AND RETRIEVAL only. Use 'list' to see all artifacts, 'get' to retrieve content, 'create' to store new files, 'edit' to update content, 'delete' to remove files. To DISPLAY artifact content to users, retrieve it with 'get' and then use the 'slide' tool to present it.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'list', 'get', 'create', 'edit', 'delete'
 * @param {string} args.name - Required for 'create'. Name of the artifact
 * @param {string} args.id - Required for 'get', 'edit', 'delete'. ID of the artifact
 * @param {string} args.content - Required for 'create' and 'edit'. Content of the artifact
 * @param {string} args.type - Optional for 'create'. Type of the artifact (default: 'markdown'). Accepts both short forms (jsx, tsx, markdown) and MIME types (text/jsx, text/tsx, text/markdown). Supported types: markdown, checklist, javascript, jsx, typescript, tsx, text/jsx, text/tsx, application/javascript, application/typescript, png, jpg, jpeg, gif, svg, pdf, zip, and other common MIME types.
 * @param {object} context - The context object
 * @param {Function} context.listArtifacts - Function to list artifacts
 * @param {Function} context.getArtifact - Function to get an artifact by ID
 * @param {Function} context.createArtifact - Function to create an artifact
 * @param {Function} context.deleteArtifact - Function to delete an artifact
 * @param {string} context.experienceId - The ID of the current experience
 * @param {string} context.functionCallId - The ID of the current function call
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function artifact(args: {
    action: 'list' | 'get' | 'create' | 'edit' | 'delete',
    name?: string,
    id?: string,
    content?: string,
    type?: string, // Accept any string to allow MIME types
    metadata?: {
        description?: string;
        tags?: string[];
        presentation?: {
            type: 'slide' | 'editor' | 'checklist' | 'none';
            options?: Record<string, any>;
        };
    };
}, context: ToolContext): Promise<ToolResponse> {
    logger.debug({ args, action: args.action }, 'artifact function called');

    if (!context.listArtifacts || !context.createArtifact || !context.deleteArtifact || !context.updateArtifact || !context.experienceId || !context.functionCallId) {
        logger.warn('artifact function missing required context functions');
        return {
            status: 'error',
            data: { error: 'Required context functions not available' }
        };
    }

    try {
        switch (args.action) {
            case 'list': {
                logger.debug('artifact function executing "list" action');
                const artifacts = await context.listArtifacts();
                logger.debug({ count: artifacts.length }, 'artifact function "list" result');
                return {
                    status: 'success',
                    data: artifacts
                };
            }

            case 'get': {
                logger.debug({ id: args.id }, 'artifact function executing "get" action');
                if (!args.id) {
                    logger.warn('artifact function "get" error: no ID provided');
                    return {
                        status: 'error',
                        data: { error: 'Artifact ID is required for getting an artifact' }
                    };
                }

                if (!context.getArtifact) {
                    logger.warn('artifact function "get" error: getArtifact function not available');
                    return {
                        status: 'error',
                        data: { error: 'getArtifact function not available in context' }
                    };
                }

                const artifact = await context.getArtifact(args.id);
                logger.debug({ id: artifact.id, name: artifact.name }, 'artifact function "get" result');
                return {
                    status: 'success',
                    data: artifact
                };
            }

            case 'create': {
                logger.debug({ name: args.name }, 'artifact function executing "create" action');
                if (!args.name) {
                    logger.warn('artifact function "create" error: no name provided');
                    return {
                        status: 'error',
                        data: { error: 'Name is required for creating an artifact' }
                    };
                }

                if (!args.content) {
                    logger.warn('artifact function "create" error: no content provided');
                    return {
                        status: 'error',
                        data: { error: 'Content is required for creating an artifact' }
                    };
                }

                // If type is checklist, ensure content is markdown with checkboxes
                const type = args.type || 'markdown';
                if (type === 'checklist' && !args.content.includes('- [ ]')) {
                    logger.warn('artifact function "create" error: checklist must contain checkboxes');
                    return {
                        status: 'error',
                        data: { error: 'Checklist artifacts must contain markdown checkboxes (- [ ])' }
                    };
                }

                // Create the artifact with the base parameters
                const artifact = await context.createArtifact(args.name, args.content, type);
                logger.debug({ id: artifact.id, name: artifact.name }, 'artifact function "create" result');

                // If metadata is provided, update the artifact with it
                if (args.metadata) {
                    await context.updateArtifact(artifact.id, args.content);
                }

                return {
                    status: 'success',
                    data: artifact
                };
            }

            case 'edit': {
                logger.debug({ id: args.id }, 'artifact function executing "edit" action');
                if (!args.id) {
                    logger.warn('artifact function "edit" error: no ID provided');
                    return {
                        status: 'error',
                        data: { error: 'Artifact ID is required for editing an artifact' }
                    };
                }

                if (!args.content) {
                    logger.warn('artifact function "edit" error: no content provided');
                    return {
                        status: 'error',
                        data: { error: 'Content is required for editing an artifact' }
                    };
                }

                // Update the artifact content
                await context.updateArtifact(args.id, args.content);
                logger.debug({ id: args.id }, 'artifact function "edit" completed');

                return {
                    status: 'success',
                    data: { message: `Artifact ${args.id} has been updated` }
                };
            }

            case 'delete': {
                logger.debug({ id: args.id }, 'artifact function executing "delete" action');
                if (!args.id) {
                    logger.warn('artifact function "delete" error: no ID provided');
                    return {
                        status: 'error',
                        data: { error: 'Artifact ID is required for deleting an artifact' }
                    };
                }

                await context.deleteArtifact(args.id);
                logger.debug({ id: args.id }, 'artifact function "delete" completed');

                return {
                    status: 'success',
                    data: { message: `Artifact ${args.id} has been deleted` }
                };
            }

            default:
                return {
                    status: 'error',
                    data: { error: `Invalid action: ${args.action}. Valid actions are: list, get, create, edit, delete` }
                };
        }
    } catch (error) {
        return {
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'An error occurred while processing the artifact' }
        };
    }
}

