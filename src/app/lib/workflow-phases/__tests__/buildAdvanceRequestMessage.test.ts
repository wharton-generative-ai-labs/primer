import { buildAdvanceRequestMessage } from '@/app/lib/workflow-phases/buildAdvanceRequestMessage';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases';

describe('buildAdvanceRequestMessage', () => {
  const phase: WorkflowPhaseConfig = {
    id: 'intake',
    title: 'Intake',
    objectives: [
      { id: 'domain', description: 'Confirm domain.' },
      { id: 'template', description: 'Pick template.' },
      { id: 'briefing', description: 'Capture briefing.' },
    ],
  };

  test('labels each objective MARKED or UNMARKED', () => {
    const msg = buildAdvanceRequestMessage(phase, ['domain', 'template']);
    expect(msg).toMatch(/- domain: MARKED — Confirm domain\./);
    expect(msg).toMatch(/- template: MARKED — Pick template\./);
    expect(msg).toMatch(/- briefing: UNMARKED — Capture briefing\./);
  });

  test('starts with [SYSTEM/USER_ADVANCE_REQUEST] framing', () => {
    const msg = buildAdvanceRequestMessage(phase, []);
    expect(msg.split('\n')[0]).toBe('[SYSTEM/USER_ADVANCE_REQUEST]');
  });

  test('includes the current phase id', () => {
    const msg = buildAdvanceRequestMessage(phase, []);
    expect(msg).toMatch(/Current phase: intake/);
  });

  test('phase with zero objectives still produces a coherent message', () => {
    const noObjs: WorkflowPhaseConfig = { id: 'p', title: 'P' };
    const msg = buildAdvanceRequestMessage(noObjs, []);
    expect(msg).toMatch(/no declared objectives/i);
    expect(msg).toMatch(/advance now/i);
  });

  test('all-marked phase prompts the agent to advance', () => {
    const msg = buildAdvanceRequestMessage(phase, ['domain', 'template', 'briefing']);
    expect(msg).not.toMatch(/UNMARKED/);
    expect(msg).toMatch(/advance now/i);
  });

  test('retro-mark guidance is present when any objective is unmarked', () => {
    const msg = buildAdvanceRequestMessage(phase, ['domain']);
    expect(msg).toMatch(/mark it now via `workflowPhase markObjective/);
  });

  test('marks unknown to the phase are ignored (defensive)', () => {
    const msg = buildAdvanceRequestMessage(phase, ['domain', 'phantom']);
    expect(msg).toMatch(/- domain: MARKED/);
    expect(msg).not.toMatch(/phantom/);
  });
});
