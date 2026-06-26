import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ConfigLoader } from '../ConfigLoader/ConfigLoader';
import { ToolRegistry } from '../ToolRegistry';
import type { Tool, AgentConfig } from '../types';
import { FsContentLoader } from './FsContentLoader';
import { createState, HarnessState } from './state';
import { executeTool } from './tools';
import { HarnessChat, textModelFor } from './ai';
import {
  Sink,
  createCompositeSink,
  createNdjsonSink,
  createStdoutSink,
  defaultRunFile,
  type HarnessEvent,
} from './sink';

export interface HarnessOptions {
  experienceId: string;
  storageRoot?: string;
  startAgent?: string;
  modelOverride?: string;
  apiKey?: string;
  /** Full path to the NDJSON session log. Wins over outDir. */
  ndjsonPath?: string;
  /** Directory the default-named NDJSON file lands in (defaults to ./runs). */
  outDir?: string;
  silent?: boolean;
}

export interface ResumeOptions {
  /** Path to the NDJSON file written by a previous run. Re-opened in append mode. */
  ndjsonPath: string;
  storageRoot?: string;
  modelOverride?: string;
  apiKey?: string;
  silent?: boolean;
}

export class Harness {
  private state!: HarnessState;
  private chat!: HarnessChat;
  private tools: Record<string, Tool[]> = {}; // per-agent tool list
  private systemPrompts: Record<string, string> = {};
  private sink!: Sink;
  private aiConfig: any = null;
  private hasAudio = false;
  private experienceMeta: { title: string; description: string } = { title: '', description: '' };
  private runFile = '';
  // Populated only by resume() — the events parsed out of the prior NDJSON.
  // Replayed to each new subscriber so the TUI/REPL can rebuild its chat
  // panel from prior history without us double-writing to the log file.
  private history: HarnessEvent[] = [];

  async boot(opts: HarnessOptions): Promise<void> {
    const storageRoot = opts.storageRoot ?? path.join(process.cwd(), 'storage');
    const experienceFolder = path.join(storageRoot, opts.experienceId);
    try {
      await fs.access(path.join(experienceFolder, 'experience.json'));
    } catch {
      throw new Error(`Experience not found at ${experienceFolder}`);
    }

    const loader = new FsContentLoader(storageRoot);
    const config = new ConfigLoader(loader);
    const configPath = `/api/storage/${opts.experienceId}/experience.json`;
    await config.loadExperience(configPath);
    const response = await config.loadConfig();

    const agents = response.agents as Record<string, AgentConfig>;
    const initialAgentKey =
      opts.startAgent ??
      (response as any).initialAgent ??
      (await readInitialAgent(experienceFolder));
    if (!initialAgentKey || !agents[initialAgentKey]) {
      throw new Error(
        `initialAgent "${initialAgentKey}" not found. available: ${Object.keys(agents).join(', ')}`,
      );
    }

    this.aiConfig = pickAiConfig(response, agents[initialAgentKey]);
    this.hasAudio = !!this.aiConfig?.modalities?.includes?.('audio');

    // Pre-compute per-agent tool list and system prompt.
    const registry = ToolRegistry.getInstance();
    for (const [key, cfg] of Object.entries(agents)) {
      const names = cfg.availableTools;
      const tools = names
        ? (names.map(n => registry.getTool(n)).filter(Boolean) as Tool[])
        : registry.getAllTools();
      this.tools[key] = tools;
      this.systemPrompts[key] = cfg.instructions ?? '';
    }

    // Plumb workflow-phase config into the harness state so the migrated
    // workflowPhase / finishExperience tools have something to navigate.
    // Mirrors the React-side `createFreshSessionRow` seeding: when the
    // experience declares phases, the initial state and a
    // `WORKFLOW_PHASE_ENTERED` event are pre-populated.
    const meta: any = response.metadata ?? {};
    this.state = createState(opts.experienceId, agents, initialAgentKey, this.hasAudio, {
      workflowPhases: meta.workflowPhases ?? [],
      initialWorkflowPhase: meta.initialWorkflowPhase,
      showPhaseCount: meta.showPhaseCount,
      experienceTitle: meta.title,
    });

    this.experienceMeta = {
      title: response.metadata?.title ?? opts.experienceId,
      description: response.metadata?.description ?? '',
    };

    const ndjsonPath = path.resolve(
      opts.ndjsonPath ?? defaultRunFile(opts.experienceId, opts.outDir),
    );
    await fs.mkdir(path.dirname(ndjsonPath), { recursive: true });
    this.runFile = ndjsonPath;
    const sinks: Sink[] = [createNdjsonSink(ndjsonPath)];
    if (!opts.silent) sinks.push(createStdoutSink());
    const composite = createCompositeSink(sinks);
    // Observer fanout runs after sink writes, not alongside them. Keeps
    // persistence + stdout on their own track; observers (TUI, autoplay)
    // are a different concern and shouldn't gate the log stream.
    this.sink = {
      emit: (e) => {
        composite.emit(e);
        for (const fn of this.observers) {
          try {
            fn(e);
          } catch {
            /* observer errors must not take down the event loop */
          }
        }
      },
      close: () => composite.close(),
    };

    const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY env var required (or pass apiKey)');
    const model = textModelFor(this.aiConfig, opts.modelOverride);
    this.chat = new HarnessChat(model, apiKey);
    this.activateAgent(initialAgentKey);

    this.sink.emit({ kind: 'session.start', experience: opts.experienceId, agent: initialAgentKey });
  }

  // Re-hydrate a Harness from a previous run's NDJSON. Boots against the same
  // experience + sink path, then replays the conversational history into the
  // chat model so the next turn can pick up where the user left off.
  //
  // What gets replayed: user.text (source !== 'system') and assistant.text.
  // What gets dropped: tool.call/tool.result history. NDJSON records the
  // events but not the OpenAI tool_call wire format the model needs to
  // reconstruct exact tool history; assistant narration usually carries
  // enough context for the next turn. Active agent tracks through every
  // agent.handoff so resume lands on the right system prompt + tool list.
  async resume(opts: ResumeOptions): Promise<void> {
    const filePath = path.resolve(opts.ndjsonPath);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch (e) {
      throw new Error(`cannot read resume file ${filePath}: ${(e as Error).message}`);
    }
    const events: HarnessEvent[] = [];
    for (const line of raw.split('\n')) {
      if (!line) continue;
      try {
        events.push(JSON.parse(line) as HarnessEvent);
      } catch {
        /* skip malformed lines — partial flushes shouldn't kill resume */
      }
    }
    // Strip trailing session.end entries — when resuming, the session
    // didn't really end; it's continuing. Remove from the parsed list and
    // rewrite the file so the stale end-markers don't survive the resume.
    let sessionEndsRemoved = 0;
    while (events.length > 0 && events[events.length - 1].kind === 'session.end') {
      events.pop();
      sessionEndsRemoved++;
    }
    if (sessionEndsRemoved > 0) {
      const clean = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.writeFile(filePath, clean, 'utf8');
    }

    const start = events.find(e => e.kind === 'session.start') as
      | Extract<HarnessEvent, { kind: 'session.start' }>
      | undefined;
    if (!start) throw new Error(`no session.start event in ${filePath}`);

    await this.boot({
      experienceId: start.experience,
      storageRoot: opts.storageRoot,
      apiKey: opts.apiKey,
      modelOverride: opts.modelOverride,
      ndjsonPath: filePath,
      silent: opts.silent,
      startAgent: start.agent,
    });

    let activeAgent = start.agent;
    let userMsgs = 0;
    let assistantMsgs = 0;
    // Replay everything except the new session.start boot() just emitted
    // (we want the file's prior content as history, not the fresh marker).
    const replayed = events.filter(e => e.kind !== 'prompt.compiled');
    for (const e of replayed) {
      switch (e.kind) {
        case 'user.text':
          // System-source kickoffs are bookkeeping, but they ARE the user
          // turn that triggered each assistant reply on the prior run, so
          // include them here to keep the model's history alternating.
          this.chat.pushUser(e.text);
          if (e.source !== 'system') userMsgs++;
          break;
        case 'assistant.text':
          this.chat.pushAssistant({ content: e.text });
          assistantMsgs++;
          break;
        case 'agent.handoff':
          activeAgent = e.to;
          break;
      }
    }
    if (activeAgent !== this.state.activeAgentKey) {
      this.activateAgent(activeAgent);
    }
    // Stash for replay-on-subscribe; observers (TUI chat panel) need to see
    // these to rebuild their view, but we don't want them re-written to the
    // log file (sink fanout already wrote them on the original run).
    this.history = replayed;
    this.sink.emit({
      kind: 'warn',
      message: `resumed from ${path.basename(filePath)} (${userMsgs} user / ${assistantMsgs} assistant messages, agent: ${activeAgent})`,
    });
  }

  private activateAgent(key: string) {
    const prompt = this.systemPrompts[key];
    const tools = this.tools[key];
    this.chat.setAgent(prompt, tools);
    this.sink.emit({
      kind: 'prompt.compiled',
      agent: key,
      bytes: Buffer.byteLength(prompt, 'utf8'),
      toolCount: tools.length,
    });
    this.state.activeAgentKey = key;
  }

  async send(userText: string, source: 'human' | 'autoplay' | 'system' = 'human'): Promise<void> {
    this.sink.emit({ kind: 'user.text', text: userText, source });
    this.chat.pushUser(userText);
    await this.runUntilIdle();
    // If the AI queued a handoff, swap agent and immediately give the new
    // agent the floor — that mirrors the realtime API where the next agent
    // starts speaking on connect rather than waiting for the human.
    if (this.state.pendingAgentTransfer) {
      const next = this.state.pendingAgentTransfer;
      const from = this.state.activeAgentKey;
      this.state.pendingAgentTransfer = null;
      this.sink.emit({ kind: 'agent.handoff', from, to: next });
      this.activateAgent(next);
      await this.kickoff(`(continue as ${this.state.agents[next]?.name ?? next})`);
    }
  }

  // Inject a hidden user nudge so the active agent takes the next turn.
  // Used at session start (no human message yet) and after handoff. Tagged
  // source: 'system' so it's recorded in NDJSON but suppressed in the chat
  // view — mirrors the realtime API's auto-greet behaviour.
  async kickoff(reason = '(experience starts)'): Promise<void> {
    await this.send(reason, 'system');
  }

  private async runUntilIdle(): Promise<void> {
    const HOPS_MAX = 12;
    for (let i = 0; i < HOPS_MAX; i++) {
      const step = await this.chat.step();
      this.chat.pushAssistant(step.rawAssistant);
      if (step.assistantText) {
        this.sink.emit({
          kind: 'assistant.text',
          text: step.assistantText,
          agent: this.state.activeAgentKey,
        });
      }
      if (step.toolCalls.length === 0) return;
      for (const tc of step.toolCalls) {
        this.sink.emit({
          kind: 'tool.call',
          name: tc.name,
          args: tc.args,
          callId: tc.id,
          agent: this.state.activeAgentKey,
        });
        const resp = await executeTool(tc.name, tc.args, { state: this.state, sink: this.sink, callId: tc.id });
        const errMsg = resp.status === 'error' ? (resp.data?.error ?? 'tool call failed') : undefined;
        this.sink.emit({
          kind: 'tool.result',
          callId: tc.id,
          name: tc.name,
          ok: resp.status === 'success',
          result: resp.data,
          error: errMsg,
        });
        // Error results must be unambiguous to the model; a bare `{error: ...}`
        // object reads as data. Prefix "ERROR: " so the next turn sees failure.
        const payload =
          resp.status === 'error'
            ? `ERROR: ${errMsg}`
            : (resp.data ?? { status: resp.status });
        this.chat.pushToolResult(tc.id, payload);
      }
    }
    this.sink.emit({ kind: 'warn', message: `hit max tool hops (${HOPS_MAX})` });
  }

  async shutdown(reason = 'shutdown'): Promise<void> {
    this.sink.emit({ kind: 'session.end', reason });
    await this.sink.close();
  }

  getState(): HarnessState {
    return this.state;
  }

  // Lets external collaborators (autoplay, TUI status line) emit events into
  // the same NDJSON + observer fanout the harness uses internally.
  getSink(): Sink {
    return this.sink;
  }

  // Returns the compiled system prompt + tool list for an agent so the TUI's
  // prompt-dump overlay can show what the model actually receives.
  getAgentBriefing(key: string): { prompt: string; tools: Tool[] } | null {
    if (!(key in this.systemPrompts)) return null;
    return { prompt: this.systemPrompts[key], tools: this.tools[key] ?? [] };
  }

  // Absolute path to the NDJSON session log so the bin files can tell the
  // user where their session went on quit.
  getRunFile(): string {
    return this.runFile;
  }

  // Returns the experience metadata fields most useful for priming an
  // autoplay persona prompt (title + description from experience.json).
  getExperienceMeta(): { title: string; description: string } {
    return this.experienceMeta;
  }

  // Subscribe to the same event stream the sinks see. Returns an unsubscribe
  // fn. Used by autoplay/TUI to track conversation state without coupling.
  // Resumed sessions replay their loaded history to the new subscriber
  // before going live, so panels like the TUI chat can rebuild prior turns
  // without us re-writing those events to the NDJSON file.
  subscribe(fn: (e: HarnessEvent) => void): () => void {
    for (const e of this.history) {
      try {
        fn(e);
      } catch {
        /* observer errors must not take down the event loop */
      }
    }
    this.observers.add(fn);
    return () => this.observers.delete(fn);
  }

  private observers = new Set<(e: HarnessEvent) => void>();
}

async function readInitialAgent(folder: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(path.join(folder, 'experience.json'), 'utf8');
    const cfg = JSON.parse(raw);
    return cfg.initialAgent;
  } catch {
    return undefined;
  }
}

function pickAiConfig(response: any, agent: AgentConfig): any {
  const configs = response.aiConfigurations || {};
  const key = agent.aiConfiguration ?? 'default';
  return configs[key] ?? configs.default ?? null;
}
