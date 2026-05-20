/**
 * Tests for the workflow phase-change message formatter.
 *
 * The formatter produces a structured prose string that is injected into the
 * AI's conversation as a `system`-role item on every workflow-phase
 * transition. The tests below lock the framing prefix, the directive line,
 * and each branch of the formatter (forward, forward-skip, backward, initial,
 * re-entry, after-skip, experience-completed, experience-rewound).
 */

import {
  formatWorkflowPhaseChangeMessage,
  WORKFLOW_PHASE_RESET_PREFIX,
  type WorkflowPhaseChangePayload,
} from '@/app/lib/agent-context/workflowPhaseChangeMessage';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases';

// Asserting only the leading sentence — the production string also carries
// the handoff-must-pair-with-tool-call rider, which we test separately below.
const DIRECTIVE_PREFIX = 'Acknowledge the transition naturally and proceed.';
const PREFIX = '[SYSTEM/workflow_phase_change]';

const designPhase: WorkflowPhaseConfig = {
  id: 'design',
  title: 'Design',
  description: 'Sketch the experience flow.',
};

const designPhaseWithFragments: WorkflowPhaseConfig = {
  ...designPhase,
  promptFragments: {
    coldStart: 'Welcome to design — start by exploring the brief.',
    reentry: 'Welcome back to design. Pick up where you left off.',
    afterSkip: 'You jumped ahead — here is what design covered.',
  },
};

describe('formatWorkflowPhaseChangeMessage', () => {
  it('starts with the system framing prefix and ends with the directive line', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'forward',
      isFirstEntry: true,
      fromPhase: 'intro',
      toPhase: 'design',
      trigger: 'agent',
    };

    const message = formatWorkflowPhaseChangeMessage(payload, designPhase);

    expect(message.startsWith(PREFIX)).toBe(true);
    expect(message.trimEnd().includes(DIRECTIVE_PREFIX)).toBe(true);
  });

  it('forward (no skip) describes the from→to transition and direction', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'forward',
      isFirstEntry: true,
      fromPhase: 'intro',
      toPhase: 'design',
      trigger: 'agent',
    };

    const message = formatWorkflowPhaseChangeMessage(payload, designPhase);

    expect(message).toContain(PREFIX);
    expect(message).toContain('direction: forward');
    expect(message).toContain('from: intro');
    expect(message).toContain('to: design');
    expect(message).toContain('trigger: agent');
    // No skip framing should appear when nothing was skipped.
    expect(message).not.toContain('skipped');
  });

  it('forward with skip lists skipped phase ids and skipped objectives', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'forward',
      isFirstEntry: true,
      fromPhase: 'intro',
      toPhase: 'review',
      trigger: 'agent',
      skipped: ['design', 'build'],
      skippedObjectives: [
        {
          phase: 'design',
          objectives: [
            { id: 'd1', description: 'Outline the design.' },
            { id: 'd2', description: 'Identify constraints.' },
          ],
        },
        {
          phase: 'build',
          objectives: [{ id: 'b1', description: 'Build a prototype.' }],
        },
      ],
    };

    const reviewPhase: WorkflowPhaseConfig = {
      id: 'review',
      title: 'Review',
    };

    const message = formatWorkflowPhaseChangeMessage(payload, reviewPhase);

    expect(message).toContain('skipped');
    expect(message).toContain('design');
    expect(message).toContain('build');
    expect(message).toContain('Outline the design.');
    expect(message).toContain('Identify constraints.');
    expect(message).toContain('Build a prototype.');
  });

  it('backward transitions are framed as a revisit', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'backward',
      isFirstEntry: false,
      fromPhase: 'review',
      toPhase: 'design',
      trigger: 'user',
    };

    const message = formatWorkflowPhaseChangeMessage(payload, designPhase);

    expect(message).toContain('WORKFLOW_PHASE_REVISITED');
    expect(message).toContain('direction: backward');
    expect(message).toContain('from: review');
    expect(message).toContain('to: design');
  });

  it('emits a reset notice keyed off the exported prefix when resetPhaseIds is non-empty', () => {
    // Pinning the test to the exported constant means any future drift of
    // the literal in the formatter fails this test, keeping the agent-side
    // grep target stable.
    const payload: WorkflowPhaseChangePayload = {
      direction: 'backward',
      isFirstEntry: false,
      fromPhase: 'build',
      toPhase: 'intake',
      trigger: 'user',
      resetPhaseIds: ['design', 'build'],
    };

    const intakePhase: WorkflowPhaseConfig = {
      id: 'intake',
      title: 'Intake',
    };
    const message = formatWorkflowPhaseChangeMessage(payload, intakePhase);

    expect(message).toContain(WORKFLOW_PHASE_RESET_PREFIX);
    expect(message).toContain('design, build');
    expect(message).toContain('requireEducatorAdvance');
  });

  it('omits the reset notice when resetPhaseIds is missing or empty', () => {
    const payloadMissing: WorkflowPhaseChangePayload = {
      direction: 'backward',
      isFirstEntry: false,
      fromPhase: 'build',
      toPhase: 'intake',
      trigger: 'user',
    };
    const payloadEmpty: WorkflowPhaseChangePayload = {
      ...payloadMissing,
      resetPhaseIds: [],
    };

    const intakePhase: WorkflowPhaseConfig = {
      id: 'intake',
      title: 'Intake',
    };

    const messageMissing = formatWorkflowPhaseChangeMessage(
      payloadMissing,
      intakePhase,
    );
    const messageEmpty = formatWorkflowPhaseChangeMessage(
      payloadEmpty,
      intakePhase,
    );

    expect(messageMissing).not.toContain(WORKFLOW_PHASE_RESET_PREFIX);
    expect(messageEmpty).not.toContain(WORKFLOW_PHASE_RESET_PREFIX);
  });

  it('initial entry uses cold-start framing and includes the coldStart prompt fragment when present', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'initial',
      isFirstEntry: true,
      toPhase: 'design',
      trigger: 'system',
    };

    const message = formatWorkflowPhaseChangeMessage(
      payload,
      designPhaseWithFragments,
    );

    expect(message).toContain('direction: initial');
    expect(message.toLowerCase()).toContain('cold');
    expect(message).toContain(
      designPhaseWithFragments.promptFragments!.coldStart!,
    );
    // Re-entry fragment must NOT appear on initial entry.
    expect(message).not.toContain(
      designPhaseWithFragments.promptFragments!.reentry!,
    );
  });

  it('initial entry without a coldStart fragment still emits cold-start framing', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'initial',
      isFirstEntry: true,
      toPhase: 'design',
      trigger: 'system',
    };

    const message = formatWorkflowPhaseChangeMessage(payload, designPhase);

    expect(message).toContain('direction: initial');
    expect(message.toLowerCase()).toContain('cold');
    expect(message.trimEnd().includes(DIRECTIVE_PREFIX)).toBe(true);
  });

  it('forward into a never-visited phase fires the coldStart fragment, not reentry', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'forward',
      isFirstEntry: true,
      fromPhase: 'intro',
      toPhase: 'design',
      trigger: 'agent',
    };

    const message = formatWorkflowPhaseChangeMessage(
      payload,
      designPhaseWithFragments,
    );

    expect(message.toLowerCase()).toContain('cold');
    expect(message).toContain(
      designPhaseWithFragments.promptFragments!.coldStart!,
    );
    expect(message).not.toContain(
      designPhaseWithFragments.promptFragments!.reentry!,
    );
  });

  it('forward into an already-visited phase fires the reentry fragment, not coldStart', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'forward',
      isFirstEntry: false,
      fromPhase: 'intro',
      toPhase: 'design',
      trigger: 'agent',
    };

    const message = formatWorkflowPhaseChangeMessage(
      payload,
      designPhaseWithFragments,
    );

    expect(message).toContain(
      designPhaseWithFragments.promptFragments!.reentry!,
    );
    expect(message).not.toContain(
      designPhaseWithFragments.promptFragments!.coldStart!,
    );
  });

  it('after-skip includes the afterSkip prompt fragment when skipped is non-empty', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'forward',
      isFirstEntry: true,
      fromPhase: 'intro',
      toPhase: 'design',
      trigger: 'agent',
      skipped: ['warmup'],
    };

    const message = formatWorkflowPhaseChangeMessage(
      payload,
      designPhaseWithFragments,
    );

    expect(message).toContain(
      designPhaseWithFragments.promptFragments!.afterSkip!,
    );
  });

  it('does not include the afterSkip fragment when nothing was skipped', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'forward',
      isFirstEntry: true,
      fromPhase: 'intro',
      toPhase: 'design',
      trigger: 'agent',
    };

    const message = formatWorkflowPhaseChangeMessage(
      payload,
      designPhaseWithFragments,
    );

    expect(message).not.toContain(
      designPhaseWithFragments.promptFragments!.afterSkip!,
    );
  });

  it('includes the destination phase title and description', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'forward',
      isFirstEntry: true,
      fromPhase: 'intro',
      toPhase: 'design',
      trigger: 'agent',
    };

    const message = formatWorkflowPhaseChangeMessage(payload, designPhase);

    expect(message).toContain('Design');
    expect(message).toContain('Sketch the experience flow.');
  });

  it('experienceCompleted emits a terminal closing line directing a wrap-up', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'forward',
      isFirstEntry: false,
      fromPhase: 'review',
      toPhase: 'review',
      trigger: 'agent',
      experienceCompleted: true,
    };

    const reviewPhase: WorkflowPhaseConfig = {
      id: 'review',
      title: 'Review',
    };

    const message = formatWorkflowPhaseChangeMessage(payload, reviewPhase);

    expect(message.toLowerCase()).toContain('wrap');
    // Should still finish with the directive line.
    expect(message.trimEnd().includes(DIRECTIVE_PREFIX)).toBe(true);
  });

  it('experienceRewound emits a "back from finished" line', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'backward',
      isFirstEntry: false,
      fromPhase: 'review',
      toPhase: 'design',
      trigger: 'user',
      experienceRewound: true,
    };

    const message = formatWorkflowPhaseChangeMessage(payload, designPhase);

    expect(message.toLowerCase()).toContain('back from finished');
  });

  describe('auto-derived per-phase contract', () => {
    const phases: WorkflowPhaseConfig[] = [
      { id: 'intake', title: 'Intake' },
      {
        id: 'designing',
        title: 'Designing',
        mode: 'build',
        allowedDelegates: ['design-agent'],
        objectives: [
          { id: 'doc', description: 'Produce a design document.' },
        ],
      },
      {
        id: 'design',
        title: 'Design',
        allowedDelegates: ['design-agent'],
        requireEducatorAdvance: true,
      },
      { id: 'handoff', title: 'Handoff', mode: 'result', allowedDelegates: [] },
    ];

    it('emits mode and mode_guidance for build mode with phase id substitution', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'forward',
        isFirstEntry: true,
        fromPhase: 'intake',
        toPhase: 'designing',
        trigger: 'agent',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[1],
        phases,
      );
      expect(message).toContain('mode: build');
      expect(message).toContain('mode_guidance:');
      expect(message).toContain('non-interactive (build mode)');
      expect(message).toContain('phase:designing');
    });

    it('defaults to interactive mode when phase.mode is unset', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'initial',
        isFirstEntry: true,
        toPhase: 'intake',
        trigger: 'system',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[0],
        phases,
      );
      expect(message).toContain('mode: interactive');
      expect(message).toContain('converse with the user');
    });

    it('emits objectives list for the destination phase', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'forward',
        isFirstEntry: true,
        fromPhase: 'intake',
        toPhase: 'designing',
        trigger: 'agent',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[1],
        phases,
      );
      expect(message).toContain('objectives:');
      expect(message).toContain('- doc: Produce a design document.');
    });

    // The objective gate + per-objective `markObjective` action were removed
    // when we moved to server-side auto-mark. Earlier revisions appended an
    // `objectives_directive` line teaching the agent to fire `markObjective`
    // for every id; that surfaced a recover-after-rejection failure mode no
    // amount of prompt engineering eliminated. The list still ships as
    // documentation, but no directive — and crucially no `markObjective`
    // mention — should ever appear in the system message regardless of
    // whether the destination phase declares objectives.
    it('never mentions `markObjective` or an `objectives_directive` line, even on phases with objectives', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'forward',
        isFirstEntry: true,
        fromPhase: 'intake',
        toPhase: 'designing',
        trigger: 'agent',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[1],
        phases,
      );
      expect(message).toContain('objectives:');
      expect(message).toContain('- doc: Produce a design document.');
      expect(message).not.toContain('objectives_directive:');
      expect(message).not.toContain('markObjective');
    });

    it('emits an empty allowed_delegates marker when allowlist is []', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'initial',
        isFirstEntry: true,
        toPhase: 'intake',
        trigger: 'system',
      };
      const intakeWithEmpty: WorkflowPhaseConfig = {
        ...phases[0],
        allowedDelegates: [],
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        intakeWithEmpty,
        phases,
      );
      expect(message).toContain('allowed_delegates: (none)');
      expect(message).toContain('refused');
    });

    it('emits non-empty allowed_delegates with the allowlist', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'forward',
        isFirstEntry: true,
        fromPhase: 'intake',
        toPhase: 'designing',
        trigger: 'agent',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[1],
        phases,
      );
      expect(message).toContain('allowed_delegates: design-agent');
      expect(message).toContain('refused server-side');
    });

    it('omits allowed_delegates entirely when the field is undefined (legacy)', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'initial',
        isFirstEntry: true,
        toPhase: 'intake',
        trigger: 'system',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[0],
        phases,
      );
      expect(message).not.toContain('allowed_delegates');
    });

    it('default forward_op recommends nextPhase atomic complete-and-advance', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'initial',
        isFirstEntry: true,
        toPhase: 'intake',
        trigger: 'system',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[0],
        phases,
      );
      expect(message).toContain('forward_op:');
      expect(message).toContain('`workflowPhase nextPhase`');
      expect(message).toContain('atomically');
    });

    it('forward_op for requireEducatorAdvance phase explains educator-driven advance', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'forward',
        isFirstEntry: true,
        fromPhase: 'designing',
        toPhase: 'design',
        trigger: 'agent',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[2],
        phases,
      );
      expect(message).toContain('forward_op:');
      expect(message).toContain('does NOT auto-advance');
      expect(message).toContain('press Next');
    });

    it('forward_op for the last phase points to finishExperience', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'forward',
        isFirstEntry: true,
        fromPhase: 'design',
        toPhase: 'handoff',
        trigger: 'agent',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[3],
        phases,
      );
      expect(message).toContain('forward_op:');
      expect(message).toContain('final phase');
      expect(message).toContain('`finishExperience');
      expect(message).not.toContain('atomically');
    });

    it('build-mode phase ends with the non-interactive silent-orchestrate directive, not the default acknowledge directive', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'forward',
        isFirstEntry: true,
        fromPhase: 'intake',
        toPhase: 'designing',
        trigger: 'agent',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[1],
        phases,
      );
      const trimmed = message.trimEnd();
      expect(trimmed.endsWith('resume orchestration silently via tool calls.')).toBe(true);
      expect(trimmed.includes(DIRECTIVE_PREFIX)).toBe(false);
      expect(message).toContain('Do NOT acknowledge or narrate');
    });

    it('result-mode phase also gets the silent-orchestrate directive', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'forward',
        isFirstEntry: true,
        fromPhase: 'design',
        toPhase: 'handoff',
        trigger: 'agent',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[3],
        phases,
      );
      expect(message).toContain('Do NOT acknowledge or narrate');
      expect(message.trimEnd().includes(DIRECTIVE_PREFIX)).toBe(false);
    });

    it('reentry into a build-mode phase still uses the silent-orchestrate directive (no "welcome back" prompt)', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'forward',
        isFirstEntry: false,
        fromPhase: 'intake',
        toPhase: 'designing',
        trigger: 'system',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[1],
        phases,
      );
      expect(message).toContain('Do NOT acknowledge or narrate');
    });

    it('interactive phase keeps the default acknowledge directive', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'initial',
        isFirstEntry: true,
        toPhase: 'intake',
        trigger: 'system',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[0],
        phases,
      );
      expect(message.trimEnd().includes(DIRECTIVE_PREFIX)).toBe(true);
      expect(message).not.toContain('Do NOT acknowledge or narrate');
    });

    it('omits objectives line AND directive when phase has no objectives', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'initial',
        isFirstEntry: true,
        toPhase: 'intake',
        trigger: 'system',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[0],
        phases,
      );
      expect(message).not.toContain('objectives:\n');
      // The directive only makes sense when there ARE objectives — emitting
      // it on objectiveless phases would create a phantom requirement.
      expect(message).not.toContain('objectives_directive:');
      expect(message).not.toContain('markObjective');
    });

    it('emits phase_position N of M for the first phase when allPhases is provided', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'initial',
        isFirstEntry: true,
        toPhase: 'intake',
        trigger: 'system',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[0],
        phases,
      );
      expect(message).toContain('phase_position: 1 of 4');
    });

    it('emits phase_position with correct index for a middle phase', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'forward',
        isFirstEntry: true,
        fromPhase: 'intake',
        toPhase: 'designing',
        trigger: 'agent',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[1],
        phases,
      );
      expect(message).toContain('phase_position: 2 of 4');
    });

    it('emits phase_position with correct index for the last phase', () => {
      const payload: WorkflowPhaseChangePayload = {
        direction: 'forward',
        isFirstEntry: true,
        fromPhase: 'design',
        toPhase: 'handoff',
        trigger: 'agent',
      };
      const message = formatWorkflowPhaseChangeMessage(
        payload,
        phases[3],
        phases,
      );
      expect(message).toContain('phase_position: 4 of 4');
    });
  });

  it('omits phase_position when allPhases is undefined (legacy callers)', () => {
    const payload: WorkflowPhaseChangePayload = {
      direction: 'forward',
      isFirstEntry: true,
      fromPhase: 'intro',
      toPhase: 'design',
      trigger: 'agent',
    };

    const message = formatWorkflowPhaseChangeMessage(payload, designPhase);

    expect(message).not.toContain('phase_position');
  });

  it.each<['forward' | 'backward' | 'initial', WorkflowPhaseChangePayload]>([
    [
      'forward',
      {
        direction: 'forward',
        isFirstEntry: true,
        fromPhase: 'intro',
        toPhase: 'design',
        trigger: 'agent',
      },
    ],
    [
      'backward',
      {
        direction: 'backward',
        isFirstEntry: false,
        fromPhase: 'review',
        toPhase: 'design',
        trigger: 'user',
      },
    ],
    [
      'initial',
      {
        direction: 'initial',
        isFirstEntry: true,
        toPhase: 'design',
        trigger: 'system',
      },
    ],
  ])(
    'always ends with the directive line (%s)',
    (_label, payload) => {
      const message = formatWorkflowPhaseChangeMessage(payload, designPhase);
      expect(message.trimEnd().includes(DIRECTIVE_PREFIX)).toBe(true);
    },
  );
});
