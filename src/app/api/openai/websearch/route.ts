import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { WebSearchTool } from "openai/resources/responses/responses";
import { createModuleLogger } from '@/lib/logger';

const openai = new OpenAI();
const logger = createModuleLogger('openai-websearch');

export async function POST(req: Request) {
  try {
    const { 
      model, 
      query, 
      searchContextSize = "medium",
      userLocation
    } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: "A search query is required" },
        { status: 400 }
      );
    }

    // Create the web search tool configuration
    const webSearchTool: WebSearchTool = {
      type: "web_search_preview",
      search_context_size: searchContextSize,
    };

    // Add user location if provided
    if (userLocation) {
      webSearchTool.user_location = {
        type: "approximate",
        ...userLocation
      };
    }

    const response = await openai.responses.create({
      model: model || "gpt-4o",
      tools: [webSearchTool],
      tool_choice: { type: "web_search_preview" },
      input: query,
    });

    return NextResponse.json(response.output_text);
  } catch (error: unknown) {
    logger.error(error, 'Error in /openai/websearch');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 