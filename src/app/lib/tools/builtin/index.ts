/**
 * Built-in core tools for Primer experiences.
 * These are the fundamental tools available to all agents.
 * 
 * Tools use the command/action pattern where related functionality
 * is consolidated into single tools with an `action` parameter.
 */

import {
  scene,
  information,
  file,
  artifact,
  checklist,
  agent,
  toast
} from './builtin';

// Export the consolidated tool functions
export {
  scene,
  information,
  file,
  artifact,
  checklist,
  agent,
  toast
};

// NOTE: Server-only functions (getSceneDescription, listUploadedFiles, getFileInfo) 
// are NOT exported here to avoid bundling them in client code.
// They are dynamically imported in registerBuiltinTools() in register.ts


// Export registration functions
export { registerClientBuiltinTools } from './register-client';  // Client-safe registration
export { registerBuiltinTools } from './register';  // Server-only registration (includes all tools)
