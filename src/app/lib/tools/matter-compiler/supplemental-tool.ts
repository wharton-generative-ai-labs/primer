/**
 * Supplemental File Management Tool
 * 
 * Manages supplemental files within an experience
 */

import { ToolResponse, ToolContext } from '@/app/lib/tools/types';
import { MatterCompilerContext } from './types';
import { getMatterCompiler } from './MatterCompiler';

/**
 * @tool createSupplementalFile
 * @description Create a supplemental file
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {string} args.fileName - The name of the file (without extension)
 * @param {string} args.content - The content of the file
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function createSupplementalFile(
  args: { experienceId: string; fileName: string; content: string },
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
    await compiler.createSupplementalFile(matterContext, args.experienceId, args.fileName, args.content);
    return {
      status: 'success',
      data: { success: true }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to create supplemental file' }
    };
  }
}

/**
 * @tool listSupplementalFiles
 * @description List all supplemental files in an experience
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object with the list of supplemental files
 */
export async function listSupplementalFiles(
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
    const files = await compiler.listSupplementalFiles(matterContext, args.experienceId);
    return {
      status: 'success',
      data: { files }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to list supplemental files' }
    };
  }
}

/**
 * @tool getSupplementalFile
 * @description Get the content of a supplemental file
 * @param {object} args - The arguments for the tool
 * @param {string} args.experienceId - The ID of the experience
 * @param {string} args.fileName - The name of the file (without extension)
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object with the file content
 */
export async function getSupplementalFile(
  args: { experienceId: string; fileName: string },
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
    const content = await compiler.getSupplementalFile(matterContext, args.experienceId, args.fileName);
    return {
      status: 'success',
      data: { content }
    };
  } catch (error) {
    return {
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Failed to get supplemental file' }
    };
  }
}

