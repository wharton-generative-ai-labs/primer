import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';
import { NanoBananaStrategy } from './strategies/NanoBananaStrategy';

const logger = createModuleLogger('image-generator');

/**
 * Generate multiple images using Nano Banana's multi-turn conversation for consistent visual style.
 * This is the recommended approach for generating multiple related images.
 */
export async function generateImages(
  args: {
    visualStyle: string;
    aspectRatio?: string;
    images: Array<{
      name: string;
      description: string;
    }>;
    additionalInstructions?: string;
  },
  context: ToolContext
): Promise<ToolResponse> {
  const { visualStyle, aspectRatio = '16:9', images, additionalInstructions } = args;
  
  logger.info({ 
    imageCount: images.length,
    visualStylePreview: visualStyle.substring(0, 100) + '...',
    aspectRatio,
    hasAdditionalInstructions: !!additionalInstructions
  }, 'Generating multiple images with multi-turn');
  
  try {
    // Use Nano Banana Strategy for multi-turn generation
    const strategy = new NanoBananaStrategy();
    
    const result = await strategy.generateMultiTurn({
      visualStyle,
      aspectRatio,
      imageSpecs: images,
      additionalInstructions
    });
    
    // HAPPY PATH - Algorithmic validation
    if (result.images.length === images.length) {
      // Save all images
      if (context.createArtifact) {
        for (let i = 0; i < images.length; i++) {
          await context.createArtifact(
            images[i].name,
            result.images[i].data,
            'png'
          );
        }
      }
      
      logger.info({ 
        generatedCount: result.images.length,
        expectedCount: images.length
      }, 'Successfully generated all images');
      
      return {
        status: 'success',
        data: {
          message: `✅ Successfully generated ${images.length} images with consistent visual style`,
          imageNames: images.map(img => img.name),
          provider: 'google',
          model: 'gemini-3-pro-image-preview',
          strategy: 'nano-banana',
          modelResponse: result.text
        }
      };
    }
    
    // EDGE CASE 1: Wrong number of images
    if (result.images.length !== images.length) {
      logger.warn({ 
        expected: images.length,
        received: result.images.length
      }, 'Image count mismatch');
      
      return {
        status: 'error',
        data: {
          error: `Expected ${images.length} images, received ${result.images.length}`,
          receivedCount: result.images.length,
          expectedCount: images.length,
          textResponse: result.text, // NO BINARY DATA
          isPartialSuccess: true, // Flag to indicate some images were generated
        }
      };
    }
    
    // EDGE CASE 2: Text-only response (refusal/clarification)
    if (result.images.length === 0 && result.text) {
      logger.warn({ textPreview: result.text.substring(0, 200) }, 'Nano Banana returned text without images');
      
      return {
        status: 'error',
        data: {
          error: 'Nano Banana did not generate images',
          modelResponse: result.text, // NO BINARY DATA
        }
      };
    }
    
    // EDGE CASE 3: API error
    if (result.error) {
      logger.error({ error: result.error }, 'Image generation failed');
      
      return {
        status: 'error',
        data: {
          error: 'Image generation failed',
          details: result.error,
        }
      };
    }
    
    // Fallback error
    return {
      status: 'error',
      data: {
        error: 'Unknown error occurred during image generation',
        details: 'No images generated and no error message'
      }
    };
    
  } catch (error) {
    logger.error(error, 'Image generation error');
    return {
      status: 'error',
      data: {
        error: error instanceof Error ? error.message : 'Unknown error occurred during image generation'
      }
    };
  }
}
