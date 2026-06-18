/**
 * Gate test: workflow-phase tools are only registered when the experience
 * declares phases. Without phases, both `workflowPhase` and `finishExperience`
 * are absent from the registry — saving prompt tokens and avoiding tool
 * surfaces the LLM can't actually use.
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import { registerClientBuiltinTools } from '@/app/lib/tools/builtin/register-client';
import { WORKFLOW_PHASE_ACTIONS } from '@/app/lib/tools/builtin/workflow-phase-tool';
import type { ExperienceConfig } from '@/app/lib/types';

describe('registerClientBuiltinTools workflow-phase gate', () => {
  beforeEach(() => {
    ToolRegistry.getInstance().clear();
  });

  it('does NOT register workflowPhase or finishExperience when config is undefined', async () => {
    await registerClientBuiltinTools();
    const registry = ToolRegistry.getInstance();
    expect(registry.hasToolWithName('workflowPhase')).toBe(false);
    expect(registry.hasToolWithName('finishExperience')).toBe(false);
  });

  it('does NOT register workflowPhase or finishExperience when workflowPhases is absent', async () => {
    const config = { agents: {} } as unknown as ExperienceConfig;
    await registerClientBuiltinTools(config);
    const registry = ToolRegistry.getInstance();
    expect(registry.hasToolWithName('workflowPhase')).toBe(false);
    expect(registry.hasToolWithName('finishExperience')).toBe(false);
  });

  it('does NOT register workflowPhase or finishExperience when workflowPhases is empty', async () => {
    const config = { agents: {}, workflowPhases: [] } as unknown as ExperienceConfig;
    await registerClientBuiltinTools(config);
    const registry = ToolRegistry.getInstance();
    expect(registry.hasToolWithName('workflowPhase')).toBe(false);
    expect(registry.hasToolWithName('finishExperience')).toBe(false);
  });

  it('DOES register workflowPhase and finishExperience when phases are declared', async () => {
    const config = {
      agents: {},
      workflowPhases: [{ id: 'intro', title: 'Intro' }],
    } as unknown as ExperienceConfig;
    await registerClientBuiltinTools(config);
    const registry = ToolRegistry.getInstance();
    expect(registry.hasToolWithName('workflowPhase')).toBe(true);
    expect(registry.hasToolWithName('finishExperience')).toBe(true);
  });

  it('still registers other builtin tools (scene, artifact, etc.) regardless of phase config', async () => {
    await registerClientBuiltinTools();
    const registry = ToolRegistry.getInstance();
    expect(registry.hasToolWithName('scene')).toBe(true);
    expect(registry.hasToolWithName('artifact')).toBe(true);
  });

  describe('agent tool description phase awareness', () => {
    it('omits the phase suffix when no phases are configured', async () => {
      await registerClientBuiltinTools();
      const registry = ToolRegistry.getInstance();
      const agentTool = registry.getAllTools().find((t) => t.name === 'agent');
      expect(agentTool).toBeDefined();
      expect(agentTool!.description).not.toContain('Workflow phases are active');
    });

    it('includes the phase suffix pointing at workflowPhase when phases are declared', async () => {
      const config = {
        agents: {},
        workflowPhases: [{ id: 'intro', title: 'Intro' }],
      } as unknown as ExperienceConfig;
      await registerClientBuiltinTools(config);
      const registry = ToolRegistry.getInstance();
      const agentTool = registry.getAllTools().find((t) => t.name === 'agent');
      expect(agentTool).toBeDefined();
      expect(agentTool!.description).toContain('Workflow phases are active');
      expect(agentTool!.description).toContain('workflowPhase.nextPhase');
      expect(agentTool!.description).not.toContain('workflowPhase.advance');
    });
  });

  // Pins the workflowPhase tool's action enum to the canonical
  // `WORKFLOW_PHASE_ACTIONS` source of truth. Without this assertion, the
  // schema enum the LLM sees can silently diverge from the handler's switch
  // statement — a prior version of `register.ts` declared
  // `complete` / `advance` in the enum, which the handler had stopped
  // accepting, so the model was told options that failed.
  it('declares workflowPhase action enum matching WORKFLOW_PHASE_ACTIONS', async () => {
    const config = {
      agents: {},
      workflowPhases: [{ id: 'intro', title: 'Intro' }],
    } as unknown as ExperienceConfig;
    await registerClientBuiltinTools(config);
    const registry = ToolRegistry.getInstance();
    const tool = registry.getAllTools().find((t) => t.name === 'workflowPhase');
    expect(tool).toBeDefined();
    const actionEnum = (tool!.parameters as any)?.properties?.action?.enum;
    expect(actionEnum).toEqual([...WORKFLOW_PHASE_ACTIONS]);
  });
});
