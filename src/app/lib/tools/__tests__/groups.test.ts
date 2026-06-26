/**
 * Tests for Tool Groups
 * 
 * Focuses on v2 toolSets API. Legacy v1 functions are minimally tested
 * since they're only used for config upgrades.
 */

import {
  getPresetToolSet,
  getPresetToolSetNames,
  expandToolSets,
  getToolsForNames,
  // Legacy (v1) - minimal tests
  pluginNamesToGroups,
  getToolNamesForGroup,
} from '../groups';
import { ToolRegistry } from '@/app/lib/ToolRegistry';
import type { Tool } from '@/app/lib/types';

jest.mock('@/app/lib/ToolRegistry');

describe('Tool Groups', () => {
  // ==========================================================================
  // V2 API: Preset ToolSets
  // ==========================================================================
  
  describe('getPresetToolSet', () => {
    it('should return default toolSet', () => {
      const result = getPresetToolSet('default');
      
      expect(result).toBeDefined();
      expect(result).toContain('scene');
      expect(result).toContain('information');
      expect(result).toContain('artifact');
      expect(result).toContain('slide');
      expect(result).toContain('note');
    });

    it('should return frontend-default toolSet', () => {
      const result = getPresetToolSet('frontend-default');
      
      expect(result).toBeDefined();
      expect(result).toContain('celebrate');
      expect(result).toContain('research');
      expect(result).not.toContain('delegate');
    });

    it('should return backend-default toolSet with experience tools', () => {
      const result = getPresetToolSet('backend-default');
      
      expect(result).toBeDefined();
      expect(result).toContain('createExperience');
      expect(result).toContain('modifyExperience');
      expect(result).toContain('generateImages');
    });

    it('should return minimal toolSet', () => {
      const result = getPresetToolSet('minimal');
      
      expect(result).toEqual(['scene', 'information', 'toast']);
    });

    it('should return undefined for unknown toolSet', () => {
      const result = getPresetToolSet('nonexistent');
      
      expect(result).toBeUndefined();
    });
  });

  describe('getPresetToolSetNames', () => {
    it('should return all preset names', () => {
      const result = getPresetToolSetNames();
      
      expect(result).toContain('default');
      expect(result).toContain('frontend-default');
      expect(result).toContain('backend-default');
      expect(result).toContain('minimal');
    });
  });

  // ==========================================================================
  // V2 API: expandToolSets
  // ==========================================================================

  describe('expandToolSets', () => {
    it('should expand a single preset toolSet', () => {
      const result = expandToolSets(['minimal']);
      
      expect(result).toEqual(['scene', 'information', 'toast']);
    });

    it('should expand multiple preset toolSets and deduplicate', () => {
      const result = expandToolSets(['minimal', 'default']);
      
      // Should have all tools from both, deduplicated
      expect(result).toContain('scene');
      expect(result).toContain('information');
      expect(result).toContain('toast');
      expect(result).toContain('artifact');
      // No duplicates
      expect(result.filter(t => t === 'scene').length).toBe(1);
    });

    it('should use custom toolSets over presets', () => {
      const customToolSets = {
        'default': ['custom-tool-1', 'custom-tool-2']
      };
      
      const result = expandToolSets(['default'], customToolSets);
      
      expect(result).toEqual(['custom-tool-1', 'custom-tool-2']);
    });

    it('should combine custom and preset toolSets', () => {
      const customToolSets = {
        'my-tools': ['tool-a', 'tool-b']
      };
      
      const result = expandToolSets(['my-tools', 'minimal'], customToolSets);
      
      expect(result).toContain('tool-a');
      expect(result).toContain('tool-b');
      expect(result).toContain('scene');
    });

    it('should throw error for unknown toolSet', () => {
      expect(() => expandToolSets(['nonexistent']))
        .toThrow('ToolSet(s) not found: nonexistent');
    });

    it('should list available toolSets in error message', () => {
      try {
        expandToolSets(['bad-name']);
      } catch (e) {
        expect((e as Error).message).toContain('default');
        expect((e as Error).message).toContain('frontend-default');
      }
    });

    it('should handle empty array', () => {
      const result = expandToolSets([]);
      
      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // V2 API: getToolsForNames
  // ==========================================================================

  describe('getToolsForNames', () => {
    let mockRegistry: jest.Mocked<ToolRegistry>;

    beforeEach(() => {
      mockRegistry = {
        getTool: jest.fn(),
      } as unknown as jest.Mocked<ToolRegistry>;
      jest.spyOn(ToolRegistry, 'getInstance').mockReturnValue(mockRegistry);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should get tools from registry', () => {
      const mockTool: Tool = {
        type: 'function',
        name: 'scene',
        description: 'Scene tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };
      mockRegistry.getTool.mockReturnValue(mockTool);

      const result = getToolsForNames(['scene', 'information']);

      expect(mockRegistry.getTool).toHaveBeenCalledWith('scene');
      expect(mockRegistry.getTool).toHaveBeenCalledWith('information');
      expect(result.length).toBe(2);
    });

    it('should deduplicate tool names', () => {
      const mockTool: Tool = {
        type: 'function',
        name: 'scene',
        description: 'Scene tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };
      mockRegistry.getTool.mockReturnValue(mockTool);

      const result = getToolsForNames(['scene', 'scene', 'scene']);

      expect(mockRegistry.getTool).toHaveBeenCalledTimes(1);
      expect(result.length).toBe(1);
    });

    it('should filter out null results', () => {
      mockRegistry.getTool.mockImplementation((name) => {
        if (name === 'scene') {
          return {
            type: 'function',
            name: 'scene',
            description: 'Scene',
            parameters: { type: 'object', properties: {}, required: [] }
          };
        }
        return null;
      });

      const result = getToolsForNames(['scene', 'nonexistent']);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('scene');
    });

    it('should handle empty array', () => {
      const result = getToolsForNames([]);

      expect(result).toEqual([]);
      expect(mockRegistry.getTool).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Legacy API (v1) - Minimal tests for upgrade support
  // ==========================================================================

  describe('Legacy v1 API', () => {
    it('pluginNamesToGroups should convert plugins to groups', () => {
      const result = pluginNamesToGroups([
        '@primer/builtin-plugin',
        '@primer/celebrate-plugin'
      ]);

      expect(result).toEqual(['builtin', 'celebrate']);
    });

    it('pluginNamesToGroups should deduplicate', () => {
      const result = pluginNamesToGroups([
        '@primer/builtin-plugin',
        '@primer/slide-plugin' // Also maps to builtin
      ]);

      expect(result).toEqual(['builtin']);
    });

    it('getToolNamesForGroup should return tools for group', () => {
      const result = getToolNamesForGroup('builtin');

      expect(result).toContain('scene');
      expect(result).toContain('information');
      expect(result).toContain('artifact');
    });

    it('getToolNamesForGroup should return empty for unknown group', () => {
      const result = getToolNamesForGroup('nonexistent');

      expect(result).toEqual([]);
    });
  });
});
