import { agentPhased, agent } from '@/app/lib/instructions/platform/agent';

describe('platform/agent — markObjective guidance', () => {
  test('agentPhased documents markObjective in the workflowPhase actions list', () => {
    expect(agentPhased).toMatch(/markObjective.*id.*record/i);
  });

  test('agentPhased instructs marking in passing, not narrating', () => {
    expect(agentPhased).toMatch(/mark.*in.*passing/i);
    expect(agentPhased).toMatch(/don't narrate/i);
  });

  test('non-phased agent variant does NOT mention markObjective', () => {
    expect(agent).not.toMatch(/markObjective/);
  });
});
