/**
 * OpenAI image generation strategy (gpt-image-1 / gpt-image-2).
 * Uses sequential generate-then-edit calls to maintain visual style across a set of images.
 */

import OpenAI, { toFile } from 'openai';
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

const logger = createModuleLogger('OpenAIImageStrategy');

const DEFAULT_MODEL = 'gpt-image-2';

export class OpenAIImageStrategy implements ImageGenerationStrategy {
  readonly name = 'openai-image';

  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      if (!env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required for OpenAI image generation');
      }
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
    return this.client;
  }

  supportsModel(model: string): boolean {
    return model.startsWith('gpt-image');
  }

  async generateMultiTurn(options: MultiTurnGenerationOptions): Promise<MultiTurnGenerationResult> {
    const { visualStyle, aspectRatio, imageSpecs, additionalInstructions } = options;
    const model = DEFAULT_MODEL;
    const size = this.aspectRatioToSize(aspectRatio);

    logger.info('=== USING STRATEGY: OpenAIImageStrategy ===');
    logger.info({
      model,
      size,
      imageCount: imageSpecs.length,
      visualStylePreview: visualStyle.substring(0, 100) + '...',
      aspectRatio,
      hasAdditionalInstructions: !!additionalInstructions,
    }, 'Starting OpenAI image generation');

    const results: MultiTurnGenerationResult = { images: [], text: '', error: undefined };
    const client = this.getClient();
    let previousImageB64: string | null = null;

    try {
      for (let i = 0; i < imageSpecs.length; i++) {
        const spec = imageSpecs[i];
        const isFirst = i === 0;

        logger.info({
          turnNumber: i + 1,
          totalTurns: imageSpecs.length,
          imageName: spec.name,
          mode: isFirst ? 'generate' : 'edit',
        }, '=== OPENAI IMAGE TURN START ===');

        let b64: string;
        if (isFirst) {
          const prompt = this.buildFirstPrompt(visualStyle, spec, imageSpecs.length, additionalInstructions);
          const response = await client.images.generate({
            model,
            prompt,
            n: 1,
            size,
          });
          b64 = this.extractB64(response);
        } else {
          const prompt = this.buildEditPrompt(visualStyle, spec, i + 1, imageSpecs.length);
          const refFile = await toFile(
            Buffer.from(previousImageB64!, 'base64'),
            `reference-${i}.png`,
            { type: 'image/png' }
          );
          const response = await client.images.edit({
            model,
            image: refFile,
            prompt,
            n: 1,
            size,
          });
          b64 = this.extractB64(response);
        }

        results.images.push({ data: b64, metadata: { mimeType: 'image/png' } });
        previousImageB64 = b64;

        logger.info({
          turnNumber: i + 1,
          imageName: spec.name,
          imageSize: Buffer.from(b64, 'base64').length,
        }, 'Successfully generated image');
      }

      logger.info({
        totalImages: results.images.length,
        expectedImages: imageSpecs.length,
      }, '=== OPENAI MULTI-IMAGE GENERATION COMPLETE ===');

      return results;
    } catch (error) {
      logger.error(error, 'OpenAI image generation error');
      return {
        images: results.images,
        text: results.text,
        error: error instanceof Error ? error.message : 'Unknown error from OpenAI image generation',
      };
    }
  }

  private extractB64(response: any): string {
    const item = response?.data?.[0];
    if (!item?.b64_json) {
      throw new Error('OpenAI image response missing b64_json');
    }
    return item.b64_json;
  }

  private aspectRatioToSize(aspectRatio: string): '1024x1024' | '1536x1024' | '1024x1536' | 'auto' {
    const normalized = aspectRatio.replace(/\s+/g, '');
    if (normalized === '1:1') return '1024x1024';
    if (normalized === '16:9' || normalized === '3:2' || normalized === '4:3') return '1536x1024';
    if (normalized === '9:16' || normalized === '2:3' || normalized === '3:4') return '1024x1536';
    return 'auto';
  }

  private buildFirstPrompt(
    visualStyle: string,
    spec: MultiTurnImageSpec,
    totalImages: number,
    additionalInstructions?: string,
  ): string {
    return `Generate the first of ${totalImages} images for an educational simulation. All images must share a single consistent visual style.

VISUAL STYLE (apply identically to all ${totalImages} images):
${visualStyle}

REQUIREMENTS:
- No people in the image
- Cinematic, cohesive look that will repeat across the set
${additionalInstructions ? `\nADDITIONAL INSTRUCTIONS:\n${additionalInstructions}\n` : ''}
IMAGE 1 of ${totalImages}
NAME: ${spec.name}
DESCRIPTION: ${spec.description}`;
  }

  private buildEditPrompt(
    visualStyle: string,
    spec: MultiTurnImageSpec,
    imageNumber: number,
    totalImages: number,
  ): string {
    return `Using the supplied image as the visual style reference, create image ${imageNumber} of ${totalImages}. Match the previous image's color palette, lighting, composition language, and rendering style exactly. Do not include any people.

VISUAL STYLE (must match):
${visualStyle}

NEW SCENE
NAME: ${spec.name}
DESCRIPTION: ${spec.description}`;
  }

  async generateImage(_options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    return {
      success: false,
      error: 'OpenAIImageStrategy only supports generateMultiTurn',
    };
  }

  async generateImageWithModel(
    _model: string,
    _options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    return {
      success: false,
      error: 'OpenAIImageStrategy only supports generateMultiTurn',
    };
  }
}
