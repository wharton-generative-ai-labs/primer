import { NextResponse } from "next/server";
import { createModuleLogger } from "@/lib/logger";
import { env } from "@/config/env";

const logger = createModuleLogger('session');

// Maps the legacy ephemeral-key response shape (`{ client_secret: { value } }`)
// onto what the GA endpoint returns (`{ value, expires_at, session }`) so
// callers don't have to care which endpoint produced the key.
function normalizeEphemeralResponse(data: {
  value?: string;
  expires_at?: number;
  session?: unknown;
  error?: unknown;
  [key: string]: unknown;
}) {
  if (data?.error || !data?.value) {
    return data;
  }
  return {
    ...data,
    client_secret: {
      value: data.value,
      expires_at: data.expires_at ?? 0,
    },
  };
}

export async function POST(request: Request) {
  try {
    const { model, modalities, voice, reasoning } = await request.json();

    // GA Realtime API. The legacy POST /v1/realtime/sessions endpoint rejects
    // newer models such as gpt-realtime-2 with:
    //   "Model \"gpt-realtime-2\" is only available on the GA API."
    // The GA endpoint is POST /v1/realtime/client_secrets, which takes a
    // nested `session` config and accepts `reasoning: { effort }` for
    // reasoning-capable models. See:
    //   https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/
    //   https://developers.openai.com/api/docs/guides/realtime-webrtc
    const session: Record<string, unknown> = {
      type: "realtime",
      ...(model ? { model } : {}),
    };

    // GA shape: voice lives under audio.output.voice (not top-level `voice`).
    if (voice) {
      session.audio = { output: { voice } };
    }

    // GA shape: modalities is `output_modalities` (defaults to ["audio"]).
    if (Array.isArray(modalities) && modalities.length > 0) {
      session.output_modalities = modalities;
    }

    // Only meaningful for reasoning-capable models like gpt-realtime-2;
    // older models simply ignore it.
    if (reasoning) {
      session.reasoning = reasoning;
    }

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session }),
      }
    );
    const data = await response.json();
    return NextResponse.json(normalizeEphemeralResponse(data));
  } catch (error) {
    logger.error(error, "Error in /session");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
