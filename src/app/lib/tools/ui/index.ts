/**
 * UI effect tools that manipulate the frontend interface.
 * These tools create visual effects, slides, notes, etc.
 * 
 * Tools use the command/action pattern where related functionality
 * is consolidated into single tools with an `action` parameter.
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ui-tools');

// Import consolidated tool implementations
import { celebrate } from './celebrate';
import { diagram } from './mermaid';

// Export consolidated tool functions
export {
  celebrate,
  diagram
};

// Note: customComponent tool is now registered in builtin/register.ts and builtin/register-client.ts
// as a backend-first tool using socket communication

// Note: note tool is now registered in builtin/register.ts and builtin/register-client.ts
// as a backend-first tool using socket communication

// Note: slide tool is now registered in builtin/register-client.ts and builtin/register.ts
// as a backend-first tool using socket communication

/**
 * Register celebrate tool (1 tool)
 */
export async function registerCelebrateTools(): Promise<void> {
  logger.debug({}, 'Registering celebrate tool');
  const registry = ToolRegistry.getInstance();

  await registry.register({
    type: 'function',
    name: 'celebrate',
    description: 'Create a festive confetti celebration animation',
    parameters: {
      type: 'object',
      properties: {
        colors: {
          type: 'string',
          description: 'Comma-separated list of colors for the confetti (default: "red,blue,green,yellow,purple")'
        },
        size: {
          type: 'number',
          description: 'Size of confetti pieces in pixels (default: 10)'
        },
        duration: {
          type: 'number',
          description: 'Duration of the animation in seconds (default: 5)'
        },
        shapes: {
          type: 'string',
          description: 'Comma-separated list of shapes to use: circle, square, or star (default: "circle,square,star")'
        }
      },
      required: []
    }
  }, celebrate);

  logger.debug({}, 'Registered 1 celebrate tool');
}

/**
 * Register slide tool (DEPRECATED - now handled by builtin tools)
 * 
 * The slide tool has been migrated to a backend-first implementation
 * and is now registered in:
 * - src/app/lib/tools/builtin/register.ts (server-side)
 * - src/app/lib/tools/builtin/register-client.ts (client-side stub)
 * 
 * This function is kept for backwards compatibility but does nothing.
 */
export async function registerSlideTools(): Promise<void> {
  logger.debug({}, 'Slide tool registration skipped (now handled by builtin tools)');
  // No-op: slide tool is registered as a backend-first tool in builtin/register.ts
}

/**
 * Register diagram tool (1 tool) - consolidated with action parameter
 */
export async function registerMermaidTools(): Promise<void> {
  logger.debug({}, 'Registering diagram tool');
  const registry = ToolRegistry.getInstance();

  await registry.register({
    type: 'function',
    name: 'diagram',
    description: 'Display or hide Mermaid diagrams to visualize concepts, flows, or relationships. The diagram will be displayed in a full-screen overlay.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['show', 'hide']
        },
        title: {
          type: 'string',
          description: 'The title to display above the diagram (required for show action)'
        },
        diagram: {
          type: 'string',
          description: 'The Mermaid diagram code (required for show action)'
        }
      },
      required: ['action']
    }
  }, diagram);

  logger.debug({}, 'Registered 1 diagram tool');
}

/**
 * Register notes tool (now handled by builtin tools)
 * 
 * The note tool has been migrated to a backend-first implementation.
 * This function ensures the note stub is registered if not already present.
 * Notes are rendered inside the document panel's Notes tab.
 */
export async function registerNotesTools(): Promise<void> {
  logger.debug({}, 'Checking note tool registration');
  
  // Import registry and check if note is already registered
  const { ToolRegistry } = await import('@/app/lib/ToolRegistry');
  const registry = ToolRegistry.getInstance();
  
  if (!registry.hasToolWithName('note')) {
    logger.debug({}, 'Registering note tool stub');
    const { createToolStub } = await import('@/app/lib/tools/client/tool-calling-shim');
    
    const noteDefinition = {
      type: 'function' as const,
      name: 'note',
      description: 'Manage sticky notes shown in the document panel\'s Notes tab. Use \'display\' to create, \'list\' to see all, \'get\' for details, \'changeColor\' to recolor, \'delete\' to remove.',
      parameters: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            description: 'The action to perform',
            enum: ['display', 'changeColor', 'get', 'list', 'delete']
          },
          noteId: { type: 'string', description: 'Note ID (required for changeColor, get, delete)' },
          content: { type: 'string', description: 'Note content in markdown (required for display)' },
          color: { type: 'string', description: 'Note color: yellow, pink, green, blue, purple, orange' }
        },
        required: ['action'] as string[]
      },
      handler: async () => ({ status: 'error' as const, data: { error: 'Not implemented' } })
    };
    
    const noteStub = createToolStub('note', noteDefinition);
    await registry.register(noteDefinition, noteStub.handler);
    logger.debug({}, 'Note tool stub registered');
  } else {
    logger.debug({}, 'Note tool already registered');
  }
}

/**
 * Register custom component tool (DEPRECATED - now handled by builtin tools)
 * 
 * The customComponent tool has been migrated to a backend-first implementation
 * and is now registered in:
 * - src/app/lib/tools/builtin/register.ts (server-side)
 * - src/app/lib/tools/builtin/register-client.ts (client-side stub)
 * 
 * Components render in the document panel as active document content.
 * 
 * This function is kept for backwards compatibility but does nothing.
 */
export async function registerCustomComponentTools(): Promise<void> {
  logger.debug({}, 'CustomComponent tool registration skipped (now handled by builtin tools)');
  // No-op: customComponent tool is registered as a backend-first tool in builtin/register.ts
}
