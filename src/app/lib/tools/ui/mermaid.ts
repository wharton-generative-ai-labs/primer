import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { MermaidToolContext } from './mermaid/types';

/**
 * @tool diagram
 * @description Display or hide Mermaid diagrams to visualize concepts, flows, or relationships. The diagram will be displayed in a full-screen overlay.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'show' or 'hide'
 * @param {string} args.title - The title to display above the diagram (required for show)
 * @param {string} args.diagram - The Mermaid diagram code (required for show)
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function diagram(
  args: { action: 'show' | 'hide'; title?: string; diagram?: string },
  context: ToolContext
): Promise<ToolResponse> {
  const mermaidContext = context as MermaidToolContext;

  if (args.action === 'show') {
    if (!mermaidContext.showMermaidDiagram) {
      return {
        status: 'error',
        data: { error: 'showMermaidDiagram not available in context' }
      };
    }

    if (!args.title || !args.diagram) {
      return {
        status: 'error',
        data: { error: 'title and diagram are required for show action' }
      };
    }

    const result = mermaidContext.showMermaidDiagram(args.title, args.diagram);
    
    return {
      status: 'success',
      data: {
        result: result.result
      }
    };
  }

  if (args.action === 'hide') {
    if (!mermaidContext.hideDiagram) {
      return {
        status: 'error',
        data: { error: 'hideDiagram not available in context' }
      };
    }

    const result = mermaidContext.hideDiagram();
    
    return {
      status: 'success',
      data: {
        result: result.result
      }
    };
  }

  return {
    status: 'error',
    data: { error: `Unknown action: ${args.action}` }
  };
} 