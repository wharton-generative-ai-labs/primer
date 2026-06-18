import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { SoundToolContext } from './types';

/**
 * @tool sound
 * @description Manage audio playback. Use 'discover' to list available sounds, 'play' to play one.
 * @param {object} args - The arguments for the tool
 * @param {string} args.action - The action to perform: 'discover' or 'play'
 * @param {string} args.name - The sound name (required for play action)
 * @param {number} args.volume - Volume level 0-1 (optional for play action)
 * @param {boolean} args.loop - Whether to loop the sound (optional for play action)
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response object
 */
export async function sound(
  args: {
    action: 'discover' | 'play';
    name?: string;
    volume?: number | null;
    loop?: boolean | null;
  },
  context: ToolContext
): Promise<ToolResponse> {
  const soundContext = context as SoundToolContext;

  switch (args.action) {
    case 'discover': {
      if (!soundContext.getAvailableSounds) {
        return {
          status: 'error',
          data: { error: 'getAvailableSounds not available in context' }
        };
      }
      return {
        status: 'success',
        data: {
          availableSounds: soundContext.getAvailableSounds()
        }
      };
    }

    case 'play': {
      if (!soundContext.playSound) {
        return {
          status: 'error',
          data: { error: 'playSound not available in context' }
        };
      }
      if (!args.name) {
        return {
          status: 'error',
          data: { error: 'name parameter is required for play action' }
        };
      }
      soundContext.playSound(args.name, {
        volume: args.volume ?? undefined,
        loop: args.loop ?? undefined
      });
      return {
        status: 'success',
        data: {
          item: {
            output: {
              success: true,
              sound: args.name,
              volume: args.volume,
              loop: args.loop
            }
          }
        }
      };
    }

    default:
      return {
        status: 'error',
        data: { error: `Invalid action: ${args.action}. Valid actions are: discover, play` }
      };
  }
}


