import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createModuleLogger } from '@/lib/logger';

const openai = new OpenAI();
const logger = createModuleLogger('openai-generate-image');

export async function POST(req: Request) {
  try {
    const { 
      prompt, 
      model = "dall-e-3",
      size = "1024x1024",
      quality = "standard",
      style,
      n = 1
    } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "A prompt is required" },
        { status: 400 }
      );
    }

    // Validate model
    if (model !== "dall-e-2" && model !== "dall-e-3") {
      return NextResponse.json(
        { error: "Invalid model. Must be 'dall-e-2' or 'dall-e-3'" },
        { status: 400 }
      );
    }

    // Validate size based on model
    const validSizes = model === "dall-e-2" 
      ? ["256x256", "512x512", "1024x1024"]
      : ["1024x1024", "1792x1024", "1024x1792"];
    
    if (!validSizes.includes(size)) {
      return NextResponse.json(
        { error: `Invalid size for ${model}. Must be one of: ${validSizes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate quality (only for DALL-E 3)
    if (model === "dall-e-3" && quality !== "standard" && quality !== "hd") {
      return NextResponse.json(
        { error: "Invalid quality. Must be 'standard' or 'hd'" },
        { status: 400 }
      );
    }

    // Validate style (only for DALL-E 3)
    if (model === "dall-e-3" && style && style !== "vivid" && style !== "natural") {
      return NextResponse.json(
        { error: "Invalid style. Must be 'vivid' or 'natural'" },
        { status: 400 }
      );
    }

    // Validate n (number of images)
    if (model === "dall-e-3" && n !== 1) {
      return NextResponse.json(
        { error: "DALL-E 3 only supports generating 1 image at a time" },
        { status: 400 }
      );
    }

    if (model === "dall-e-2" && (n < 1 || n > 10)) {
      return NextResponse.json(
        { error: "DALL-E 2 supports generating 1-10 images at a time" },
        { status: 400 }
      );
    }

    // Prepare options for the API call
    const options: any = {
      model,
      prompt,
      n,
      size,
    };

    // Add quality and style options for DALL-E 3
    if (model === "dall-e-3") {
      options.quality = quality;
      if (style) {
        options.style = style;
      }
    }

    // Call the OpenAI API
    const response = await openai.images.generate(options);

    logger.debug({ response: { dataLength: response.data?.length, hasRevisedPrompt: !!response.data?.[0]?.revised_prompt } }, 'Image generation response');
    
    // Return the first image URL and revised prompt
    return NextResponse.json({
      url: response.data![0].url,
      revisedPrompt: response.data![0].revised_prompt
    });
  } catch (error: unknown) {
    logger.error(error, 'Error in /openai/generate-image');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 