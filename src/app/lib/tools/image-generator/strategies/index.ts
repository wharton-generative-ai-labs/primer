/**
 * Strategy factory for image generation.
 * Selects the appropriate strategy based on the model name.
 */

import { ImageGenerationStrategy } from './ImageGenerationStrategy';
import { NanoBananaStrategy } from './NanoBananaStrategy';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ImageStrategyFactory');

// Export types and strategies
export * from './ImageGenerationStrategy';
export { NanoBananaStrategy } from './NanoBananaStrategy';

/**
 * Available strategies
 */
const strategies: ImageGenerationStrategy[] = [
  new NanoBananaStrategy(), // Nano Banana is the primary strategy
];

/**
 * Get the appropriate image generation strategy based on the model name.
 * 
 * @param model - The model name (e.g., 'gemini-2.5-flash-image', 'gemini-3-pro-image-preview')
 * @returns The appropriate strategy, or NanoBananaStrategy as default
 */
export function getImageGenerationStrategy(model: string): ImageGenerationStrategy {
  logger.debug({ model }, 'Selecting image generation strategy');

  // Find the first strategy that supports this model
  for (const strategy of strategies) {
    if (strategy.supportsModel(model)) {
      logger.debug({ model, strategy: strategy.name }, 'Selected strategy');
      return strategy;
    }
  }

  // Default to Nano Banana
  logger.debug({ model }, 'No specific strategy found, defaulting to Nano Banana');
  return new NanoBananaStrategy();
}

/**
 * Check if a model is supported by any strategy
 */
export function isModelSupported(model: string): boolean {
  return strategies.some(strategy => strategy.supportsModel(model));
}

/**
 * Get all available strategy names
 */
export function getAvailableStrategies(): string[] {
  return strategies.map(s => s.name);
}
