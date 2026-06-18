/**
 * Nano Banana (Gemini with native image generation) strategy.
 * Uses Gemini's conversational multi-turn image generation API for consistent visual style.
 */

import {
  ImageGenerationStrategy,
  ImageGenerationOptions,
  ImageGenerationResult,
  MultiTurnGenerationOptions,
  MultiTurnGenerationResult,
  MultiTurnImageSpec,
} from './ImageGenerationStrategy';
import { createModuleLogger } from '@/lib/logger';
import { env } from '@/config/env';

const logger = createModuleLogger('NanoBananaStrategy');

export class NanoBananaStrategy implements ImageGenerationStrategy {
  readonly name = 'nano-banana';

  /**
   * Lazy-load Google AI client
   */
  private async getGoogleAI() {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      return new GoogleGenAI({
        apiKey: env.GOOGLE_AI_API_KEY,
      });
    } catch (error) {
      logger.error(error, 'Failed to initialize Google GenAI for Nano Banana');
      throw new Error(`Failed to initialize Google GenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if this strategy supports the given model
   */
  supportsModel(model: string): boolean {
    return model.includes('gemini') && (model.includes('image') || model.includes('flash-image') || model.includes('pro-image'));
  }

  /**
   * Generate multiple images using multi-turn conversation for style consistency
   */
  async generateMultiTurn(options: MultiTurnGenerationOptions): Promise<MultiTurnGenerationResult> {
    const { visualStyle, aspectRatio, imageSpecs, additionalInstructions } = options;

    logger.info('=== USING STRATEGY: NanoBananaStrategy (Multi-Turn) ===');
    logger.info({ 
      imageCount: imageSpecs.length,
      visualStyle: visualStyle.substring(0, 100) + '...',
      aspectRatio,
      hasAdditionalInstructions: !!additionalInstructions
    }, 'Starting multi-turn image generation');

    const conversationHistory: any[] = [];
    const results: MultiTurnGenerationResult = {
      images: [],
      text: '',
      error: undefined
    };

    try {
      const googleAI = await this.getGoogleAI();
      const model = 'gemini-3-pro-image-preview';

      logger.info({ model }, 'Using manual conversation history with thought signature preservation');
      
      // Generate each image in sequence
      for (let i = 0; i < imageSpecs.length; i++) {
        const isFirst = i === 0;
        const imageSpec = imageSpecs[i];

        // Build prompt for this turn
        const prompt = isFirst 
          ? this.buildFirstTurnPrompt(visualStyle, aspectRatio, imageSpec, imageSpecs.length, additionalInstructions)
          : this.buildFollowUpPrompt(imageSpec, i + 1, imageSpecs.length);

        // Add user message to conversation history
        conversationHistory.push({
          role: 'user',
          parts: [{ text: prompt }]
        });

        logger.info({ 
          turnNumber: i + 1,
          totalTurns: imageSpecs.length,
          imageName: imageSpec.name,
          promptPreview: prompt.substring(0, 150) + '...',
          historyLength: conversationHistory.length
        }, '=== NANO BANANA TURN START ===');

        // Call API with conversation history
        const response = await googleAI.models.generateContent({
          model: model,
          contents: conversationHistory,
          config: {
            responseModalities: ['TEXT', 'IMAGE']
          }
        });

        // Validate response has candidates
        if (!response.candidates || response.candidates.length === 0) {
          throw new Error('No candidates in response from Nano Banana');
        }

        // Log response structure
        this.logResponse(response, i + 1);

        // CRITICAL: Preserve the ENTIRE model response including thought signatures
        // We must keep all parts exactly as returned, including thoughtSignature fields
        const modelContent = response.candidates[0].content;
        if (!modelContent) {
          throw new Error('No content in response from Nano Banana');
        }
        
        conversationHistory.push(modelContent);

        logger.debug({
          turnNumber: i + 1,
          addedRole: modelContent.role,
          partsCount: modelContent.parts?.length,
          partStructure: modelContent.parts?.map((p: any) => ({
            hasText: !!p.text,
            hasInlineData: !!p.inlineData,
            hasThoughtSignature: !!(p.thoughtSignature || p.thought_signature),
            hasThought: !!p.thought
          }))
        }, 'Added model response to history');

        // Extract image from response
        const image = this.extractImage(response);
        if (image) {
          results.images.push(image);
          logger.info({ 
            turnNumber: i + 1,
            imageName: imageSpec.name,
            imageSize: Buffer.from(image.data, 'base64').length
          }, 'Successfully extracted image from turn');
        } else {
          logger.warn({ 
            turnNumber: i + 1,
            imageName: imageSpec.name
          }, 'No image extracted from turn');
        }

        // Collect text from this turn
        const turnText = this.extractText(response);
        if (turnText) {
          results.text += (results.text ? '\n\n' : '') + turnText;
        }
      }

      logger.info({ 
        totalImages: results.images.length,
        expectedImages: imageSpecs.length
      }, '=== MULTI-TURN GENERATION COMPLETE ===');

      return results;

    } catch (error) {
      logger.error(error, 'Multi-turn generation error');
      return {
        images: results.images, // Return any images we got before error
        text: results.text,
        error: error instanceof Error ? error.message : 'Unknown error occurred during multi-turn generation'
      };
    }
  }

  /**
   * Build the first turn prompt with full context
   */
  private buildFirstTurnPrompt(
    visualStyle: string,
    aspectRatio: string,
    firstImage: MultiTurnImageSpec,
    totalImages: number,
    additionalInstructions?: string
  ): string {
    return `You are an expert image generation specialist. I need you to generate ${totalImages} images for an educational simulation, one at a time, with consistent visual style.

VISUAL STYLE (apply to ALL ${totalImages} images):
${visualStyle}

TECHNICAL REQUIREMENTS:
- Aspect ratio: ${aspectRatio}
- No people in any images
- Maintain consistent style across all images

${additionalInstructions ? `ADDITIONAL INSTRUCTIONS:\n${additionalInstructions}\n\n` : ''}This is image 1 of ${totalImages}:
NAME: ${firstImage.name}
DESCRIPTION: ${firstImage.description}

Generate this first image now in the specified visual style.`;
  }

  /**
   * Build follow-up prompts that reference previous images
   */
  private buildFollowUpPrompt(
    image: MultiTurnImageSpec,
    imageNumber: number,
    totalImages: number
  ): string {
    return `Perfect! Now generate image ${imageNumber} of ${totalImages}, maintaining the SAME visual style as the previous image${imageNumber > 2 ? 's' : ''}.

NAME: ${image.name}
DESCRIPTION: ${image.description}

Generate this image now, keeping the visual style consistent with the previous image${imageNumber > 2 ? 's' : ''}.`;
  }

  /**
   * Log response structure (excluding binary data)
   */
  private logResponse(response: any, turnNumber: number) {
    const responseStructure = {
      turnNumber,
      hasCandidates: !!response.candidates,
      numberOfCandidates: response.candidates?.length || 0,
      candidates: response.candidates?.map((candidate: any, idx: number) => ({
        index: idx,
        finishReason: candidate.finishReason,
        safetyRatings: candidate.safetyRatings,
        numberOfParts: candidate.content?.parts?.length || 0,
        parts: candidate.content?.parts?.map((part: any) => ({
          hasText: !!part.text,
          textPreview: part.text ? part.text.substring(0, 100) + '...' : undefined,
          hasInlineData: !!part.inlineData,
          inlineDataMimeType: part.inlineData?.mimeType,
          inlineDataLength: part.inlineData?.data ? 
            Buffer.from(part.inlineData.data, 'base64').length : 0,
          hasThoughtSignature: !!(part.thought_signature || part.thoughtSignature),
          hasThought: !!part.thought
        }))
      }))
    };
    logger.info({ responseStructure }, '=== NANO BANANA RESPONSE ===');
  }

  /**
   * Extract a single image from a response
   */
  private extractImage(response: any): { data: string; metadata?: any } | null {
    if (!response.candidates || response.candidates.length === 0) {
      return null;
    }

    const parts = response.candidates[0].content.parts;
    for (const part of parts) {
      if (part.inlineData) {
        logger.debug({ 
          mimeType: part.inlineData.mimeType,
          dataLength: Buffer.from(part.inlineData.data, 'base64').length 
        }, 'Extracted image from response');

        return {
          data: part.inlineData.data,
          metadata: {
            mimeType: part.inlineData.mimeType
          }
        };
      }
    }

    return null;
  }

  /**
   * Extract text from a single response
   */
  private extractText(response: any): string {
    if (!response.candidates || response.candidates.length === 0) {
      return '';
    }

    const parts = response.candidates[0].content.parts;
    let text = '';

    for (const part of parts) {
      if (part.text) {
        text += part.text;
      }
    }

    return text;
  }

  /**
   * Legacy method required by ImageGenerationStrategy interface
   * @deprecated Use generateMultiTurn for all image generation
   */
  async generateImage(_options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    logger.warn('generateImage (legacy) called - use generateMultiTurn instead');
    return {
      success: false,
      error: 'This method is deprecated. Use generateMultiTurn for multi-turn image generation.'
    };
  }

  /**
   * Legacy method required by ImageGenerationStrategy interface
   * @deprecated Use generateMultiTurn for all image generation
   */
  async generateImageWithModel(
    _model: string,
    _options: ImageGenerationOptions
  ): Promise<ImageGenerationResult> {
    logger.warn('generateImageWithModel (legacy) called - use generateMultiTurn instead');
    return {
      success: false,
      error: 'This method is deprecated. Use generateMultiTurn for multi-turn image generation.'
    };
  }
}
