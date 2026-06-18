import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';
import { getImageGenerationStrategy } from './strategies';

const logger = createModuleLogger('image-generator');

const DEFAULT_IMAGE_MODEL = 'gpt-image-2';

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

  // Local-dev short-circuit: when MOCK_GENERATE_IMAGES is set, skip the
  // strategy + provider entirely and return stub PNG artifacts. The 5-7
  // minute real image-generation step dominates the Experience Creator
  // happy-path, so this lets developers iterate on intake/design/build/
  // handoff in seconds. OPENAI_API_KEY must still be set for the tool
  // to pass its env-gate registration (see envRequirements.ts).
  const mockFlag = process.env.MOCK_GENERATE_IMAGES;
  if (mockFlag === '1' || mockFlag === 'true') {
    // 16x9 white/gray checkerboard PNG. Valid image bytes so any downstream
    // consumer that decodes the artifact still sees a real PNG, and the
    // chess pattern reads as a placeholder when stretched to the slot size.
    const STUB_PNG_B64 =
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAHklEQVR42mP4////mTNniCcZSFL9//9/hlEbaGEDAK/sg1imrR7ZAAAAAElFTkSuQmCC';

    logger.info(
      { imageCount: images.length, imageNames: images.map((i) => i.name) },
      '[MOCK] MOCK_GENERATE_IMAGES set — returning stub PNGs without calling provider',
    );

    if (context.createArtifact) {
      for (const img of images) {
        await context.createArtifact(img.name, STUB_PNG_B64, 'png');
      }
    }

    return {
      status: 'success',
      data: {
        message: `[MOCK] Returned ${images.length} stub images (MOCK_GENERATE_IMAGES set)`,
        imageNames: images.map((img) => img.name),
        model: 'mock',
        strategy: 'mock',
        modelResponse: '',
      },
    };
  }

  try {
    const modelHint = process.env.IMAGE_GENERATION_MODEL || DEFAULT_IMAGE_MODEL;
    const strategy = getImageGenerationStrategy(modelHint);
    logger.info({ modelHint, strategyName: strategy.name }, 'Selected image generation strategy');

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
          model: modelHint,
          strategy: strategy.name,
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
      logger.warn({ strategy: strategy.name, textPreview: result.text.substring(0, 200) }, 'Image strategy returned text without images');

      return {
        status: 'error',
        data: {
          error: `${strategy.name} did not generate images`,
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
