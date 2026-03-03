import { Tool, ToolResponse } from '@/app/lib/types';
import { ResourceDefinition, ResourceProcessor } from '@/app/lib/resource-types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ToolRegistry');

export type ToolHandler = (args: any, context?: any) => Promise<ToolResponse> | ToolResponse;

interface ToolRegistration {
  tool: Tool;
  handler: ToolHandler;
}

/**
 * ToolRegistry manages tool definitions and their handlers
 * This allows for dynamic registration and execution of tools
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolRegistration> = new Map();
  private processor?: ResourceProcessor<Tool>;
  
  /**
   * Get the singleton instance of ToolRegistry
   */
  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }
  
  /**
   * Set the tool processor
   */
  public setProcessor(processor: ResourceProcessor<Tool>): void {
    this.processor = processor;
  }

  /**
   * Register a tool with its handler
   */
  public async register(toolOrResource: Tool | ResourceDefinition<Tool>, handler?: ToolHandler): Promise<void> {
    // Get caller information from stack trace
    const stack = new Error().stack || '';
    const callerLine = stack.split('\n')[3] || ''; // Get the line that called this function
    
    // Try multiple patterns to extract the source path
    let source = 'unknown';
    
    // Pattern 1: (file:line:col) - most common in Node
    let match = callerLine.match(/\(([^)]+)\)/);
    if (match) {
      source = match[1];
    } else {
      // Pattern 2: at file:line:col (no parentheses)
      match = callerLine.match(/at\s+(.+:\d+:\d+)/);
      if (match) {
        source = match[1];
      }
    }
    
    // Determine if this is from centralized code or old plugin code
    // Use more flexible matching that works with different path formats
    const isCentralized = source.includes('/src/app/lib/tools/') || source.includes('src/app/lib/tools/');
    const isOldPlugin = (source.includes('/plugins/') || source.includes('plugins/')) && 
                        (source.includes('/dist/') || source.includes('dist/'));
    
    const sourceType = isCentralized ? '🔧 [CENTRALIZED]' : (isOldPlugin ? '⚠️  [OLD PLUGIN]' : '❓ [UNKNOWN]');
    
    if ('metadata' in toolOrResource && 'definition' in toolOrResource) {
      // Process the resource if we have a processor
      if (this.processor) {
        const processedTool = await this.processor.process(toolOrResource);
        this.registerProcessedTool(processedTool, handler);
      } else {
        this.registerProcessedTool(toolOrResource.definition, handler);
      }
    } else {
      if (this.tools.has(toolOrResource.name)) {
        logger.warn({ toolName: toolOrResource.name, sourceType }, 'Tool is already registered. Overwriting');
      }
      
      this.tools.set(toolOrResource.name, { tool: toolOrResource, handler: handler! });
      this.logToolsState('Tool registered', { 
        toolName: toolOrResource.name,
        action: this.tools.has(toolOrResource.name) ? 'overwritten' : 'added',
        sourceType,
        source
      });
    }
  }
  
  /**
   * Register multiple tools with their handlers
   */
  public async registerMany(registrations: { tool: Tool, handler: ToolHandler }[]): Promise<void> {
    for (const { tool, handler } of registrations) {
      await this.register(tool, handler);
    }
  }
  
  /**
   * Get a tool by name
   */
  public getTool(name: string): Tool | null {
    const registration = this.tools.get(name);
    return registration ? registration.tool : null;
  }
  
  /**
   * Get a tool handler by name
   */
  public getHandler(name: string): ToolHandler | null {
    const registration = this.tools.get(name);
    return registration ? registration.handler : null;
  }
  
  /**
   * Execute a tool with the given arguments and context
   */
  public async execute(name: string, args: any, context?: any): Promise<ToolResponse> {
    const handler = this.getHandler(name);
    
    if (!handler) {
      throw new Error(`Tool ${name} not found`);
    }
    
    try {
      const result = await handler(args, context);      

      if (!result || typeof result.status === 'undefined') {
        logger.error({ toolName: name, result }, 'Tool handler returned invalid response format');
        return {
          status: 'error',
          message: 'Tool handler returned invalid response format'
        };
      }
      
      return result;
    } catch (error) {
      logger.error(error, `Error executing ${name}`);
      throw error;
    }
  }
  
  /**
   * Get all registered tools
   */
  public getAllTools(): Tool[] {
    const tools = Array.from(this.tools.values()).map(registration => registration.tool);
    this.logToolsState('Getting all tools');
    return tools;
  }
  
  /**
   * Get all tools that match a filter function
   */
  public getFilteredTools(filter: (tool: Tool) => boolean): Tool[] {
    const tools = this.getAllTools().filter(filter);
    this.logToolsState('Getting filtered tools', {
      filterResult: tools.map(t => t.name)
    });
    return tools;
  }

  /**
   * Format tools for AI consumption by ensuring they match the expected format
   */
  public formatForAI(tools: Tool[]): Tool[] {
    const formattedTools = tools.map(tool => ({
      type: 'function' as const,
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: tool.parameters.properties,
        required: tool.parameters.required || [],
        additionalProperties: false
      }
    }));

    return formattedTools;
  }
  
  /**
   * Clear all registered tools
   */
  public clear(): void {
    const previousCount = this.tools.size;
    const previousTools = Array.from(this.tools.keys());
    this.tools.clear();
    this.logToolsState('Tools cleared', {
      previousCount,
      previousTools
    });
  }
  
  /**
   * Check if a tool is registered
   */
  public hasToolWithName(name: string): boolean {
    return this.tools.has(name);
  }

  private logToolsState(action: string, details?: any) {
    logger.debug({
      toolCount: this.tools.size,
      toolNames: Array.from(this.tools.keys()),
      ...details
    }, action);
  }

  /**
   * Register a processed tool with its handler
   */
  private registerProcessedTool(tool: Tool, handler?: ToolHandler): void {
    const name = tool.name;
    if (!handler) {
      throw new Error(`No handler provided for tool ${name}`);
    }

    this.tools.set(name, { tool, handler });
  }
}
