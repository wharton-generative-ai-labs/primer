/**
 * Image Generator Manager
 * 
 * Client-side manager for image generation (used by hooks/UI).
 * Server-side tools are in ./image.ts
 */

import { ImageGeneratorManager, ImageGenerationOptions, ImageGenerationResult } from './types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ImageGeneratorManager');

// Export server-side tools
export { generateImages } from './image';

/**
 * Client-side image generation function (legacy DALL-E API)
 */
export async function generateImageClient(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> {
  try {
    const response = await fetch('/api/openai/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        ...options,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate image');
    }

    const data = await response.json();
    return {
      url: data.url,
      revisedPrompt: data.revisedPrompt,
    };
  } catch (error) {
    logger.error(error, 'Error generating image');
    return {
      url: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export function createImageGeneratorManager(): ImageGeneratorManager {
  return {
    generateImage: generateImageClient,
  };
}

export function getImageGeneratorManager(): ImageGeneratorManager {
  return createImageGeneratorManager();
} 