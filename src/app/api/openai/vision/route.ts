import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { EasyInputMessage, ResponseInputText, ResponseInputImage } from "openai/resources/responses/responses";
import { createModuleLogger } from '@/lib/logger';

const openai = new OpenAI();
const logger = createModuleLogger('openai-vision');

export async function POST(req: Request) {
  try {
    const { model, prompt, imageUrls, detail = "auto" } = await req.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: "At least one image URL is required" },
        { status: 400 }
      );
    }

    // Prepare the input array with text and images
    const content: (ResponseInputText | ResponseInputImage)[] = [
      { type: "input_text", text: prompt || "What's in this image?" },
      ...imageUrls.map(url => ({
        type: "input_image" as const,
        image_url: url,
        detail: detail,
      })),
    ];

    const input: EasyInputMessage = {
      role: "user",
      content,
    };

    const response = await openai.responses.create({
      model: model || "gpt-4o-mini",
      input: [input],
    });

    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error(error, 'Error in /openai/vision');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 