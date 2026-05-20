/**
 * Tests for ExperienceConfigLoader
 * 
 * Tests loading and parsing of experience configurations including:
 * - Loading experience.json
 * - Finding agent configurations
 * - Loading agent instructions
 * - Resolving AI configurations
 */

import { ExperienceConfigLoader } from '../ExperienceConfigLoader';
import type { ExperienceConfig, AgentConfig } from '../types';

// Mock the file system and path modules
jest.mock('fs/promises');
jest.mock('path');
jest.mock('@/app/lib/file-utils');
jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('ExperienceConfigLoader', () => {
  describe('findAgentConfig', () => {
    const mockConfig: ExperienceConfig = {
      id: 'test-experience',
      name: 'Test Experience',
      agents: {
        'assistant': {
          name: 'Assistant',
          publicDescription: 'A helpful assistant',
          aiConfiguration: 'default',
        },
        'tutor': {
          name: 'Math Tutor',
          publicDescription: 'Helps with math problems',
          aiConfiguration: 'default',
        },
        'coder': {
          name: 'Code Helper',
          publicDescription: 'Assists with coding tasks',
          aiConfiguration: 'default',
        },
      },
      aiConfigurations: {},
      resources: {},
    };

    describe('Finding agents by name', () => {
      it('should find agent by exact name match', () => {
        const result = ExperienceConfigLoader.findAgentConfig(mockConfig, 'Assistant');
        
        expect(result).not.toBeNull();
        expect(result?.agentKey).toBe('assistant');
        expect(result?.agentConfig.name).toBe('Assistant');
      });

      it('should find agent by key match', () => {
        const result = ExperienceConfigLoader.findAgentConfig(mockConfig, 'tutor');
        
        expect(result).not.toBeNull();
        expect(result?.agentKey).toBe('tutor');
        expect(result?.agentConfig.name).toBe('Math Tutor');
      });

      it('should not match by description substring', () => {
        const result = ExperienceConfigLoader.findAgentConfig(mockConfig, 'coding');
        
        expect(result).toBeNull();
      });

      it('should be case-insensitive for name matching', () => {
        const result = ExperienceConfigLoader.findAgentConfig(mockConfig, 'assistant');
        
        expect(result).not.toBeNull();
        expect(result?.agentKey).toBe('assistant');
      });

      it('should match name regardless of casing', () => {
        const result = ExperienceConfigLoader.findAgentConfig(mockConfig, 'math tutor');
        
        expect(result).not.toBeNull();
        expect(result?.agentKey).toBe('tutor');
        expect(result?.agentConfig.name).toBe('Math Tutor');
      });
    });

    describe('Agent not found scenarios', () => {
      it('should return null when agent does not exist', () => {
        const result = ExperienceConfigLoader.findAgentConfig(mockConfig, 'nonexistent');
        
        expect(result).toBeNull();
      });

      it('should return null when agents object is empty', () => {
        const emptyConfig: ExperienceConfig = {
          id: 'empty',
          name: 'Empty',
          agents: {},
          aiConfigurations: {},
          resources: {},
        };
        
        const result = ExperienceConfigLoader.findAgentConfig(emptyConfig, 'any');
        
        expect(result).toBeNull();
      });

      it('should return null when agents object is undefined', () => {
        const noAgentsConfig: ExperienceConfig = {
          id: 'no-agents',
          name: 'No Agents',
          aiConfigurations: {},
          resources: {},
        };
        
        const result = ExperienceConfigLoader.findAgentConfig(noAgentsConfig, 'any');
        
        expect(result).toBeNull();
      });
    });

    describe('Priority of matching', () => {
      it('should prioritize name match over key match', () => {
        const configWithOverlap: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {
            'coding': {
              name: 'Helper',
              aiConfiguration: 'default',
            },
            'helper': {
              name: 'Coding',
              aiConfiguration: 'default',
            },
          },
          aiConfigurations: {},
          resources: {},
        };
        
        const result = ExperienceConfigLoader.findAgentConfig(configWithOverlap, 'Coding');
        
        // Should find 'helper' by name match, not 'coding' by key
        expect(result?.agentKey).toBe('helper');
      });

      it('should prioritize name match over key match', () => {
        const configWithOverlap: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {
            'helper': {
              name: 'Assistant',
              publicDescription: 'Helps users',
              aiConfiguration: 'default',
            },
            'assistant': {
              name: 'Helper',
              publicDescription: 'General helper',
              aiConfiguration: 'default',
            },
          },
          aiConfigurations: {},
          resources: {},
        };
        
        const result = ExperienceConfigLoader.findAgentConfig(configWithOverlap, 'Assistant');
        
        // Should find 'helper' agent by name match, not 'assistant' by key
        expect(result?.agentKey).toBe('helper');
        expect(result?.agentConfig.name).toBe('Assistant');
      });
    });

    describe('Edge cases', () => {
      it('should handle agents with no publicDescription', () => {
        const configNoDesc: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {
            'simple': {
              name: 'Simple Agent',
              aiConfiguration: 'default',
            },
          },
          aiConfigurations: {},
          resources: {},
        };
        
        const result = ExperienceConfigLoader.findAgentConfig(configNoDesc, 'Simple Agent');
        
        expect(result).not.toBeNull();
        expect(result?.agentKey).toBe('simple');
      });

      it('should return null for empty string agent type', () => {
        const result = ExperienceConfigLoader.findAgentConfig(mockConfig, '');
        
        expect(result).toBeNull();
      });

      it('should handle whitespace in agent type', () => {
        const result = ExperienceConfigLoader.findAgentConfig(mockConfig, '  Assistant  ');
        
        // Should not match due to whitespace
        expect(result).toBeNull();
      });
    });
  });

  describe('getAIConfiguration', () => {
    const mockConfig: ExperienceConfig = {
      id: 'test',
      name: 'Test',
      agents: {},
      aiConfigurations: {
        'default': {
          provider: 'openai',
          model: 'gpt-4',
        },
        'anthropic': {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
        },
        'custom': {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
        },
      },
      resources: {},
    };

    describe('AI configuration resolution', () => {
      it('should resolve default AI configuration', () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };
        
        const result = ExperienceConfigLoader.getAIConfiguration(mockConfig, agentConfig);
        
        expect(result.aiConfig).toEqual({
          provider: 'openai',
          model: 'gpt-4',
        });
        expect(result.temperature).toBeUndefined();
      });

      it('should resolve custom AI configuration', () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'anthropic',
        };
        
        const result = ExperienceConfigLoader.getAIConfiguration(mockConfig, agentConfig);
        
        expect(result.aiConfig).toEqual({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
        });
      });

      it('should use default when aiConfiguration is undefined', () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
        };
        
        const result = ExperienceConfigLoader.getAIConfiguration(mockConfig, agentConfig);
        
        expect(result.aiConfig).toEqual({
          provider: 'openai',
          model: 'gpt-4',
        });
      });

      it('should return undefined aiConfig when configuration does not exist', () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'nonexistent',
        };
        
        const result = ExperienceConfigLoader.getAIConfiguration(mockConfig, agentConfig);
        
        expect(result.aiConfig).toBeUndefined();
      });
    });

    describe('Temperature handling', () => {
      it('should use agent-specific temperature when provided', () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
          temperature: 0.5,
        };
        
        const result = ExperienceConfigLoader.getAIConfiguration(mockConfig, agentConfig);
        
        expect(result.temperature).toBe(0.5);
      });

      it('should leave temperature undefined when not specified, so providers use their model default', () => {
        // Some models (gpt-5, o-series) reject any explicit temperature, so
        // hardcoding a fallback would 400 every delegation. Authors who want
        // a specific value declare it on the agent.
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        const result = ExperienceConfigLoader.getAIConfiguration(mockConfig, agentConfig);

        expect(result.temperature).toBeUndefined();
      });

      it('should handle temperature of 0', () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
          temperature: 0,
        };
        
        const result = ExperienceConfigLoader.getAIConfiguration(mockConfig, agentConfig);
        
        expect(result.temperature).toBe(0);
      });

      it('should handle temperature of 1', () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
          temperature: 1,
        };
        
        const result = ExperienceConfigLoader.getAIConfiguration(mockConfig, agentConfig);
        
        expect(result.temperature).toBe(1);
      });

      it('should handle temperature of 2', () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
          temperature: 2,
        };
        
        const result = ExperienceConfigLoader.getAIConfiguration(mockConfig, agentConfig);
        
        expect(result.temperature).toBe(2);
      });
    });

    describe('Edge cases', () => {
      it('should handle missing aiConfigurations object', () => {
        const configNoAI: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {},
          resources: {},
        };
        
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };
        
        const result = ExperienceConfigLoader.getAIConfiguration(configNoAI, agentConfig);
        
        expect(result.aiConfig).toBeUndefined();
        expect(result.temperature).toBeUndefined();
      });

      it('should handle empty aiConfigurations object', () => {
        const configEmptyAI: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {},
          aiConfigurations: {},
          resources: {},
        };
        
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };
        
        const result = ExperienceConfigLoader.getAIConfiguration(configEmptyAI, agentConfig);
        
        expect(result.aiConfig).toBeUndefined();
        expect(result.temperature).toBeUndefined();
      });
    });
  });

  describe('loadExperienceConfig', () => {
    let mockReadFile: jest.Mock;
    let mockGetExperienceFolder: jest.Mock;
    let mockPathJoin: jest.Mock;

    beforeEach(async () => {
      // Reset mocks
      jest.clearAllMocks();

      // Setup mocks
      const fs = await import('fs/promises');
      const path = await import('path');
      const fileUtils = await import('@/app/lib/file-utils');

      mockReadFile = fs.readFile as jest.Mock;
      mockGetExperienceFolder = fileUtils.getExperienceFolder as jest.Mock;
      mockPathJoin = path.join as jest.Mock;

      // Default mock implementations
      mockGetExperienceFolder.mockResolvedValue('/mock/path/to/experience');
      mockPathJoin.mockImplementation((...args) => args.join('/'));
    });

    describe('Successful loading', () => {
      it('should load valid experience configuration', async () => {
        const mockExperienceConfig = {
          id: 'test-exp',
          name: 'Test Experience',
          agents: {
            'agent1': {
              name: 'Agent 1',
              aiConfiguration: 'default',
            },
          },
          aiConfigurations: {
            'default': {
              provider: 'openai',
              model: 'gpt-4',
            },
          },
          resources: {},
        };

        mockReadFile.mockResolvedValue(JSON.stringify(mockExperienceConfig));

        const result = await ExperienceConfigLoader.loadExperienceConfig('test-exp');

        expect(mockGetExperienceFolder).toHaveBeenCalledWith('test-exp');
        expect(mockPathJoin).toHaveBeenCalledWith('/mock/path/to/experience', 'experience.json');
        expect(mockReadFile).toHaveBeenCalledWith('/mock/path/to/experience/experience.json', 'utf-8');
        expect(result).toEqual(mockExperienceConfig);
      });

      it('should load experience with multiple agents', async () => {
        const mockConfig = {
          id: 'multi-agent',
          name: 'Multi Agent Experience',
          agents: {
            'agent1': { name: 'Agent 1', aiConfiguration: 'default' },
            'agent2': { name: 'Agent 2', aiConfiguration: 'default' },
            'agent3': { name: 'Agent 3', aiConfiguration: 'custom' },
          },
          aiConfigurations: {},
          resources: {},
        };

        mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));

        const result = await ExperienceConfigLoader.loadExperienceConfig('multi-agent');

        expect(result.agents).toHaveProperty('agent1');
        expect(result.agents).toHaveProperty('agent2');
        expect(result.agents).toHaveProperty('agent3');
        expect(Object.keys(result.agents || {})).toHaveLength(3);
      });

      it('should load experience with no agents', async () => {
        const mockConfig = {
          id: 'no-agents',
          name: 'No Agents Experience',
          agents: {},
          aiConfigurations: {},
          resources: {},
        };

        mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));

        const result = await ExperienceConfigLoader.loadExperienceConfig('no-agents');

        expect(result.agents).toEqual({});
      });
    });

    describe('Error handling', () => {
      it('should throw error when file does not exist', async () => {
        mockReadFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

        await expect(
          ExperienceConfigLoader.loadExperienceConfig('nonexistent')
        ).rejects.toThrow('Failed to load experience configuration');
      });

      it('should throw error when JSON is invalid', async () => {
        mockReadFile.mockResolvedValue('{ invalid json }');

        await expect(
          ExperienceConfigLoader.loadExperienceConfig('invalid-json')
        ).rejects.toThrow('Failed to load experience configuration');
      });

      it('should throw error when file is empty', async () => {
        mockReadFile.mockResolvedValue('');

        await expect(
          ExperienceConfigLoader.loadExperienceConfig('empty')
        ).rejects.toThrow('Failed to load experience configuration');
      });

      it('should throw error when getExperienceFolder fails', async () => {
        mockGetExperienceFolder.mockRejectedValue(new Error('Folder not found'));

        await expect(
          ExperienceConfigLoader.loadExperienceConfig('bad-folder')
        ).rejects.toThrow('Folder not found');
      });
    });
  });

  describe('loadAgentInstructions', () => {
    let mockReadFile: jest.Mock;
    let mockGetExperienceFolder: jest.Mock;
    let mockPathJoin: jest.Mock;

    beforeEach(async () => {
      jest.clearAllMocks();

      const fs = await import('fs/promises');
      const path = await import('path');
      const fileUtils = await import('@/app/lib/file-utils');

      mockReadFile = fs.readFile as jest.Mock;
      mockGetExperienceFolder = fileUtils.getExperienceFolder as jest.Mock;
      mockPathJoin = path.join as jest.Mock;

      mockGetExperienceFolder.mockResolvedValue('/mock/experience');
      mockPathJoin.mockImplementation((...args) => args.join('/'));
    });

    describe('Successful loading', () => {
      it('should load agent instructions from file', async () => {
        const mockConfig: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {},
          aiConfigurations: {},
          resources: {
            instructions: {
              agent: {
                'agent1': 'instructions/agent1.txt',
              },
            },
          },
        };

        const mockInstructions = 'You are a helpful assistant. Follow these instructions...';
        mockReadFile.mockResolvedValue(mockInstructions);

        const result = await ExperienceConfigLoader.loadAgentInstructions('test-exp', mockConfig, 'agent1');

        expect(mockGetExperienceFolder).toHaveBeenCalledWith('test-exp');
        expect(mockPathJoin).toHaveBeenCalledWith('/mock/experience', 'instructions/agent1.txt');
        expect(mockReadFile).toHaveBeenCalledWith('/mock/experience/instructions/agent1.txt', 'utf-8');
        expect(result).toBe(mockInstructions);
      });

      it('should load instructions from nested path', async () => {
        const mockConfig: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {},
          aiConfigurations: {},
          resources: {
            instructions: {
              agent: {
                'agent1': 'prompts/agents/detailed/agent1-instructions.md',
              },
            },
          },
        };

        mockReadFile.mockResolvedValue('Detailed instructions...');

        const result = await ExperienceConfigLoader.loadAgentInstructions('test-exp', mockConfig, 'agent1');

        expect(mockPathJoin).toHaveBeenCalledWith('/mock/experience', 'prompts/agents/detailed/agent1-instructions.md');
        expect(result).toBe('Detailed instructions...');
      });

      it('should handle empty instructions file', async () => {
        const mockConfig: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {},
          aiConfigurations: {},
          resources: {
            instructions: {
              agent: {
                'agent1': 'instructions/empty.txt',
              },
            },
          },
        };

        mockReadFile.mockResolvedValue('');

        const result = await ExperienceConfigLoader.loadAgentInstructions('test-exp', mockConfig, 'agent1');

        expect(result).toBe('');
      });
    });

    describe('Error handling', () => {
      it('should throw error when instruction path is not found', async () => {
        const mockConfig: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {},
          aiConfigurations: {},
          resources: {
            instructions: {
              agent: {},
            },
          },
        };

        await expect(
          ExperienceConfigLoader.loadAgentInstructions('test-exp', mockConfig, 'nonexistent')
        ).rejects.toThrow('No instructions found for agent "nonexistent"');
      });

      it('should throw error when resources.instructions is undefined', async () => {
        const mockConfig: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {},
          aiConfigurations: {},
          resources: {},
        };

        await expect(
          ExperienceConfigLoader.loadAgentInstructions('test-exp', mockConfig, 'agent1')
        ).rejects.toThrow('No instructions found for agent "agent1"');
      });

      it('should throw error when resources.instructions.agent is undefined', async () => {
        const mockConfig: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {},
          aiConfigurations: {},
          resources: {
            instructions: {},
          },
        };

        await expect(
          ExperienceConfigLoader.loadAgentInstructions('test-exp', mockConfig, 'agent1')
        ).rejects.toThrow('No instructions found for agent "agent1"');
      });

      it('should throw error when file read fails', async () => {
        const mockConfig: ExperienceConfig = {
          id: 'test',
          name: 'Test',
          agents: {},
          aiConfigurations: {},
          resources: {
            instructions: {
              agent: {
                'agent1': 'instructions/agent1.txt',
              },
            },
          },
        };

        mockReadFile.mockRejectedValue(new Error('ENOENT: file not found'));

        await expect(
          ExperienceConfigLoader.loadAgentInstructions('test-exp', mockConfig, 'agent1')
        ).rejects.toThrow('Failed to load agent instructions');
      });
    });
  });

  describe('loadExperience — agent-not-found error message', () => {
    let mockReadFile: jest.Mock;
    let mockGetExperienceFolder: jest.Mock;
    let mockPathJoin: jest.Mock;

    beforeEach(async () => {
      jest.clearAllMocks();
      const fs = await import('fs/promises');
      const path = await import('path');
      const fileUtils = await import('@/app/lib/file-utils');
      mockReadFile = fs.readFile as jest.Mock;
      mockGetExperienceFolder = fileUtils.getExperienceFolder as jest.Mock;
      mockPathJoin = path.join as jest.Mock;
      mockGetExperienceFolder.mockResolvedValue('/mock/path');
      mockPathJoin.mockImplementation((...args) => args.join('/'));
    });

    function mockConfig(agents: Record<string, Partial<AgentConfig>>) {
      mockReadFile.mockResolvedValue(JSON.stringify({
        id: 'test',
        name: 'Test',
        agents,
        aiConfigurations: {},
        resources: {},
      }));
    }

    it('flags a tool name (artifact) called as agentType with a tool-vs-agent hint', async () => {
      mockConfig({
        'design-agent': { name: 'Design Agent', aiConfiguration: 'default' },
      });
      await expect(
        ExperienceConfigLoader.loadExperience('test', 'artifact'),
      ).rejects.toThrow(/built-in tool, not a sub-agent.*artifact\(\.\.\.\) directly/);
    });

    it('lists available agents in the error when the name is unknown', async () => {
      mockConfig({
        'design-agent': { name: 'Design Agent', aiConfiguration: 'default' },
        'casting-director': { name: 'Casting Director', aiConfiguration: 'default' },
      });
      await expect(
        ExperienceConfigLoader.loadExperience('test', 'mystery-agent'),
      ).rejects.toThrow(/Available agents: design-agent, casting-director/);
    });

    it('does not include a tool hint when the name is just an unknown agent', async () => {
      mockConfig({
        'design-agent': { name: 'Design Agent', aiConfiguration: 'default' },
      });
      await expect(
        ExperienceConfigLoader.loadExperience('test', 'mystery'),
      ).rejects.toThrow(/^No agent found matching "mystery"\. Available agents: design-agent\.$/);
    });

    it('says no agents declared when the agents block is empty', async () => {
      mockConfig({});
      await expect(
        ExperienceConfigLoader.loadExperience('test', 'anything'),
      ).rejects.toThrow(/declares no agents/);
    });
  });
});
