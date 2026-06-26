/**
 * Tests for the platform-supplemental selector.
 *
 * The selector is the integration point for phase-aware baseline guidance:
 * when an experience declares `workflowPhases`, the `{{agent}}` supplemental
 * swaps in copy that teaches `workflowPhase nextPhase` / `finishExperience`
 * and the cross-phase handoff rule. Phase-less experiences keep the original
 * transfer guidance verbatim.
 *
 * The phased variant teaches `markObjective` for marking objectives as covered
 * during conversation (Task 6 added the action; Task 11 teaches the guidance).
 * The non-phased variant must NOT mention it.
 */

import { getPlatformSupplemental } from '@/app/lib/instructions/platform';
import type { ExperienceConfig } from '@/app/lib/types';

function makeConfig(overrides: Partial<ExperienceConfig> = {}): ExperienceConfig {
  return {
    agents: {},
    ...overrides,
  } as unknown as ExperienceConfig;
}

describe('getPlatformSupplemental', () => {
  it('returns the non-phased agent supplemental when no config is passed', () => {
    const supplemental = getPlatformSupplemental();
    expect(supplemental.agent).toContain('### Transferring');
    expect(supplemental.agent).not.toContain('### Workflow phases');
    expect(supplemental.agent).not.toContain('workflowPhase');
  });

  it('returns the non-phased agent supplemental when workflowPhases is absent', () => {
    const supplemental = getPlatformSupplemental(makeConfig());
    expect(supplemental.agent).toContain('### Transferring');
    expect(supplemental.agent).not.toContain('### Workflow phases');
  });

  it('returns the non-phased agent supplemental when workflowPhases is empty', () => {
    const supplemental = getPlatformSupplemental(
      makeConfig({ workflowPhases: [] }),
    );
    expect(supplemental.agent).toContain('### Transferring');
    expect(supplemental.agent).not.toContain('### Workflow phases');
  });

  it('returns the phased agent supplemental when workflowPhases has at least one entry', () => {
    const supplemental = getPlatformSupplemental(
      makeConfig({
        workflowPhases: [{ id: 'intro', title: 'Intro' }],
      }),
    );
    expect(supplemental.agent).toContain('### Workflow phases');
    expect(supplemental.agent).toContain('### Handoffs vs phase changes');
    expect(supplemental.agent).toContain('workflowPhase');
    expect(supplemental.agent).toContain('finishExperience');
    expect(supplemental.agent).toContain('suggestReturn');
  });

  // The `markObjective` action (added in Task 6) is taught in the phased
  // variant so agents know how to mark objectives as covered during
  // conversation. The non-phased variant must NOT mention it (regression).
  it('phased variant DOES teach `markObjective` for marking objectives', () => {
    const supplemental = getPlatformSupplemental(
      makeConfig({
        workflowPhases: [{ id: 'intro', title: 'Intro' }],
      }),
    );
    expect(supplemental.agent).toContain('markObjective');
    // `nextPhase` is still the primary forward op.
    expect(supplemental.agent).toContain('nextPhase');
    // The guidance must teach mark-in-passing behavior.
    expect(supplemental.agent).toMatch(/mark.*in.*passing/i);
  });

  it('non-phased variant also omits `markObjective` (regression: never bleeds in)', () => {
    const supplemental = getPlatformSupplemental();
    expect(supplemental.agent).not.toContain('markObjective');
  });

  // The legacy `complete` + `advance` primitives still exist on the
  // transition manager but are NOT exposed on the agent's `workflowPhase`
  // tool. Older drafts of this supplemental advertised them as the primary
  // forward path, which trained agents to call something the tool wouldn't
  // accept. Lock the demotion so a future revert to the old wording fails
  // loudly.
  it('phased variant does not teach `complete` or `advance` as the primary forward op', () => {
    const supplemental = getPlatformSupplemental(
      makeConfig({
        workflowPhases: [{ id: 'intro', title: 'Intro' }],
      }),
    );
    // `complete` and `advance` may be MENTIONED (in the "low-level
    // primitives" caveat at the end) but must not be presented as the
    // primary forward path. A bullet entry like `- \`action\` \`complete\`
    // ...` would re-teach the deprecated path.
    expect(supplemental.agent).not.toMatch(/-\s+`action`\s+`complete`/);
    expect(supplemental.agent).not.toMatch(/-\s+`action`\s+`advance`/);
  });

  // The "Handoffs vs phase changes" section previously told the agent to
  // call `workflowPhase` with `action` `advance` for cross-phase handoffs,
  // but `advance` was removed from the agent-callable surface (it lives
  // only on the low-level transition manager now). An agent following the
  // stale guidance hits the tool's `default` "Invalid action" branch and
  // stalls. Lock that no copy in the supplemental pairs the word `action`
  // with a backtick-wrapped `advance` instruction — the legitimate
  // mentions of `advance` (as a removed primitive in the caveat paragraph)
  // do not collocate with `action` and should not match.
  it('phased variant never instructs the agent to call `action` `advance`', () => {
    const supplemental = getPlatformSupplemental(
      makeConfig({
        workflowPhases: [{ id: 'intro', title: 'Intro' }],
      }),
    );
    expect(supplemental.agent).not.toMatch(/\baction\b[^\n]{0,40}`advance`/);
  });

  it('phased variant teaches the revisit recovery routine', () => {
    const supplemental = getPlatformSupplemental(
      makeConfig({
        workflowPhases: [{ id: 'a', title: 'A' }],
      }),
    );
    expect(supplemental.agent).toContain('### Returning to a phase');
    expect(supplemental.agent).toContain('WORKFLOW_PHASE_REVISITED');
    expect(supplemental.agent).toMatch(/information.*discover/);
    expect(supplemental.agent).not.toContain('### Returning to a phase\n\n### Returning');
  });

  it('non-phased variant omits the revisit routine', () => {
    const supplemental = getPlatformSupplemental();
    expect(supplemental.agent).not.toContain('### Returning to a phase');
    expect(supplemental.agent).not.toContain('WORKFLOW_PHASE_REVISITED');
  });

  it('phased variant explicitly forbids transfer for cross-phase moves', () => {
    const supplemental = getPlatformSupplemental(
      makeConfig({
        workflowPhases: [{ id: 'a', title: 'A' }],
      }),
    );
    // Direct guidance: across phases, do NOT use transfer.
    expect(supplemental.agent).toMatch(/Across phases.*do NOT use.*transfer/s);
  });

  it('honors the explicit options-shape escape hatch', () => {
    const supplemental = getPlatformSupplemental({ hasWorkflowPhases: true });
    expect(supplemental.agent).toContain('### Workflow phases');
  });

  // Realtime agents observably commit verbally without translating to
  // tool calls ("I'll handle X behind the scenes" then idle for minutes).
  // The say-do rule lives in COMMON_HEAD so it applies to BOTH variants.
  // This is the only place the rule is taught — losing it silently
  // re-enables the announce-and-pause stall pattern.
  it('agent supplemental teaches the say-do principle in BOTH variants', () => {
    const noPhases = getPlatformSupplemental();
    const phased = getPlatformSupplemental(
      makeConfig({ workflowPhases: [{ id: 'a', title: 'A' }] }),
    );

    for (const supplemental of [noPhases, phased]) {
      expect(supplemental.agent).toContain('### Say-do principle');
      // The rule must reference the same-turn requirement.
      expect(supplemental.agent.toLowerCase()).toMatch(/same response turn/);
      // It must call out the parallel-signal framing so the agent
      // understands WHY (not just what), reducing chance of casual
      // dropping.
      expect(supplemental.agent.toLowerCase()).toMatch(/parallel signals/);
    }
  });

  it('keeps tools and errorHandling supplementals stable across modes', () => {
    const noPhases = getPlatformSupplemental();
    const phased = getPlatformSupplemental(
      makeConfig({ workflowPhases: [{ id: 'a', title: 'A' }] }),
    );
    expect(phased.tools).toBe(noPhases.tools);
    expect(phased.errorHandling).toBe(noPhases.errorHandling);
  });

  // `showArtifact` is an action on the `slide` tool, NOT on `artifact`. An
  // earlier version of this supplemental listed `showArtifact` parenthetically
  // without anchoring it to its tool, and agents repeatedly mis-routed the
  // call as `artifact({ action: 'showArtifact' })` — which the tool refuses.
  // Lock in that the wording now (a) keeps `showArtifact` adjacent to
  // `slide`, and (b) explicitly tells the model that `artifact` has no
  // display action.
  it('tools supplemental anchors `showArtifact` to the `slide` tool', () => {
    const { tools } = getPlatformSupplemental();
    expect(tools).toMatch(/`slide`[^`]*`showArtifact`/);
  });

  it('tools supplemental tells the agent `artifact` has no display action', () => {
    const { tools } = getPlatformSupplemental();
    expect(tools.toLowerCase()).toMatch(/storage/);
    expect(tools).toMatch(/`artifact`[\s\S]*list[\s\S]*get[\s\S]*create[\s\S]*edit[\s\S]*delete/);
  });

  it('exposes the documentStyle supplemental', () => {
    const supplemental = getPlatformSupplemental();
    expect(supplemental.documentStyle).toBeDefined();
    expect(supplemental.documentStyle).toMatch(/Document style/);
    expect(supplemental.documentStyle).toMatch(/scaffold/i);
    expect(supplemental.documentStyle).toMatch(/Step 1: \.\.\. Step 2: \.\.\. Step 3: \.\.\./);
  });

  it('documentStyle is identical regardless of phases', () => {
    const phased = getPlatformSupplemental(
      makeConfig({ workflowPhases: [{ id: 'a', title: 'A' }] }),
    );
    const plain = getPlatformSupplemental();
    expect(phased.documentStyle).toBe(plain.documentStyle);
  });
});
