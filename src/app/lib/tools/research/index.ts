/**
 * Research tools for finding information from various sources.
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { research } from './search';

// Export the tool functions
export { research };

// Export manager and types
export * from './WebSearchManager';
export * from './types';

/**
 * Register research tools with the ToolRegistry.
 * This should be called during application initialization.
 */
export async function registerWebSearchTools(): Promise<void> {
  const registry = ToolRegistry.getInstance();

  await registry.register({
    type: 'function',
    name: 'research',
    description: 'Research information using various sources. Use webSearch action to search the web.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['webSearch']
        },
        query: {
          type: 'string',
          description: 'The search query to look up (required for webSearch action)'
        }
      },
      required: ['action', 'query']
    }
  }, research);
}

