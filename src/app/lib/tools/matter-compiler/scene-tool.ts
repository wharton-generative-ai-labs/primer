/**
 * Scene Management Tool
 * 
 * Manages scenes within an experience (add, modify, delete)
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { MatterCompilerContext, SceneOperation } from './types';
import { getMatterCompiler } from './MatterCompiler';

/**
 * @tool modifyScene
 * @description Add, modify, or delete a scene in an experience
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {object} args.operation - The operation to perform
 * @param {string} args.operation.type - The type of operation ('add', 'modify', or 'delete')
 * @param {string} args.operation.path - The path of the scene
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function modifyScene(
  args: { experienceId: string; operation: SceneOperation },
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
    await compiler.modifyScene(matterContext, args.experienceId, args.operation);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to modify scene' }
    };
  }
}

