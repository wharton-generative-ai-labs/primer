/**
 * ToolExecutionManager
 * 
 * Handles execution of tool calls from AI responses including:
 * - Tool call parsing
 * - Tool execution via ToolRegistry
 * - Binary content protection for artifacts
 * - Error handling for tool execution
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { createModuleLogger } from '@/lib/logger';
import type { ToolContext } from '@/app/lib/tools/types';
import type { ToolCall, AIMessage } from './types';

const logger = createModuleLogger('backend-agent-tool-execution');

export class ToolExecutionManager {
  /**
   * Execute a single tool call
   */
  static async executeToolCall(
    toolCall: ToolCall,
    toolContext: ToolContext
  ): Promise<AIMessage> {
    const toolName = toolCall.function.name;

    try {
      const toolArgs = JSON.parse(toolCall.function.arguments);
      logger.debug({ tool: toolName, args: toolArgs }, 'Executing tool');

      const registry = ToolRegistry.getInstance();
      let result;

      // Special handling for artifact 'get' to avoid binary content in AI responses
      // This prevents token limit issues when backend agents retrieve binary artifacts (images)
      if (toolName === 'artifact' && toolArgs.action === 'get') {
        logger.debug('Applying binary content protection for artifact get');
        const modifiedContext = { ...toolContext };
        const originalGetArtifact = toolContext.getArtifact;

        if (originalGetArtifact) {
          modifiedContext.getArtifact = async (id: string) => {
            const artifact = await originalGetArtifact(id);
            if (artifact && !artifact.isText) {
              logger.debug(
                { name: artifact.name, length: artifact.content.length },
                'Truncating binary artifact content'
              );
              return {
                ...artifact,
                content: `[BINARY CONTENT - ${artifact.content.length} characters - Type: ${artifact.type}]`,
                isText: true,
                contentType: artifact.contentType
              };
            }
            return artifact;
          };
        }

        result = await registry.execute(toolName, toolArgs, modifiedContext);
      } else {
        result = await registry.execute(toolName, toolArgs, toolContext);
      }

      // Convert result to tool response format
      const toolResponse: AIMessage = {
        role: 'tool' as const,
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      };

      logger.debug({ tool: toolName, status: result.status }, 'Tool completed');

      return toolResponse;
    } catch (error) {
      logger.error(error, `Tool execution error for ${toolName}`);
      const errorResponse: AIMessage = {
        role: 'tool' as const,
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          status: 'error',
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        })
      };
      return errorResponse;
    }
  }

  /**
   * Execute all tool calls from an AI response
   */
  static async executeToolCalls(
    toolCalls: ToolCall[],
    toolContext: ToolContext
  ): Promise<AIMessage[]> {
    logger.debug({ count: toolCalls.length }, 'Processing tool calls');

    const toolResponses: AIMessage[] = [];

    for (const toolCall of toolCalls) {
      const response = await this.executeToolCall(toolCall, toolContext);
      toolResponses.push(response);
    }

    return toolResponses;
  }
}

