/**
 * Tests for ConfigLoader.loadConfig — metadata propagation.
 *
 * These tests focus on the assembly logic in `loadConfig` rather than the full
 * load pipeline: they construct a `ConfigLoader` with a stub `ContentLoader`,
 * inject a synthetic `experienceConfig`, and stub the inner managers so we can
 * assert the shape of the returned `ConfigResponse.metadata`.
 */

import { ConfigLoader } from '../ConfigLoader';
import { ContentLoader, ExperienceConfig } from '../../types';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases';

function makeBaseExperienceConfig(
  overrides: Partial<ExperienceConfig> = {}
): ExperienceConfig {
  return {
    version: '1.0.0',
    title: 'Test Experience',
    description: 'desc',
    resources: {
      scenes: [],
      sounds: [],
      instructions: { agent: {}, supplemental: {} },
    },
    agents: {},
    ...overrides,
  } as ExperienceConfig;
}

function buildLoader(experienceConfig: ExperienceConfig): ConfigLoader {
  const contentLoader: ContentLoader = {
    basePath: '',
    loadContent: jest.fn(),
  };
  const loader = new ConfigLoader(contentLoader);

  // Inject a fully-built experienceConfig and replace the inner managers with
  // minimal stubs. `loadConfig` only consults `agentConfigBuilder`,
  // `validationManager`, and `toolProcessor` — bypassing the file pipeline
  // keeps these tests focused on metadata assembly.
  const internal = loader as unknown as {
    experienceConfig: ExperienceConfig;
    agentConfigBuilder: { buildAllAgentConfigs: (cfg: ExperienceConfig) => Promise<Record<string, unknown>> };
    validationManager: { hasErrors: () => boolean; logReport: () => void; getErrorMessage: () => string };
    toolProcessor: { getToolDefinitions: () => Record<string, unknown> };
  };
  internal.experienceConfig = experienceConfig;
  internal.agentConfigBuilder = {
    buildAllAgentConfigs: jest.fn().mockResolvedValue({}),
  };
  internal.validationManager = {
    hasErrors: jest.fn().mockReturnValue(false),
    logReport: jest.fn(),
    getErrorMessage: jest.fn().mockReturnValue(''),
  };
  internal.toolProcessor = {
    getToolDefinitions: jest.fn().mockReturnValue({}),
  };
  return loader;
}

describe('ConfigLoader.loadConfig — metadata propagation', () => {
  it('omits initialAgent and workflow-phase fields when not set on the source config', async () => {
    const loader = buildLoader(makeBaseExperienceConfig());

    const response = await loader.loadConfig();

    expect(response.metadata.initialAgent).toBeUndefined();
    expect(response.metadata.workflowPhases).toBeUndefined();
    expect(response.metadata.initialWorkflowPhase).toBeUndefined();
    // Existing fields are still present.
    expect(response.metadata.version).toBe('1.0.0');
    expect(response.metadata.title).toBe('Test Experience');
  });

  it('exposes metadata.initialAgent when set on the source config', async () => {
    const loader = buildLoader(
      makeBaseExperienceConfig({ initialAgent: 'guide' })
    );

    const response = await loader.loadConfig();

    expect(response.metadata.initialAgent).toBe('guide');
  });

  it('exposes metadata.workflowPhases and metadata.initialWorkflowPhase when set', async () => {
    const phases: WorkflowPhaseConfig[] = [
      { id: 'design', title: 'Design' },
      { id: 'build', title: 'Build' },
    ];
    const loader = buildLoader(
      makeBaseExperienceConfig({
        workflowPhases: phases,
        initialWorkflowPhase: 'design',
      })
    );

    const response = await loader.loadConfig();

    expect(response.metadata.workflowPhases).toEqual(phases);
    expect(response.metadata.initialWorkflowPhase).toBe('design');
  });
});
