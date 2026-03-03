/**
 * Sound Management Tool
 * 
 * Manages sounds within an experience
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { MatterCompilerContext } from './types';
import { getMatterCompiler } from './MatterCompiler';

/**
 * @tool addSound
 * @description Add a sound to an experience
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {string} args.soundPath - The path of the sound file
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function addSound(
  args: { experienceId: string; soundPath: string },
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
    await compiler.addSound(matterContext, args.experienceId, args.soundPath);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to add sound' }
    };
  }
}

