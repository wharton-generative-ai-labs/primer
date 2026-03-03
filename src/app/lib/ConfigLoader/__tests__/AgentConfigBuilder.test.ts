/**
 * Tests for AgentConfigBuilder
 */

import { AgentConfigBuilder } from '../AgentConfigBuilder';
import { InstructionProcessor } from '../InstructionProcessor';
import { ExperienceConfig } from '../../types';

// Mock InstructionProcessor
jest.mock('../InstructionProcessor');

// Mock the groups module
jest.mock('../../tools/groups', () => ({
  expandToolSets: jest.fn((toolSetNames: string[], customToolSets?: Record<string, string[]>) => {
    // Simple mock implementation
    if (customToolSets) {
      const tools = toolSetNames.flatMap(name => customToolSets[name] || []);
      return [...new Set(tools)];
    }
    return [];
  }),
  getToolNamesForGroup: jest.fn((groupName: string) => {
    const mockGroups: Record<string, string[]> = {
      'builtin': ['scene', 'information', 'file'],
      'celebrate': ['celebrate']
    };
    return mockGroups[groupName] || [];
  })
}));

describe('AgentConfigBuilder', () => {
  let builder: AgentConfigBuilder;
  let mockInstructionProcessor: jest.Mocked<InstructionProcessor>;

  beforeEach(() => {
    mockInstructionProcessor = {
      processInstructions: jest.fn().mockResolvedValue('Mock instructions')
    } as any;

    builder = new AgentConfigBuilder(mockInstructionProcessor);
  });

  describe('computeAvailableTools', () => {
    it('should use explicit availableTools if provided (legacy)', async () => {
      const experienceConfig: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        resources: {
          scenes: [],
          sounds: [],
          instructions: { agent: {}, supplemental: {} }
        },
        agents: {
          testAgent: {
            name: 'Test Agent',
            publicDescription: 'Test',
            availableTools: ['scene', 'information'],
            downstreamAgents: []
          }
        }
      };

      const config = await builder.buildAgentConfig('testAgent', experienceConfig.agents.testAgent, experienceConfig);

      expect(config.availableTools).toEqual(['scene', 'information']);
    });

    it('should compute availableTools from toolSets (configVersion 2)', async () => {
      const experienceConfig: ExperienceConfig = {
        version: '1.0.0',
        configVersion: 2,
        title: 'Test',
        description: 'Test',
        resources: {
          scenes: [],
          sounds: [],
          instructions: { agent: {}, supplemental: {} }
        },
        toolSets: {
          'default': ['scene', 'information', 'file', 'artifact'],
          'minimal': ['scene', 'toast']
        },
        agents: {
          testAgent: {
            name: 'Test Agent',
            publicDescription: 'Test',
            toolSets: ['default'],
            downstreamAgents: []
          }
        }
      };

      const config = await builder.buildAgentConfig('testAgent', experienceConfig.agents.testAgent, experienceConfig);

      expect(config.availableTools).toEqual(['scene', 'information', 'file', 'artifact']);
      expect(config.toolSets).toEqual(['default']);
    });

    it('should compute availableTools from toolGroups (legacy)', async () => {
      const experienceConfig: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        resources: {
          scenes: [],
          sounds: [],
          instructions: { agent: {}, supplemental: {} }
        },
        agents: {
          testAgent: {
            name: 'Test Agent',
            publicDescription: 'Test',
            toolGroups: ['builtin', 'celebrate'],
            downstreamAgents: []
          }
        }
      };

      const config = await builder.buildAgentConfig('testAgent', experienceConfig.agents.testAgent, experienceConfig);

      // Should get tools from both groups, deduplicated
      expect(config.availableTools).toEqual(['scene', 'information', 'file', 'celebrate']);
      expect(config.toolGroups).toEqual(['builtin', 'celebrate']);
    });

    it('should return undefined availableTools if no tool configuration', async () => {
      const experienceConfig: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        resources: {
          scenes: [],
          sounds: [],
          instructions: { agent: {}, supplemental: {} }
        },
        agents: {
          testAgent: {
            name: 'Test Agent',
            publicDescription: 'Test',
            downstreamAgents: []
          }
        }
      };

      const config = await builder.buildAgentConfig('testAgent', experienceConfig.agents.testAgent, experienceConfig);

      expect(config.availableTools).toBeUndefined();
    });

    it('should prioritize availableTools over toolSets', async () => {
      const experienceConfig: ExperienceConfig = {
        version: '1.0.0',
        configVersion: 2,
        title: 'Test',
        description: 'Test',
        resources: {
          scenes: [],
          sounds: [],
          instructions: { agent: {}, supplemental: {} }
        },
        toolSets: {
          'default': ['scene', 'information', 'file']
        },
        agents: {
          testAgent: {
            name: 'Test Agent',
            publicDescription: 'Test',
            availableTools: ['scene'], // Explicit override
            toolSets: ['default'],
            downstreamAgents: []
          }
        }
      };

      const config = await builder.buildAgentConfig('testAgent', experienceConfig.agents.testAgent, experienceConfig);

      // Should use explicit availableTools, not compute from toolSets
      expect(config.availableTools).toEqual(['scene']);
    });

    it('should deduplicate tools from multiple toolSets', async () => {
      const experienceConfig: ExperienceConfig = {
        version: '1.0.0',
        configVersion: 2,
        title: 'Test',
        description: 'Test',
        resources: {
          scenes: [],
          sounds: [],
          instructions: { agent: {}, supplemental: {} }
        },
        toolSets: {
          'set1': ['scene', 'information', 'file'],
          'set2': ['scene', 'toast', 'artifact'] // 'scene' is duplicate
        },
        agents: {
          testAgent: {
            name: 'Test Agent',
            publicDescription: 'Test',
            toolSets: ['set1', 'set2'],
            downstreamAgents: []
          }
        }
      };

      const config = await builder.buildAgentConfig('testAgent', experienceConfig.agents.testAgent, experienceConfig);

      // Should deduplicate 'scene'
      expect(config.availableTools).toEqual(['scene', 'information', 'file', 'toast', 'artifact']);
    });
  });
});
