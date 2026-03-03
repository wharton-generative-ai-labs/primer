import { NextResponse } from "next/server";
import { createModuleLogger } from "@/lib/logger";
import { env } from "@/config/env";

const logger = createModuleLogger('session');

export async function POST(request: Request) {
  try {
    const { model, modalities, voice } = await request.json();
    
    // OpenAI's example wasn't ideal - this is all we need
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          modalities,
          voice,
        }),
      }
    );
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error(error, "Error in /session");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
