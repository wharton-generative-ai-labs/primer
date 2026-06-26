import { ToolContext, ToolResponse } from '@/app/lib/tools/types';

export interface ImageGeneratorToolContext extends ToolContext {
  generateImage: (prompt: string, options?: ImageGenerationOptions) => Promise<ImageGenerationResult>;
}

// Legacy DALL-E options
export interface ImageGenerationOptions {
  model?: 'dall-e-2' | 'dall-e-3';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  n?: number;
}

// Legacy result format
export interface ImageGenerationResult {
  url: string;
  revisedPrompt?: string;
  error?: string;
}

export interface ImageGeneratorManager {
  generateImage: (prompt: string, options?: ImageGenerationOptions) => Promise<ImageGenerationResult>;
}

// Enhanced tool response that includes strategy information
export interface ImageGeneratorToolResponse extends ToolResponse {
  data: {
    imageUrl?: string;
    revisedPrompt?: string;
    error?: string;
    // New fields for strategy pattern
    provider?: string;
    model?: string;
    strategy?: string;
    imageName?: string;
    modelResponse?: string; // Text response from Nano Banana
  };
}

// Strategy-specific types (re-exported from strategies for convenience)
export interface StrategyImageGenerationResult {
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

export interface StrategyImageGenerationOptions {
  prompt: string;
  aspectRatio?: string;
  numberOfImages?: number;
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
} 