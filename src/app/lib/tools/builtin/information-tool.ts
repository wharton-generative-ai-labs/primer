/**
 * Information Storage Tool
 * 
 * Manages persistent key-value information storage.
 * Useful for maintaining state and continuity between agents.
 * 
 * Backend-first implementation: data is stored on the server,
 * persisted to disk in session_data/{sessionId}/information.json
 *
 * SYNC: the dev harness duplicates this handler at
 * src/app/lib/harness/tools.ts (against an in-memory state.information
 * map). Any schema change here — action names, required params,
 * response shape — must be mirrored there or the harness will drift.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('information-tool');

/**
 * @tool information
 * @description Manage stored information. Use 'discover' to list available keys, 'get' to retrieve, 'save' to store, 'delete' to remove.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'discover', 'get', 'save', 'delete'
 * @param {string} args.key - The key of a key/value pair (required for get/save/delete)
 * @param {string} args.value - The value to store (required for save)
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function information(args: {
    action: 'discover' | 'get' | 'save' | 'delete';
    key?: string;
    value?: string;
}, context: ToolContext): Promise<ToolResponse> {
    logger.debug({ action: args.action, key: args.key }, 'information tool called');
    
    // Check for required context
    if (!context.informationStore) {
        logger.warn('information tool called without informationStore in context');
        return {
            status: 'error',
            data: { error: 'Information store not available in context' }
        };
    }
    
    try {
        switch (args.action) {
            case 'discover': {
                const keys = await context.informationStore.getAllKeys();
                logger.debug({ keyCount: keys.length }, 'information discover completed');
                return {
                    status: 'success',
                    data: keys.length > 0 ? keys.join(', ') : '(no keys stored)'
                };
            }

            case 'get': {
                if (!args.key) {
                    return {
                        status: 'error',
                        data: { error: 'key parameter is required for get action' }
                    };
                }
                const value = await context.informationStore.get(args.key);
                logger.debug({ key: args.key, found: value !== null }, 'information get completed');
                return {
                    status: 'success',
                    data: { key: args.key, value }
                };
            }

            case 'save': {
                if (!args.key || args.value === undefined) {
                    return {
                        status: 'error',
                        data: { error: 'key and value parameters are required for save action' }
                    };
                }
                await context.informationStore.save(args.key, args.value);
                logger.debug({ key: args.key }, 'information save completed');
                return {
                    status: 'success',
                    data: { key: args.key, value: args.value }
                };
            }

            case 'delete': {
                if (!args.key) {
                    return {
                        status: 'error',
                        data: { error: 'key parameter is required for delete action' }
                    };
                }
                const deleted = await context.informationStore.delete(args.key);
                logger.debug({ key: args.key, deleted }, 'information delete completed');
                if (deleted) {
                    return {
                        status: 'success',
                        data: { message: `Key '${args.key}' has been deleted` }
                    };
                } else {
                    return {
                        status: 'success',
                        data: { message: `Key '${args.key}' was not found` }
                    };
                }
            }

            default:
                return {
                    status: 'error',
                    data: { error: `Invalid action: ${args.action}. Valid actions are: discover, get, save, delete` }
                };
        }
    } catch (error) {
        logger.error({ error, action: args.action }, 'information tool error');
        return {
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'An error occurred' }
        };
    }
}
