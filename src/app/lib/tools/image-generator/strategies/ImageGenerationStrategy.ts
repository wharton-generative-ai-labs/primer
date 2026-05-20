/**
 * Strategy interface for different image generation providers.
 * Allows switching between Imagen, Nano Banana, and other providers.
 */

export interface ImageGenerationResult {
  success: boolean;
  imageData?: string; // base64 encoded image
  text?: string; // optional text response (e.g., from Nano Banana)
  error?: string;
  metadata?: {
    provider: string;
    model: string;
    aspectRatio?: string;
  };
}

export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: string;
  numberOfImages?: number;
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
}

export interface MultiTurnImageSpec {
  name: string;
  description: string;
}

export interface MultiTurnGenerationOptions {
  visualStyle: string;
  aspectRatio: string;
  imageSpecs: MultiTurnImageSpec[];
  additionalInstructions?: string;
}

export interface MultiTurnGenerationResult {
  images: Array<{ data: string; metadata?: any }>;
  text: string;
  error?: string;
}

/**
 * Base interface for image generation strategies
 */
export interface ImageGenerationStrategy {
  /**
   * The name of the strategy (e.g., 'imagen', 'nano-banana')
   */
  readonly name: string;

  /**
   * Generate an image using the provider's API
   */
  generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult>;

  /**
   * Generate an image with a specific model
   */
  generateImageWithModel(model: string, options: ImageGenerationOptions): Promise<ImageGenerationResult>;

  /**
   * Generate a sequence of images with a consistent visual style.
   */
  generateMultiTurn(options: MultiTurnGenerationOptions): Promise<MultiTurnGenerationResult>;

  /**
   * Check if this strategy supports the given model name
   */
  supportsModel(model: string): boolean;
}
