import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createModuleLogger } from '@/lib/logger';

const openai = new OpenAI();
const logger = createModuleLogger('openai-text');

export async function POST(req: Request) {
  try {
    const { model, instructions, input, messages } = await req.json();

    // If messages are provided, use them as input array
    const response = await openai.responses.create({
      model,
      input: messages || input,
      instructions: instructions,
    });

    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error(error, 'Error in /openai/text');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 