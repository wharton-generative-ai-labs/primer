/**
 * Agent Prompt Management Tool
 * 
 * Manages agent prompt files within an experience
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { MatterCompilerContext } from './types';
import { getMatterCompiler } from './MatterCompiler';

/**
 * @tool createAgentPrompt
 * @description Create a prompt file for an agent
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {string} args.agentId - The ID of the agent
 * @param {string} args.promptContent - The content of the prompt
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function createAgentPrompt(
  args: { experienceId: string; agentId: string; promptContent: string },
  context: ToolContext
): Promise<ToolResponse> {
  const matterContext = context as MatterCompilerContext;
  if (!matterContext.createDirectory || !matterContext.createFile || !matterContext.getResourceContent) {
    return {
      status: 'error',
      data: { error: 'Required context functions not available' }
    };
  }

  try {
    const compiler = getMatterCompiler();
    await compiler.createAgentPrompt(matterContext, args.experienceId, args.agentId, args.promptContent);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to create agent prompt' }
    };
  }
}

/**
 * @tool listAgentPrompts
 * @description List all agent prompts in an experience
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object with the list of agent prompts
 */
export async function listAgentPrompts(
  args: { experienceId: string },
  context: ToolContext
): Promise<ToolResponse> {
  const matterContext = context as MatterCompilerContext;
  if (!matterContext.getResourceContent) {
    return {
      status: 'error',
      data: { error: 'getResourceContent not available in context' }
    };
  }

  try {
    const compiler = getMatterCompiler();
    const prompts = await compiler.listAgentPrompts(matterContext, args.experienceId);
    return {
      status: 'success',
      data: { prompts }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to list agent prompts' }
    };
  }
}

/**
 * @tool getAgentPrompt
 * @description Get the content of an agent prompt
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {string} args.agentId - The ID of the agent
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object with the prompt content
 */
export async function getAgentPrompt(
  args: { experienceId: string; agentId: string },
  context: ToolContext
): Promise<ToolResponse> {
  const matterContext = context as MatterCompilerContext;
  if (!matterContext.getResourceContent) {
    return {
      status: 'error',
      data: { error: 'getResourceContent not available in context' }
    };
  }

  try {
    const compiler = getMatterCompiler();
    const prompt = await compiler.getAgentPrompt(matterContext, args.experienceId, args.agentId);
    return {
      status: 'success',
      data: { prompt }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to get agent prompt' }
    };
  }
}

