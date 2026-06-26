// Thin wrapper over OpenAI chat completions with tool-calling loop.
// Designed for the harness — non-streaming for simplicity. A realtime
// experience's voice config is remapped to a text model automatically.
//
// We keep our own chat history so that when the active agent changes
// (post agent.transfer) we swap system prompt + tools but preserve
// the conversation, which is what the realtime handoff actually does.

import OpenAI from 'openai';
import type { Tool } from '../types';

type Msg =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: any[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface AIRunResult {
  assistantText: string;
  toolCalls: Array<{ id: string; name: string; args: any }>;
  // Raw assistant message so caller can push it into history before submitting tool results.
  rawAssistant: any;
}

export class HarnessChat {
  private client: OpenAI;
  private history: Msg[] = [];
  private systemPrompt = '';
  private tools: Tool[] = [];
  public model: string;

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.client = new OpenAI({ apiKey });
  }

  setAgent(systemPrompt: string, tools: Tool[]) {
    this.systemPrompt = systemPrompt;
    this.tools = tools;
  }

  pushUser(text: string) {
    this.history.push({ role: 'user', content: text });
  }

  pushAssistant(raw: any) {
    this.history.push({ role: 'assistant', content: raw.content ?? null, tool_calls: raw.tool_calls });
  }

  pushToolResult(toolCallId: string, result: unknown) {
    this.history.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: typeof result === 'string' ? result : JSON.stringify(result),
    });
  }

  async step(): Promise<AIRunResult> {
    const messages: any[] = [{ role: 'system', content: this.systemPrompt }, ...this.history];
    const openaiTools = this.tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: openaiTools.length ? openaiTools : undefined,
      tool_choice: openaiTools.length ? 'auto' : undefined,
    });
    const choice = resp.choices[0];
    const msg = choice.message;
    const toolCalls = (msg.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      args: safeJson(tc.function.arguments),
    }));
    return {
      assistantText: msg.content ?? '',
      toolCalls,
      rawAssistant: msg,
    };
  }
}

function safeJson(raw: string): any {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { _rawArgs: raw };
  }
}

// Realtime model IDs don't work with chat completions; remap to text.
export function textModelFor(aiConfig: any, override?: string): string {
  if (override) return override;
  const m: string | undefined = aiConfig?.model;
  if (!m) return 'gpt-4o';
  if (m.includes('realtime')) return 'gpt-4o';
  return m;
}
