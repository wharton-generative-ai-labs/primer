/**
 * `stateSnapshot.heading` follows the same resolution rule as the play UI's
 * central `<PhaseHeading>`:
 *   - Use the active phase's `heading` field if set.
 *   - Otherwise fall back to the experience title.
 *   - Otherwise null (TUI hides the header slot).
 *
 * The harness is the single source of truth for the TUI's top panel — these
 * tests pin the resolution rule so future drift between the two surfaces
 * (play UI vs. TUI) surfaces here.
 */

import { createState, stateSnapshot } from '../state';
import type { AgentConfig } from '@/app/lib/types';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases';

const AGENTS: Record<string, AgentConfig> = {
  coach: {
    name: 'Coach',
    publicDescription: 'guides',
    downstreamAgents: [],
  } as unknown as AgentConfig,
};

describe('stateSnapshot.heading', () => {
  it('returns the experience title when no phase has its own heading', () => {
    const phases: WorkflowPhaseConfig[] = [
      { id: 'intro', title: 'Intro' },
      { id: 'design', title: 'Design' },
    ];
    const state = createState('exp1', AGENTS, 'coach', false, {
      workflowPhases: phases,
      experienceTitle: 'Elevator Pitching',
    });
    expect(stateSnapshot(state).heading).toBe('Elevator Pitching');
  });

  it("uses the phase's own heading when set, even when an experience title is present", () => {
    const phases: WorkflowPhaseConfig[] = [
      {
        id: 'feedback',
        title: 'Feedback',
        heading: "Here's what works (and what doesn't).",
      },
    ];
    const state = createState('exp1', AGENTS, 'coach', false, {
      workflowPhases: phases,
      experienceTitle: 'Elevator Pitching',
    });
    expect(stateSnapshot(state).heading).toBe(
      "Here's what works (and what doesn't).",
    );
  });

  it('returns null when neither phase heading nor experience title is set', () => {
    const phases: WorkflowPhaseConfig[] = [{ id: 'intro', title: 'Intro' }];
    const state = createState('exp1', AGENTS, 'coach', false, {
      workflowPhases: phases,
      // no experienceTitle
    });
    expect(stateSnapshot(state).heading).toBeNull();
  });

  it("tracks phase changes — different phases' headings surface as the user advances", () => {
    const phases: WorkflowPhaseConfig[] = [
      { id: 'warmup', title: 'Warmup', heading: 'Get you ready to pitch.' },
      { id: 'pitch', title: 'Pitch', heading: 'Time to make your case.' },
      {
        id: 'feedback',
        title: 'Feedback',
        heading: "Here's what works.",
      },
    ];
    const state = createState('exp1', AGENTS, 'coach', false, {
      workflowPhases: phases,
      experienceTitle: 'Elevator Pitching',
    });
    expect(stateSnapshot(state).heading).toBe('Get you ready to pitch.');

    // Simulate advancing — same path the manager mutates.
    state.workflowPhaseState!.currentPhase = 'pitch';
    expect(stateSnapshot(state).heading).toBe('Time to make your case.');

    state.workflowPhaseState!.currentPhase = 'feedback';
    expect(stateSnapshot(state).heading).toBe("Here's what works.");
  });

  it('returns the experience title even when there are no phases', () => {
    const state = createState('exp1', AGENTS, 'coach', false, {
      experienceTitle: 'Some Single-Screen Experience',
    });
    expect(stateSnapshot(state).heading).toBe('Some Single-Screen Experience');
  });
});
