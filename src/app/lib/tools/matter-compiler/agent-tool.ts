/**
 * Agent Management Tool
 * 
 * Manages agents within an experience (create, modify, delete)
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { MatterCompilerContext, AgentOperation } from './types';
import { getMatterCompiler } from './MatterCompiler';

/**
 * @tool modifyAgent
 * @description Create, modify, or delete an agent in an experience
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {object} args.operation - The operation to perform
 * @param {string} args.operation.type - The type of operation ('create', 'modify', or 'delete')
 * @param {string} args.operation.id - The ID of the agent
 * @param {object} args.operation.data - The agent data (required for create/modify)
 * @param {boolean} args.operation.setAsInitial - Whether to set this agent as the initial agent
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function modifyAgent(
  args: { experienceId: string; operation: AgentOperation },
  context: ToolContext
): Promise<ToolResponse> {
  const matterContext = context as MatterCompilerContext;
  if (!matterContext.getResourceContent || !matterContext.createFile) {
    return {
      status: 'error',
      data: { error: 'Required context functions not available' }
    };
  }

  try {
    const compiler = getMatterCompiler();
    await compiler.modifyAgent(matterContext, args.experienceId, args.operation);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to modify agent' }
    };
  }
}

