/**
 * Image generation tools for creating images using AI models.
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { generateImages } from './image';

// Export the tool functions
export { generateImages };

// Export manager and types
export * from './ImageGeneratorManager';
export * from './types';

/**
 * Register all image generator tools with the ToolRegistry.
 * This should be called during application initialization.
 */
export async function registerImageGeneratorTools(): Promise<void> {
  const registry = ToolRegistry.getInstance();

  console.log('[IMAGE-GENERATOR] Registering image generator tools...');

  // Register the multi-turn image generation tool
  console.log('[IMAGE-GENERATOR] Registering generateImages (multi-turn)');
  await registry.register({
    type: 'function',
    name: 'generateImages',
    description: 'Generate multiple images with consistent visual style using Nano Banana multi-turn conversation. All images will automatically be saved as artifacts.',
    parameters: {
      type: 'object',
      properties: {
        visualStyle: {
          type: 'string',
          description: 'Detailed description of the visual style to apply to ALL images (e.g., "Modern Surreal Collage - Shapes reduced to crisp, block-colour silhouettes...")'
        },
        aspectRatio: {
          type: 'string',
          description: 'The aspect ratio for all images (default: "16:9"). Common values: "1:1", "16:9", "9:16", "4:3", "3:4"'
        },
        images: {
          type: 'array',
          description: 'Array of image specifications to generate',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'The name for this image artifact (e.g., "mentor_scene")'
              },
              description: {
                type: 'string',
                description: 'Description of what this specific image should contain'
              }
            },
            required: ['name', 'description']
          }
        },
        additionalInstructions: {
          type: 'string',
          description: 'Optional additional instructions for retry scenarios or special requirements'
        }
      },
      required: ['visualStyle', 'images']
    }
  }, generateImages);

  console.log('[IMAGE-GENERATOR] Image generator tools registered successfully');
  console.log('[IMAGE-GENERATOR] Available tools:', registry.getAllTools().filter(t => t.name.includes('Image')).map(t => t.name));
}

