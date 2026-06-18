import { NextResponse } from 'next/server';
import { Tool, ToolHandler } from '@/app/lib/types';
import { ResourceDefinition } from '@/app/lib/resource-types';
import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('resources-tools');

// In-memory cache of processed tools
const processedTools = new Map<string, Tool>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const toolId = url.searchParams.get('id');

  const registry = ToolRegistry.getInstance();

  // If no tool ID, return all tools
  if (!toolId) {
    const tools = registry.getAllTools().map(tool => ({
      ...tool,
      url: `/api/resources/tools/${tool.name}`
    }));
    return NextResponse.json({ tools });
  }

  // Get the specific tool
  const tool = registry.getTool(toolId);
  if (!tool) {
    return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
  }

  // If the tool is already processed and cached, return it
  if (processedTools.has(toolId)) {
    return NextResponse.json(processedTools.get(toolId));
  }

  // Process and cache the tool
  processedTools.set(toolId, tool);
  return NextResponse.json(tool);
}

// POST endpoint for registering new tools
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const toolResource = body as ResourceDefinition<Tool>;
    
    const registry = ToolRegistry.getInstance();
    
    // Extract the tool and create a handler
    const tool = toolResource.definition;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handler: ToolHandler = async (args: any, context?: any) => {
      // For now, just return success with the args
      return {
        status: 'success',
        data: args
      };
    };
    
    await registry.register(tool, handler);
    
    return NextResponse.json({
      message: 'Tool registered successfully',
      tool
    });
  } catch (error) {
    logger.error(error, 'Failed to register tool');
    return NextResponse.json(
      { error: 'Failed to register tool' },
      { status: 500 }
    );
  }
} 