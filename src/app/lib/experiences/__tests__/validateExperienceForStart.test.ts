/**
 * Tests for the pre-flight gate util that combines structural analysis with
 * filesystem and env-key checks. The structural side is covered by
 * `ConfigAnalyzer.test.ts`; here we focus on the additional checks this
 * layer adds (file existence, provider env-key presence) and confirm the
 * structural issues bubble through.
 */

const fileExists = jest.fn();

jest.mock('@/app/lib/storage/StorageServiceFactory', () => ({
  StorageServiceFactory: {
    getInstance: () => ({ fileExists }),
  },
}));

jest.mock('@/config/env', () => ({
  env: {} as Record<string, string | undefined>,
}));

import { env } from '@/config/env';
import { validateExperienceForStart } from '../validateExperienceForStart';

const baseConfig = {
  version: '1.0.0',
  configVersion: 2,
  title: 'Test',
  description: 'Test',
  initialAgent: 'mentor',
  aiConfigurations: {
    main: {
      provider: 'openai',
      api: 'responses',
      model: 'gpt-4o',
      streaming: false,
      modalities: ['text'],
    },
  },
  resources: {
    scenes: [],
    sounds: [],
    instructions: {
      agent: { mentor: 'resources/instructions/agent/mentor.md' },
      supplemental: { agent: 'resources/instructions/supplemental/agent.md' },
    },
  },
  agents: {
    mentor: {
      name: 'Mentor',
      publicDescription: 'A mentor',
      downstreamAgents: [],
      aiConfiguration: 'main',
      toolSets: ['frontend-default'],
    },
  },
  toolSets: {},
};

beforeEach(() => {
  fileExists.mockReset();
  for (const key of Object.keys(env)) delete (env as Record<string, unknown>)[key];
});

describe('validateExperienceForStart', () => {
  it('passes when all files exist and the provider env key is set', async () => {
    fileExists.mockResolvedValue(true);
    (env as Record<string, string>).OPENAI_API_KEY = 'sk-test';
    const result = await validateExperienceForStart('exp-1', JSON.stringify(baseConfig));
    expect(result.isValid).toBe(true);
    expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('blocks when a referenced instruction file is missing', async () => {
    fileExists.mockImplementation(async (p: string) =>
      !p.endsWith('mentor.md'),
    );
    (env as Record<string, string>).OPENAI_API_KEY = 'sk-test';
    const result = await validateExperienceForStart('exp-1', JSON.stringify(baseConfig));
    expect(result.isValid).toBe(false);
    expect(
      result.issues.some(
        i =>
          i.severity === 'error' &&
          i.path === 'resources.instructions.agent.mentor',
      ),
    ).toBe(true);
  });

  it('blocks when the declared provider has no env key', async () => {
    fileExists.mockResolvedValue(true);
    const result = await validateExperienceForStart('exp-1', JSON.stringify(baseConfig));
    expect(result.isValid).toBe(false);
    expect(
      result.issues.some(
        i =>
          i.severity === 'error' &&
          i.message.includes("'OPENAI_API_KEY' is not set"),
      ),
    ).toBe(true);
  });

  it('blocks when a reachable tool requires an env key that is not set', async () => {
    fileExists.mockResolvedValue(true);
    // Use an anthropic provider so the provider key (ANTHROPIC_API_KEY) is
    // distinct from the generateImages tool key (OPENAI_API_KEY). With a
    // satisfied provider, only the tool key gap should block validation.
    (env as Record<string, string>).ANTHROPIC_API_KEY = 'an-test';
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.aiConfigurations.main.provider = 'anthropic';
    // backend-default contains generateImages which needs OPENAI_API_KEY
    cfg.agents.mentor.toolSets = ['backend-default'];
    const result = await validateExperienceForStart('exp-1', JSON.stringify(cfg));
    expect(result.isValid).toBe(false);
    expect(
      result.issues.some(
        i =>
          i.severity === 'error' &&
          i.message.includes("'OPENAI_API_KEY' is not set") &&
          i.message.includes('generateImages'),
      ),
    ).toBe(true);
  });

  it('passes when both the provider env key and the tool env key are set', async () => {
    fileExists.mockResolvedValue(true);
    (env as Record<string, string>).ANTHROPIC_API_KEY = 'an-test';
    (env as Record<string, string>).OPENAI_API_KEY = 'oa-test';
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.aiConfigurations.main.provider = 'anthropic';
    cfg.agents.mentor.toolSets = ['backend-default'];
    const result = await validateExperienceForStart('exp-1', JSON.stringify(cfg));
    expect(result.isValid).toBe(true);
  });

  it('blocks when experience.json is unparseable', async () => {
    fileExists.mockResolvedValue(true);
    const result = await validateExperienceForStart('exp-1', '{not json');
    expect(result.isValid).toBe(false);
    expect(
      result.issues.some(
        i => i.severity === 'error' && i.category === 'structure',
      ),
    ).toBe(true);
  });

  it('bubbles structural errors from the analyzer', async () => {
    fileExists.mockResolvedValue(true);
    (env as Record<string, string>).OPENAI_API_KEY = 'sk-test';
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.initialAgent = 'ghost';
    const result = await validateExperienceForStart('exp-1', JSON.stringify(cfg));
    expect(result.isValid).toBe(false);
    expect(
      result.issues.some(
        i => i.severity === 'error' && i.path === 'initialAgent',
      ),
    ).toBe(true);
  });
});
