// Autoplay: a second LLM (Anthropic Claude) plays the role of the human
// student. Watches the harness event stream, builds a transcript view of
// what the agent has said + done, and asks Claude what the student would
// say next. Decoupled from the harness via subscribe(...).
//
// Termination conditions, in priority order:
//   1. external stop() called (e.g. user types /stop)
//   2. cap reached (default 10 turns)
//   3. model emits the literal "<DONE>" sentinel anywhere in its reply
//
// Cap is mandatory and enforced even if you crank it high — runaway
// autoplay against a paid API is the worst-case bug.

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { Harness } from './Harness';
import type { HarnessEvent } from './sink';

const DEFAULT_PERSONA = `You are a curious student trying out an interactive learning experience. \
Reply as a real person would — short, natural, sometimes uncertain. Ask questions when you don't understand. \
Move the conversation forward. Don't narrate yourself ("I would say..."), just talk.

When you feel the experience has reached a natural end, reply with just the literal token <DONE> on its own line.`;

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini';

type Provider =
  | { kind: 'anthropic'; client: Anthropic }
  | { kind: 'openai'; client: OpenAI };

interface TranscriptLine {
  who: 'agent' | 'student' | 'tool' | 'event';
  text: string;
}

export interface AutoplayOptions {
  cap?: number;
  persona?: string;
  apiKey?: string;
}

export class Autoplayer {
  private provider: Provider;
  private persona: string;
  private cap: number;
  private lines: TranscriptLine[] = [];
  private running = false;
  private turns = 0;
  private unsubscribe: (() => void) | null = null;
  private busy = false;

  constructor(private harness: Harness, opts: AutoplayOptions = {}) {
    const aKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    const oKey = process.env.OPENAI_API_KEY;
    if (aKey) {
      this.provider = { kind: 'anthropic', client: new Anthropic({ apiKey: aKey }) };
    } else if (oKey) {
      this.provider = { kind: 'openai', client: new OpenAI({ apiKey: oKey }) };
    } else {
      throw new Error('autoplay needs ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY');
    }
    this.persona = opts.persona ?? DEFAULT_PERSONA;
    this.cap = opts.cap ?? 10;
  }

  // Begin autoplay. Returns when stopped (cap, <DONE>, or stop()).
  async run(): Promise<{ reason: string; turns: number }> {
    if (this.running) return { reason: 'already-running', turns: this.turns };
    this.running = true;
    this.turns = 0;
    this.unsubscribe = this.harness.subscribe(e => this.onEvent(e));

    const meta = this.harness.getExperienceMeta();
    this.harness.getSink().emit({ kind: 'autoplay.start', persona: this.persona.slice(0, 60), cap: this.cap });

    try {
      // First turn — open the conversation if no agent text seen yet.
      while (this.running && this.turns < this.cap) {
        // Wait until the agent has finished a reply (or a turn cycle has completed).
        // The harness.send() call is synchronous-ish from our POV: we await it
        // each time we hand it text. So just step in lockstep.
        this.harness.getSink().emit({ kind: 'autoplay.phase', phase: 'drafting' });
        const next = await this.draftNextStudentLine(meta);
        if (!this.running) break;
        if (!next) {
          this.stopInternal('model returned empty');
          break;
        }
        if (next.includes('<DONE>')) {
          this.stopInternal('model said <DONE>');
          break;
        }
        this.turns += 1;
        this.harness.getSink().emit({ kind: 'autoplay.phase', phase: 'awaiting-agent' });
        await this.harness.send(next, 'autoplay');
        this.harness.getSink().emit({ kind: 'autoplay.phase', phase: 'idle' });
      }
      if (this.running) this.stopInternal('cap reached');
    } catch (e) {
      // Any throw from draftNextStudentLine or harness.send must still emit
      // autoplay.stop, otherwise subscribers (TUI auto-on badge) stay stuck.
      const msg = e instanceof Error ? e.message : String(e);
      this.harness.getSink().emit({ kind: 'error', message: `autoplay: ${msg}` });
      this.stopInternal(`error: ${msg}`);
    } finally {
      this.unsubscribe?.();
      this.unsubscribe = null;
    }
    return { reason: this.lastStopReason, turns: this.turns };
  }

  stop(reason = 'user-stop'): void {
    this.stopInternal(reason);
  }

  private lastStopReason = 'unknown';
  private stopInternal(reason: string) {
    if (!this.running) return;
    this.running = false;
    this.lastStopReason = reason;
    this.harness.getSink().emit({ kind: 'autoplay.stop', reason, turns: this.turns });
  }

  private onEvent(e: HarnessEvent) {
    switch (e.kind) {
      case 'assistant.text':
        this.lines.push({ who: 'agent', text: `[${e.agent}] ${e.text}` });
        break;
      case 'user.text':
        if (e.source === 'system') break; // hidden kickoffs aren't part of the visible dialogue
        if (e.source === 'autoplay') this.lines.push({ who: 'student', text: e.text });
        else this.lines.push({ who: 'student', text: `[human] ${e.text}` });
        break;
      case 'tool.call':
        this.lines.push({ who: 'tool', text: `${e.name} ${truncate(JSON.stringify(e.args), 80)}` });
        break;
      case 'agent.handoff':
        this.lines.push({ who: 'event', text: `(handoff: ${e.from} → ${e.to})` });
        break;
    }
  }

  private async draftNextStudentLine(meta: { title: string; description: string }): Promise<string | null> {
    if (this.busy) return null;
    this.busy = true;
    try {
      // Build a compact transcript view: the student doesn't need to see
      // every tool call, just the agent's text + any handoff events for
      // context. We always include the most recent ~20 turns.
      const visible = this.lines.filter(l => l.who !== 'tool').slice(-20);
      const transcript = visible
        .map(l => (l.who === 'agent' ? `Agent: ${l.text.replace(/^\[[^\]]+\]\s*/, '')}` : l.who === 'student' ? `You: ${l.text}` : l.text))
        .join('\n');

      const system =
        this.persona +
        `\n\nThe experience you're trying out is "${meta.title}". ${meta.description ? `Here's what it's about: ${meta.description}` : ''}`;

      const userBlock =
        transcript.length === 0
          ? "You just opened the experience. Say something to get started."
          : `Here's the conversation so far:\n\n${transcript}\n\nWhat do you say next? Reply with just your next line.`;

      const text = await this.callModel(system, userBlock);
      return text?.trim() || null;
    } finally {
      this.busy = false;
    }
  }

  private async callModel(system: string, userBlock: string): Promise<string> {
    if (this.provider.kind === 'anthropic') {
      const resp = await this.provider.client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        system,
        messages: [{ role: 'user', content: userBlock }],
      });
      const block = resp.content.find(b => b.type === 'text');
      return block && block.type === 'text' ? block.text : '';
    }
    const resp = await this.provider.client.chat.completions.create({
      model: OPENAI_FALLBACK_MODEL,
      max_tokens: 300,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userBlock },
      ],
    });
    return resp.choices[0]?.message?.content ?? '';
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
