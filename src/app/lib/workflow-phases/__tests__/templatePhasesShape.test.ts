import fs from 'fs';
import path from 'path';
import { loadWorkflowPhases } from '../loadWorkflowPhases';
import { expandToolSets } from '@/app/lib/tools/groups';

function resolveAgentTools(agent: any, cfg: any): string[] | undefined {
  if (agent.availableTools) return agent.availableTools;
  if (agent.toolSets && agent.toolSets.length > 0) {
    return expandToolSets(agent.toolSets, cfg.toolSets);
  }
  // toolGroups path is legacy and not used by phased experiences; treat as undefined.
  if (agent.toolGroups && agent.toolGroups.length > 0) return undefined;
  return undefined;
}

interface ExpectedShape {
  initialPhase: string;
  phaseIds: string[];
}

const fixtures: Record<string, ExpectedShape> = {
  'roleplay-template':    { initialPhase: 'mentor', phaseIds: ['mentor', 'practice', 'feedback'] },
  'teachback-template':   { initialPhase: 'mentor', phaseIds: ['mentor', 'practice', 'feedback'] },
  'experience-creator':   { initialPhase: 'intake', phaseIds: ['intake', 'design', 'build', 'handoff'] },
};

const STALE_HANDOFF_PATTERNS = [
  /\btransferAgents\b/,
  /action\s+['"]transfer['"]/,
];

describe.each(Object.entries(fixtures))('%s phase config', (experienceId, expected) => {
  const cfgPath = path.join(process.cwd(), 'storage', experienceId, 'experience.json');
  if (!fs.existsSync(cfgPath)) {
    it.skip('skipped — fixture not present in this checkout', () => {});
    return;
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  if (!cfg.initialWorkflowPhase) {
    it.skip('skipped — experience not yet migrated to workflow phases', () => {});
    return;
  }

  it('declares initialWorkflowPhase pointing at a defined phase', () => {
    expect(cfg.initialWorkflowPhase).toBe(expected.initialPhase);
    const ids = (cfg.workflowPhases ?? []).map((p: any) => p.id);
    expect(ids).toContain(cfg.initialWorkflowPhase);
  });

  it('declares the expected phases in order', () => {
    const ids = (cfg.workflowPhases ?? []).map((p: any) => p.id);
    expect(ids).toEqual(expected.phaseIds);
  });

  it('every phase initialAgent exists in agents block', () => {
    const agentKeys = Object.keys(cfg.agents ?? {});
    for (const phase of cfg.workflowPhases ?? []) {
      expect(agentKeys).toContain(phase.initialAgent);
    }
  });

  it('loadWorkflowPhases parses without throwing', () => {
    expect(() => loadWorkflowPhases(cfg)).not.toThrow();
    const phases = loadWorkflowPhases(cfg);
    expect(phases).toHaveLength(expected.phaseIds.length);
  });

  it('every frontend phase-anchor agent has workflowPhase and finishExperience available', () => {
    const phaseAnchors = new Set<string>();
    for (const phase of cfg.workflowPhases ?? []) {
      if (phase.initialAgent) phaseAnchors.add(phase.initialAgent);
      if (phase.reentryAgent) phaseAnchors.add(phase.reentryAgent);
    }
    for (const agentKey of phaseAnchors) {
      const agent = cfg.agents[agentKey];
      if (agent.type === 'backend') continue;
      const available = resolveAgentTools(agent, cfg);
      if (available === undefined) continue;  // No explicit toolSet -> agent gets all registered tools, fine.
      expect(available).toContain('workflowPhase');
      expect(available).toContain('finishExperience');
    }
  });

  it('every phase allowedDelegates entry references an agent in the agents block', () => {
    const agentKeys = new Set(Object.keys(cfg.agents ?? {}));
    for (const phase of cfg.workflowPhases ?? []) {
      if (!phase.allowedDelegates) continue;
      expect(Array.isArray(phase.allowedDelegates)).toBe(true);
      for (const delegateKey of phase.allowedDelegates) {
        expect(agentKeys.has(delegateKey)).toBe(true);
      }
    }
  });

  it('supplemental/agent.md contains no stale cross-phase handoff guidance', () => {
    const supplementalPath = path.join(
      process.cwd(),
      'storage',
      experienceId,
      'resources/instructions/supplemental/agent.md',
    );
    if (!fs.existsSync(supplementalPath)) return;
    const text = fs.readFileSync(supplementalPath, 'utf-8');
    for (const pattern of STALE_HANDOFF_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });
});

describe('experience-creator design-agent prompt', () => {
  const promptPath = path.join(
    process.cwd(),
    'storage/experience-creator/resources/instructions/agent/design-agent.md',
  );
  if (!fs.existsSync(promptPath)) {
    it.skip('skipped — prompt file not present in this checkout', () => {});
    return;
  }
  const text = fs.readFileSync(promptPath, 'utf-8');

  it('contains a fenced JSON Phases Configuration example that parses as valid JSON', () => {
    const sectionMatch = text.match(/## Phases Configuration Artifact[\s\S]*?```json\s*\n([\s\S]*?)\n```/);
    expect(sectionMatch).not.toBeNull();
    const jsonText = sectionMatch![1];

    expect(() => JSON.parse(jsonText)).not.toThrow();

    const parsed = JSON.parse(jsonText);
    expect(parsed.initialWorkflowPhase).toBe('mentor');
    expect(parsed.workflowPhases).toHaveLength(3);
    expect(parsed.workflowPhases.map((p: any) => p.id)).toEqual(['mentor', 'practice', 'feedback']);
  });
});
