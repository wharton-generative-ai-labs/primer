/**
 * High-level domain tools for manipulating Primer experiences.
 * These tools provide a more semantic interface for working with experience.json
 * compared to the lower-level file operations in the experience tools.
 */

import {
  modifyExperience,
  modifyAgent,
  modifyScene,
  getExperience,
  createAgentPrompt,
  createSupplementalFile,
  addSound,
  listAgentPrompts,
  getAgentPrompt,
  listSupplementalFiles,
  getSupplementalFile
} from './matter-compiler';

// Export the tool functions
export {
  modifyExperience,
  modifyAgent,
  modifyScene,
  getExperience,
  createAgentPrompt,
  createSupplementalFile,
  addSound,
  listAgentPrompts,
  getAgentPrompt,
  listSupplementalFiles,
  getSupplementalFile
};

// Export matter compiler and types
export * from './MatterCompiler';
export * from './types';

// Export registration function
export { registerMatterCompilerTools } from './register';

