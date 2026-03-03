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
      expect(result.data.error).toContain('Invalid downstream agent');
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
  });

  describe('invalid action', () => {
    it('should return error for unknown action', async () => {
      const result = await agent({ action: 'unknown' as any }, makeContext());

      expect(result.status).toBe('error');
      expect(result.data.error).toContain('Invalid action');
    });
  });
});
