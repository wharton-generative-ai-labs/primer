/**
 * Provider Adapter Utilities
 * 
 * Converts between OpenAI and Anthropic API formats to maintain a single
 * tool definition format (OpenAI) while supporting multiple providers.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('provider-adapter');

/**
 * Convert OpenAI tool format to Anthropic tool format
 */
export function convertOpenAIToolsToAnthropic(openAITools: any[]): Anthropic.Tool[] {
  return openAITools.map(tool => {
    const anthropicTool: Anthropic.Tool = {
      name: tool.function.name,
      description: tool.function.description,
      input_schema: {
        type: "object" as const,
        properties: tool.function.parameters.properties,
        required: tool.function.parameters.required || []
      }
    };

    // Special handling for artifact tool - Anthropic needs more explicit required fields
    // The artifact tool has conditional requirements based on the action parameter
    if (tool.function.name === 'artifact') {
      // Update description to be more explicit about required fields
      anthropicTool.description = tool.function.description + 
        "\n\nIMPORTANT: When action is 'create' or 'edit', you MUST include the 'content' parameter with the FULL content of the artifact. " +
        "When action is 'create', you MUST include 'name'. " +
        "When action is 'get', 'edit', or 'delete', you MUST include 'id'.";
    }

    return anthropicTool;
  });
}

/**
 * Convert OpenAI messages to Anthropic format
 * Anthropic requires system messages to be separate, and doesn't support the 'tool' role
 */
export function convertMessagesToAnthropic(messages: any[]): { system: string; messages: Anthropic.MessageParam[] } {
  let systemMessage = '';
  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Anthropic uses a separate system parameter
      systemMessage = msg.content;
    } else if (msg.role === 'user') {
      anthropicMessages.push({
        role: 'user',
        content: msg.content
      });
    } else if (msg.role === 'assistant') {
      // Convert assistant message with potential tool calls
      const content: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];
      
      if (msg.content) {
        content.push({
          type: 'text',
          text: msg.content
        });
      }
      
      if (msg.tool_calls) {
        for (const toolCall of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments)
          });
        }
      }
      
      anthropicMessages.push({
        role: 'assistant',
        content
      });
    } else if (msg.role === 'tool') {
      // Anthropic expects tool results in user messages
      anthropicMessages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: msg.content
          }
        ]
      });
    }
  }

  return { system: systemMessage, messages: anthropicMessages };
}

/**
 * Convert Anthropic response to OpenAI-compatible format
 * This allows the rest of the code to work with a consistent format
 */
export function convertAnthropicResponseToOpenAI(response: Anthropic.Message): any {
  const openAIMessage: any = {
    role: 'assistant',
    content: null,
    tool_calls: []
  };

  // Extract text content and tool uses
  for (const block of response.content) {
    if (block.type === 'text') {
      openAIMessage.content = openAIMessage.content 
        ? openAIMessage.content + '\n' + block.text 
        : block.text;
    } else if (block.type === 'tool_use') {
      // Debug logging for tool calls
      const toolInput = block.input as Record<string, any>;
      logger.debug({
        name: block.name,
        id: block.id,
        inputKeys: Object.keys(toolInput),
        input: toolInput
      }, 'Converting Anthropic tool_use');
      
      openAIMessage.tool_calls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(toolInput)
        }
      });
    }
  }

  // If no tool calls, remove the empty array
  if (openAIMessage.tool_calls.length === 0) {
    delete openAIMessage.tool_calls;
  }

  return openAIMessage;
}

/**
 * Determine if we should use Anthropic based on the AI config
 */
export function shouldUseAnthropic(aiConfig?: any): boolean {
  return aiConfig?.provider === 'anthropic';
}

/**
 * Get the appropriate model name, with defaults
 */
export function getModelName(aiConfig?: any, provider?: string): string {
  if (aiConfig?.model) {
    return aiConfig.model;
  }
  
  // Defaults
  const actualProvider = provider || aiConfig?.provider || 'openai';
  if (actualProvider === 'anthropic') {
    return 'claude-3-5-sonnet-20241022';
  }
  return 'gpt-4o';
}


