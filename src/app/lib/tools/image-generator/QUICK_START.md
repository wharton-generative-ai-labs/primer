# Image Generation Quick Start Guide

## Local Mock Mode (skip the 5-7 min wait while iterating)

Set `MOCK_GENERATE_IMAGES=1` in `.env` to make the `generateImages` tool
return stub 1x1 PNG artifacts instead of calling the real provider. The
stubs are valid PNGs and are written through the normal `createArtifact`
path, so downstream agents (e.g. the Experience Creator's
`experience-builder`) see real artifact ids and the rest of the build
flow is unchanged.

```bash
# .env
OPENAI_API_KEY=sk-...        # still required (tool env-gate)
MOCK_GENERATE_IMAGES=1       # short-circuits generateImages
```

Unset (or any value other than `1` / `true`) restores the real
provider path. See `image.ts` for the short-circuit and the
`__tests__/image.test.ts` suite for the contract.

## TL;DR - How to Switch to Nano Banana

**Current setup (Imagen):**
```json
"imageModel": "imagen-4.0-generate-preview-06-06"
```

**Switch to Nano Banana:**
```json
"imageModel": "gemini-2.5-flash-image"
```

That's it! No code changes needed.

---

## What Changed?

We now support **two image generation strategies**:

1. **Imagen** - Dedicated image generation API (current/default)
2. **Nano Banana** - Gemini's conversational image generation (new)

The system automatically picks the right strategy based on your `imageModel` configuration.

## Why Nano Banana?

### Key Differences

| Feature | Imagen | Nano Banana |
|---------|--------|-------------|
| **API** | Dedicated image API | Conversational API |
| **Response** | Image only | Image + text commentary |
| **Refusals** | Silent fail | Explains why |
| **Text in images** | Good | Excellent |
| **Iteration** | Start over | Conversational refinement |

### Nano Banana Advantages

1. **Conversational**: Can explain what it's creating
2. **Better text rendering**: Excellent at text in images (logos, posters, diagrams)
3. **Helpful refusals**: Tells you why it can't generate something
4. **Commentary**: Provides context about the generated image

### Example Responses

**Imagen:**
```
✅ Successfully generated image "scene-1" using Google imagen-4.0-generate-001.
The image has been saved as an artifact.
```

**Nano Banana:**
```
✅ Successfully generated image "scene-1" using Google gemini-2.5-flash-image.

💬 Model response: I've created a warm, inviting classroom scene with natural 
lighting streaming through large windows. The mentor figure is positioned to 
create an approachable, welcoming atmosphere.

The image has been saved as an artifact.
```

## How to Test

### Option 1: Update Existing Experience

1. Open `storage/{experienceId}/experience.json`
2. Find your image generation agent's `aiConfiguration`
3. Change the `imageModel`:
   ```json
   "image-generation": {
     "provider": "google",
     "api": "generate",
     "model": "gpt-4o",
     "imageModel": "gemini-2.5-flash-image",  // ← Change this
     "streaming": false
   }
   ```
4. Test your workflow

### Option 2: Create Test Experience

Create a new experience with Nano Banana configuration to compare side-by-side.

## Available Models

### Imagen Models
- `imagen-4.0-generate-001` (standard)
- `imagen-4.0-ultra-generate-001` (high quality)
- `imagen-4.0-fast-generate-001` (faster)
- `imagen-3.0-generate-002` (previous version)

### Nano Banana Models
- `gemini-2.5-flash-image` (fast, recommended)
- `gemini-3-pro-image-preview` (advanced, higher quality)

## Troubleshooting

### "No image generated"
- Check logs for strategy selection
- Verify API key is set (`GOOGLE_AI_API_KEY`)
- Check if Nano Banana returned text-only (refusal)

### "Wrong model being used"
- Verify `imageModel` field in configuration
- Check logs: `Selected image generation strategy: {name}`
- Ensure model name matches patterns:
  - Imagen: contains "imagen"
  - Nano Banana: contains "gemini" AND "image"

### "Text response without image"
Nano Banana may refuse to generate certain images. Check the response text for explanation:
```json
{
  "status": "error",
  "data": {
    "error": "Model returned text response without image...",
    "modelResponse": "I cannot generate that image because..."
  }
}
```

## Rollback

To switch back to Imagen:
```json
"imageModel": "imagen-4.0-generate-001"
```

System automatically uses Imagen strategy. No code changes needed.

## When to Use Each

### Use Imagen When:
- You want pure image generation
- You don't need explanations
- You're using existing tested configurations
- You want proven, stable performance

### Use Nano Banana When:
- You want text in images (logos, posters, diagrams)
- You want the model to explain what it created
- You want helpful refusal messages
- You want to experiment with conversational image generation
- You want iterative refinement (future feature)

## Example Configurations

### Design Agent (Current - Imagen)
```json
{
  "aiConfigurations": {
    "image-generation": {
      "provider": "google",
      "api": "generate",
      "model": "gpt-4o",
      "imageModel": "imagen-4.0-generate-preview-06-06",
      "streaming": false,
      "modalities": ["image"]
    }
  },
  "agents": {
    "image-generation-agent": {
      "name": "Image Generation Agent",
      "type": "backend",
      "aiConfiguration": "image-generation"
    }
  }
}
```

### Design Agent (New - Nano Banana)
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
  },
  "agents": {
    "image-generation-agent": {
      "name": "Image Generation Agent",
      "type": "backend",
      "aiConfiguration": "image-generation"
    }
  }
}
```

## Questions?

See the full documentation:
- **Strategy details**: `strategies/README.md`
- **Implementation summary**: `IMPLEMENTATION_SUMMARY.md` (in project root)
- **Code**: `strategies/` directory

## Quick Comparison Test

Want to compare both? Here's a simple test:

1. Generate an image with Imagen (current config)
2. Note the result
3. Change `imageModel` to `gemini-2.5-flash-image`
4. Generate the same image with Nano Banana
5. Compare:
   - Image quality
   - Generation time
   - Model commentary
   - Cost (check your Google AI usage)

Choose the one that works best for your use case!
