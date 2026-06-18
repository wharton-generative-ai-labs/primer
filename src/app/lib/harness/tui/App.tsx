// Three-pane Ink TUI for the harness. Designers can watch and steer an
// experience playthrough without rendering the real React UI.
//
// Layout:
//   ┌── header (current agent, pending handoff, autoplay state) ──────┐
//   │  chat / tool stream            │  state snapshot                │
//   │                                │  + tools list (selectable)     │
//   ├────────────────────────────────┴────────────────────────────────┤
//   │  > input ___________________________________  hints             │
//   └─────────────────────────────────────────────────────────────────┘
//
// Modes:
//   focus 'input'  — TextInput is live. Tab cycles to 'tools'.
//                    Ctrl+A toggles autoplay. Ctrl+P dumps current prompt.
//   focus 'tools'  — TextInput inert. ↑↓ selects a tool, Enter opens detail
//                    overlay, Tab returns focus to input.
//   overlay set    — full-pane modal showing tool args/result or prompt.
//                    Esc dismisses.

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { Harness } from '../Harness';
import { Autoplayer } from '../autoplay';
import type { HarnessEvent } from '../sink';
import { stateSnapshot } from '../state';

interface ToolEntry {
  id: string; // synthetic — matches callId from harness
  name: string;
  args: any;
  agent: string;
  result?: any;
  error?: string;
  ok?: boolean;
  ts: number;
}

type ChatItem =
  | { kind: 'user'; source: 'human' | 'autoplay'; text: string }
  | { kind: 'agent'; agent: string; text: string }
  | { kind: 'tool-ref'; toolId: string; name: string }
  | { kind: 'handoff'; from: string; to: string }
  | { kind: 'system'; text: string };

type Focus = 'input' | 'tools';
type Overlay = { kind: 'prompt'; agent: string } | null;

const CHAT_PAGE = 10;
const CHAT_VIEWPORT = 30;

interface Props {
  harness: Harness;
  cap: number;
}

export const App: React.FC<Props> = ({ harness, cap }) => {
  const { exit } = useApp();
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [snapshot, setSnapshot] = useState(() => stateSnapshot(harness.getState()));
  const [agentKey, setAgentKey] = useState(harness.getState().activeAgentKey);
  const [pending, setPending] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoPhase, setAutoPhase] = useState<'drafting' | 'awaiting-agent' | 'idle'>('idle');
  const [focus, setFocus] = useState<Focus>('input');
  const [toolCursor, setToolCursor] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>(null);
  // Items from the BOTTOM of the chat list to skip; 0 = pinned to latest.
  // Bumped via PageUp/PageDown. New messages don't auto-snap unless we're
  // already at 0 — designers reading history shouldn't be yanked back.
  const [chatScroll, setChatScroll] = useState(0);

  const autoRef = useRef<Autoplayer | null>(null);
  const autoPromiseRef = useRef<Promise<unknown> | null>(null);

  const refreshSnapshot = useCallback(() => {
    setSnapshot(stateSnapshot(harness.getState()));
    setPending(harness.getState().pendingAgentTransfer);
    setAgentKey(harness.getState().activeAgentKey);
  }, [harness]);

  useEffect(() => {
    const unsub = harness.subscribe((e: HarnessEvent) => {
      switch (e.kind) {
        case 'user.text': {
          // System-source nudges (kickoffs) are bookkeeping, not chat.
          if (e.source === 'system') break;
          const source: 'human' | 'autoplay' = e.source === 'autoplay' ? 'autoplay' : 'human';
          setChat(c => [...c, { kind: 'user', source, text: e.text }]);
          break;
        }
        case 'assistant.text':
          setChat(c => [...c, { kind: 'agent', agent: e.agent, text: e.text }]);
          refreshSnapshot();
          break;
        case 'tool.call': {
          const entry: ToolEntry = {
            id: e.callId,
            name: e.name,
            args: e.args,
            agent: e.agent,
            ts: Date.now(),
          };
          setTools(t => {
            const next = [...t, entry];
            // Auto-track newest in tool cursor when not focused on tools.
            return next;
          });
          setChat(c => [...c, { kind: 'tool-ref', toolId: e.callId, name: e.name }]);
          break;
        }
        case 'tool.result':
          setTools(t => t.map(x => (x.id === e.callId ? { ...x, ok: e.ok, result: e.result, error: e.error } : x)));
          refreshSnapshot();
          break;
        case 'agent.handoff':
          setChat(c => [...c, { kind: 'handoff', from: e.from, to: e.to }]);
          refreshSnapshot();
          break;
        case 'autoplay.start':
          setAuto(true);
          setAutoPhase('drafting');
          break;
        case 'autoplay.stop':
          setAuto(false);
          setAutoPhase('idle');
          setChat(c => [...c, { kind: 'system', text: `autoplay off (${e.reason}, ${e.turns} turns)` }]);
          break;
        case 'autoplay.phase':
          setAutoPhase(e.phase);
          break;
        case 'session.end':
          setChat(c => [...c, { kind: 'system', text: `session end: ${e.reason}` }]);
          break;
      }
    });
    return unsub;
  }, [harness, refreshSnapshot]);

  // Keep cursor in range as tools accrue. When focus is on tools we hold the
  // cursor still; otherwise we follow the latest entry.
  useEffect(() => {
    if (focus !== 'tools') setToolCursor(Math.max(0, tools.length - 1));
    else if (toolCursor >= tools.length) setToolCursor(Math.max(0, tools.length - 1));
  }, [tools, focus, toolCursor]);

  // Preserve absolute scroll position when chat grows: if we'd already
  // scrolled up to read history, bump chatScroll so the viewport stays put.
  const prevChatLen = useRef(chat.length);
  useEffect(() => {
    const grew = chat.length - prevChatLen.current;
    prevChatLen.current = chat.length;
    if (grew > 0 && chatScroll > 0) setChatScroll(s => s + grew);
  }, [chat.length, chatScroll]);

  useInput((char, key) => {
    if (overlay) {
      if (key.escape) setOverlay(null);
      return;
    }
    if (key.tab) {
      setFocus(f => (f === 'input' ? 'tools' : 'input'));
      return;
    }
    if (key.ctrl && (char === 'a' || char === 'p' || char === 'd' || char === 'q')) {
      if (char === 'a') toggleAutoplay();
      else if (char === 'p') setOverlay({ kind: 'prompt', agent: agentKey });
      else if (char === 'd' || char === 'q') shutdown();
      return;
    }
    if (key.pageUp) {
      setChatScroll(s => Math.min(Math.max(0, chat.length - 1), s + CHAT_PAGE));
      return;
    }
    if (key.pageDown) {
      setChatScroll(s => Math.max(0, s - CHAT_PAGE));
      return;
    }
    if (focus === 'tools') {
      if (key.upArrow) setToolCursor(c => Math.max(0, c - 1));
      else if (key.downArrow) {
        // Down past the last tool drops focus back to the input — symmetry
        // with the input-mode Up shortcut.
        if (toolCursor >= tools.length - 1) setFocus('input');
        else setToolCursor(c => c + 1);
      } else if (key.escape) setFocus('input');
      return;
    }
    if (focus === 'input' && key.upArrow && tools.length > 0) {
      // Up from the chat box is a shortcut to focus the most recent tool —
      // saves a Tab when you just want to peek at the last call. Detail
      // shows in-place in the main panel; arrow keys move between calls.
      setFocus('tools');
      setToolCursor(tools.length - 1);
      return;
    }
  });

  const toggleAutoplay = useCallback(() => {
    if (autoRef.current) {
      autoRef.current.stop('user-stop');
      return;
    }
    try {
      const a = new Autoplayer(harness, { cap });
      autoRef.current = a;
      autoPromiseRef.current = a.run().finally(() => {
        autoRef.current = null;
        autoPromiseRef.current = null;
      });
    } catch (e) {
      flashErr(e instanceof Error ? e.message : String(e));
    }
  }, [harness, cap]);

  const flashErr = useCallback((msg: string) => {
    setErr(msg);
    setTimeout(() => setErr(null), 4000);
  }, []);

  const submit = useCallback(
    async (raw: string) => {
      const line = raw.trim();
      if (!line) return;
      if (line === '/quit' || line === '/q') return shutdown();
      if (line === '/auto') return toggleAutoplay();
      if (line === '/stop') {
        autoRef.current?.stop('user-stop');
        return;
      }
      if (line === '/prompt') {
        setOverlay({ kind: 'prompt', agent: agentKey });
        return;
      }
      if (autoRef.current) {
        flashErr('autoplay running — /stop first');
        return;
      }
      setBusy(true);
      try {
        await harness.send(line);
      } catch (e) {
        flashErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [harness, toggleAutoplay, agentKey, flashErr],
  );

  const shutdown = useCallback(async () => {
    autoRef.current?.stop('quit');
    if (autoPromiseRef.current) await autoPromiseRef.current.catch(() => {});
    await harness.shutdown('user-quit');
    exit();
  }, [harness, exit]);

  // ── render ──
  if (overlay?.kind === 'prompt') {
    const briefing = harness.getAgentBriefing(overlay.agent);
    return <PromptOverlay agent={overlay.agent} briefing={briefing} onClose={() => setOverlay(null)} />;
  }

  const end = Math.max(0, chat.length - chatScroll);
  const start = Math.max(0, end - CHAT_VIEWPORT);
  const visibleChat = chat.slice(start, end);
  const olderHidden = start;
  const newerHidden = chat.length - end;

  const visibleTools = tools.slice(-12);
  const visibleStart = Math.max(0, tools.length - visibleTools.length);
  const cursorInVisible = toolCursor - visibleStart;
  const focusedTool = focus === 'tools' ? tools[toolCursor] : null;

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" paddingX={1} justifyContent="space-between">
        <Text>
          <Text bold color="magenta">{agentKey}</Text>
          {pending ? <Text color="cyan">{`  → pending: ${pending}`}</Text> : null}
        </Text>
        {snapshot.heading ? (
          <Text bold color="cyan">{snapshot.heading}</Text>
        ) : null}
        <Text>
          <Text color={auto ? 'green' : 'gray'}>{auto ? '⟳ auto on' : '○ auto off'}</Text>
          {busy ? <Text color="yellow">  …thinking</Text> : null}
        </Text>
      </Box>

      <Box flexDirection="row" minHeight={20}>
        <Box flexDirection="column" flexGrow={2} borderStyle="round" paddingX={1} marginRight={1}>
          {focusedTool ? (
            <ToolDetailInline entry={focusedTool} />
          ) : (
            <>
              {olderHidden > 0 ? (
                <Text dimColor>↑ {olderHidden} earlier · PgUp/PgDn scroll</Text>
              ) : null}
              {visibleChat.length === 0 ? (
                <Text dimColor>(empty — type a message, ↑ for tools, /auto to autoplay)</Text>
              ) : (
                visibleChat.map((item, i) => <ChatLine key={start + i} item={item} tools={tools} />)
              )}
              {newerHidden > 0 ? (
                <Text dimColor>↓ {newerHidden} newer · PgDn to catch up</Text>
              ) : null}
            </>
          )}
        </Box>
        <Box
          flexDirection="column"
          flexBasis={36}
          borderStyle={focus === 'tools' ? 'double' : 'round'}
          borderColor={focus === 'tools' ? 'cyan' : undefined}
          paddingX={1}
        >
          <Text bold>state</Text>
          <Text>layout: <Text color="cyan">{snapshot.layout}</Text></Text>
          <Text>tab: <Text color="cyan">{snapshot.panels.tab}</Text></Text>
          <Text>scene: {snapshot.scene.current ?? '-'}</Text>
          {snapshot.phase ? (
            <Text>phase: <Text color="cyan">{phaseLine(snapshot.phase)}</Text></Text>
          ) : null}
          <Text>active: {snapshot.activeSlide?.title ?? '-'}</Text>
          <Text>
            library: {snapshot.library.length} · artifacts: {snapshot.artifacts.length}
            {snapshot.artifacts.length > 0
              ? ` · max rev ${Math.max(...snapshot.artifacts.map(a => a.currentRev))}`
              : null}
          </Text>
          <Text>notes: {snapshot.notes.length} · checklist: {snapshot.checklist ? `${snapshot.checklist.done}/${snapshot.checklist.total}` : '-'}</Text>
          <Box marginTop={1} flexDirection="column">
            <Text bold>
              tools <Text dimColor>({tools.length})</Text>
            </Text>
            {visibleTools.length === 0 ? (
              <Text dimColor>(none)</Text>
            ) : (
              visibleTools.map((t, i) => {
                const selected = focus === 'tools' && i === cursorInVisible;
                return (
                  <Box key={t.id} width="100%" backgroundColor={selected ? 'cyan' : undefined}>
                    <Text>
                      <Text color={selected ? 'black' : t.ok === false ? 'red' : t.ok ? 'green' : 'yellow'}>
                        {t.ok === false ? '✗' : t.ok ? '✓' : '·'}
                      </Text>
                      {' '}
                      <Text color={selected ? 'black' : undefined} bold={selected}>{t.name}</Text>
                      {' '}
                      <Text color={selected ? 'black' : undefined} dimColor={!selected}>{summary(t.args)}</Text>
                    </Text>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>

      <Box borderStyle={focus === 'input' ? 'double' : 'round'} borderColor={auto ? 'green' : focus === 'input' ? 'cyan' : undefined} paddingX={1} flexDirection="column">
        <Box>
          {auto ? (
            <Text>
              <Text color="green">⟳ autoplaying</Text>{' '}
              <Text dimColor>· {phaseLabel(autoPhase)}</Text>
            </Text>
          ) : (
            <>
              <Text>{busy ? '… ' : '> '}</Text>
              <ChatInput onSubmit={submit} focus={focus === 'input'} />
            </>
          )}
        </Box>
        <Text dimColor>
          {auto
            ? 'Ctrl-A stop autoplay · ↑ tools · PgUp/PgDn scroll · Ctrl-P prompt · Ctrl-Q quit'
            : '↑ tools (live preview) · Tab focus · PgUp/PgDn scroll · Ctrl-A autoplay · Ctrl-P prompt · /quit · Ctrl-Q'}
          {err ? <Text color="red">  · {err}</Text> : null}
        </Text>
      </Box>
    </Box>
  );
};

// Uncontrolled text input with cursor support. Replaces ink-text-input,
// which derived its next value from a parent-controlled `value` prop and
// dropped characters under fast typing or rapid pastes (vadimdemedes/
// ink-text-input#90 and friends). Functional setState here keeps every
// keystroke regardless of parent re-render cadence.
const ChatInput: React.FC<{
  focus: boolean;
  onSubmit: (value: string) => void;
}> = ({ focus, onSubmit }) => {
  const [{ value, cursor }, setState] = useState({ value: '', cursor: 0 });
  useInput(
    (char, key) => {
      if (key.return) {
        onSubmit(value);
        setState({ value: '', cursor: 0 });
        return;
      }
      if (key.backspace || key.delete) {
        setState(s =>
          s.cursor === 0
            ? s
            : {
                value: s.value.slice(0, s.cursor - 1) + s.value.slice(s.cursor),
                cursor: s.cursor - 1,
              },
        );
        return;
      }
      if (key.leftArrow) {
        setState(s => ({ ...s, cursor: Math.max(0, s.cursor - 1) }));
        return;
      }
      if (key.rightArrow) {
        setState(s => ({ ...s, cursor: Math.min(s.value.length, s.cursor + 1) }));
        return;
      }
      // Anything App-level handles (ctrl shortcuts, tab, up/down, page, esc)
      // or has no printable payload is a no-op here.
      if (
        key.ctrl ||
        key.meta ||
        key.tab ||
        key.upArrow ||
        key.downArrow ||
        key.pageUp ||
        key.pageDown ||
        key.escape ||
        !char
      ) {
        return;
      }
      setState(s => ({
        value: s.value.slice(0, s.cursor) + char + s.value.slice(s.cursor),
        cursor: s.cursor + char.length,
      }));
    },
    { isActive: focus },
  );
  // Render a block cursor by inverting the char under the caret. End-of-line
  // gets a trailing inverted space so the caret is visible past the last char.
  if (!focus) return <Text>{value}</Text>;
  if (value.length === 0) return <Text inverse> </Text>;
  const head = value.slice(0, cursor);
  const caret = value[cursor] ?? ' ';
  const tail = cursor < value.length ? value.slice(cursor + 1) : '';
  return (
    <Text>
      {head}
      <Text inverse>{caret}</Text>
      {tail}
    </Text>
  );
};

const ChatLine: React.FC<{ item: ChatItem; tools: ToolEntry[] }> = ({ item, tools }) => {
  switch (item.kind) {
    case 'user':
      return (
        <Text>
          <Text bold color={item.source === 'autoplay' ? 'green' : 'blue'}>
            {item.source === 'autoplay' ? 'auto' : 'you'}
          </Text>{' '}
          {item.text}
        </Text>
      );
    case 'agent':
      return (
        <Text>
          <Text bold color="magenta">{item.agent}</Text> {item.text}
        </Text>
      );
    case 'tool-ref': {
      const t = tools.find(x => x.id === item.toolId);
      const status = t?.ok === false ? <Text color="red">err {t.error ?? ''}</Text> : t?.ok ? <Text color="green">ok</Text> : <Text color="yellow">…</Text>;
      return (
        <Text dimColor>
          {'  '}
          <Text color="yellow">→ {item.name}</Text> {status}
        </Text>
      );
    }
    case 'handoff':
      return (
        <Text color="cyan">
          {'  '}⇢ handoff {item.from} → {item.to}
        </Text>
      );
    case 'system':
      return (
        <Text dimColor italic>
          {'  '}-- {item.text} --
        </Text>
      );
  }
};

const ToolDetailInline: React.FC<{ entry: ToolEntry }> = ({ entry }) => {
  const status = entry.ok === undefined ? 'pending' : entry.ok ? 'ok' : 'error';
  const statusColor = entry.ok === undefined ? 'yellow' : entry.ok ? 'green' : 'red';
  return (
    <Box flexDirection="column">
      <Text>
        <Text bold color="yellow">{entry.name}</Text>
        {' · '}
        <Text dimColor>{entry.agent}</Text>
        {' · '}
        <Text color={statusColor}>{status}</Text>
        {' · '}
        <Text dimColor>{new Date(entry.ts).toLocaleTimeString()}</Text>
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text bold>args</Text>
        <Text>{pretty(entry.args)}</Text>
      </Box>
      {entry.ok === false ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="red">error</Text>
          <Text>{entry.error ?? '(none)'}</Text>
        </Box>
      ) : null}
      {entry.result !== undefined ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold>result</Text>
          <Text>{pretty(entry.result)}</Text>
        </Box>
      ) : null}
    </Box>
  );
};

const PromptOverlay: React.FC<{
  agent: string;
  briefing: { prompt: string; tools: any[] } | null;
  onClose: () => void;
}> = ({ agent, briefing, onClose }) => {
  const [tab, setTab] = useState<'prompt' | 'tools'>('prompt');
  useInput((_c, key) => {
    if (key.escape) onClose();
    else if (key.leftArrow || key.rightArrow) setTab(t => (t === 'prompt' ? 'tools' : 'prompt'));
  });
  if (!briefing) {
    return <Text>no briefing for {agent} (Esc)</Text>;
  }
  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={1}>
      <Text>
        <Text bold>briefing</Text> · <Text color="magenta">{agent}</Text> ·{' '}
        <Text color={tab === 'prompt' ? 'green' : 'gray'}>[prompt]</Text>{' '}
        <Text color={tab === 'tools' ? 'green' : 'gray'}>[tools ({briefing.tools.length})]</Text>
      </Text>
      <Box marginTop={1} flexDirection="column">
        {tab === 'prompt' ? (
          <Text>{briefing.prompt.length > 4000 ? briefing.prompt.slice(0, 4000) + '\n…(truncated)' : briefing.prompt}</Text>
        ) : (
          briefing.tools.map((t: any) => (
            <Box key={t.name} flexDirection="column" marginBottom={1}>
              <Text>
                <Text bold color="yellow">{t.name}</Text>
                <Text dimColor> {t.description?.slice(0, 80) ?? ''}</Text>
              </Text>
            </Box>
          ))
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>← → switch tab · Esc close</Text>
      </Box>
    </Box>
  );
};

function phaseLabel(p: 'drafting' | 'awaiting-agent' | 'idle'): string {
  switch (p) {
    case 'drafting':
      return 'thinking up the next student line…';
    case 'awaiting-agent':
      return 'waiting for the agent…';
    case 'idle':
      return 'between turns…';
  }
}

// Render the `phase:` state-panel row. Format depends on showPhaseCount and
// experienceCompleted. Override-aware: a `↪` arrow flags when the resolved
// next-phase id differs from the array-next (i.e. a setNext override is in
// effect).
type PhaseSnapshot = {
  index: number;
  total: number;
  currentId: string | null;
  currentTitle: string | null;
  completed: boolean;
  nextPhaseId: string | null;
  isOverride: boolean;
  experienceCompleted: boolean;
  showPhaseCount: boolean;
};
function phaseLine(p: PhaseSnapshot): string {
  const label = p.currentTitle ?? p.currentId ?? '?';
  // Position prefix only when showPhaseCount is true. Use 1-based index for
  // the human-facing display (matches "Phase N of M" convention).
  const position = p.showPhaseCount ? `${p.index + 1}/${p.total} · ` : '';
  if (p.experienceCompleted) {
    return `${position}${label} [COMPLETED]`;
  }
  if (p.nextPhaseId) {
    const arrow = p.isOverride ? ' ↪' : '';
    return `${position}${label} (next: ${p.nextPhaseId}${arrow})`;
  }
  return `${position}${label}`;
}

function summary(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 26 ? s.slice(0, 26) + '…' : s;
}

function pretty(v: unknown): string {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
