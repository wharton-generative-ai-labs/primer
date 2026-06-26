/**
 * Scene Management Tool
 *
 * Manages background scenes for the experience.
 * Provides actions to discover, set, and manage custom scenes.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';

// Backend agents (subagents dispatched by the design-agent, etc.) inherit
// scene-tool guidance from cross-agent prompts but have no UI surface to
// render to — their `ToolContext` lacks scene callbacks. Returning `error`
// in that case used to look like a real failure to the backend agent's
// retry loop and would abort the whole dispatch after 3 consecutive
// "failures" of the same tool. Treat absent-callback scenarios as a no-op
// success instead so the agent sees "scene was ignored, move on".
const skippedOnBackend = (action: string): ToolResponse => ({
    status: 'success',
    data: {
        skipped: true,
        reason: `scene tool is a frontend-only operation; '${action}' ignored on backend`,
    },
});

export async function scene(args: {
    action: 'discover' | 'set' | 'reveal' | 'hide' | 'describe' | 'addCustom' | 'removeCustom';
    scene?: string;
    sceneName?: string;
    imageUrl?: string;
}, context: ToolContext): Promise<ToolResponse> {
    switch (args.action) {
        case 'discover': {
            if (!context.getAvailableScenes) {
                return skippedOnBackend(args.action);
            }
            return {
                status: 'success',
                data: context.getAvailableScenes().join(', ')
            };
        }

        case 'set': {
            if (!context.setScene) {
                return skippedOnBackend(args.action);
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

        case 'reveal': {
            if (!context.showScene) {
                return skippedOnBackend(args.action);
            }
            return {
                status: 'success',
                data: context.showScene()
            };
        }

        case 'hide': {
            if (!context.hideScene) {
                return skippedOnBackend(args.action);
            }
            return {
                status: 'success',
                data: context.hideScene()
            };
        }

        case 'describe': {
            // This action is handled by getSceneDescription in builtin-server.ts.
            // When this branch is reached, it means the backend dispatcher
            // didn't intercept describe — treat as skipped rather than error
            // so the backend agent doesn't abort.
            return skippedOnBackend(args.action);
        }

        case 'addCustom': {
            if (!context.addCustomScene) {
                return skippedOnBackend(args.action);
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
                return skippedOnBackend(args.action);
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
                data: { error: `Invalid action: ${args.action}. Valid actions are: discover, set, reveal, hide, describe, addCustom, removeCustom` }
            };
    }
}
