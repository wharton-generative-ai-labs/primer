/**
 * Tests for ToolRegistrationManager
 * 
 * Tests tool registration and retrieval for backend agents including:
 * - Registering all backend tool groups
 * - Getting tools for specific agent tool groups
 * - Formatting tools for AI providers
 */

import { ToolRegistrationManager } from '../ToolRegistrationManager';
import type { AgentConfig } from '../types';

// Mock the tool registration functions
jest.mock('@/app/lib/tools', () => ({
  registerBuiltinTools: jest.fn(),
  registerExperienceTools: jest.fn(),
  registerMatterCompilerTools: jest.fn(),
  registerImageGeneratorTools: jest.fn(),
  registerAnalyticsTools: jest.fn(),
}));

// Mock the groups module
jest.mock('@/app/lib/tools/groups', () => ({
  getToolsForGroups: jest.fn(),
  getToolsForNames: jest.fn(),
  expandToolSets: jest.fn(),
  getPresetToolSet: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('ToolRegistrationManager', () => {
  let mockRegisterBuiltinTools: jest.Mock;
  let mockRegisterExperienceTools: jest.Mock;
  let mockRegisterMatterCompilerTools: jest.Mock;
  let mockRegisterImageGeneratorTools: jest.Mock;
  let mockRegisterAnalyticsTools: jest.Mock;
  let mockGetToolsForGroups: jest.Mock;
  let mockGetToolsForNames: jest.Mock;
  let mockExpandToolSets: jest.Mock;
  let mockGetPresetToolSet: jest.Mock;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Get mock references
    const tools = await import('@/app/lib/tools');
    const groups = await import('@/app/lib/tools/groups');

    mockRegisterBuiltinTools = tools.registerBuiltinTools as jest.Mock;
    mockRegisterExperienceTools = tools.registerExperienceTools as jest.Mock;
    mockRegisterMatterCompilerTools = tools.registerMatterCompilerTools as jest.Mock;
    mockRegisterImageGeneratorTools = tools.registerImageGeneratorTools as jest.Mock;
    mockRegisterAnalyticsTools = tools.registerAnalyticsTools as jest.Mock;
    mockGetToolsForGroups = groups.getToolsForGroups as jest.Mock;
    mockGetToolsForNames = groups.getToolsForNames as jest.Mock;
    mockExpandToolSets = groups.expandToolSets as jest.Mock;
    mockGetPresetToolSet = groups.getPresetToolSet as jest.Mock;

    // Default implementations
    mockRegisterBuiltinTools.mockResolvedValue(undefined);
    mockRegisterExperienceTools.mockResolvedValue(undefined);
    mockRegisterMatterCompilerTools.mockResolvedValue(undefined);
    mockRegisterImageGeneratorTools.mockResolvedValue(undefined);
    mockRegisterAnalyticsTools.mockResolvedValue(undefined);
    
    // Default mock implementations for tool resolution
    mockGetToolsForNames.mockReturnValue([]);
    mockExpandToolSets.mockReturnValue([]);
    mockGetPresetToolSet.mockReturnValue([]);
  });

  describe('registerAllBackendTools', () => {
    it('should register all backend tool groups', async () => {
      await ToolRegistrationManager.registerAllBackendTools();

      expect(mockRegisterBuiltinTools).toHaveBeenCalledTimes(1);
      expect(mockRegisterExperienceTools).toHaveBeenCalledTimes(1);
      expect(mockRegisterMatterCompilerTools).toHaveBeenCalledTimes(1);
      expect(mockRegisterImageGeneratorTools).toHaveBeenCalledTimes(1);
      expect(mockRegisterAnalyticsTools).toHaveBeenCalledTimes(1);
    });

    it('should register tools in correct order', async () => {
      const callOrder: string[] = [];
      
      mockRegisterBuiltinTools.mockImplementation(async () => {
        callOrder.push('builtin');
      });
      mockRegisterExperienceTools.mockImplementation(async () => {
        callOrder.push('experience');
      });
      mockRegisterMatterCompilerTools.mockImplementation(async () => {
        callOrder.push('matter-compiler');
      });
      mockRegisterImageGeneratorTools.mockImplementation(async () => {
        callOrder.push('image-generator');
      });
      mockRegisterAnalyticsTools.mockImplementation(async () => {
        callOrder.push('analytics');
      });

      await ToolRegistrationManager.registerAllBackendTools();

      expect(callOrder).toEqual([
        'builtin',
        'experience',
        'matter-compiler',
        'image-generator',
        'analytics',
      ]);
    });

    it('should handle registration errors gracefully', async () => {
      mockRegisterBuiltinTools.mockRejectedValue(new Error('Registration failed'));

      await expect(
        ToolRegistrationManager.registerAllBackendTools()
      ).rejects.toThrow('Registration failed');
    });

    it('should propagate errors from any registration function', async () => {
      mockRegisterMatterCompilerTools.mockRejectedValue(new Error('Matter compiler registration failed'));

      await expect(
        ToolRegistrationManager.registerAllBackendTools()
      ).rejects.toThrow('Matter compiler registration failed');
    });
  });

  describe('getToolsForAgent', () => {
    const mockTools = [
      {
        name: 'artifact',
        description: 'Create or update artifacts',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string' },
          },
        },
      },
      {
        name: 'scene',
        description: 'Manage scenes',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string' },
          },
        },
      },
      {
        name: 'toast',
        description: 'Show toast messages',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    ];

    beforeEach(() => {
      mockGetToolsForGroups.mockReturnValue(mockTools);
    });

    describe('Default tool groups', () => {
      it('should use backend-default preset when not specified', async () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        mockGetPresetToolSet.mockReturnValue(['artifact', 'scene', 'toast']);
        mockGetToolsForNames.mockReturnValue([]);

        await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(mockGetPresetToolSet).toHaveBeenCalledWith('backend-default');
        expect(mockGetToolsForNames).toHaveBeenCalled();
      });

      it('should format tools correctly for OpenAI', async () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        const mockTools = [
          {
            name: 'artifact',
            description: 'Create or update artifacts',
            parameters: {
              type: 'object',
              properties: {
                content: { type: 'string' },
              },
            },
          },
        ];

        mockGetPresetToolSet.mockReturnValue(['artifact']);
        mockGetToolsForNames.mockReturnValue(mockTools);

        const result = await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          type: 'function',
          function: {
            name: 'artifact',
            description: 'Create or update artifacts',
            parameters: {
              type: 'object',
              properties: {
                content: { type: 'string' },
              },
            },
          },
        });
      });

      it('should include all tools from backend-default preset', async () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        const mockTools = [
          { name: 'artifact', description: 'Test', parameters: {} },
          { name: 'scene', description: 'Test', parameters: {} },
          { name: 'toast', description: 'Test', parameters: {} },
        ];

        mockGetPresetToolSet.mockReturnValue(['artifact', 'scene', 'toast']);
        mockGetToolsForNames.mockReturnValue(mockTools);

        const result = await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(result).toHaveLength(3);
        expect(result.map(t => t.function.name)).toEqual(['artifact', 'scene', 'toast']);
      });
    });

    describe('Custom tool groups', () => {
      it('should use custom tool groups when specified', async () => {
        const agentConfig: AgentConfig = {
          name: 'Custom Agent',
          aiConfiguration: 'default',
          toolGroups: ['builtin', 'analytics'],
        };

        await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(mockGetToolsForGroups).toHaveBeenCalledWith(['builtin', 'analytics']);
      });

      it('should handle single tool group', async () => {
        const agentConfig: AgentConfig = {
          name: 'Simple Agent',
          aiConfiguration: 'default',
          toolGroups: ['builtin'],
        };

        await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(mockGetToolsForGroups).toHaveBeenCalledWith(['builtin']);
      });

      it('should handle many tool groups', async () => {
        const agentConfig: AgentConfig = {
          name: 'Power Agent',
          aiConfiguration: 'default',
          toolGroups: [
            'builtin',
            'experience',
            'matter-compiler',
            'image-generator',
            'analytics',
            'delegation',
          ],
        };

        await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(mockGetToolsForGroups).toHaveBeenCalledWith([
          'builtin',
          'experience',
          'matter-compiler',
          'image-generator',
          'analytics',
          'delegation',
        ]);
      });

      it('should handle empty tool groups array', async () => {
        const agentConfig: AgentConfig = {
          name: 'No Tools Agent',
          aiConfiguration: 'default',
          toolGroups: [],
        };

        // Empty toolGroups falls back to backend-default preset
        mockGetPresetToolSet.mockReturnValue([]);
        mockGetToolsForNames.mockReturnValue([]);

        const result = await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(mockGetPresetToolSet).toHaveBeenCalledWith('backend-default');
        expect(result).toEqual([]);
      });
    });

    describe('Tool formatting', () => {
      it('should format each tool with type: function', async () => {
        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        const result = await ToolRegistrationManager.getToolsForAgent(agentConfig);

        result.forEach(tool => {
          expect(tool.type).toBe('function');
          expect(tool.function).toBeDefined();
          expect(tool.function.name).toBeDefined();
          expect(tool.function.description).toBeDefined();
          expect(tool.function.parameters).toBeDefined();
        });
      });

      it('should preserve tool names', async () => {
        const mockTools = [
          { name: 'artifact', description: 'Create or update artifacts', parameters: {} },
          { name: 'scene', description: 'Manage scenes', parameters: {} },
          { name: 'toast', description: 'Show toast messages', parameters: {} },
        ];

        mockGetPresetToolSet.mockReturnValue(['artifact', 'scene', 'toast']);
        mockGetToolsForNames.mockReturnValue(mockTools);

        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        const result = await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(result[0].function.name).toBe('artifact');
        expect(result[1].function.name).toBe('scene');
        expect(result[2].function.name).toBe('toast');
      });

      it('should preserve tool descriptions', async () => {
        const mockTools = [
          { name: 'artifact', description: 'Create or update artifacts', parameters: {} },
          { name: 'scene', description: 'Manage scenes', parameters: {} },
          { name: 'toast', description: 'Show toast messages', parameters: {} },
        ];

        mockGetPresetToolSet.mockReturnValue(['artifact', 'scene', 'toast']);
        mockGetToolsForNames.mockReturnValue(mockTools);

        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        const result = await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(result[0].function.description).toBe('Create or update artifacts');
        expect(result[1].function.description).toBe('Manage scenes');
        expect(result[2].function.description).toBe('Show toast messages');
      });

      it('should preserve tool parameters', async () => {
        const mockTools = [
          { 
            name: 'artifact', 
            description: 'Create or update artifacts', 
            parameters: {
              type: 'object',
              properties: {
                content: { type: 'string' },
              },
            }
          },
        ];

        mockGetPresetToolSet.mockReturnValue(['artifact']);
        mockGetToolsForNames.mockReturnValue(mockTools);

        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        const result = await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(result[0].function.parameters).toEqual({
          type: 'object',
          properties: {
            content: { type: 'string' },
          },
        });
      });

      it('should handle tools with complex parameters', async () => {
        const complexTool = {
          name: 'complexTool',
          description: 'A complex tool',
          parameters: {
            type: 'object',
            properties: {
              required: { type: 'string' },
              optional: { type: 'number' },
              nested: {
                type: 'object',
                properties: {
                  field: { type: 'boolean' },
                },
              },
            },
            required: ['required'],
          },
        };

        mockGetPresetToolSet.mockReturnValue(['complexTool']);
        mockGetToolsForNames.mockReturnValue([complexTool]);

        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        const result = await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(result[0].function.parameters).toEqual(complexTool.parameters);
      });
    });

    describe('Edge cases', () => {
      it('should handle tools with no parameters', async () => {
        const noParamTool = {
          name: 'noParamTool',
          description: 'A tool with no parameters',
          parameters: {},
        };

        mockGetPresetToolSet.mockReturnValue(['noParamTool']);
        mockGetToolsForNames.mockReturnValue([noParamTool]);

        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        const result = await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(result[0].function.parameters).toEqual({});
      });

      it('should handle tools with empty description', async () => {
        const emptyDescTool = {
          name: 'emptyDescTool',
          description: '',
          parameters: {},
        };

        mockGetPresetToolSet.mockReturnValue(['emptyDescTool']);
        mockGetToolsForNames.mockReturnValue([emptyDescTool]);

        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        const result = await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(result[0].function.description).toBe('');
      });

      it('should handle large number of tools', async () => {
        const manyTools = Array.from({ length: 50 }, (_, i) => ({
          name: `tool${i}`,
          description: `Tool ${i}`,
          parameters: { type: 'object' },
        }));

        const toolNames = manyTools.map(t => t.name);
        mockGetPresetToolSet.mockReturnValue(toolNames);
        mockGetToolsForNames.mockReturnValue(manyTools);

        const agentConfig: AgentConfig = {
          name: 'Test Agent',
          aiConfiguration: 'default',
        };

        const result = await ToolRegistrationManager.getToolsForAgent(agentConfig);

        expect(result).toHaveLength(50);
      });
    });
  });

  describe('initializeTools', () => {
    beforeEach(() => {
      const mockTool = {
        name: 'artifact',
        description: 'Create artifacts',
        parameters: {},
      };
      mockGetPresetToolSet.mockReturnValue(['artifact']);
      mockGetToolsForNames.mockReturnValue([mockTool]);
    });

    it('should register all tools and return agent tools', async () => {
      const agentConfig: AgentConfig = {
        name: 'Test Agent',
        aiConfiguration: 'default',
      };

      const result = await ToolRegistrationManager.initializeTools(agentConfig);

      expect(mockRegisterBuiltinTools).toHaveBeenCalledTimes(1);
      expect(mockRegisterExperienceTools).toHaveBeenCalledTimes(1);
      expect(mockRegisterMatterCompilerTools).toHaveBeenCalledTimes(1);
      expect(mockRegisterImageGeneratorTools).toHaveBeenCalledTimes(1);
      expect(mockRegisterAnalyticsTools).toHaveBeenCalledTimes(1);
      expect(mockGetPresetToolSet).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].function.name).toBe('artifact');
    });

    it('should register tools before getting agent tools', async () => {
      const callOrder: string[] = [];

      mockRegisterBuiltinTools.mockImplementation(async () => {
        callOrder.push('register');
      });

      mockGetPresetToolSet.mockImplementation(() => {
        callOrder.push('getTools');
        return [];
      });

      const agentConfig: AgentConfig = {
        name: 'Test Agent',
        aiConfiguration: 'default',
      };

      await ToolRegistrationManager.initializeTools(agentConfig);

      expect(callOrder[0]).toBe('register');
      expect(callOrder[callOrder.length - 1]).toBe('getTools');
    });

    it('should handle registration errors', async () => {
      mockRegisterBuiltinTools.mockRejectedValue(new Error('Registration failed'));

      const agentConfig: AgentConfig = {
        name: 'Test Agent',
        aiConfiguration: 'default',
      };

      await expect(
        ToolRegistrationManager.initializeTools(agentConfig)
      ).rejects.toThrow('Registration failed');
    });

    it('should work with custom tool groups', async () => {
      const agentConfig: AgentConfig = {
        name: 'Custom Agent',
        aiConfiguration: 'default',
        toolGroups: ['builtin', 'analytics'],
      };

      await ToolRegistrationManager.initializeTools(agentConfig);

      expect(mockGetToolsForGroups).toHaveBeenCalledWith(['builtin', 'analytics']);
    });

    it('should return formatted tools for AI provider', async () => {
      const mockTool = {
        name: 'testTool',
        description: 'Test tool',
        parameters: { type: 'object', properties: { test: { type: 'string' } } },
      };

      mockGetPresetToolSet.mockReturnValue(['testTool']);
      mockGetToolsForNames.mockReturnValue([mockTool]);

      const agentConfig: AgentConfig = {
        name: 'Test Agent',
        aiConfiguration: 'default',
      };

      const result = await ToolRegistrationManager.initializeTools(agentConfig);

      expect(result[0]).toEqual({
        type: 'function',
        function: {
          name: 'testTool',
          description: 'Test tool',
          parameters: { type: 'object', properties: { test: { type: 'string' } } },
        },
      });
    });
  });
});
