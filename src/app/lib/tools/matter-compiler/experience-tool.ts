/**
 * Experience Management Tool
 * 
 * Manages experience metadata (title, version, description, status)
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { MatterCompilerContext, ExperienceOperation } from './types';
import { getMatterCompiler } from './MatterCompiler';

/**
 * @tool modifyExperience
 * @description Modify an experience's metadata (title, version, description, status)
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {object} args.operation - The operation to perform
 * @param {string} args.operation.type - The type of operation (must be 'modify')
 * @param {object} args.operation.data - The data to modify
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function modifyExperience(
  args: { experienceId: string; operation: ExperienceOperation },
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
    await compiler.modifyExperience(matterContext, args.experienceId, args.operation);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to modify experience' }
    };
  }
}

/**
 * @tool getExperience
 * @description Get the full experience configuration
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object with the experience data
 */
export async function getExperience(
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
    const experience = await compiler.getExperience(matterContext, args.experienceId);
    return {
      status: 'success',
      data: { experience }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to get experience' }
    };
  }
}

