# Nano Banana Multi-Turn Image Generation Integration

## Overview

Refactor image generation to use Nano Banana's multi-turn conversational approach for generating multiple images with consistent visual style. This eliminates the "lossy translation" problem where GPT-4o interprets visual styles and loses fidelity.

## Problem Statement

**Current Architecture (Broken):**
```
Frontend Agent → Backend Agent (GPT-4o) → generateImage tool → Nano Banana
```

**Issue:** GPT-4o acts as an intermediary that:
1. Reads visual style descriptions (e.g., "Modern Surreal Collage")
2. Interprets and creates individual prompts for each image
3. Loses style specification during translation
4. Nano Banana receives only content descriptions, no style info
5. Results in realistic images instead of styled images

**Evidence:** User requested "Modern Surreal Collage" style but received photorealistic images because the style instruction never reached Nano Banana.

## Solution Architecture

**New Architecture (Path C):**
```
Frontend Agent 
  ↓ [delegates]
Backend Image Orchestrator Agent (GPT-4o) - THIN LAYER
  ↓ [calls generateImages tool with structured data]
Image Generation Code
  ↓ [calls Nano Banana Strategy with multi-turn]
Nano Banana Multi-Turn Conversation
  ↓ [returns 3 images with consistent style]
Image Generation Code
  ↓ [saves all images, returns success/error]
Backend Orchestrator Agent
  ↓ [handles result, retries if needed]
Frontend Agent
```

### Key Changes

1. **Backend Agent becomes thin orchestrator** - Extracts info, doesn't interpret
2. **New `generateImages` tool** - Takes structured data, handles multi-turn internally
3. **Multi-turn Nano Banana** - Generates images one at a time with visual context
4. **Algorithmic happy path** - No AI needed for success case
5. **Intelligent error handling** - Orchestrator handles edge cases

## Implementation Plan

### 1. Remove Deprecated Code

**Files to delete:**
- `src/app/lib/tools/image-generator/strategies/ImagenStrategy.ts`

**Rationale:** Imagen is deprecated, we're standardizing on Nano Banana.

### 2. Create New `generateImages` Tool

**Location:** `src/app/lib/tools/image-generator/`

**Tool Interface:**
```typescript
interface GenerateImagesArgs {
  visualStyle: string;          // Full style description
  aspectRatio: string;           // e.g., "16:9"
  images: Array<{
    name: string;                // e.g., "mentor_scene"
    description: string;         // Scene description
  }>;
  additionalInstructions?: string; // For retry scenarios
}

interface GenerateImagesResult {
  status: 'success' | 'partial' | 'error';
  data: {
    message?: string;            // Success message
    imageNames?: string[];       // Names of saved images
    error?: string;              // Error description
    receivedCount?: number;      // For partial results
    expectedCount?: number;      // For partial results
    textResponse?: string;       // Nano Banana's text (NO binary)
    modelResponse?: string;      // For refusals
    details?: string;            // For API errors
  };
}
```

**Tool Implementation:**
```typescript
async function generateImages(args: GenerateImagesArgs, context: ToolContext) {
  const { visualStyle, aspectRatio, images, additionalInstructions } = args;
  
  // Call Nano Banana Strategy with multi-turn
  const nanoBananaResults = await nanoBananaStrategy.generateMultiTurn({
    visualStyle,
    aspectRatio,
    imageSpecs: images,
    additionalInstructions
  });
  
  // HAPPY PATH - Algorithmic validation
  if (nanoBananaResults.images.length === images.length) {
    // Save all images
    for (let i = 0; i < images.length; i++) {
      await context.createArtifact(
        images[i].name,
        nanoBananaResults.images[i].data,
        'png'
      );
    }
    
    return {
      status: 'success',
      data: {
        message: `Successfully generated ${images.length} images`,
        imageNames: images.map(img => img.name)
      }
    };
  }
  
  // EDGE CASE 1: Wrong number of images
  if (nanoBananaResults.images.length !== images.length) {
    return {
      status: 'partial',
      data: {
        error: `Expected ${images.length} images, received ${nanoBananaResults.images.length}`,
        receivedCount: nanoBananaResults.images.length,
        expectedCount: images.length,
        textResponse: nanoBananaResults.text, // NO BINARY DATA
      }
    };
  }
  
  // EDGE CASE 2: Text-only response (refusal/clarification)
  if (nanoBananaResults.images.length === 0 && nanoBananaResults.text) {
    return {
      status: 'error',
      data: {
        error: 'Nano Banana did not generate images',
        modelResponse: nanoBananaResults.text, // NO BINARY DATA
      }
    };
  }
  
  // EDGE CASE 3: API error
  if (nanoBananaResults.error) {
    return {
      status: 'error',
      data: {
        error: 'Image generation failed',
        details: nanoBananaResults.error,
      }
    };
  }
}
```

### 3. Refactor NanoBananaStrategy for Multi-Turn

**Location:** `src/app/lib/tools/image-generator/strategies/NanoBananaStrategy.ts`

**Key Methods:**

#### `generateMultiTurn()`
Main entry point for multi-turn generation.

```typescript
async generateMultiTurn(args: {
  visualStyle: string;
  aspectRatio: string;
  imageSpecs: Array<{ name: string; description: string }>;
  additionalInstructions?: string;
}): Promise<{
  images: Array<{ data: string; metadata?: any }>;
  text: string;
  error?: string;
}> {
  
  const conversationHistory = [];
  const results = {
    images: [],
    text: '',
    error: null
  };
  
  // Turn 1: Generate first image with full context
  const firstPrompt = this.buildFirstTurnPrompt(
    args.visualStyle,
    args.aspectRatio,
    args.imageSpecs[0],
    args.imageSpecs.length,
    args.additionalInstructions
  );
  
  conversationHistory.push({
    role: 'user',
    parts: [{ text: firstPrompt }]
  });
  
  const response1 = await this.callNanoBanana(conversationHistory);
  conversationHistory.push(response1.candidates[0].content);
  
  // Extract image 1
  const image1 = this.extractImage(response1);
  if (image1) results.images.push(image1);
  
  // Turn 2: Generate second image (references first)
  const secondPrompt = this.buildFollowUpPrompt(
    args.imageSpecs[1],
    2,
    args.imageSpecs.length
  );
  
  conversationHistory.push({
    role: 'user',
    parts: [{ text: secondPrompt }]
  });
  
  const response2 = await this.callNanoBanana(conversationHistory);
  conversationHistory.push(response2.candidates[0].content);
  
  // Extract image 2
  const image2 = this.extractImage(response2);
  if (image2) results.images.push(image2);
  
  // Turn 3: Generate third image (references first two)
  const thirdPrompt = this.buildFollowUpPrompt(
    args.imageSpecs[2],
    3,
    args.imageSpecs.length
  );
  
  conversationHistory.push({
    role: 'user',
    parts: [{ text: thirdPrompt }]
  });
  
  const response3 = await this.callNanoBanana(conversationHistory);
  
  // Extract image 3
  const image3 = this.extractImage(response3);
  if (image3) results.images.push(image3);
  
  // Collect all text responses
  results.text = this.extractAllText([response1, response2, response3]);
  
  return results;
}
```

#### `buildFirstTurnPrompt()`
Creates the initial prompt with full style context.

```typescript
private buildFirstTurnPrompt(
  visualStyle: string,
  aspectRatio: string,
  firstImage: { name: string; description: string },
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

${additionalInstructions ? `ADDITIONAL INSTRUCTIONS:\n${additionalInstructions}\n\n` : ''}

This is image 1 of ${totalImages}:
NAME: ${firstImage.name}
DESCRIPTION: ${firstImage.description}

Generate this first image now in the specified visual style.`;
}
```

#### `buildFollowUpPrompt()`
Creates follow-up prompts that reference previous images.

```typescript
private buildFollowUpPrompt(
  image: { name: string; description: string },
  imageNumber: number,
  totalImages: number
): string {
  return `Perfect! Now generate image ${imageNumber} of ${totalImages}, maintaining the SAME visual style as the previous image${imageNumber > 2 ? 's' : ''}.

NAME: ${image.name}
DESCRIPTION: ${image.description}

Generate this image now, keeping the visual style consistent with the previous image${imageNumber > 2 ? 's' : ''}.`;
}
```

#### `callNanoBanana()`
Handles the actual API call with conversation history.

```typescript
private async callNanoBanana(conversationHistory: any[]) {
  const googleAI = await this.getGoogleAI();
  
  logger.info({ 
    turnNumber: Math.ceil(conversationHistory.length / 2),
    historyLength: conversationHistory.length 
  }, '=== NANO BANANA API CALL ===');
  
  const response = await googleAI.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: conversationHistory,
  });
  
  // Log response structure (excluding binary)
  const responseStructure = {
    hasCandidates: !!response.candidates,
    numberOfCandidates: response.candidates?.length || 0,
    candidates: response.candidates?.map((candidate, idx) => ({
      index: idx,
      finishReason: candidate.finishReason,
      numberOfParts: candidate.content?.parts?.length || 0,
      parts: candidate.content?.parts?.map(part => ({
        hasText: !!part.text,
        textPreview: part.text ? part.text.substring(0, 100) : undefined,
        hasInlineData: !!part.inlineData,
        inlineDataMimeType: part.inlineData?.mimeType,
        inlineDataLength: part.inlineData?.data ? 
          Buffer.from(part.inlineData.data, 'base64').length : 0
      }))
    }))
  };
  logger.info({ responseStructure }, '=== NANO BANANA RESPONSE ===');
  
  return response;
}
```

#### `extractImage()`
Extracts a single image from a response.

```typescript
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
```

#### `extractAllText()`
Collects all text responses from multiple turns.

```typescript
private extractAllText(responses: any[]): string {
  const textParts = [];
  
  for (const response of responses) {
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.text) {
          textParts.push(part.text);
        }
      }
    }
  }
  
  return textParts.join('\n\n');
}
```

### 4. Update Image Generation Agent Instructions

**Location:** `storage/hal/resources/instructions/agent/image-generation-agent.md`

**Key Changes:**

1. **Simplify agent's role** - From prompt engineer to information extractor
2. **Update tool call pattern** - Single `generateImages` call instead of multiple `generateImage` calls
3. **Update success criteria** - Agent validates tool response, not individual images

**New Instructions Excerpt:**
```markdown
## Your Process

1. Retrieve the design document using the `artifact` tool
2. Extract the following information:
   - Visual style description (from the design document or user request)
   - Scene descriptions for all three images (mentor, practice, feedback)
3. Call the `generateImages` tool ONCE with all information:
   ```javascript
   generateImages({
     visualStyle: "Modern Surreal Collage - Shapes reduced to...",
     aspectRatio: "16:9",
     images: [
       { name: "mentor_scene", description: "..." },
       { name: "practice_scene", description: "..." },
       { name: "feedback_scene", description: "..." }
     ]
   })
   ```
4. Handle the tool response:
   - If `status: 'success'`: Create process notes and complete
   - If `status: 'partial'` or `status: 'error'`: Read the error message and retry with modifications
5. Create process notes documenting the generation process

## Important Notes

- You are NOT responsible for crafting image prompts
- You are NOT responsible for ensuring style consistency
- Your job is to EXTRACT information and pass it to the tool
- The tool handles all image generation complexity
- If the tool returns an error, you can retry with `additionalInstructions`
```

### 5. Update Tool Registry

**Location:** `src/app/lib/ToolRegistry.ts`

**Changes:**
1. Register new `generateImages` tool
2. Keep old `generateImage` tool for backward compatibility (mark as deprecated)
3. Update tool group for image-generator plugin

### 6. Update Image Generator Manager

**Location:** `src/app/lib/tools/image-generator/ImageGeneratorManager.ts`

**Changes:**
1. Export new `generateImages` function
2. Keep old `generateImage` function (calls new one with single image)
3. Update strategy selection to only use NanoBananaStrategy

## Benefits of This Architecture

### 1. No Translation Loss
Visual style goes directly to Nano Banana without GPT-4o interpretation.

### 2. Style Consistency
Multi-turn allows Nano Banana to see its own previous outputs and match them exactly:
- Exact color palette (specific hex values, not just "dusty reds")
- Shadow technique (blur radius, opacity, angle)
- Composition style (framing, negative space)
- Texture approach (specific "hand-cut" aesthetic)
- Line weight (exact thickness if using outlines)

### 3. Algorithmic Efficiency
Happy path (90% case) requires no AI interpretation - just save images and return success.

### 4. Intelligent Error Handling
Edge cases handled by Orchestrator Agent:
- Wrong image count → retry with clarification
- Text-only response → read and adapt
- API error → retry or report to user

### 5. Future-Proof
Architecture naturally extends to:
- Iterative refinement ("make image 2 brighter")
- Style transfer (user uploads image, apply style)
- Compositional variations (same style, different content)

### 6. Clean Separation of Concerns
- **Orchestrator Agent**: Information extraction, decision-making
- **generateImages Tool**: Execution, validation
- **NanoBananaStrategy**: API communication, prompt templating

## Testing Strategy

### Unit Tests
1. Test prompt template generation
2. Test image extraction from responses
3. Test conversation history building
4. Test error handling for each edge case

### Integration Tests
1. Test full multi-turn flow with mock Nano Banana responses
2. Test retry logic with Orchestrator Agent
3. Test artifact creation and naming

### End-to-End Tests
1. Generate 3 images with "Modern Surreal Collage" style
2. Verify visual consistency (manual inspection)
3. Test error scenarios (wrong count, refusal, API error)
4. Verify Orchestrator retry behavior

## Rollout Plan

1. Implement NanoBananaStrategy refactor
2. Create generateImages tool
3. Update Image Generation Agent instructions
4. Test with HAL experience
5. Verify visual style consistency
6. Deploy to production
7. Monitor for edge cases
8. Remove deprecated Imagen code after stability confirmed

## Success Criteria

- [ ] Images generated with correct visual style (not photorealistic)
- [ ] All three images visually consistent (same colors, shadows, style)
- [ ] Happy path completes without AI interpretation overhead
- [ ] Edge cases handled gracefully by Orchestrator
- [ ] No binary data sent to Orchestrator Agent
- [ ] Logging shows clear decision points and API calls

## Notes

- Multi-turn overhead (~15-20 seconds for 3 images) is acceptable trade-off for consistency
- Template-based prompt generation is the correct approach (deterministic, testable)
- Orchestrator Agent becomes thin layer, not prompt engineer
- Architecture aligns with Nano Banana's design (conversational image generation)
