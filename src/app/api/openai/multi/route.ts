import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { 
  EasyInputMessage, 
  ResponseInputText, 
  ResponseInputImage,
  WebSearchTool,
} from "openai/resources/responses/responses";
import { createModuleLogger } from '@/lib/logger';

const openai = new OpenAI();
const logger = createModuleLogger('openai-multi');

export async function POST(req: Request) {
  try {
    const { 
      task, 
      model, 
      // Text generation parameters
      instructions, 
      input, 
      messages,
      // Vision parameters
      prompt,
      imageUrls,
      detail,
      // Web search parameters
      query,
      searchContextSize,
      userLocation
    } = await req.json();

    if (!task) {
      return NextResponse.json(
        { error: "Task type is required" },
        { status: 400 }
      );
    }

    let response;

    switch (task) {
      case "text":
        // Text generation with instructions or messages
        response = await openai.responses.create({
          model,
          input: messages || input,
          instructions: instructions,
        });
        break;

      case "vision":
        // Vision/image analysis
        if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
          return NextResponse.json(
            { error: "At least one image URL is required for vision tasks" },
            { status: 400 }
          );
        }

        const content: (ResponseInputText | ResponseInputImage)[] = [
          { type: "input_text", text: prompt || "What's in this image?" },
          ...imageUrls.map(url => ({
            type: "input_image" as const,
            image_url: url,
            detail: detail || "auto",
          })),
        ];

        const visionInput: EasyInputMessage = {
          role: "user",
          content,
        };

        response = await openai.responses.create({
          model: model || "gpt-4o-mini",
          input: [visionInput],
        });
        break;

      case "websearch":
        // Web search
        if (!query) {
          return NextResponse.json(
            { error: "A search query is required for web search tasks" },
            { status: 400 }
          );
        }

        const webSearchTool: WebSearchTool = {
          type: "web_search_preview",
          search_context_size: searchContextSize || "medium",
        };

        if (userLocation) {
          webSearchTool.user_location = {
            type: "approximate",
            ...userLocation
          };
        }

        response = await openai.responses.create({
          model: model || "gpt-4o",
          tools: [webSearchTool],
          input: query,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown task type: ${task}` },
          { status: 400 }
        );
    }

    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error(error, 'Error in /openai/multi');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 