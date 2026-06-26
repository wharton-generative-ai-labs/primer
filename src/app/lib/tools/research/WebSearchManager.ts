import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('WebSearchManager');

export async function searchWeb(query: string): Promise<string> {
  try {
    const response = await fetch('/api/openai/websearch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        searchContextSize: 'medium',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to perform web search');
    }

    const data = await response.json();
    return data || "";
  } catch (error) {
    logger.error(error, 'Error performing web search');
    throw error;
  }
}

export function createWebSearchManager() {
  return {
    searchWeb,
  };
}

export function getWebSearchManager() {
  return createWebSearchManager();
}

