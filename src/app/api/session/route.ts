import { NextResponse } from "next/server";
import { createModuleLogger } from "@/lib/logger";
import { env } from "@/config/env";

const logger = createModuleLogger('session');

export async function POST(request: Request) {
  try {
    const { model, modalities, voice, reasoning } = await request.json();

    // `reasoning` is only used by reasoning-capable realtime models such as
    // gpt-realtime-2; older models (gpt-realtime-1.5, gpt-4o-realtime-preview)
    // do not accept it. We forward it only when the caller provides it.
    const body: Record<string, unknown> = { model, modalities, voice };
    if (reasoning) {
      body.reasoning = reasoning;
    }

    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
