import {
  workflowPhase,
  WORKFLOW_PHASE_DESCRIPTION,
} from '../workflow-phase-tool';
import type {
  CurrentWorkflowPhaseInfo,
  ToolContext,
} from '@/app/lib/tools/types';

jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

interface MockableContext extends ToolContext {
  _calls: Array<{ op: any; meta: any }>;
}

function makeContext(overrides: Partial<ToolContext> = {}): MockableContext {
  const calls: Array<{ op: any; meta: any }> = [];
  const phases = [
    { id: 'intro', title: 'Intro' },
    { id: 'design', title: 'Design' },
    { id: 'build', title: 'Build' },
    { id: 'reflect', title: 'Reflect' },
  ];
  const baseContext: MockableContext = {
    _calls: calls,
    setWorkflowPhase: jest.fn(async (op: any, meta: any) => {
      calls.push({ op, meta });
      return {
        result: true,
        currentPhase:
          op.kind === 'set'
            ? op.targetPhase
            : op.kind === 'advance'
              ? 'design'
              : 'intro',
        nextPhaseOverride:
          op.kind === 'setNext' ? op.targetPhase : undefined,
      };
    }),
    getCurrentWorkflowPhase: jest.fn(
      (): CurrentWorkflowPhaseInfo => ({
        id: 'intro',
        title: 'Intro',
        index: 0,
        total: phases.length,
        isCompleted: false,
        resolvedNextPhaseId: 'design',
      }),
    ),
    getWorkflowPhases: jest.fn(() => phases),
    getWorkflowPhaseState: jest.fn(() => ({
      currentPhase: 'intro',
      furthestPhase: 'intro',
      visited: ['intro'],
      completedPhases: [],
      snapshots: {},
    })),
    suggestWorkflowPhaseReturn: jest.fn(),
    ...overrides,
  };
  return baseContext;
}

describe('workflowPhase tool', () => {
  describe('description (LLM-facing)', () => {
    it('matches the snapshot guardrail sentence verbatim', () => {
      // The first sentence is load-bearing — the agent uses it to know to
      // confirm with the user before moving forward. If you reword the
      // guardrail, also update the snapshot intentionally.
      expect(WORKFLOW_PHASE_DESCRIPTION.startsWith(
        'Before calling `nextPhase` or `set` to move the workflow forward, verbally check that the user is ready. The user expects to be asked.',
      )).toBe(true);
    });
  });

  describe('discover', () => {
    it('returns the ordered phase list with state flags', async () => {
      const ctx = makeContext({
        getWorkflowPhaseState: () => ({
          currentPhase: 'design',
          furthestPhase: 'build',
          visited: ['intro', 'design'],
          completedPhases: ['intro'],
          snapshots: {},
        }),
        getCurrentWorkflowPhase: () => ({
          id: 'design',
          title: 'Design',
          index: 1,
          total: 4,
          isCompleted: false,
        }),
      });
      const result = await workflowPhase({ action: 'discover' }, ctx);
      expect(result.status).toBe('success');
      expect(result.data.phases).toHaveLength(4);
      expect(result.data.phases[0]).toMatchObject({
        id: 'intro',
        visited: true,
        completed: true,
        current: false,
      });
      expect(result.data.phases[1]).toMatchObject({
        id: 'design',
        visited: true,
        completed: false,
        current: true,
      });
      expect(result.data.phases[2]).toMatchObject({
        id: 'build',
        furthest: true,
        visited: false,
      });
    });

    it('errors when no workflow phases capability is present', async () => {
      const result = await workflowPhase(
        { action: 'discover' },
        {} as ToolContext,
      );
      expect(result.status).toBe('error');
    });
  });

  describe('current', () => {
    it('returns metadata from getCurrentWorkflowPhase', async () => {
      const ctx = makeContext();
      const result = await workflowPhase({ action: 'current' }, ctx);
      expect(result.status).toBe('success');
      expect(result.data.current).toMatchObject({
        id: 'intro',
        title: 'Intro',
        index: 0,
        resolvedNextPhaseId: 'design',
      });
    });

    it('returns null when no phase is active', async () => {
      const ctx = makeContext({ getCurrentWorkflowPhase: () => null });
      const result = await workflowPhase({ action: 'current' }, ctx);
      expect(result.status).toBe('success');
      expect(result.data.current).toBeNull();
    });
  });

  describe('nextPhase', () => {
    it('routes through setWorkflowPhase with op.kind = nextPhase', async () => {
      const ctx = makeContext();
      const result = await workflowPhase({ action: 'nextPhase' }, ctx);
      expect(result.status).toBe('success');
      expect(result.data.result).toBe(true);
      expect(ctx._calls).toHaveLength(1);
      expect(ctx._calls[0].op).toEqual({ kind: 'nextPhase' });
      expect(ctx._calls[0].meta?.trigger).toBe('agent');
    });

    it('surfaces error message when transition fails', async () => {
      const ctx = makeContext({
        setWorkflowPhase: async () => ({
          result: false,
          message: 'Cannot advance: last phase',
        }),
      });
      const result = await workflowPhase({ action: 'nextPhase' }, ctx);
      expect(result.status).toBe('error');
      expect(result.data.error).toContain('Cannot advance');
    });
  });

  describe('removed agent-facing actions', () => {
    it('rejects `complete` (now low-level only — server primitive used by UI Next)', async () => {
      const ctx = makeContext();
      const result = await workflowPhase({ action: 'complete' as any }, ctx);
      expect(result.status).toBe('error');
      expect(result.data.error).toContain('Invalid action');
      expect(ctx._calls).toHaveLength(0);
    });

    it('rejects `advance` (now low-level only — server primitive used by UI Next)', async () => {
      const ctx = makeContext();
      const result = await workflowPhase({ action: 'advance' as any }, ctx);
      expect(result.status).toBe('error');
      expect(result.data.error).toContain('Invalid action');
      expect(ctx._calls).toHaveLength(0);
    });

    // Note: `markObjective` has been re-introduced as an agent-callable action
    // in the markObjective action test suite below. It is no longer rejected.
  });

  describe('set', () => {
    it('jumps forward to a named phase', async () => {
      const ctx = makeContext();
      const result = await workflowPhase(
        { action: 'set', phase: 'build' },
        ctx,
      );
      expect(result.status).toBe('success');
      expect(ctx._calls[0].op).toEqual({ kind: 'set', targetPhase: 'build' });
    });

    it('rejects backward targets without calling through', async () => {
      const ctx = makeContext({
        getCurrentWorkflowPhase: () => ({
          id: 'design',
          title: 'Design',
          index: 1,
          total: 4,
          isCompleted: false,
        }),
      });
      const result = await workflowPhase(
        { action: 'set', phase: 'intro' },
        ctx,
      );
      expect(result.status).toBe('error');
      expect(result.data.error).toBe(
        'Agents cannot navigate backward; use suggestReturn',
      );
      expect(ctx._calls).toHaveLength(0);
    });

    it('rejects current phase target as backward', async () => {
      const ctx = makeContext();
      const result = await workflowPhase(
        { action: 'set', phase: 'intro' },
        ctx,
      );
      expect(result.status).toBe('error');
      expect(ctx._calls).toHaveLength(0);
    });

    it('errors when phase parameter is missing', async () => {
      const ctx = makeContext();
      const result = await workflowPhase({ action: 'set' }, ctx);
      expect(result.status).toBe('error');
      expect(ctx._calls).toHaveLength(0);
    });
  });

  describe('setNext', () => {
    it('records a forward override without navigating', async () => {
      const ctx = makeContext();
      const result = await workflowPhase(
        { action: 'setNext', phase: 'build' },
        ctx,
      );
      expect(result.status).toBe('success');
      expect(result.data.nextPhaseOverride).toBe('build');
      expect(ctx._calls[0].op).toEqual({
        kind: 'setNext',
        targetPhase: 'build',
      });
    });

    it('rejects backward targets', async () => {
      const ctx = makeContext({
        getCurrentWorkflowPhase: () => ({
          id: 'build',
          title: 'Build',
          index: 2,
          total: 4,
          isCompleted: false,
        }),
      });
      const result = await workflowPhase(
        { action: 'setNext', phase: 'intro' },
        ctx,
      );
      expect(result.status).toBe('error');
      expect(ctx._calls).toHaveLength(0);
    });

    it('rejects the current phase as a target', async () => {
      const ctx = makeContext();
      const result = await workflowPhase(
        { action: 'setNext', phase: 'intro' },
        ctx,
      );
      expect(result.status).toBe('error');
      expect(result.data.error).toContain(
        'cannot be the current phase',
      );
      expect(ctx._calls).toHaveLength(0);
    });

    it('rejects unknown phase ids', async () => {
      const ctx = makeContext();
      const result = await workflowPhase(
        { action: 'setNext', phase: 'nope' },
        ctx,
      );
      expect(result.status).toBe('error');
      expect(result.data.error).toContain('Unknown phase');
      expect(ctx._calls).toHaveLength(0);
    });
  });

  describe('suggestReturn', () => {
    it('calls suggestWorkflowPhaseReturn and does not transition', async () => {
      const ctx = makeContext();
      const result = await workflowPhase(
        {
          action: 'suggestReturn',
          phase: 'design',
          reason: 'You may want to revisit the design objectives.',
        },
        ctx,
      );
      expect(result.status).toBe('success');
      expect(ctx.suggestWorkflowPhaseReturn).toHaveBeenCalledWith(
        'design',
        'You may want to revisit the design objectives.',
      );
      // No transitions should have been issued.
      expect(ctx._calls).toHaveLength(0);
    });

    it('errors when phase is missing', async () => {
      const ctx = makeContext();
      const result = await workflowPhase(
        { action: 'suggestReturn', reason: 'x' },
        ctx,
      );
      expect(result.status).toBe('error');
    });

    it('errors when reason is missing', async () => {
      const ctx = makeContext();
      const result = await workflowPhase(
        { action: 'suggestReturn', phase: 'design' },
        ctx,
      );
      expect(result.status).toBe('error');
    });
  });

  describe('reachability via the realtime tool registry', () => {
    // Integration test: the realtime path looks tools up via the shared
    // `ToolRegistry` instance. Registering the client builtin set should
    // make `workflowPhase` resolvable through the same lookup path that
    // `useHandleServerEvent` uses (`registry.hasToolWithName`).
    it('is registered by registerClientBuiltinTools and resolves to the workflowPhase handler', async () => {
      const { ToolRegistry } = await import('@/app/lib/ToolRegistry');
      // Reset the singleton between test files: the registry is a process-wide
      // singleton. Calling `registerClientBuiltinTools` twice on the same
      // instance is a no-op for already-registered tools, so we just rely on
      // the existing instance.
      const { registerClientBuiltinTools } = await import(
        '@/app/lib/tools/builtin/register-client'
      );
      // The tool is gated on `workflowPhases.length > 0` — pass a minimal
      // config that declares phases to exercise the registration path.
      await registerClientBuiltinTools({
        agents: {},
        workflowPhases: [{ id: 'intro', title: 'Intro' }],
      } as never);
      const registry = ToolRegistry.getInstance();
      expect(registry.hasToolWithName('workflowPhase')).toBe(true);
      const tool = registry.getTool('workflowPhase');
      expect(tool).not.toBeNull();
        expect(tool!.description).toContain(
          'Before calling `nextPhase` or `set` to move the workflow forward',
        );
    });
  });
});

describe('workflowPhase tool — markObjective action', () => {
  function makeCtx(setResult: any = { result: true }) {
    return {
      getCurrentWorkflowPhase: () => ({ id: 'p1' }),
      getWorkflowPhases: () => [{ id: 'p1', objectives: [{ id: 'o1', description: 'd' }] }],
      setWorkflowPhase: jest.fn().mockResolvedValue(setResult),
    } as any;
  }

  test('routes markObjective through setWorkflowPhase with id payload', async () => {
    const ctx = makeCtx();
    const res = await workflowPhase({ action: 'markObjective', id: 'o1' } as any, ctx);
    expect(ctx.setWorkflowPhase).toHaveBeenCalledWith(
      { kind: 'markObjective', id: 'o1' },
      { trigger: 'agent' },
    );
    expect(res.status).toBe('success');
  });

  test('rejects missing id with actionable error', async () => {
    const ctx = makeCtx();
    const res = await workflowPhase({ action: 'markObjective' } as any, ctx);
    expect(res.status).toBe('error');
    expect((res.data as any).error).toMatch(/id.*required.*markObjective/i);
    expect(ctx.setWorkflowPhase).not.toHaveBeenCalled();
  });

  test('surfaces server-side validation errors verbatim', async () => {
    const ctx = makeCtx({ result: false, message: 'Cannot markObjective: ...' });
    const res = await workflowPhase({ action: 'markObjective', id: 'bad' } as any, ctx);
    expect(res.status).toBe('error');
    expect((res.data as any).error).toMatch(/Cannot markObjective/);
  });
});
