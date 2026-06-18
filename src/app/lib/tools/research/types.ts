import { ToolContext } from '@/app/lib/tools/types';

export interface WebSearchToolContext extends ToolContext {
  searchWeb: (query: string) => Promise<string>;
}

