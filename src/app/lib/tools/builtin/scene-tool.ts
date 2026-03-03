/**
 * Scene Management Tool
 * 
 * Manages background scenes for the experience.
 * Provides actions to discover, set, and manage custom scenes.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';

/**
 * @tool scene
 * @description Manage background scenes. Use 'discover' to list available scenes, 'set' to display one.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'discover', 'set', 'describe', 'addCustom', 'removeCustom'
 * @param {string} args.scene - The scene name (for set/describe actions)
 * @param {string} args.sceneName - Custom scene name (for addCustom/removeCustom actions)
 * @param {string} args.imageUrl - Image URL (for addCustom action)
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function scene(args: {
    action: 'discover' | 'set' | 'describe' | 'addCustom' | 'removeCustom';
    scene?: string;
    sceneName?: string;
    imageUrl?: string;
}, context: ToolContext): Promise<ToolResponse> {
    switch (args.action) {
        case 'discover': {
            if (!context.getAvailableScenes) {
                return {
                    status: 'error',
                    data: { error: 'getAvailableScenes not available in context' }
                };
            }
            return {
                status: 'success',
                data: context.getAvailableScenes().join(', ')
            };
        }

        case 'set': {
            if (!context.setScene) {
                return {
                    status: 'error',
                    data: { error: 'setScene not available in context' }
                };
            }
            if (!args.scene) {
                return {
                    status: 'error',
                    data: { error: 'scene parameter is required for set action' }
                };
            }
            return {
                status: 'success',
                data: context.setScene(args.scene)
            };
        }

        case 'describe': {
            // This action is handled by getSceneDescription in builtin-server.ts
            // Return a deferred status to indicate it needs server-side handling
            return {
                status: 'error',
                data: { error: 'describe action requires server-side handling' }
            };
        }

        case 'addCustom': {
            if (!context.addCustomScene) {
                return {
                    status: 'error',
                    data: { error: 'addCustomScene not available in context' }
                };
            }
            if (!args.sceneName || !args.imageUrl) {
                return {
                    status: 'error',
                    data: { error: 'sceneName and imageUrl are required for addCustom action' }
                };
            }
            return {
                status: 'success',
                data: context.addCustomScene(args.sceneName, args.imageUrl)
            };
        }

        case 'removeCustom': {
            if (!context.removeCustomScene) {
                return {
                    status: 'error',
                    data: { error: 'removeCustomScene not available in context' }
                };
            }
            if (!args.sceneName) {
                return {
                    status: 'error',
                    data: { error: 'sceneName is required for removeCustom action' }
                };
            }
            return {
                status: 'success',
                data: context.removeCustomScene(args.sceneName)
            };
        }

        default:
            return {
                status: 'error',
                data: { error: `Invalid action: ${args.action}. Valid actions are: discover, set, describe, addCustom, removeCustom` }
            };
    }
}

