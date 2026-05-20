/**
 * Tests for phase membership computation.
 *
 * Covers `computePhaseMemberships`, `isAgentInPhase`, and `findAnchoringPhase`.
 * The setup mirrors `storage/elevator-pitching-with-phases` (warmup → pitch →
 * feedback) plus targeted edge cases: no anchors, shared anchors, downstream
 * loops, and unknown references.
 */

import {
  computePhaseMemberships,
  findAnchoringPhase,
  isAgentInPhase,
} from '@/app/lib/workflow-phases';
import type { AgentConfig } from '@/app/lib/types';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases';

function agent(
  overrides: Partial<AgentConfig> & { downstreamAgents?: string[] } = {},
): AgentConfig {
  return {
    name: 'Agent',
    publicDescription: '',
    downstreamAgents: [],
    ...overrides,
  } as AgentConfig;
}

describe('computePhaseMemberships', () => {
  it('returns {} when no phases declared', () => {
    expect(computePhaseMemberships([], {})).toEqual({});
  });

  it('three-phase elevator-pitching shape: anchors stop at boundaries', () => {
    const agents: Record<string, AgentConfig> = {
      narratorStart: agent({ name: 'Narrator', downstreamAgents: ['mentor'] }),
      mentor: agent({ name: 'Mentor', downstreamAgents: ['choices'] }),
      choices: agent({ name: 'Choices', downstreamAgents: ['adam', 'anna', 'aria'] }),
      adam: agent({ name: 'Adam', downstreamAgents: ['feedback'] }),
      anna: agent({ name: 'Anna', downstreamAgents: ['feedback'] }),
      aria: agent({ name: 'Aria', downstreamAgents: ['feedback'] }),
      feedback: agent({ name: 'Feedback', downstreamAgents: [] }),
    };
    const phases: WorkflowPhaseConfig[] = [
      { id: 'warmup', title: 'Warmup', initialAgent: 'narratorStart' },
      { id: 'pitch', title: 'Pitch', initialAgent: 'mentor' },
      { id: 'feedback', title: 'Feedback', initialAgent: 'feedback' },
    ];

    const memberships = computePhaseMemberships(phases, agents);

    expect(memberships.warmup.members).toEqual(new Set(['narratorStart']));
    expect(memberships.pitch.members).toEqual(
      new Set(['mentor', 'choices', 'adam', 'anna', 'aria']),
    );
    expect(memberships.feedback.members).toEqual(new Set(['feedback']));
  });

  it('treats reentryAgent as an anchor too', () => {
    const agents: Record<string, AgentConfig> = {
      a: agent({ downstreamAgents: ['b'] }),
      b: agent({ downstreamAgents: [] }),
      c: agent({ downstreamAgents: [] }),
    };
    const phases: WorkflowPhaseConfig[] = [
      { id: 'p1', title: 'P1', initialAgent: 'a', reentryAgent: 'c' },
    ];

    const memberships = computePhaseMemberships(phases, agents);

    expect(memberships.p1.members).toEqual(new Set(['a', 'b', 'c']));
  });

  it('phase with no initialAgent has empty members', () => {
    const agents: Record<string, AgentConfig> = {
      a: agent({ downstreamAgents: [] }),
    };
    const phases: WorkflowPhaseConfig[] = [
      { id: 'p1', title: 'P1' },
    ];

    expect(computePhaseMemberships(phases, agents).p1.members.size).toBe(0);
  });

  it('downstream cycle does not loop forever', () => {
    const agents: Record<string, AgentConfig> = {
      a: agent({ downstreamAgents: ['b'] }),
      b: agent({ downstreamAgents: ['a'] }),
    };
    const phases: WorkflowPhaseConfig[] = [
      { id: 'p1', title: 'P1', initialAgent: 'a' },
    ];

    expect(computePhaseMemberships(phases, agents).p1.members).toEqual(
      new Set(['a', 'b']),
    );
  });

  it('downstream reference by display name resolves to the agent key', () => {
    const agents: Record<string, AgentConfig> = {
      narrator: agent({ name: 'Narrator', downstreamAgents: ['Mentor'] }),
      mentor: agent({ name: 'Mentor', downstreamAgents: [] }),
    };
    const phases: WorkflowPhaseConfig[] = [
      { id: 'p1', title: 'P1', initialAgent: 'narrator' },
    ];

    expect(computePhaseMemberships(phases, agents).p1.members).toEqual(
      new Set(['narrator', 'mentor']),
    );
  });

  it('unknown downstream references are skipped silently', () => {
    const agents: Record<string, AgentConfig> = {
      a: agent({ downstreamAgents: ['ghost'] }),
    };
    const phases: WorkflowPhaseConfig[] = [
      { id: 'p1', title: 'P1', initialAgent: 'a' },
    ];

    expect(computePhaseMemberships(phases, agents).p1.members).toEqual(
      new Set(['a']),
    );
  });

  it('agent anchoring two phases is a member of both', () => {
    const agents: Record<string, AgentConfig> = {
      shared: agent({ downstreamAgents: [] }),
    };
    const phases: WorkflowPhaseConfig[] = [
      { id: 'p1', title: 'P1', initialAgent: 'shared' },
      { id: 'p2', title: 'P2', initialAgent: 'shared' },
    ];

    const memberships = computePhaseMemberships(phases, agents);

    expect(memberships.p1.members).toEqual(new Set(['shared']));
    expect(memberships.p2.members).toEqual(new Set(['shared']));
  });
});

describe('isAgentInPhase', () => {
  const agents: Record<string, AgentConfig> = {
    a: agent({ downstreamAgents: ['b'] }),
    b: agent({ downstreamAgents: [] }),
    c: agent({ downstreamAgents: [] }),
  };
  const phases: WorkflowPhaseConfig[] = [
    { id: 'p1', title: 'P1', initialAgent: 'a' },
    { id: 'p2', title: 'P2', initialAgent: 'c' },
  ];
  const memberships = computePhaseMemberships(phases, agents);

  it('returns true for in-phase agent', () => {
    expect(isAgentInPhase(memberships, 'p1', 'b')).toBe(true);
  });

  it('returns false for out-of-phase agent', () => {
    expect(isAgentInPhase(memberships, 'p1', 'c')).toBe(false);
  });

  it('returns true when phase id is undefined (no-phases mode)', () => {
    expect(isAgentInPhase(memberships, undefined, 'c')).toBe(true);
  });

  it('returns true when phase id is unknown (defensive)', () => {
    expect(isAgentInPhase(memberships, 'nope', 'c')).toBe(true);
  });
});

describe('findAnchoringPhase', () => {
  const phases: WorkflowPhaseConfig[] = [
    { id: 'p1', title: 'P1', initialAgent: 'a' },
    { id: 'p2', title: 'P2', initialAgent: 'b', reentryAgent: 'c' },
  ];

  it('finds phase by initialAgent', () => {
    expect(findAnchoringPhase(phases, 'a')?.id).toBe('p1');
    expect(findAnchoringPhase(phases, 'b')?.id).toBe('p2');
  });

  it('finds phase by reentryAgent', () => {
    expect(findAnchoringPhase(phases, 'c')?.id).toBe('p2');
  });

  it('returns undefined for unanchored agent', () => {
    expect(findAnchoringPhase(phases, 'z')).toBeUndefined();
  });
});
