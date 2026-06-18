/**
 * Artifact Management Tool
 * 
 * Manages artifacts (documents, images, files) that can be created,
 * edited, and displayed during experiences.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';
import { ARTIFACT_SCAFFOLDS, getScaffold, isScaffoldedType } from './artifact-scaffolds';

const logger = createModuleLogger('artifact-tool');

/**
 * @tool artifact
 * @description Manage artifact files (documents, images, etc.). Artifacts are for FILE STORAGE AND RETRIEVAL only. Use 'list' to see all artifacts, 'get' to retrieve content, 'create' to store new files, 'edit' to update content, 'delete' to remove files. This tool has no display action; the slide tool is what renders content in the document panel.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'list', 'get', 'create', 'edit', 'delete'
 * @param {string} args.name - Required for 'create'. Name of the artifact
 * @param {string} args.id - Required for 'get', 'edit', 'delete'. ID of the artifact
 * @param {string} args.content - Required for 'edit'. Required for 'create' UNLESS `type` is a scaffolded type (journal, design-document, transcript, process-notes, feedback-debrief, checklist), in which case the tool seeds the artifact with a starter markdown scaffold and returns `scaffolded: true`.
 * @param {string} args.type - Optional for 'create'. Type of the artifact (default: 'markdown'). Accepts both short forms (jsx, tsx, markdown) and MIME types (text/jsx, text/tsx, text/markdown). Supported types: markdown, checklist, javascript, jsx, typescript, tsx, text/jsx, text/tsx, application/javascript, application/typescript, png, jpg, jpeg, gif, svg, pdf, zip, and other common MIME types.
 * @param {number} args.rev - Optional for 'get'. Pass a specific revision number to read a past version of the artifact; omit to read the latest. Combine with the `focusedRev` field returned by the `observe` tool to fetch the exact content the user is currently looking at when they're browsing history.
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
    // The registered OpenAI enum is locked at the five storage actions
    // (list/get/create/edit/delete). The union is intentionally widened here
    // to also recognize the realtime model's two known misroutes
    // ('showArtifact' and the legacy 'show') so the default-case branch can
    // emit a fully-formed correction back to the agent. See QA history in
    // `Experience Creator QA.md` and `experience_creator_qa_round1_fixes.plan.md`.
    action: 'list' | 'get' | 'create' | 'edit' | 'delete' | 'showArtifact' | 'show' | string,
    name?: string,
    id?: string,
    content?: string,
    type?: string, // Accept any string to allow MIME types
    rev?: number, // Optional for 'get': read a specific past revision
    // Not a typed field on the artifact tool — but the misrouting realtime
    // model passes it anyway when it conflates this with the slide tool.
    // Accept it so the recovery error can echo it back in the corrected call.
    artifactId?: string,
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

                const artifact = await context.getArtifact(args.id, undefined, args.rev);
                logger.debug({ id: artifact?.id, name: artifact?.name, rev: args.rev }, 'artifact function "get" result');
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

                const type = args.type || 'markdown';

                // When content is omitted and the type has a registered scaffold,
                // synthesize the scaffold so the artifact starts with section
                // headings the agent fills in. The agent gets `scaffolded: true`
                // back so it knows to update the artifact rather than treat the
                // create as final.
                let content = args.content;
                let scaffolded = false;
                if ((content === undefined || content === '') && isScaffoldedType(type)) {
                    const scaffold = getScaffold(type, args.name);
                    if (scaffold !== null) {
                        content = scaffold;
                        scaffolded = true;
                    }
                }

                if (!content) {
                    logger.warn('artifact function "create" error: no content provided');
                    const knownScaffoldTypes = Object.keys(ARTIFACT_SCAFFOLDS).join(', ');
                    return {
                        status: 'error',
                        data: {
                            error: `Content is required for creating an artifact (or omit content with type set to one of: ${knownScaffoldTypes} to receive a starter scaffold).`,
                        },
                    };
                }

                // If type is checklist, ensure content is markdown with checkboxes
                if (type === 'checklist' && !content.includes('- [ ]')) {
                    logger.warn('artifact function "create" error: checklist must contain checkboxes');
                    return {
                        status: 'error',
                        data: { error: 'Checklist artifacts must contain markdown checkboxes (- [ ])' }
                    };
                }

                // Create the artifact with the base parameters
                const artifact = await context.createArtifact(args.name, content, type);
                logger.debug({ id: artifact.id, name: artifact.name, scaffolded }, 'artifact function "create" result');

                // If metadata is provided, update the artifact with it
                if (args.metadata) {
                    await context.updateArtifact(artifact.id, content);
                }

                return {
                    status: 'success',
                    data: scaffolded
                        ? { ...artifact, scaffolded: true, scaffoldType: type }
                        : artifact,
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
                return buildInvalidActionResponse(args);
        }
    } catch (error) {
        return {
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'An error occurred while processing the artifact' }
        };
    }
}

const VALID_ACTIONS_HINT = 'list, get, create, edit, delete';

/**
 * Build an "invalid action" error response.
 *
 * Generic unknown actions get the original list-of-valid-actions message.
 * The two known misroutes — `showArtifact` (the slide tool's display action)
 * and the legacy `show` (an artifact-tool action removed in the
 * artifact/slide refactor, phase 1-2) — get a fully-formed correction that
 * names the right tool, the exact call shape, AND echoes back the
 * artifactId/id the agent already passed. The realtime model then has
 * everything it needs to fire the corrected call on its very next turn,
 * which closes the recurring stall flagged in `Experience Creator QA.md`.
 */
function buildInvalidActionResponse(args: {
    action: string;
    id?: string;
    artifactId?: string;
}): ToolResponse {
    const action = args.action;

    if (action === 'showArtifact') {
        const artifactId = args.artifactId ?? args.id ?? '<id>';
        logger.warn(
            { action, artifactId },
            'artifact tool received slide-shaped action — returning corrected slide call shape'
        );
        return {
            status: 'error',
            data: {
                error:
                    `'showArtifact' is an action on the slide tool, not artifact. ` +
                    `Call slide({ action: 'showArtifact', artifactId: '${artifactId}' }) instead. ` +
                    `The artifact tool only handles storage (${VALID_ACTIONS_HINT}); it has no display action.`,
            },
        };
    }

    if (action === 'show') {
        const artifactId = args.artifactId ?? args.id;
        logger.warn(
            { action, artifactId },
            'artifact tool received slide-shaped action — returning corrected slide call shape'
        );
        const suggestion = artifactId
            ? `Call slide({ action: 'showArtifact', artifactId: '${artifactId}' }) to display an existing artifact, ` +
              `or slide({ action: 'show', title: '...', content: '...' }) to display ad-hoc markdown.`
            : `Call slide({ action: 'show', title: '...', content: '...' }) to display ad-hoc markdown, ` +
              `or slide({ action: 'showArtifact', artifactId: '<id>' }) to display an existing artifact.`;
        return {
            status: 'error',
            data: {
                error:
                    `'show' is an action on the slide tool, not artifact. ${suggestion} ` +
                    `The artifact tool only handles storage (${VALID_ACTIONS_HINT}); it has no display action.`,
            },
        };
    }

    return {
        status: 'error',
        data: { error: `Invalid action: ${action}. Valid actions are: ${VALID_ACTIONS_HINT}` },
    };
}
