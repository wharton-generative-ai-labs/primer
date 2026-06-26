/**
 * MessageHistoryManager
 *
 * Keeps the running message history for a backend agent under control by
 * eliding stale tool-result payloads. Tool results from earlier turns are
 * rewritten with a small placeholder while preserving the tool_call_id ↔
 * tool_use linkage Anthropic requires.
 *
 * Policy: walk turns newest → oldest. The most recent `minTurnsKept` turns
 * are always kept verbatim. Beyond that, greedy-keep any turn whose tool
 * results still fit the remaining byte budget; elide turns that bust it.
 * A small turn behind a giant one therefore stays alive.
 */
import { createModuleLogger } from '@/lib/logger';
import type { AIMessage, ToolCall } from './types';

const logger = createModuleLogger('backend-agent-history');

export interface ElisionOptions {
  /** Most recent N turns are always kept verbatim. */
  minTurnsKept?: number;
  /** Byte budget for tool-result content beyond the floor. */
  byteBudget?: number;
  /** Tool results smaller than this are never worth eliding. */
  minElidableBytes?: number;
}

interface Turn {
  /** Index of the assistant message that opened the turn. */
  assistantIdx: number;
  /** Indices of tool-result messages that follow it. */
  toolResultIdxs: number[];
  /** Total content bytes across this turn's tool results. */
  toolResultBytes: number;
}

const DEFAULTS = {
  minTurnsKept: 3,
  byteBudget: 80_000,
  minElidableBytes: 1_000,
} as const;

/**
 * Mutates `messages` in place: rewrites tool-result content for stale,
 * oversized turns into a placeholder describing what was elided.
 */
export function elideStaleToolResults(
  messages: AIMessage[],
  options: ElisionOptions = {}
): { elidedTurns: number; bytesReclaimed: number } {
  const minTurnsKept = options.minTurnsKept ?? DEFAULTS.minTurnsKept;
  const byteBudget = options.byteBudget ?? DEFAULTS.byteBudget;
  const minElidableBytes = options.minElidableBytes ?? DEFAULTS.minElidableBytes;

  const turns = identifyTurns(messages);
  if (turns.length <= minTurnsKept) {
    return { elidedTurns: 0, bytesReclaimed: 0 };
  }

  let remainingBudget = byteBudget;
  let elidedTurns = 0;
  let bytesReclaimed = 0;

  // Walk newest → oldest.
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    const turnsFromEnd = turns.length - 1 - i;

    if (turnsFromEnd < minTurnsKept) {
      continue;
    }

    if (turn.toolResultBytes <= minElidableBytes) {
      continue;
    }

    if (turn.toolResultBytes <= remainingBudget) {
      remainingBudget -= turn.toolResultBytes;
      continue;
    }

    const reclaimed = elideTurn(messages, turn);
    bytesReclaimed += reclaimed;
    elidedTurns++;
  }

  if (elidedTurns > 0) {
    logger.debug(
      { elidedTurns, bytesReclaimed, totalTurns: turns.length, minTurnsKept, byteBudget },
      'Elided stale tool results'
    );
  }

  return { elidedTurns, bytesReclaimed };
}

/**
 * Group messages into turns. A turn is one assistant-message-with-tool_calls
 * plus the run of tool-result messages that immediately follows it.
 */
function identifyTurns(messages: AIMessage[]): Turn[] {
  const turns: Turn[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'assistant' || !msg.tool_calls?.length) continue;

    const toolResultIdxs: number[] = [];
    let toolResultBytes = 0;
    for (let j = i + 1; j < messages.length; j++) {
      const next = messages[j];
      if (next.role !== 'tool') break;
      toolResultIdxs.push(j);
      toolResultBytes += contentByteLength(next.content);
    }

    turns.push({ assistantIdx: i, toolResultIdxs, toolResultBytes });
  }

  return turns;
}

function contentByteLength(content: unknown): number {
  if (typeof content !== 'string') return 0;
  return content.length;
}

/**
 * Replace this turn's tool-result contents with a placeholder. Returns
 * total bytes reclaimed.
 */
function elideTurn(messages: AIMessage[], turn: Turn): number {
  const assistantMsg = messages[turn.assistantIdx];
  const toolCallById = new Map<string, ToolCall>();
  for (const tc of assistantMsg.tool_calls ?? []) {
    toolCallById.set(tc.id, tc);
  }

  let reclaimed = 0;
  for (const idx of turn.toolResultIdxs) {
    const msg = messages[idx];
    const before = contentByteLength(msg.content);
    const tc = msg.tool_call_id ? toolCallById.get(msg.tool_call_id) : undefined;
    const placeholder = buildPlaceholder(tc, before);
    if (placeholder.length >= before) continue;
    msg.content = placeholder;
    reclaimed += before - placeholder.length;
  }
  return reclaimed;
}

function buildPlaceholder(tc: ToolCall | undefined, originalBytes: number): string {
  const tool = tc?.function.name ?? 'unknown';
  let action: string | undefined;
  if (tc) {
    try {
      const args = JSON.parse(tc.function.arguments);
      action = typeof args?.action === 'string' ? args.action : undefined;
    } catch {
      // ignore
    }
  }
  return JSON.stringify({
    status: 'elided',
    data: {
      note: 'Tool result from earlier turn omitted to save context. Re-call the tool if you still need the data.',
      tool,
      ...(action ? { action } : {}),
      originalBytes,
    },
  });
}
