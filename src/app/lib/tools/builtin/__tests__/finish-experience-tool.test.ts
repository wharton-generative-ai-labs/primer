import {
  finishExperience,
  FINISH_EXPERIENCE_DESCRIPTION,
} from '../finish-experience-tool';
import type { ToolContext } from '@/app/lib/tools/types';

jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

interface MockableContext extends ToolContext {
  _calls: Array<{ reason: string | undefined }>;
}

function makeContext(overrides: Partial<ToolContext> = {}): MockableContext {
  const calls: Array<{ reason: string | undefined }> = [];
  const baseContext: MockableContext = {
    _calls: calls,
    finishExperience: jest.fn(async (reason?: string) => {
      calls.push({ reason });
      return { result: true };
    }),
    ...overrides,
  };
  return baseContext;
}

describe('finishExperience tool', () => {
  describe('description (LLM-facing)', () => {
    it('matches the snapshot agreement-gate sentence verbatim', () => {
      // The first sentence is load-bearing — the LLM uses it to know that
      // calling this tool requires explicit user agreement. If you reword the
      // gate, also update the snapshot intentionally.
      expect(
        FINISH_EXPERIENCE_DESCRIPTION.startsWith(
          "Call this only after the user has explicitly agreed that the entire experience is complete and ready to wrap up. The user will be shown a closing dialog and the workflow will lock to read-only-ish (forward navigation hidden until they rewind). This is irreversible from the agent's side; only the user can rewind.",
        ),
      ).toBe(true);
    });

    it('notes the distinction from workflowPhase.nextPhase', () => {
      // The LLM must understand these are different tools; the description
      // explicitly contrasts them.
      expect(FINISH_EXPERIENCE_DESCRIPTION).toContain(
        'distinct from `workflowPhase.nextPhase`',
      );
    });
  });

  describe('invocation', () => {
    it('calls context.finishExperience(undefined) when no args are passed', async () => {
      const ctx = makeContext();
      const result = await finishExperience({}, ctx);
      expect(result.status).toBe('success');
      expect(result.data.result).toBe(true);
      expect(ctx._calls).toHaveLength(1);
      expect(ctx._calls[0].reason).toBeUndefined();
      expect(ctx.finishExperience).toHaveBeenCalledWith(undefined);
    });

    it('passes through the reason argument when supplied', async () => {
      const ctx = makeContext();
      const result = await finishExperience({ reason: 'wrap up' }, ctx);
      expect(result.status).toBe('success');
      expect(result.data.result).toBe(true);
      expect(ctx._calls[0].reason).toBe('wrap up');
      expect(ctx.finishExperience).toHaveBeenCalledWith('wrap up');
    });

    it('is idempotent: calling twice still returns { result: true }', async () => {
      // The manager owns the actual idempotency (a second call after the
      // flag is set emits no new event). The tool layer just ensures it
      // doesn't error if invoked more than once.
      const ctx = makeContext();
      const first = await finishExperience({}, ctx);
      const second = await finishExperience({}, ctx);
      expect(first.status).toBe('success');
      expect(first.data.result).toBe(true);
      expect(second.status).toBe('success');
      expect(second.data.result).toBe(true);
      expect(ctx._calls).toHaveLength(2);
    });

    it('errors when finishExperience capability is not in context', async () => {
      const result = await finishExperience({}, {} as ToolContext);
      expect(result.status).toBe('error');
      expect(result.data.error).toContain('finishExperience not available');
    });

    it('surfaces an error when context.finishExperience returns result: false', async () => {
      const ctx = makeContext({
        finishExperience: async () => ({ result: false }),
      });
      const result = await finishExperience({}, ctx);
      expect(result.status).toBe('error');
      expect(result.data.error).toContain('Failed to finish experience');
    });

    it('catches thrown errors and surfaces their message', async () => {
      const ctx = makeContext({
        finishExperience: async () => {
          throw new Error('network down');
        },
      });
      const result = await finishExperience({}, ctx);
      expect(result.status).toBe('error');
      expect(result.data.error).toBe('network down');
    });
  });

  describe('reachability via the realtime tool registry', () => {
    // Integration test: the realtime path looks tools up via the shared
    // `ToolRegistry` instance. Registering the client builtin set should
    // make `finishExperience` resolvable through the same lookup path that
    // `useHandleServerEvent` uses (`registry.hasToolWithName`).
    it('is registered by registerClientBuiltinTools and resolves to the finishExperience handler', async () => {
      const { ToolRegistry } = await import('@/app/lib/ToolRegistry');
      const { registerClientBuiltinTools } = await import(
        '@/app/lib/tools/builtin/register-client'
      );
      // Tool is gated on `workflowPhases.length > 0` — pass a minimal config
      // that declares phases.
      await registerClientBuiltinTools({
        agents: {},
        workflowPhases: [{ id: 'intro', title: 'Intro' }],
      } as never);
      const registry = ToolRegistry.getInstance();
      expect(registry.hasToolWithName('finishExperience')).toBe(true);
      const tool = registry.getTool('finishExperience');
      expect(tool).not.toBeNull();
      expect(tool!.description).toContain(
        "Call this only after the user has explicitly agreed that the entire experience is complete",
      );
    });
  });
});
