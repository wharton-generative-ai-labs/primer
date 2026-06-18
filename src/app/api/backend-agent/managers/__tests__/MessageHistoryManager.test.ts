import { elideStaleToolResults } from '../MessageHistoryManager';
import type { AIMessage } from '../types';

jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

function makeTurn(
  index: number,
  toolName: string,
  resultBytes: number,
  action?: string
): AIMessage[] {
  const callId = `call_${index}`;
  const args = action ? JSON.stringify({ action }) : '{}';
  const assistant: AIMessage = {
    role: 'assistant',
    content: '',
    tool_calls: [
      { id: callId, type: 'function', function: { name: toolName, arguments: args } },
    ],
  };
  const toolResult: AIMessage = {
    role: 'tool',
    tool_call_id: callId,
    content: 'x'.repeat(resultBytes),
  };
  return [assistant, toolResult];
}

describe('elideStaleToolResults', () => {
  it('does nothing when fewer turns than floor', () => {
    const messages: AIMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      ...makeTurn(0, 'artifact', 50_000, 'get'),
      ...makeTurn(1, 'artifact', 50_000, 'get'),
    ];
    const before = messages.map((m) => m.content);
    const result = elideStaleToolResults(messages);
    expect(result.elidedTurns).toBe(0);
    expect(messages.map((m) => m.content)).toEqual(before);
  });

  it('keeps the most recent N turns verbatim', () => {
    const messages: AIMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      ...makeTurn(0, 'artifact', 50_000, 'get'),
      ...makeTurn(1, 'artifact', 50_000, 'get'),
      ...makeTurn(2, 'artifact', 50_000, 'get'),
      ...makeTurn(3, 'artifact', 50_000, 'get'),
    ];
    elideStaleToolResults(messages, { minTurnsKept: 3, byteBudget: 0 });
    // Turn 0 is older than the floor — should be elided.
    expect(messages[3].content).toContain('"status":"elided"');
    // Turns 1, 2, 3 within floor — verbatim.
    expect(messages[5].content.length).toBe(50_000);
    expect(messages[7].content.length).toBe(50_000);
    expect(messages[9].content.length).toBe(50_000);
  });

  it('keeps small older turns even when a giant one is elided', () => {
    const messages: AIMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      ...makeTurn(0, 'artifact', 500, 'create'), // small
      ...makeTurn(1, 'analytics', 200_000), // giant
      ...makeTurn(2, 'artifact', 500, 'create'), // small
      ...makeTurn(3, 'noop', 100),
      ...makeTurn(4, 'noop', 100),
      ...makeTurn(5, 'noop', 100),
    ];
    elideStaleToolResults(messages, { minTurnsKept: 3, byteBudget: 5_000, minElidableBytes: 1_000 });

    // Most recent 3 turns: untouched.
    expect(messages[messages.length - 1].content).toBe('x'.repeat(100));

    // Giant turn 1: elided.
    const turn1Result = messages[5];
    expect(turn1Result.content).toContain('"status":"elided"');
    expect(turn1Result.content).toContain('"tool":"analytics"');
    expect(turn1Result.content).toContain('"originalBytes":200000');

    // Small turn 0 (older than the giant): below minElidableBytes — kept.
    const turn0Result = messages[3];
    expect(turn0Result.content).toBe('x'.repeat(500));
  });

  it('greedy-keeps small turns past a budget-busting one', () => {
    const messages: AIMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      ...makeTurn(0, 'small', 4_000), // fits in remaining budget
      ...makeTurn(1, 'huge', 200_000), // busts budget, elided
      ...makeTurn(2, 'noop', 100),
      ...makeTurn(3, 'noop', 100),
      ...makeTurn(4, 'noop', 100),
    ];
    elideStaleToolResults(messages, {
      minTurnsKept: 3,
      byteBudget: 5_000,
      minElidableBytes: 1_000,
    });

    // Huge turn 1: elided.
    expect(messages[5].content).toContain('"status":"elided"');

    // Small turn 0: still fits remaining budget post-elision — verbatim.
    expect(messages[3].content).toBe('x'.repeat(4_000));
  });

  it('preserves tool_call_id linkage and includes action in placeholder', () => {
    const messages: AIMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      ...makeTurn(0, 'artifact', 50_000, 'get'),
      ...makeTurn(1, 'noop', 50),
      ...makeTurn(2, 'noop', 50),
      ...makeTurn(3, 'noop', 50),
    ];
    const originalToolCallId = messages[3].tool_call_id;
    elideStaleToolResults(messages, { minTurnsKept: 3, byteBudget: 0 });
    expect(messages[3].tool_call_id).toBe(originalToolCallId);
    expect(messages[3].role).toBe('tool');
    expect(messages[3].content).toContain('"action":"get"');
    expect(messages[3].content).toContain('"tool":"artifact"');
  });

  it('is idempotent — re-running on already-elided history is a no-op', () => {
    const messages: AIMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      ...makeTurn(0, 'artifact', 100_000, 'get'),
      ...makeTurn(1, 'noop', 50),
      ...makeTurn(2, 'noop', 50),
      ...makeTurn(3, 'noop', 50),
    ];
    elideStaleToolResults(messages, { minTurnsKept: 3, byteBudget: 0 });
    const firstPass = messages.map((m) => m.content);
    const second = elideStaleToolResults(messages, { minTurnsKept: 3, byteBudget: 0 });
    expect(second.elidedTurns).toBe(0);
    expect(messages.map((m) => m.content)).toEqual(firstPass);
  });
});
