/**
 * Tests for {@link ConfigAnalyzer.validateConfig} — the structural checks
 * that gate experience playback. The startup gate also runs filesystem and
 * env checks; those live in `validateExperienceForStart.test.ts`.
 */

import { ConfigAnalyzer } from '../ConfigAnalyzer';

const baseConfig = {
  version: '1.0.0',
  title: 'Test Experience',
  description: 'A test experience',
  configVersion: 2,
  initialAgent: 'mentor',
  aiConfigurations: {
    'voice-interactive': {
      provider: 'openai',
      api: 'realtime',
      model: 'gpt-realtime-1.5',
      streaming: true,
      modalities: ['audio', 'text'],
    },
  },
  resources: {
    scenes: [],
    sounds: [],
    instructions: {
      agent: { mentor: 'resources/instructions/agent/mentor.md' },
      supplemental: {},
    },
  },
  agents: {
    mentor: {
      name: 'Mentor',
      publicDescription: 'A mentor',
      downstreamAgents: [],
      aiConfiguration: 'voice-interactive',
      toolSets: ['frontend-default'],
    },
  },
  toolSets: {},
};

async function analyze(config: unknown) {
  const analyzer = new ConfigAnalyzer();
  return analyzer.analyze(JSON.stringify(config));
}

describe('ConfigAnalyzer.validateConfig', () => {
  it('passes a clean v2 config', async () => {
    const result = await analyze(baseConfig);
    const errors = result.validation.issues.filter(i => i.severity === 'error');
    expect(errors).toHaveLength(0);
    expect(result.validation.isValid).toBe(true);
  });

  it('flags an aiConfiguration missing provider', async () => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    delete (cfg.aiConfigurations['voice-interactive'] as { provider?: string }).provider;
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'error' &&
          i.path === 'aiConfigurations.voice-interactive.provider',
      ),
    ).toBe(true);
  });

  it('flags an aiConfiguration with unknown provider', async () => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.aiConfigurations['voice-interactive'].provider = 'cohere';
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i => i.severity === 'error' && i.message.includes('unknown provider'),
      ),
    ).toBe(true);
  });

  it('flags an agent setting temperature on a model that only accepts the default', async () => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.aiConfigurations['voice-interactive'].model = 'gpt-5';
    cfg.agents.mentor.temperature = 0.7;
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'error' &&
          i.path === 'agents.mentor.temperature' &&
          i.message.includes("only accepts the default temperature"),
      ),
    ).toBe(true);
  });

  it('flags temperature on o-series reasoning models', async () => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.aiConfigurations['voice-interactive'].model = 'o3-mini';
    cfg.agents.mentor.temperature = 0.5;
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i => i.severity === 'error' && i.path === 'agents.mentor.temperature',
      ),
    ).toBe(true);
  });

  it('does not flag temperature on models that accept custom values', async () => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    // baseConfig already uses gpt-realtime-1.5; just add a custom temperature.
    cfg.agents.mentor.temperature = 0.7;
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i => i.severity === 'error' && i.path === 'agents.mentor.temperature',
      ),
    ).toBe(false);
  });

  it.each([
    'gpt-image-2',
    'gpt-image-1',
    'dall-e-3',
    'dalle-3',
    'imagen-3',
    'nano-banana',
    'nano-banana-2',
    'nanobanana-3-pro',
  ])('flags image-only model %s wired as an agent chat brain', async (imageModel) => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.aiConfigurations['voice-interactive'].model = imageModel;
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'error' &&
          i.path === 'aiConfigurations.voice-interactive.model' &&
          i.message.includes('image-only'),
      ),
    ).toBe(true);
  });

  it('does not flag chat models that are not image-only', async () => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.aiConfigurations['voice-interactive'].model = 'gpt-5';
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'error' &&
          i.path === 'aiConfigurations.voice-interactive.model' &&
          i.message.includes('image-only'),
      ),
    ).toBe(false);
  });

  it('warns when provider and model name disagree', async () => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.aiConfigurations['voice-interactive'].provider = 'google';
    cfg.aiConfigurations['voice-interactive'].model = 'gpt-4o';
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'warning' &&
          i.message.includes("does not match model name"),
      ),
    ).toBe(true);
  });

  it('flags an agent referencing a missing aiConfiguration', async () => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.agents.mentor.aiConfiguration = 'nonexistent';
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'error' &&
          i.path === 'agents.mentor.aiConfiguration',
      ),
    ).toBe(true);
  });

  it('flags an agent without an instruction file', async () => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.resources.instructions.agent = {};
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'error' &&
          i.path === 'resources.instructions.agent.mentor',
      ),
    ).toBe(true);
  });

  it('warns about an instruction file with no matching agent', async () => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    (cfg.resources.instructions.agent as Record<string, string>).orphan =
      'resources/instructions/agent/orphan.md';
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'warning' &&
          i.path === 'resources.instructions.agent.orphan',
      ),
    ).toBe(true);
  });

  it('flags an unknown initialAgent', async () => {
    const cfg = JSON.parse(JSON.stringify(baseConfig));
    cfg.initialAgent = 'ghost';
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i => i.severity === 'error' && i.path === 'initialAgent',
      ),
    ).toBe(true);
  });

  it('flags an unknown plugin in tools.plugins', async () => {
    const cfg: any = JSON.parse(JSON.stringify(baseConfig));
    cfg.tools = { plugins: ['@primer/builtin-plugin', '@primer/nope-plugin'] };
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'error' &&
          i.message.includes("Unknown plugin '@primer/nope-plugin'"),
      ),
    ).toBe(true);
  });

  it('warns when an artifact private tag does not match its agents list', async () => {
    const cfg: any = JSON.parse(JSON.stringify(baseConfig));
    cfg.resources.artifacts = [
      {
        name: 'Casting Director Checklist',
        type: 'checklist',
        file: 'resources/artifacts/casting-director-checklist.md',
        agents: ['mentor'],
        metadata: { tags: ['private:casting-director'] },
      },
    ];
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'warning' &&
          i.message.includes('private:casting-director'),
      ),
    ).toBe(true);
  });

  it('accepts preset toolSets without warning', async () => {
    const cfg: any = JSON.parse(JSON.stringify(baseConfig));
    cfg.agents.mentor.toolSets = ['frontend-default'];
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(i => i.message.includes("undefined toolSet")),
    ).toBe(false);
  });

  it('flags an unknown toolSet as an error', async () => {
    const cfg: any = JSON.parse(JSON.stringify(baseConfig));
    cfg.agents.mentor.toolSets = ['nonexistent'];
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'error' &&
          i.message.includes("undefined toolSet 'nonexistent'"),
      ),
    ).toBe(true);
  });

  it('flags an artifact referencing an undefined agent', async () => {
    const cfg: any = JSON.parse(JSON.stringify(baseConfig));
    cfg.resources.artifacts = [
      {
        name: 'X',
        type: 'checklist',
        file: 'resources/artifacts/x.md',
        agents: ['nobody'],
      },
    ];
    const result = await analyze(cfg);
    expect(
      result.validation.issues.some(
        i =>
          i.severity === 'error' &&
          i.message.includes("undefined agent 'nobody'"),
      ),
    ).toBe(true);
  });
});
