# Image Generation Strategies

This directory contains the strategy pattern implementation for image generation, allowing the system to seamlessly switch between different image generation providers (Imagen, Nano Banana, etc.) based on configuration.

## Overview

The strategy pattern decouples the image generation logic from the specific provider implementation, making it easy to:
- Add new image generation providers
- Switch between providers via configuration
- A/B test different models
- Handle provider-specific features (e.g., Nano Banana's text responses)

## Architecture

```
strategies/
├── ImageGenerationStrategy.ts   # Interface definition
├── ImagenStrategy.ts            # Google Imagen implementation
├── NanoBananaStrategy.ts        # Gemini Nano Banana implementation
├── index.ts                     # Strategy factory
└── README.md                    # This file
```

## Strategies

### ImagenStrategy

**Purpose:** High-quality dedicated image generation using Google's Imagen models.

**Supported Models:**
- `imagen-4.0-generate-001`
- `imagen-4.0-ultra-generate-001`
- `imagen-4.0-fast-generate-001`
- `imagen-3.0-generate-002`
- Any model name containing "imagen"

**Features:**
- Dedicated image generation API
- Aspect ratio control (1:1, 16:9, 9:16, 4:3, 3:4)
- Person generation control
- Returns only image data

**Example Configuration:**
```json
{
  "aiConfigurations": {
    "image-generation": {
      "provider": "google",
      "api": "generate",
      "model": "gpt-4o",
      "imageModel": "imagen-4.0-generate-001",
      "streaming": false,
      "modalities": ["image"]
    }
  }
}
```

### NanoBananaStrategy

**Purpose:** Conversational image generation using Gemini's native image capabilities.

**Supported Models:**
- `gemini-2.5-flash-image`
- `gemini-3-pro-image-preview`
- Any model name containing "gemini" AND "image"

**Features:**
- Conversational API (can return text AND images)
- Can provide explanations alongside images
- Can refuse requests with explanatory text
- Iterative refinement through conversation
- High-fidelity text rendering in images

**Response Types:**
1. **Image only** - Standard success case
2. **Image + Text** - Image with explanation/commentary
3. **Text only** - Refusal or clarification request

**Example Configuration:**
```json
{
  "aiConfigurations": {
    "image-generation": {
      "provider": "google",
      "api": "generate",
      "model": "gpt-4o",
      "imageModel": "gemini-2.5-flash-image",
      "streaming": false,
      "modalities": ["text", "image"]
    }
  }
}
```

## Usage

### Automatic Strategy Selection

The system automatically selects the appropriate strategy based on the `imageModel` field in the AI configuration:

```typescript
// In your tool context, the strategy is automatically selected
const strategy = getImageGenerationStrategy(actualImageModel);
const result = await strategy.generateImageWithModel(actualImageModel, {
  prompt: "A beautiful sunset over mountains",
  aspectRatio: "16:9",
  numberOfImages: 1,
  personGeneration: "allow_adult"
});
```

### Strategy Selection Logic

1. Check if model name contains "gemini" and "image" → **NanoBananaStrategy**
2. Check if model name contains "imagen" → **ImagenStrategy**
3. Default → **ImagenStrategy** (for backward compatibility)

### Handling Responses

#### Imagen Response
```typescript
{
  success: true,
  imageData: "base64_encoded_image_data",
  metadata: {
    provider: "google",
    model: "imagen-4.0-generate-001",
    aspectRatio: "16:9"
  }
}
```

#### Nano Banana Response (with text)
```typescript
{
  success: true,
  imageData: "base64_encoded_image_data",
  text: "I've created a sunset scene with warm orange and pink tones...",
  metadata: {
    provider: "google",
    model: "gemini-2.5-flash-image"
  }
}
```

#### Nano Banana Refusal
```typescript
{
  success: false,
  text: "I cannot generate that image because it violates content policies.",
  error: "Model returned text response without image..."
}
```

## Switching Between Strategies

To switch from Imagen to Nano Banana (or vice versa), simply update the `imageModel` field in your experience configuration:

### Current (Imagen)
```json
"imageModel": "imagen-4.0-generate-preview-06-06"
```

### Switch to Nano Banana
```json
"imageModel": "gemini-2.5-flash-image"
```

**No code changes required!** The strategy pattern handles the rest.

## Adding a New Strategy

To add support for a new image generation provider:

1. **Create a new strategy class** implementing `ImageGenerationStrategy`:

```typescript
// strategies/NewProviderStrategy.ts
import { ImageGenerationStrategy, ImageGenerationOptions, ImageGenerationResult } from './ImageGenerationStrategy';

export class NewProviderStrategy implements ImageGenerationStrategy {
  readonly name = 'new-provider';

  supportsModel(model: string): boolean {
    return model.includes('new-provider');
  }

  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    // Implementation
  }

  async generateImageWithModel(model: string, options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    // Implementation
  }
}
```

2. **Register the strategy** in `strategies/index.ts`:

```typescript
import { NewProviderStrategy } from './NewProviderStrategy';

const strategies: ImageGenerationStrategy[] = [
  new NewProviderStrategy(), // Add your strategy
  new NanoBananaStrategy(),
  new ImagenStrategy(),
];
```

3. **Update configuration** to use the new provider:

```json
"imageModel": "new-provider-model-name"
```

## Testing

### Test with Imagen
```json
{
  "imageModel": "imagen-4.0-generate-001"
}
```

### Test with Nano Banana
```json
{
  "imageModel": "gemini-2.5-flash-image"
}
```

### Compare Results
Create two identical experiences with different `imageModel` configurations and compare:
- Image quality
- Generation speed
- Cost per image
- Success rate
- Model commentary (Nano Banana only)

## Best Practices

1. **Use imageModel field**: Always specify the image generation model in the `imageModel` field, separate from the main chat `model`.

2. **Handle text responses**: When using Nano Banana, be prepared to handle text responses in addition to images.

3. **Log strategy selection**: The system logs which strategy is selected, making debugging easier.

4. **Aspect ratio**: Both strategies support aspect ratios, but Imagen has more explicit support.

5. **Error handling**: Both strategies return structured error responses with helpful messages.

## Comparison: Imagen vs Nano Banana

| Feature | Imagen | Nano Banana |
|---------|--------|-------------|
| API Type | Dedicated image generation | Conversational content generation |
| Response | Image only | Image + optional text |
| Aspect Ratio | Explicit support (1:1, 16:9, etc.) | Implicit through prompt |
| Text in Images | Good | Excellent (high-fidelity) |
| Explanations | No | Yes |
| Refusals | Silent failure | Explanatory text |
| Iteration | New request required | Conversational refinement |
| Speed | Fast | Fast |
| Quality | Excellent | Excellent |

## Troubleshooting

### Strategy not being selected
- Check the `imageModel` field in your configuration
- Verify the model name matches the pattern in `supportsModel()`
- Check logs for strategy selection messages

### No image generated
- Check if Nano Banana returned text-only response (refusal)
- Verify API keys are configured correctly
- Check logs for detailed error messages

### Wrong strategy selected
- Ensure model name patterns don't overlap
- Check strategy order in `strategies/index.ts` (more specific patterns should come first)

## Future Enhancements

Potential improvements to the strategy pattern:

1. **Caching**: Cache generated images to avoid regeneration
2. **Retry logic**: Automatic retry with fallback strategies
3. **Cost tracking**: Track API costs per strategy
4. **Quality metrics**: Collect quality ratings for each strategy
5. **Batch generation**: Support generating multiple images in one call
6. **Style transfer**: Support for style transfer between images
7. **Image editing**: Support for iterative image editing (especially with Nano Banana)
