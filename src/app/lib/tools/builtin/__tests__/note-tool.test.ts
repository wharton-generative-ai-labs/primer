import { note } from '../note-tool';
import type { ToolContext } from '@/app/lib/tools/types';

jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('@/app/lib/uuid', () => ({
  generateUUID: jest.fn(() => 'note-test-uuid'),
}));

interface FakeNote {
  id: string;
  content: string;
  color: string;
  [key: string]: unknown;
}

function makeContext(): {
  ctx: ToolContext;
  saved: FakeNote[];
  events: Array<{ type: string; data: any }>;
} {
  const saved: FakeNote[] = [];
  const events: Array<{ type: string; data: any }> = [];

  const ctx = {
    noteStore: {
      getAllNotes: jest.fn(async () => saved),
      getNote: jest.fn(async (id: string) => saved.find((n) => n.id === id) ?? null),
      saveNote: jest.fn(async (note: any) => {
        saved.push(note as FakeNote);
      }),
      updateNote: jest.fn(async (id: string, updates: any) => {
        const target = saved.find((n) => n.id === id);
        if (!target) return null;
        Object.assign(target, updates);
        return target;
      }),
      deleteNote: jest.fn(async (id: string) => {
        const idx = saved.findIndex((n) => n.id === id);
        if (idx === -1) return false;
        saved.splice(idx, 1);
        return true;
      }),
    },
    sendClientEvent: jest.fn((event: { type: string; data: any }) => {
      events.push(event);
    }),
    requestManager: {
      // The note tool awaits this promise after emitting the UI event.
      // Resolve immediately so the test doesn't hang on the round-trip.
      createPendingRequest: jest.fn(async () => ({ ok: true })),
      resolvePendingRequest: jest.fn(),
      rejectPendingRequest: jest.fn(),
    },
  } as unknown as ToolContext;

  return { ctx, saved, events };
}

describe('note tool', () => {
  describe('action aliases for create-a-note', () => {
    // The realtime model reaches for `add` and occasionally `create` instead
    // of the historical `display` action. All three must succeed and produce
    // the same outcome — a saved note + a `ui.note.display` event.

    it.each(['add', 'create', 'display'] as const)(
      'accepts action=%s and creates a note',
      async (action) => {
        const { ctx, saved, events } = makeContext();

        const result = await note(
          { action, content: 'a single discrete idea' },
          ctx,
        );

        expect(result.status).toBe('success');
        expect(saved).toHaveLength(1);
        expect(saved[0].content).toBe('a single discrete idea');
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('ui.note.display');
      },
    );
  });

  describe('invalid action error', () => {
    it('returns the canonical surface in the error message', async () => {
      const { ctx } = makeContext();

      const result = await note(
        // Cast through unknown because TS rightly refuses an unknown literal
        // here — the runtime guard is exactly what we want to exercise.
        { action: 'wat' as unknown as 'add' },
        ctx,
      );

      expect(result.status).toBe('error');
      // Lock the new canonical surface so a future regression that drops
      // `add` (or reintroduces `display` as the headline name) trips here.
      expect(result.data.error).toMatch(/Invalid action: wat/);
      expect(result.data.error).toMatch(/add/);
      expect(result.data.error).toMatch(/list/);
      expect(result.data.error).toMatch(/get/);
      expect(result.data.error).toMatch(/changeColor/);
      expect(result.data.error).toMatch(/delete/);
    });
  });
});
