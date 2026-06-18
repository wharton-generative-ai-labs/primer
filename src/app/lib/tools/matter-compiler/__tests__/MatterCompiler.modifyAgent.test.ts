/**
 * Server-side guard: `modifyAgent` must reject hallucinated voices like
 * "emerald" before they get persisted to `experience.json`. Without this
 * guard, the experience boots and OpenAI's Realtime API rejects the session
 * with a 400 ("Invalid value: 'emerald'..."), leaving educators stuck.
 */

import { MatterCompiler } from '../MatterCompiler';
import type { Experience, MatterCompilerContext } from '../types';

function makeContext(initial: Experience): {
  context: MatterCompilerContext;
  saved: { path: string; content: string }[];
} {
  const saved: { path: string; content: string }[] = [];
  let current = initial;

  const context = {
    getResourceContent: jest.fn(async (_id: string, path: string) => {
      if (path === 'experience.json') {
        return {
          content: JSON.stringify(current),
          contentType: 'application/json',
          isText: true,
        };
      }
      throw new Error(`unexpected resource ${path}`);
    }),
    createFile: jest.fn(async (_id: string, path: string, content: string) => {
      saved.push({ path, content });
      if (path === 'experience.json') {
        current = JSON.parse(content);
      }
    }),
    createDirectory: jest.fn(),
    listResources: jest.fn(),
  } as unknown as MatterCompilerContext;

  return { context, saved };
}

function emptyExperience(): Experience {
  return {
    version: '1',
    title: 'Test',
    description: '',
    resources: { scenes: [] },
    agents: {
      mentor: {
        name: 'Mentor',
        voice: 'shimmer',
        publicDescription: '',
        downstreamAgents: [],
      },
    },
    initialAgent: 'mentor',
  };
}

describe('MatterCompiler.modifyAgent voice validation', () => {
  let compiler: MatterCompiler;

  beforeEach(() => {
    compiler = MatterCompiler.getInstance();
  });

  it('rejects creating an agent with a hallucinated voice', async () => {
    const { context, saved } = makeContext(emptyExperience());

    await expect(
      compiler.modifyAgent(context, 'exp-1', {
        type: 'create',
        id: 'practice',
        data: {
          name: 'Practice',
          voice: 'emerald',
          publicDescription: '',
          downstreamAgents: [],
        },
      }),
    ).rejects.toThrow(/Invalid voice "emerald"/);

    expect(saved).toHaveLength(0);
  });

  it('rejects modifying an agent to a hallucinated voice', async () => {
    const { context, saved } = makeContext(emptyExperience());

    await expect(
      compiler.modifyAgent(context, 'exp-1', {
        type: 'modify',
        id: 'mentor',
        data: { voice: 'jade' },
      }),
    ).rejects.toThrow(/Invalid voice "jade"/);

    expect(saved).toHaveLength(0);
  });

  it('lists the supported voices in the error message', async () => {
    const { context } = makeContext(emptyExperience());

    await expect(
      compiler.modifyAgent(context, 'exp-1', {
        type: 'modify',
        id: 'mentor',
        data: { voice: 'emerald' },
      }),
    ).rejects.toThrow(/alloy.*ash.*ballad.*cedar.*coral.*echo.*marin.*sage.*shimmer.*verse/);
  });

  it('accepts a canonical voice on modify', async () => {
    const { context, saved } = makeContext(emptyExperience());

    await compiler.modifyAgent(context, 'exp-1', {
      type: 'modify',
      id: 'mentor',
      data: { voice: 'verse' },
    });

    expect(saved).toHaveLength(1);
    const persisted = JSON.parse(saved[0].content) as Experience;
    expect(persisted.agents.mentor.voice).toBe('verse');
  });

  it('accepts create when no voice is specified (legacy default flow)', async () => {
    const { context, saved } = makeContext(emptyExperience());

    await compiler.modifyAgent(context, 'exp-1', {
      type: 'create',
      id: 'practice',
      data: {
        name: 'Practice',
        publicDescription: '',
        downstreamAgents: [],
      },
    });

    expect(saved).toHaveLength(1);
    const persisted = JSON.parse(saved[0].content) as Experience;
    expect(persisted.agents.practice.voice).toBe('');
  });

  it('skips voice validation for a delete operation', async () => {
    const start = emptyExperience();
    start.agents.practice = {
      name: 'Practice',
      voice: 'shimmer',
      publicDescription: '',
      downstreamAgents: [],
    };
    const { context, saved } = makeContext(start);

    await compiler.modifyAgent(context, 'exp-1', {
      type: 'delete',
      id: 'practice',
    });

    expect(saved).toHaveLength(1);
    const persisted = JSON.parse(saved[0].content) as Experience;
    expect(persisted.agents.practice).toBeUndefined();
  });
});
