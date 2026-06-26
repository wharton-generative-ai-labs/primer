/**
 * Sound management tools for playing audio effects in experiences.
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { sound } from './sound';

// Export the consolidated tool function
export { sound };

// Export AudioManager and types
export * from './AudioManager';
export * from './types';

// Export manager functions with legacy names for compatibility
export { createAudioManager as createSoundManager, getAudioManager as getSoundManager } from './AudioManager';

/**
 * Register all sound tools with the ToolRegistry.
 * This should be called during application initialization.
 */
export async function registerSoundTools(): Promise<void> {
  const registry = ToolRegistry.getInstance();

  // Consolidated sound tool with action parameter
  await registry.register({
    type: 'function',
    name: 'sound',
    description: 'Manage audio playback. Use discover to list available sounds, play to play one.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['discover', 'play']
        },
        name: {
          type: 'string',
          description: 'The sound name (required for play action)'
        },
        volume: {
          type: 'number',
          description: 'Volume level 0-1 (optional for play action)'
        },
        loop: {
          type: 'boolean',
          description: 'Whether to loop the sound (optional for play action)'
        }
      },
      required: ['action']
    }
  }, sound);
}

