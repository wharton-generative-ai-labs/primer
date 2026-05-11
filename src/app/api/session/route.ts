import { NextResponse } from "next/server";
import { createModuleLogger } from "@/lib/logger";
import { env } from "@/config/env";

const logger = createModuleLogger('session');

export async function POST(request: Request) {
  try {
    const { model, modalities, voice } = await request.json();

    // NOTE: The legacy `POST /v1/realtime/sessions` REST endpoint accepts
    // only a narrow set of bootstrap fields (model, modalities, voice). It
    // does NOT accept `reasoning` even for reasoning-capable models like
    // gpt-realtime-2 — sending it produces an "Unknown parameter: 'reasoning'"
    // error. Reasoning effort must be set via `session.update` over the
    // WebRTC data channel after the connection opens
    // (handled in src/app/hooks/useSessionManagement.ts).
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
