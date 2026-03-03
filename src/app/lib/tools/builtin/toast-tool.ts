/**
 * Toast Notification Tool
 * 
 * Displays toast notifications to the user.
 * Useful for showing progress updates, confirmations, or error messages.
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';

/**
 * @tool toast
 * @description Display toast notifications to the user with progress updates or messages.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'show'
 * @param {string} args.message - The message to display in the toast
 * @param {string} args.type - The type of toast - 'default' for normal messages, 'destructive' for errors
 * @param {object} context - The context object
 * @param {Function} context.toast - Function to display toast notifications
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function toast(args: {
    action: 'show';
    message: string;
    type?: 'default' | 'destructive';
}, context: ToolContext): Promise<ToolResponse> {
    if (!context.toast) {
        return {
            status: 'error',
            data: { error: 'toast not available in context' }
        };
    }

    try {
        if (args.action === 'show') {
            // Display the toast notification
            context.toast({
                title: args.message,
                variant: args.type === 'destructive' ? 'destructive' : 'default',
            });

            return {
                status: 'success',
                data: { message: 'Toast notification displayed' }
            };
        }

        return {
            status: 'error',
            data: { error: `Unknown action: ${args.action}` }
        };
    } catch (error) {
        return {
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Failed to display toast' }
        };
    }
}

