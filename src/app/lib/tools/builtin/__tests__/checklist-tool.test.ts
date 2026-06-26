import { checklist } from '../checklist-tool';
import type { ToolContext } from '@/app/lib/tools/types';

jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

interface FakeArtifact {
  id: string;
  name: string;
  type: string;
  content: string;
  metadata?: { tags?: string[] };
}

function makeContext(artifacts: FakeArtifact[]): ToolContext {
  const updateArtifact = jest.fn(async (id: string, content: string) => {
    const target = artifacts.find((a) => a.id === id);
    if (target) target.content = content;
    return { id, content };
  });
  const ctx = {
    listArtifacts: jest.fn(async () =>
      artifacts.map(({ id, name, type, metadata }) => ({
        id,
        name,
        type,
        metadata,
      })),
    ),
    getArtifact: jest.fn(async (id: string) =>
      artifacts.find((a) => a.id === id) ?? null,
    ),
    updateArtifact,
  } as unknown as ToolContext;
  return ctx;
}

describe('checklist tool', () => {
  describe('check / uncheck noop short-circuit', () => {
    it('returns noop:true without rewriting when item is already checked', async () => {
      const artifacts: FakeArtifact[] = [
        {
          id: 'cl1',
          name: 'Build Progress',
          type: 'checklist',
          content: '- [x] Creating character prompts\n- [ ] Generating visual assets\n',
        },
      ];
      const ctx = makeContext(artifacts);

      const result = await checklist(
        { action: 'check', itemText: 'Creating character prompts' },
        ctx,
      );

      expect(result.status).toBe('success');
      expect(result.data.noop).toBe(true);
      expect(result.data.message).toMatch(/already checked/i);
      expect(result.data.message).toMatch(/continue with the next step/i);
      expect(result.data.checklist_id).toBe('cl1');
      // The artifact MUST NOT be rewritten when there's nothing to change.
      expect(ctx.updateArtifact).not.toHaveBeenCalled();
    });

    it('returns noop:true without rewriting when item is already unchecked', async () => {
      const artifacts: FakeArtifact[] = [
        {
          id: 'cl1',
          name: 'Build Progress',
          type: 'checklist',
          content: '- [ ] Creating character prompts\n- [ ] Generating visual assets\n',
        },
      ];
      const ctx = makeContext(artifacts);

      const result = await checklist(
        { action: 'uncheck', itemText: 'Creating character prompts' },
        ctx,
      );

      expect(result.status).toBe('success');
      expect(result.data.noop).toBe(true);
      expect(result.data.message).toMatch(/already unchecked/i);
      expect(result.data.message).toMatch(/continue with the next step/i);
      expect(ctx.updateArtifact).not.toHaveBeenCalled();
    });

    it('actually flips the box when state differs (check)', async () => {
      const artifacts: FakeArtifact[] = [
        {
          id: 'cl1',
          name: 'Build Progress',
          type: 'checklist',
          content: '- [ ] Creating character prompts\n',
        },
      ];
      const ctx = makeContext(artifacts);

      const result = await checklist(
        { action: 'check', itemText: 'Creating character prompts' },
        ctx,
      );

      expect(result.status).toBe('success');
      expect(result.data.noop).toBeUndefined();
      expect(ctx.updateArtifact).toHaveBeenCalledTimes(1);
      expect(artifacts[0].content).toContain('- [x] Creating character prompts');
    });

    it('actually flips the box when state differs (uncheck)', async () => {
      const artifacts: FakeArtifact[] = [
        {
          id: 'cl1',
          name: 'Build Progress',
          type: 'checklist',
          content: '- [x] Creating character prompts\n',
        },
      ];
      const ctx = makeContext(artifacts);

      const result = await checklist(
        { action: 'uncheck', itemText: 'Creating character prompts' },
        ctx,
      );

      expect(result.status).toBe('success');
      expect(result.data.noop).toBeUndefined();
      expect(ctx.updateArtifact).toHaveBeenCalledTimes(1);
      expect(artifacts[0].content).toContain('- [ ] Creating character prompts');
    });
  });

  describe('check error path', () => {
    it('still surfaces a clear error when itemText does not match any line', async () => {
      const artifacts: FakeArtifact[] = [
        {
          id: 'cl1',
          name: 'Build Progress',
          type: 'checklist',
          content: '- [ ] Creating character prompts\n',
        },
      ];
      const ctx = makeContext(artifacts);

      const result = await checklist(
        { action: 'check', itemText: 'No such item' },
        ctx,
      );

      expect(result.status).toBe('error');
      expect(result.data.available_items).toEqual(['Creating character prompts']);
    });
  });
});
