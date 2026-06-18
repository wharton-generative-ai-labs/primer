import {
  filterPersistableMessages,
  formatTranscriptMarkdown,
  type PersistableTranscriptMessage,
} from '@/app/lib/transcript-persistence';

function userMessage(
  text: string,
  overrides: Partial<PersistableTranscriptMessage> = {},
): PersistableTranscriptMessage {
  return {
    itemId: `user-${overrides.itemId ?? 'a'}`,
    type: 'MESSAGE',
    role: 'user',
    title: text,
    timestamp: '12:34:56 PM',
    isHidden: false,
    ...overrides,
  };
}

function assistantMessage(
  text: string,
  overrides: Partial<PersistableTranscriptMessage> = {},
): PersistableTranscriptMessage {
  return {
    itemId: `assistant-${overrides.itemId ?? 'a'}`,
    type: 'MESSAGE',
    role: 'assistant',
    title: text,
    timestamp: '12:35:02 PM',
    isHidden: false,
    agentName: 'Intake',
    ...overrides,
  };
}

describe('filterPersistableMessages', () => {
  it('keeps committed user/assistant messages with non-empty text', () => {
    const items: PersistableTranscriptMessage[] = [
      userMessage('Hello'),
      assistantMessage('Hi back!'),
    ];
    expect(filterPersistableMessages(items)).toHaveLength(2);
  });

  it('drops breadcrumbs (workflow phase changes, tool errors, handoffs)', () => {
    const items: PersistableTranscriptMessage[] = [
      userMessage('Hi'),
      { itemId: 'b1', type: 'BREADCRUMB', title: 'Phase change' },
      { itemId: 'b2', type: 'BREADCRUMB', title: 'tool failed' },
    ];
    const filtered = filterPersistableMessages(items);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].itemId).toBe('user-a');
  });

  it('drops hidden messages (system / internal)', () => {
    const items: PersistableTranscriptMessage[] = [
      userMessage('visible'),
      assistantMessage('hidden one', { isHidden: true, itemId: 'hidden' }),
    ];
    const filtered = filterPersistableMessages(items);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('visible');
  });

  it('drops messages with empty / whitespace-only text', () => {
    const items: PersistableTranscriptMessage[] = [
      userMessage(''),
      assistantMessage('   '),
      userMessage('actual content', { itemId: 'real' }),
    ];
    const filtered = filterPersistableMessages(items);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('actual content');
  });

  it('drops the [Transcribing...] placeholder until the realtime API completes', () => {
    const items: PersistableTranscriptMessage[] = [
      userMessage('[Transcribing...]'),
      userMessage('done', { itemId: 'done' }),
    ];
    const filtered = filterPersistableMessages(items);
    expect(filtered.map((m) => m.title)).toEqual(['done']);
  });

  it('drops messages without a recognized role (tool/system items in transit)', () => {
    const items: PersistableTranscriptMessage[] = [
      { itemId: 'x', type: 'MESSAGE', title: 'no role here' },
      userMessage('with role'),
    ];
    const filtered = filterPersistableMessages(items);
    expect(filtered).toHaveLength(1);
  });
});

describe('formatTranscriptMarkdown', () => {
  it('renders a header + speaker blocks with timestamps', () => {
    const items: PersistableTranscriptMessage[] = [
      userMessage('What can you build for me?'),
      assistantMessage("Let's start with your topic."),
    ];
    expect(formatTranscriptMarkdown(items)).toMatchInlineSnapshot(`
"# Conversation Transcript

**User** (12:34:56 PM):
What can you build for me?

**Intake** (12:35:02 PM):
Let's start with your topic.
"
`);
  });

  it('uses agentName for assistant labels and falls back to "Assistant"', () => {
    const items: PersistableTranscriptMessage[] = [
      assistantMessage('First, with name', {
        itemId: '1',
        agentName: 'Intake',
      }),
      assistantMessage('Second, no name', {
        itemId: '2',
        agentName: undefined,
      }),
    ];
    const md = formatTranscriptMarkdown(items);
    expect(md).toContain('**Intake**');
    expect(md).toContain('**Assistant**');
  });

  it('omits the timestamp parenthetical when one is not provided', () => {
    const items: PersistableTranscriptMessage[] = [
      userMessage('hello', { timestamp: undefined }),
    ];
    expect(formatTranscriptMarkdown(items)).toContain('**User**:\nhello');
    expect(formatTranscriptMarkdown(items)).not.toContain('()');
  });

  it('returns a placeholder body when no persistable messages exist', () => {
    expect(formatTranscriptMarkdown([])).toMatchInlineSnapshot(`
"# Conversation Transcript

_No conversation yet._
"
`);
  });

  it('is deterministic — same input produces byte-identical output', () => {
    const items: PersistableTranscriptMessage[] = [
      userMessage('Hi there'),
      assistantMessage('Hello!'),
    ];
    expect(formatTranscriptMarkdown(items)).toBe(
      formatTranscriptMarkdown(items),
    );
  });

  it('skips non-persistable items (breadcrumbs, hidden, placeholders) when rendering', () => {
    const items: PersistableTranscriptMessage[] = [
      userMessage('keep me'),
      { itemId: 'b', type: 'BREADCRUMB', title: 'drop me' },
      assistantMessage('[Transcribing...]', { itemId: 'placeholder' }),
      assistantMessage('keep me too', { itemId: 'real' }),
    ];
    const md = formatTranscriptMarkdown(items);
    expect(md).toContain('keep me');
    expect(md).toContain('keep me too');
    expect(md).not.toContain('drop me');
    expect(md).not.toContain('[Transcribing...]');
  });
});
