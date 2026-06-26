import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { WebSearchToolContext } from './types';

/**
 * @tool research
 * @description Research information using various sources. Use webSearch action to search the web.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'webSearch'
 * @param {string} args.query - The search query to look up
 * @param {object} context - The context object
 * @param {Function} context.searchWeb - Function to search the web
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function research(
  args: { action: 'webSearch'; query: string },
  context: ToolContext
): Promise<ToolResponse> {
  const searchContext = context as WebSearchToolContext;
  if (!searchContext.searchWeb) {
    return {
      status: 'error',
      data: { error: 'searchWeb not available in context' }
    };
  }

  try {
    if (args.action === 'webSearch') {
      const results = await searchContext.searchWeb(args.query);
      return {
        status: 'success',
        data: results
      };
    }

    return {
      status: 'error',
      data: { error: `Unknown action: ${args.action}` }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Unknown error occurred' }
    };
  }
}

