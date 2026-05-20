/**
 * Tests for InstructionProcessor — platform + experience supplemental layering.
 */

import { InstructionProcessor } from '../InstructionProcessor';
import { ResourceManager } from '../ResourceManager';
import { ValidationManager } from '../ValidationManager';
import { ExperienceConfig, Resource } from '../../types';

jest.mock('@/app/lib/instructions/platform', () => ({
  getPlatformSupplemental: () => ({
    tools: 'PLATFORM TOOLS BASELINE',
    agent: 'PLATFORM AGENT BASELINE',
    errorHandling: 'PLATFORM ERROR BASELINE',
  }),
}));

function makeResource(path: string): Resource {
  return { path, url: path };
}

function makeConfig(opts: {
  agentInstructions?: Record<string, Resource>;
  supplementalInstructions?: Record<string, Resource>;
  overrides?: Record<string, { replace?: boolean }>;
} = {}): ExperienceConfig {
  return {
    version: '1.0.0',
    title: 'Test',
    description: '',
    resources: {
      scenes: [],
      sounds: [],
      instructions: {
        agent: opts.agentInstructions ?? {},
        supplemental: opts.supplementalInstructions ?? {},
      },
    },
    agents: {},
    instructionOverrides: opts.overrides,
  } as ExperienceConfig;
}

describe('InstructionProcessor — platform + experience merging', () => {
  let processor: InstructionProcessor;
  let resourceManager: jest.Mocked<ResourceManager>;
  let validationManager: jest.Mocked<ValidationManager>;

  beforeEach(() => {
    resourceManager = {
      loadResource: jest.fn(),
    } as any;
    validationManager = {
      addStatus: jest.fn(),
      hasStatusForPath: jest.fn().mockReturnValue(false),
    } as any;
    processor = new InstructionProcessor(resourceManager, validationManager);
  });

  it('makes platform supplemental available even when the experience ships no supplemental file', async () => {
    const agentContent = '{{tools}}';
    resourceManager.loadResource.mockImplementation(async (path) => {
      if (path === 'agent/narrator.md') {
        return { content: agentContent, status: { friendlyName: '', path: '', objectPath: '', status: 'OK' } };
      }
      return { content: null, status: { friendlyName: '', path: '', objectPath: '', status: 'MISSING' } };
    });

    await processor.loadInstructions(
      makeConfig({ agentInstructions: { narrator: makeResource('agent/narrator.md') } })
    );
    const result = await processor.processInstructions('narrator');
    expect(result).toContain('PLATFORM TOOLS BASELINE');
  });

  it('concatenates experience supplemental after the platform baseline by default', async () => {
    resourceManager.loadResource.mockImplementation(async (path) => {
      if (path === 'agent/narrator.md') {
        return { content: '{{tools}}', status: { friendlyName: '', path: '', objectPath: '', status: 'OK' } };
      }
      if (path === 'supplemental/tools.md') {
        return { content: 'EXPERIENCE TOOLS ADDITION', status: { friendlyName: '', path: '', objectPath: '', status: 'OK' } };
      }
      return { content: null, status: { friendlyName: '', path: '', objectPath: '', status: 'MISSING' } };
    });

    await processor.loadInstructions(
      makeConfig({
        agentInstructions: { narrator: makeResource('agent/narrator.md') },
        supplementalInstructions: { tools: makeResource('supplemental/tools.md') },
      })
    );
    const result = await processor.processInstructions('narrator');
    // Platform comes first, heading separates, experience follows.
    const platformIdx = result.indexOf('PLATFORM TOOLS BASELINE');
    const headingIdx = result.indexOf('Experience-specific additions');
    const experienceIdx = result.indexOf('EXPERIENCE TOOLS ADDITION');
    expect(platformIdx).toBeGreaterThanOrEqual(0);
    expect(headingIdx).toBeGreaterThan(platformIdx);
    expect(experienceIdx).toBeGreaterThan(headingIdx);
  });

  it('replaces the platform baseline when instructionOverrides.<key>.replace is true', async () => {
    resourceManager.loadResource.mockImplementation(async (path) => {
      if (path === 'agent/narrator.md') {
        return { content: '{{tools}}', status: { friendlyName: '', path: '', objectPath: '', status: 'OK' } };
      }
      if (path === 'supplemental/tools.md') {
        return { content: 'EXPERIENCE OVERRIDE', status: { friendlyName: '', path: '', objectPath: '', status: 'OK' } };
      }
      return { content: null, status: { friendlyName: '', path: '', objectPath: '', status: 'MISSING' } };
    });

    await processor.loadInstructions(
      makeConfig({
        agentInstructions: { narrator: makeResource('agent/narrator.md') },
        supplementalInstructions: { tools: makeResource('supplemental/tools.md') },
        overrides: { tools: { replace: true } },
      })
    );
    const result = await processor.processInstructions('narrator');
    expect(result).toContain('EXPERIENCE OVERRIDE');
    expect(result).not.toContain('PLATFORM TOOLS BASELINE');
    expect(result).not.toContain('Experience-specific additions');
  });

  it('leaves platform content intact for keys the experience does not touch', async () => {
    resourceManager.loadResource.mockImplementation(async (path) => {
      if (path === 'agent/narrator.md') {
        return {
          content: '{{tools}}\n\n{{errorHandling}}',
          status: { friendlyName: '', path: '', objectPath: '', status: 'OK' },
        };
      }
      if (path === 'supplemental/tools.md') {
        return { content: 'EXPERIENCE TOOLS', status: { friendlyName: '', path: '', objectPath: '', status: 'OK' } };
      }
      return { content: null, status: { friendlyName: '', path: '', objectPath: '', status: 'MISSING' } };
    });

    await processor.loadInstructions(
      makeConfig({
        agentInstructions: { narrator: makeResource('agent/narrator.md') },
        supplementalInstructions: { tools: makeResource('supplemental/tools.md') },
      })
    );
    const result = await processor.processInstructions('narrator');
    // tools was overridden with a merge; errorHandling is platform-only.
    expect(result).toContain('EXPERIENCE TOOLS');
    expect(result).toContain('PLATFORM ERROR BASELINE');
  });
});
