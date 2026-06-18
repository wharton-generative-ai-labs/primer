import { promises as fs } from 'node:fs';
import path from 'node:path';

export type HarnessEvent =
  | { kind: 'session.start'; experience: string; agent: string }
  | { kind: 'session.end'; reason: string }
  | { kind: 'prompt.compiled'; agent: string; bytes: number; toolCount: number }
  | { kind: 'user.text'; text: string; source?: 'human' | 'autoplay' | 'system' }
  | { kind: 'assistant.delta'; text: string }
  | { kind: 'assistant.text'; text: string; agent: string }
  | { kind: 'tool.call'; name: string; args: unknown; callId: string; agent: string }
  | { kind: 'tool.result'; callId: string; name: string; ok: boolean; result?: unknown; error?: string }
  | { kind: 'agent.handoff'; from: string; to: string; rationale?: string }
  | { kind: 'state.change'; summary: unknown }
  | { kind: 'autoplay.start'; persona: string; cap: number }
  | { kind: 'autoplay.stop'; reason: string; turns: number }
  | { kind: 'autoplay.phase'; phase: 'drafting' | 'awaiting-agent' | 'idle' }
  | { kind: 'warn'; message: string; detail?: unknown }
  | { kind: 'error'; message: string; detail?: unknown };

type Record = HarnessEvent & { t: number };

export interface Sink {
  emit(e: HarnessEvent): void;
  close(): Promise<void>;
}

export function createCompositeSink(sinks: Sink[]): Sink {
  return {
    emit(e) {
      for (const s of sinks) s.emit(e);
    },
    async close() {
      await Promise.all(sinks.map(s => s.close()));
    },
  };
}

// Lightweight observer sink — calls fn for every event. Used by Autoplayer
// to track recent assistant text without coupling to harness internals.
export function createCallbackSink(fn: (e: HarnessEvent) => void): Sink {
  return {
    emit: fn,
    async close() {
      /* no-op */
    },
  };
}

export function createNdjsonSink(filePath: string): Sink {
  const buffer: Record[] = [];
  let flushing: Promise<void> | null = null;
  let closed = false;

  const flush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);
    const lines = batch.map(r => JSON.stringify(r)).join('\n') + '\n';
    await fs.appendFile(filePath, lines);
  };

  const schedule = () => {
    if (flushing || closed) return;
    flushing = (async () => {
      await new Promise(r => setTimeout(r, 50));
      try {
        await flush();
      } finally {
        flushing = null;
        if (buffer.length > 0) schedule();
      }
    })();
  };

  return {
    emit(e) {
      buffer.push({ ...e, t: Date.now() });
      schedule();
    },
    async close() {
      closed = true;
      if (flushing) await flushing;
      await flush();
    },
  };
}

// Minimal ANSI colors — no deps.
const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
};

export function createStdoutSink(): Sink {
  return {
    emit(e) {
      switch (e.kind) {
        case 'session.start':
          process.stdout.write(c.bold(c.cyan(`\n── ${e.experience} · start agent: ${e.agent} ──\n\n`)));
          break;
        case 'session.end':
          process.stdout.write(c.dim(`\n── end: ${e.reason} ──\n`));
          break;
        case 'prompt.compiled':
          process.stdout.write(c.dim(`[${e.agent}] prompt ${e.bytes}B, ${e.toolCount} tools\n`));
          break;
        case 'user.text': {
          // System-source nudges (kickoffs) are bookkeeping, not chat — keep
          // them in NDJSON for replay but don't echo to the human.
          if (e.source === 'system') break;
          const tag = e.source === 'autoplay' ? c.bold(c.green('auto')) : c.bold(c.blue('you'));
          process.stdout.write(`${tag} ${e.text}\n`);
          break;
        }
        case 'autoplay.start':
          process.stdout.write(c.green(`  ⟳ autoplay on (cap ${e.cap})\n`));
          break;
        case 'autoplay.stop':
          process.stdout.write(c.green(`  ⟳ autoplay off (${e.reason}, ${e.turns} turn${e.turns === 1 ? '' : 's'})\n`));
          break;
        case 'autoplay.phase':
          // Phase ticks are useful in the TUI but spammy in the REPL — skip
          // them in colored stdout, keep them in the NDJSON for replay.
          break;
        case 'assistant.text':
          process.stdout.write(`${c.bold(c.magenta(e.agent))} ${e.text}\n`);
          break;
        case 'tool.call':
          process.stdout.write(
            c.yellow(`  → ${e.name}`) + c.dim(' ' + truncateJson(e.args)) + '\n',
          );
          break;
        case 'tool.result':
          if (e.ok) {
            process.stdout.write(c.green(`  ← ok`) + c.dim(` ${e.name}` + (e.result ? ` ${truncateJson(e.result)}` : '')) + '\n');
          } else {
            process.stdout.write(c.red(`  ← err`) + c.dim(` ${e.name}: ${e.error}`) + '\n');
          }
          break;
        case 'agent.handoff':
          process.stdout.write(c.cyan(`  ⇢ handoff ${e.from} → ${e.to}`) + (e.rationale ? c.dim(` (${e.rationale})`) : '') + '\n');
          break;
        case 'warn':
          process.stdout.write(c.yellow(`  ! ${e.message}\n`));
          break;
        case 'error':
          process.stdout.write(c.red(`  !! ${e.message}\n`));
          break;
        case 'state.change':
        case 'assistant.delta':
          // Too noisy for stdout. Keep to NDJSON.
          break;
      }
    },
    async close() {
      /* no-op */
    },
  };
}

function truncateJson(v: unknown, max = 120): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export function defaultRunFile(experienceId: string, rootOverride?: string): string {
  const root = rootOverride ?? process.env.HARNESS_RUNS_DIR ?? 'runs';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(root, `${stamp}-${experienceId}.ndjson`);
}
