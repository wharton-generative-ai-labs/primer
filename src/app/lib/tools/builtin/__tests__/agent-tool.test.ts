import { agent } from '../agent-tool';
import type { ToolContext } from '@/app/lib/tools/types';

jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockDelegate = jest.fn().mockResolvedValue({
  status: 'success',
  data: { message: 'Delegation completed' },
});

jest.mock('@/app/lib/tools/delegation/delegate', () => ({
  delegate: mockDelegate,
}));

const makeContext = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  selectedAgentKey: 'intake',
  agents: {
    intake: {
      name: 'Intake',
      type: 'frontend',
      publicDescription: 'An intake agent.',
      downstreamAgents: [
        { name: 'Practice Partner', publicDescription: 'Practice agent.' },
      ],
    },
    practice: {
      name: 'Practice Partner',
      type: 'frontend',
      publicDescription: 'Practice agent.',
      downstreamAgents: [],
    },
    'design-agent': {
      name: 'Design Agent',
      type: 'backend',
      publicDescription: 'Creates design documents.',
      downstreamAgents: [],
    },
    'image-gen': {
      name: 'Image Generator',
      type: 'backend',
      publicDescription: 'Generates images.',
      downstreamAgents: [],
    },
  },
  setQueuedAgentTransfer: jest.fn(),
  addTranscriptBreadcrumb: jest.fn(),
  experienceId: 'test-exp',
  ...overrides,
});

describe('agent tool', () => {
  describe('discover action', () => {
    it('should return all agents with capabilities', async () => {
      const result = await agent({ action: 'discover' }, makeContext());

      expect(result.status).toBe('success');
      expect(result.data.agents).toHaveLength(4);
      expect(result.data.current_agent).toBe('intake');
    });

    it('should mark the current agent', async () => {
      const result = await agent({ action: 'discover' }, makeContext());
      const intake = result.data.agents.find((a: any) => a.key === 'intake');

      expect(intake.is_current).toBe(true);
    });

    it('should show transfer as available for downstream frontend agents', async () => {
      const result = await agent({ action: 'discover' }, makeContext());
      const practice = result.data.agents.find((a: any) => a.key === 'practice');

      expect(practice.available_actions).toContain('transfer');
      expect(practice.type).toBe('frontend');
    });

    it("surfaces a backend agent's delegationContract on the discover entry", async () => {
      const ctx = makeContext({
        agents: {
          ...makeContext().agents,
          'design-agent': {
            name: 'Design Agent',
            type: 'backend',
            publicDescription: 'Creates design documents.',
            delegationContract: 'Pass `artifactIds: [conversation_transcript_id]` and a brief taskDescription. Returns a design-document artifact id.',
            downstreamAgents: [],
          } as any,
        },
      });
      const result = await agent({ action: 'discover' }, ctx);
      expect(result.status).toBe('success');
      const design = (result.data.agents as any[]).find((a) => a.key === 'design-agent');
      expect(design.delegation_contract).toContain('conversation_transcript_id');
    });

    it('omits delegation_contract on agents without one', async () => {
      const ctx = makeContext();
      const result = await agent({ action: 'discover' }, ctx);
      const intake = (result.data.agents as any[]).find((a) => a.key === 'intake');
      expect(intake.delegation_contract).toBeUndefined();
    });

    it('should show delegate as available for backend agents', async () => {
      const result = await agent({ action: 'discover' }, makeContext());
      const design = result.data.agents.find((a: any) => a.key === 'design-agent');

      expect(design.available_actions).toContain('delegate');
      expect(design.type).toBe('backend');
    });

    it('should not show transfer for non-downstream frontend agents', async () => {
      const ctx = makeContext({
        agents: {
          intake: {
            name: 'Intake',
            type: 'frontend',
            downstreamAgents: [],
          },
          other: {
            name: 'Other',
            type: 'frontend',
            downstreamAgents: [],
          },
        },
      });
      const result = await agent({ action: 'discover' }, ctx);
      const other = result.data.agents.find((a: any) => a.key === 'other');

      expect(other.available_actions).toEqual([]);
    });

    it('should handle string-based downstreamAgents', async () => {
      const ctx = makeContext({
        agents: {
          intake: {
            name: 'Intake',
            type: 'frontend',
            downstreamAgents: ['practice'],
          },
          practice: {
            name: 'Practice Partner',
            type: 'frontend',
            downstreamAgents: [],
          },
        },
      });
      const result = await agent({ action: 'discover' }, ctx);
      const practice = result.data.agents.find((a: any) => a.key === 'practice');

      expect(practice.available_actions).toContain('transfer');
    });

    it('should return error when context is missing', async () => {
      const result = await agent({ action: 'discover' }, {} as ToolContext);

      expect(result.status).toBe('error');
    });
  });

  describe('transfer action', () => {
    it('should transfer to a valid downstream agent', async () => {
      const ctx = makeContext();
      const result = await agent({
        action: 'transfer',
        destination: 'Practice Partner',
        rationale: 'Moving to practice phase',
        conversationContext: 'Student is ready',
      }, ctx);

      expect(result.status).toBe('success');
      expect(result.data.did_transfer).toBe(true);
      expect(result.data.destination_agent).toBe('practice');
      expect(result.data.from_name).toBe('Intake');
      expect(result.data.to_name).toBe('Practice Partner');
    });

    it('should call client callbacks when available', async () => {
      const ctx = makeContext();
      await agent({
        action: 'transfer',
        destination: 'Practice Partner',
        rationale: 'Moving to practice phase',
        conversationContext: 'Student is ready',
      }, ctx);

      expect(ctx.setQueuedAgentTransfer).toHaveBeenCalledWith('practice');
      expect(ctx.addTranscriptBreadcrumb).toHaveBeenCalledWith(
        'Agent transfer queued',
        expect.objectContaining({ from: 'Intake', to: 'Practice Partner' })
      );
    });

    it('should succeed without client callbacks (backend-first mode)', async () => {
      const ctx = makeContext({
        setQueuedAgentTransfer: undefined,
        addTranscriptBreadcrumb: undefined,
      });
      const result = await agent({
        action: 'transfer',
        destination: 'Practice Partner',
        rationale: 'Moving to practice phase',
        conversationContext: 'Student is ready',
      }, ctx);

      expect(result.status).toBe('success');
      expect(result.data.did_transfer).toBe(true);
      expect(result.data.destination_agent).toBe('practice');
    });

    it('should transfer using case-insensitive name match', async () => {
      const ctx = makeContext();
      const result = await agent({
        action: 'transfer',
        destination: 'practice partner',
        rationale: 'Moving to practice phase',
        conversationContext: 'Student is ready',
      }, ctx);

      expect(result.status).toBe('success');
      expect(result.data.did_transfer).toBe(true);
    });

    it('should transfer using agent key', async () => {
      const ctx = makeContext();
      const result = await agent({
        action: 'transfer',
        destination: 'practice',
        rationale: 'Moving to practice phase',
        conversationContext: 'Student is ready',
      }, ctx);

      expect(result.status).toBe('success');
      expect(result.data.did_transfer).toBe(true);
    });

    it('should transfer when downstreamAgents are strings (keys)', async () => {
      const ctx = makeContext({
        agents: {
          intake: {
            name: 'Intake',
            type: 'frontend',
            downstreamAgents: ['practice'],
          },
          practice: {
            name: 'Practice Partner',
            type: 'frontend',
            downstreamAgents: [],
          },
        },
      });
      const result = await agent({
        action: 'transfer',
        destination: 'Practice Partner',
        rationale: 'Moving to practice phase',
        conversationContext: 'Student is ready',
      }, ctx);

      expect(result.status).toBe('success');
      expect(result.data.did_transfer).toBe(true);
      expect(result.data.destination_agent).toBe('practice');
    });

    it('should reject transfer to non-downstream agent', async () => {
      const result = await agent({
        action: 'transfer',
        destination: 'Design Agent',
        rationale: 'test',
        conversationContext: 'test',
      }, makeContext());

      expect(result.status).toBe('error');
      expect(result.data.error).toContain('not a downstream agent');
    });

    it('should require all parameters', async () => {
      const result = await agent({
        action: 'transfer',
        destination: 'Practice Partner',
      }, makeContext());

      expect(result.status).toBe('error');
      expect(result.data.error).toContain('required');
    });
  });

  describe('delegate action', () => {
    it('should delegate to a backend agent', async () => {
      const ctx = makeContext();

      const result = await agent({
        action: 'delegate',
        agentType: 'Design Agent',
        taskDescription: 'Create a design document',
        artifactIds: ['artifact-1'],
      }, ctx);

      expect(result.status).toBe('success');
      expect(mockDelegate).toHaveBeenCalledWith(
        {
          agentType: 'Design Agent',
          taskDescription: 'Create a design document',
          artifactIds: ['artifact-1'],
          imageNames: undefined,
        },
        ctx
      );
    });

    it('should require agentType', async () => {
      const result = await agent({ action: 'delegate' }, makeContext());

      expect(result.status).toBe('error');
      expect(result.data.error).toContain('agentType');
    });

    it('refuses delegation when agentType is not in phase allowedDelegates', async () => {
      mockDelegate.mockClear();
      const ctx = makeContext({
        getCurrentWorkflowPhase: () => ({
          id: 'intake',
          title: 'Intake',
          index: 0,
          total: 2,
          isCompleted: false,
        }),
        getWorkflowPhases: () => [
          { id: 'intake', title: 'Intake', allowedDelegates: [] },
          { id: 'designing', title: 'Designing', allowedDelegates: ['design-agent'] },
        ],
      });

      const result = await agent({
        action: 'delegate',
        agentType: 'design-agent',
        taskDescription: 'too early',
      }, ctx);

      expect(result.status).toBe('error');
      expect(result.data.error).toContain('not allowed in phase "intake"');
      expect(result.data.suggested_action).toBe('nextPhase');
      expect(mockDelegate).not.toHaveBeenCalled();
    });

    it('allows delegation when agentType is in phase allowedDelegates', async () => {
      mockDelegate.mockClear();
      const ctx = makeContext({
        getCurrentWorkflowPhase: () => ({
          id: 'designing',
          title: 'Designing',
          index: 1,
          total: 2,
          isCompleted: false,
        }),
        getWorkflowPhases: () => [
          { id: 'intake', title: 'Intake', allowedDelegates: [] },
          { id: 'designing', title: 'Designing', allowedDelegates: ['design-agent'] },
        ],
      });

      const result = await agent({
        action: 'delegate',
        agentType: 'design-agent',
        taskDescription: 'go',
      }, ctx);

      expect(result.status).toBe('success');
      expect(mockDelegate).toHaveBeenCalledTimes(1);
    });

    it('does not gate when phase has no allowedDelegates field (legacy behavior)', async () => {
      mockDelegate.mockClear();
      const ctx = makeContext({
        getCurrentWorkflowPhase: () => ({
          id: 'open',
          title: 'Open',
          index: 0,
          total: 1,
          isCompleted: false,
        }),
        getWorkflowPhases: () => [{ id: 'open', title: 'Open' }],
      });

      const result = await agent({
        action: 'delegate',
        agentType: 'design-agent',
      }, ctx);

      expect(result.status).toBe('success');
      expect(mockDelegate).toHaveBeenCalledTimes(1);
    });

    it('fails-closed when phases are declared but currentPhase is missing (stale tab / unhydrated context)', async () => {
      mockDelegate.mockClear();
      const ctx = makeContext({
        // Phases declared (the experience HAS a workflow) but the context
        // failed to resolve a current phase — simulates a stale tab whose
        // WorkflowPhaseProvider didn't hydrate. The gate must refuse.
        getCurrentWorkflowPhase: () => null,
        getWorkflowPhases: () => [
          { id: 'intake', title: 'Intake', allowedDelegates: [] },
          { id: 'designing', title: 'Designing', allowedDelegates: ['design-agent'] },
        ],
      });

      const result = await agent({
        action: 'delegate',
        agentType: 'design-agent',
      }, ctx);

      expect(result.status).toBe('error');
      expect(result.data.error).toContain('phase state is not loaded');
      expect(result.data.suggested_action).toBe('reload');
      expect(mockDelegate).not.toHaveBeenCalled();
    });

    it('does not fail-closed when no phases are declared at all (legacy non-phased experiences)', async () => {
      mockDelegate.mockClear();
      const ctx = makeContext({
        getCurrentWorkflowPhase: () => null,
        getWorkflowPhases: () => [],
      });

      const result = await agent({
        action: 'delegate',
        agentType: 'design-agent',
      }, ctx);

      // No phases means no workflow — legacy single-screen experience.
      // Don't refuse on missing currentPhase since it's structurally
      // absent rather than unhealthily missing.
      expect(result.status).toBe('success');
      expect(mockDelegate).toHaveBeenCalledTimes(1);
    });

    describe('backend-context refusal', () => {
      // jsdom defines `sessionStorage` so we have to remove it from the
      // global scope for the duration of these tests to simulate the Node
      // environment a backend agent runs in.
      let originalSessionStorage: Storage | undefined;
      beforeEach(() => {
        originalSessionStorage = (globalThis as any).sessionStorage;
        // `delete` works on plain properties; jsdom defines sessionStorage on
        // the window prototype, so we override with `undefined` via
        // defineProperty (configurable: true) to keep `typeof` returning
        // `'undefined'`.
        Object.defineProperty(globalThis, 'sessionStorage', {
          value: undefined,
          configurable: true,
          writable: true,
        });
      });
      afterEach(() => {
        Object.defineProperty(globalThis, 'sessionStorage', {
          value: originalSessionStorage,
          configurable: true,
          writable: true,
        });
      });

      it('refuses delegate from backend context with a clear pointer', async () => {
        mockDelegate.mockClear();
        // Sanity check: the global is genuinely undefined inside the test.
        expect(typeof sessionStorage).toBe('undefined');

        const result = await agent(
          {
            action: 'delegate',
            agentType: 'design-agent',
            taskDescription: 'something',
          },
          makeContext(),
        );

        expect(result.status).toBe('error');
        expect(result.data.error).toContain(
          'agent.delegate is only callable from the frontend orchestrator',
        );
        expect(result.data.suggested_pattern).toBe(
          'Return a result; the orchestrator will drive the next step.',
        );
        expect(mockDelegate).not.toHaveBeenCalled();
      });

      it('refuses backend-context delegate before phase-allowedDelegates check', async () => {
        // If phase gating ran first, this test would also produce an error,
        // but with the phase-gate message instead of the backend-context
        // message. Verifying the message confirms ordering.
        mockDelegate.mockClear();
        const ctx = makeContext({
          getCurrentWorkflowPhase: () => ({
            id: 'designing',
            title: 'Designing',
            index: 1,
            total: 2,
            isCompleted: false,
          }),
          getWorkflowPhases: () => [
            { id: 'intake', title: 'Intake', allowedDelegates: ['design-agent'] },
            { id: 'designing', title: 'Designing', allowedDelegates: ['design-agent'] },
          ],
        });

        const result = await agent(
          {
            action: 'delegate',
            agentType: 'design-agent',
          },
          ctx,
        );

        expect(result.status).toBe('error');
        expect(result.data.error).toContain(
          'agent.delegate is only callable from the frontend orchestrator',
        );
        expect(mockDelegate).not.toHaveBeenCalled();
      });
    });

    describe('phase-gate parity for backend-shaped contexts', () => {
      // The backend `createServerToolContext` now hot-loads the experience
      // config + session metadata so its `getCurrentWorkflowPhase` /
      // `getWorkflowPhases` return real data (mirroring the harness and the
      // realtime path). These tests assert that — once such a context is in
      // hand — the same allowedDelegates gate that already protects the
      // frontend fires for the backend caller too. We simulate a backend
      // context here by returning the snapshot shape `createServerToolContext`
      // produces from disk.
      function makeBackendContext({
        currentPhaseId,
        phases,
      }: {
        currentPhaseId: string;
        phases: Array<{ id: string; title: string; allowedDelegates?: string[] }>;
      }): ToolContext {
        const idx = phases.findIndex((p) => p.id === currentPhaseId);
        const current = idx >= 0 ? phases[idx] : phases[0];
        return makeContext({
          // No setQueuedAgentTransfer / addTranscriptBreadcrumb — the backend
          // dispatcher does not wire them up.
          setQueuedAgentTransfer: undefined,
          addTranscriptBreadcrumb: undefined,
          getWorkflowPhases: () => phases as any,
          getCurrentWorkflowPhase: () => ({
            id: current.id,
            title: current.title,
            index: idx >= 0 ? idx : 0,
            total: phases.length,
            isCompleted: false,
          }),
        });
      }

      it('refuses backend-dispatched delegate when not in phase allowedDelegates', async () => {
        mockDelegate.mockClear();
        const ctx = makeBackendContext({
          currentPhaseId: 'intake',
          phases: [
            { id: 'intake', title: 'Intake', allowedDelegates: [] },
            { id: 'designing', title: 'Designing', allowedDelegates: ['design-agent'] },
          ],
        });

        const result = await agent(
          {
            action: 'delegate',
            agentType: 'design-agent',
            taskDescription: 'too early',
          },
          ctx,
        );

        expect(result.status).toBe('error');
        expect(result.data.error).toContain('not allowed in phase "intake"');
        expect(result.data.current_phase).toBe('intake');
        expect(result.data.allowed_delegates).toEqual([]);
        expect(result.data.suggested_action).toBe('nextPhase');
        expect(mockDelegate).not.toHaveBeenCalled();
      });

      it('allows backend-dispatched delegate when agentType is in phase allowedDelegates', async () => {
        mockDelegate.mockClear();
        const ctx = makeBackendContext({
          currentPhaseId: 'designing',
          phases: [
            { id: 'intake', title: 'Intake', allowedDelegates: [] },
            { id: 'designing', title: 'Designing', allowedDelegates: ['design-agent'] },
          ],
        });

        const result = await agent(
          {
            action: 'delegate',
            agentType: 'design-agent',
            taskDescription: 'go',
          },
          ctx,
        );

        expect(result.status).toBe('success');
        expect(mockDelegate).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('invalid action', () => {
    it('should return error for unknown action', async () => {
      const result = await agent({ action: 'unknown' as any }, makeContext());

      expect(result.status).toBe('error');
      expect(result.data.error).toContain('Invalid action');
    });
  });

  describe('workflow-phase gating', () => {
    // Mirrors the elevator-pitching-with-phases shape: narratorStart anchors
    // warmup, mentor anchors pitch, feedback anchors feedback. Cross-phase
    // transfers must be refused with a pointer to workflowPhase.
    const phasedAgents: ToolContext['agents'] = {
      narratorStart: {
        name: 'Narrator',
        type: 'frontend',
        downstreamAgents: ['mentor'],
      },
      mentor: {
        name: 'Mentor',
        type: 'frontend',
        downstreamAgents: ['choices'],
      },
      choices: {
        name: 'Choices',
        type: 'frontend',
        downstreamAgents: ['adam'],
      },
      adam: {
        name: 'Adam',
        type: 'frontend',
        downstreamAgents: ['feedback'],
      },
      feedback: {
        name: 'Feedback',
        type: 'frontend',
        downstreamAgents: [],
      },
    };

    const phases = [
      { id: 'warmup', title: 'Warmup', initialAgent: 'narratorStart' },
      { id: 'pitch', title: 'Pitch', initialAgent: 'mentor' },
      { id: 'feedback', title: 'Feedback', initialAgent: 'feedback' },
    ];

    function makePhasedContext(
      currentAgentKey: string,
      currentPhaseId: string,
    ): ToolContext {
      return makeContext({
        selectedAgentKey: currentAgentKey,
        agents: phasedAgents,
        getWorkflowPhases: () => phases,
        getCurrentWorkflowPhase: () => ({
          id: currentPhaseId,
          title: phases.find((p) => p.id === currentPhaseId)?.title ?? '',
        } as any),
      });
    }

    it('refuses cross-phase transfer with a workflowPhase pointer', async () => {
      const ctx = makePhasedContext('narratorStart', 'warmup');
      const result = await agent(
        {
          action: 'transfer',
          destination: 'mentor',
          rationale: 'moving to pitch',
          conversationContext: 'ready',
        },
        ctx,
      );

      expect(result.status).toBe('error');
      expect(result.data.did_transfer).toBe(false);
      expect(result.data.error).toContain('outside the current workflow phase');
      expect(result.data.suggested_tool).toBe('workflowPhase');
      expect(result.data.suggested_action).toBe('set');
      expect(result.data.suggested_phase).toBe('pitch');
      // Pointer wording must name the current tool surface (`set` with the
      // destination phase) and must not reference the removed `advance`
      // action. The model uses the pointer string verbatim to choose the
      // next tool call, so substring drift is a self-defeating bug.
      expect(result.data.error).toContain('workflowPhase.set with phase="pitch"');
      expect(result.data.error).not.toContain('workflowPhase.advance');
      expect(result.data.error).not.toContain('workflowPhase.complete');
    });

    it('allows in-phase transfer when phases are active', async () => {
      const ctx = makePhasedContext('mentor', 'pitch');
      const result = await agent(
        {
          action: 'transfer',
          destination: 'choices',
          rationale: 'present choices',
          conversationContext: 'ready',
        },
        ctx,
      );

      expect(result.status).toBe('success');
      expect(result.data.did_transfer).toBe(true);
      expect(result.data.destination_agent).toBe('choices');
    });

    it('discover marks cross-phase downstream as not transferable and explains why', async () => {
      const ctx = makePhasedContext('adam', 'pitch');
      const result = await agent({ action: 'discover' }, ctx);
      expect(result.status).toBe('success');
      expect(result.data.current_phase).toBe('pitch');
      expect(result.data.phase_filtered).toBe(true);

      const feedback = result.data.agents.find((a: any) => a.key === 'feedback');
      expect(feedback.available_actions).not.toContain('transfer');
      expect(feedback.outside_current_phase).toBe(true);
      expect(feedback.transfer_blocked_reason).toContain('belongs to phase "feedback"');
      // Pointer must name the current tool surface (`set` with the
      // destination phase) — same self-defeating-string guard as the
      // transfer-refusal test above.
      expect(feedback.transfer_blocked_reason).toContain('workflowPhase.set with phase="feedback"');
      expect(feedback.transfer_blocked_reason).not.toContain('workflowPhase.advance');
      expect(feedback.transfer_blocked_reason).not.toContain('workflowPhase.complete');
    });

    it('discover keeps in-phase downstream as transferable', async () => {
      const ctx = makePhasedContext('mentor', 'pitch');
      const result = await agent({ action: 'discover' }, ctx);
      const choices = result.data.agents.find((a: any) => a.key === 'choices');
      expect(choices.available_actions).toContain('transfer');
      expect(choices.outside_current_phase).toBeUndefined();
    });

    it('does not gate transfers when no phases are configured', async () => {
      // No getWorkflowPhases in context — original behaviour.
      const ctx = makeContext();
      const result = await agent(
        {
          action: 'transfer',
          destination: 'Practice Partner',
          rationale: 'reason',
          conversationContext: 'ctx',
        },
        ctx,
      );
      expect(result.status).toBe('success');
      expect(result.data.did_transfer).toBe(true);
    });
  });
});
