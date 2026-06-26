/**
 * AIRequestHandler
 * 
 * Handles AI API requests and responses including:
 * - Creating initial AI requests
 * - Managing conversation loops with tool calls
 * - Provider abstraction (OpenAI/Anthropic)
 * - Message history management
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import {
  convertOpenAIToolsToAnthropic,
  convertMessagesToAnthropic,
  convertAnthropicResponseToOpenAI,
  shouldUseAnthropic,
  getModelName
} from '../utils/provider-adapter';
import { createModuleLogger } from '@/lib/logger';
import { env } from '@/config/env';
import type {
  ToolDefinition,
  AIMessage,
  LoadedExperience,
  AIProviderConfig
} from './types';

const logger = createModuleLogger('backend-agent-ai-handler');

/** Claude Opus 4.6 max output via synchronous Messages API (128k). See Anthropic models overview. */
const ANTHROPIC_BACKEND_AGENT_MAX_OUTPUT_TOKENS = 128_000;

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

type AnthropicMessageCreateParams = Omit<
  Anthropic.MessageCreateParams,
  'stream'
>;

/**
 * Anthropic's SDK rejects non-streaming requests when max_tokens implies a
 * runtime over ~10 minutes (see _calculateNonstreamingTimeout). At 128k that
 * always applies, so we stream and assemble the final Message.
 */
async function requestAnthropicMessage(
  params: AnthropicMessageCreateParams,
): Promise<Anthropic.Message> {
  const stream = anthropic.messages.stream(params);
  return stream.finalMessage();
}

export class AIRequestHandler {
  /**
   * Determine which AI provider to use
   */
  static getProviderConfig(experience: LoadedExperience): AIProviderConfig {
    const useAnthropic = shouldUseAnthropic(experience.aiConfig);
    const modelName = getModelName(experience.aiConfig, useAnthropic ? 'anthropic' : 'openai');
    const providerName = useAnthropic ? 'Anthropic' : 'OpenAI';

    logger.debug({ provider: providerName, model: modelName }, 'Provider configuration');

    return { useAnthropic, modelName, providerName };
  }

  /**
   * Create task message for backend agent
   */
  static createTaskMessage(
    taskDescription: string,
    artifactIds: string[]
  ): string {
    let taskMessage = `I have been delegated the following task:\n\n`;

    if (taskDescription) {
      taskMessage += `Task: ${taskDescription}\n\n`;
    }

    if (artifactIds && artifactIds.length > 0) {
      taskMessage += `Available artifacts: ${artifactIds.join(', ')}\n\n`;
      taskMessage += `Please retrieve and analyze these artifacts, then complete the requested task.`;
    } else {
      taskMessage += `Please begin working on the delegated task.`;
    }

    return taskMessage;
  }

  /**
   * Send initial request to AI provider
   */
  static async sendInitialRequest(
    experience: LoadedExperience,
    taskMessage: string,
    tools: ToolDefinition[],
    providerConfig: AIProviderConfig
  ): Promise<AIMessage> {
    logger.debug({
      provider: providerConfig.providerName,
      model: providerConfig.modelName,
      messagePreview: taskMessage.substring(0, 200),
      toolsCount: tools.length,
      toolNames: tools.map(t => t.function.name),
    }, 'Sending initial request to AI');

    if (providerConfig.useAnthropic) {
      // Convert tools to Anthropic format
      const anthropicTools = convertOpenAIToolsToAnthropic(tools);

      const response = await requestAnthropicMessage({
        model: providerConfig.modelName,
        max_tokens: ANTHROPIC_BACKEND_AGENT_MAX_OUTPUT_TOKENS,
        system: experience.instructions,
        messages: [
          {
            role: 'user',
            content: taskMessage
          }
        ],
        ...(experience.temperature !== undefined && { temperature: experience.temperature }),
        tools: anthropicTools
      });

      logger.debug({
        stop_reason: response.stop_reason,
        usage: response.usage,
      }, 'Anthropic response received');

      // Convert response to OpenAI format for consistency
      return convertAnthropicResponseToOpenAI(response);
    } else {
      const response = await openai.chat.completions.create({
        model: providerConfig.modelName,
        messages: [
          {
            role: 'system',
            content: experience.instructions
          },
          {
            role: 'user',
            content: taskMessage
          }
        ],
        ...(experience.temperature !== undefined && { temperature: experience.temperature }),
        tools,
        tool_choice: "auto",
        stream: false
      });

      const responseMessage = response.choices[0]?.message;
      if (!responseMessage) {
        throw new Error('No response from AI provider');
      }

      return responseMessage as AIMessage;
    }
  }

  /**
   * Send follow-up request after tool execution
   */
  static async sendFollowUpRequest(
    experience: LoadedExperience,
    allMessages: any[],
    tools: ToolDefinition[],
    providerConfig: AIProviderConfig
  ): Promise<AIMessage> {
    logger.debug('Getting next AI response after tool execution');

    if (providerConfig.useAnthropic) {
      // Convert messages to Anthropic format
      const anthropicTools = convertOpenAIToolsToAnthropic(tools);
      const { system, messages: anthropicMessages } = convertMessagesToAnthropic(allMessages);

      const nextResponse = await requestAnthropicMessage({
        model: providerConfig.modelName,
        max_tokens: ANTHROPIC_BACKEND_AGENT_MAX_OUTPUT_TOKENS,
        system,
        messages: anthropicMessages,
        ...(experience.temperature !== undefined && { temperature: experience.temperature }),
        tools: anthropicTools
      });

      logger.debug({
        stop_reason: nextResponse.stop_reason,
        usage: nextResponse.usage,
      }, 'Anthropic response received');

      // Convert back to OpenAI format
      return convertAnthropicResponseToOpenAI(nextResponse);
    } else {
      const nextResponse = await openai.chat.completions.create({
        model: providerConfig.modelName,
        messages: allMessages,
        ...(experience.temperature !== undefined && { temperature: experience.temperature }),
        tools,
        tool_choice: "auto",
        stream: false
      });

      const currentResponse = nextResponse.choices[0]?.message;
      if (!currentResponse) {
        throw new Error('No response from AI provider');
      }

      return currentResponse as AIMessage;
    }
  }

  /**
   * Initialize message history
   */
  static initializeMessageHistory(
    experience: LoadedExperience,
    taskMessage: string,
    initialResponse: AIMessage
  ): any[] {
    return [
      {
        role: 'system',
        content: experience.instructions
      },
      {
        role: 'user',
        content: taskMessage
      },
      initialResponse
    ];
  }
}

