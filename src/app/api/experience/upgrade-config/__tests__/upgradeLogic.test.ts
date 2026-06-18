/**
 * Tests for experience.json upgrade logic
 */

import { upgradeConfig } from '../upgradeLogic';
import { ExperienceConfig } from '@/app/lib/types';

describe('upgradeConfig', () => {
  describe('configVersion handling', () => {
    it('should not modify already upgraded configs', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        configVersion: 2,
        title: 'Test',
        description: 'Test',
        agents: {},
        aiConfigurations: {}
      };

      const result = upgradeConfig(config);
      expect(result).toEqual(config);
    });

    it('should set configVersion to 2 for legacy configs', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        agents: {},
        aiConfigurations: {}
      };

      const result = upgradeConfig(config);
      expect(result.configVersion).toBe(2);
    });
  });

  describe('agent-level toolGroups conversion', () => {
    it('should convert agent toolGroups to custom toolSets', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          studentReport: {
            name: 'Student Report',
            type: 'backend',
            aiConfiguration: 'analytics',
            downstreamAgents: [],
            toolGroups: ['builtin', 'analytics']
          },
          classAnalytics: {
            name: 'Class Analytics',
            type: 'backend',
            aiConfiguration: 'analytics',
            downstreamAgents: [],
            toolGroups: ['builtin', 'analytics']
          }
        }
      };

      const result = upgradeConfig(config);

      // Should create custom toolSets for each agent
      expect(result.toolSets).toBeDefined();
      expect(result.toolSets!['studentReport-tools']).toBeDefined();
      expect(result.toolSets!['classAnalytics-tools']).toBeDefined();

      // Each toolSet should contain tools from both builtin and analytics groups
      const studentTools = result.toolSets!['studentReport-tools'];
      expect(studentTools).toContain('scene');
      expect(studentTools).toContain('information');
      expect(studentTools).toContain('listClassSessions');
      expect(studentTools).toContain('readSessionFile');

      // Agents should reference their custom toolSets
      expect(result.agents.studentReport.toolSets).toEqual(['studentReport-tools']);
      expect(result.agents.classAnalytics.toolSets).toEqual(['classAnalytics-tools']);

      // toolGroups should be removed
      expect(result.agents.studentReport.toolGroups).toBeUndefined();
      expect(result.agents.classAnalytics.toolGroups).toBeUndefined();
    });

    it('should handle single toolGroup', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          testAgent: {
            name: 'Test Agent',
            type: 'backend',
            aiConfiguration: 'test',
            downstreamAgents: [],
            toolGroups: ['analytics']
          }
        }
      };

      const result = upgradeConfig(config);

      expect(result.toolSets).toBeDefined();
      expect(result.toolSets!['testAgent-tools']).toBeDefined();
      
      const tools = result.toolSets!['testAgent-tools'];
      expect(tools).toContain('listClassSessions');
      expect(tools).toContain('readSessionFile');
      expect(tools).not.toContain('scene'); // builtin tools should not be included
    });

    it('should deduplicate tools when agent has multiple groups', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          testAgent: {
            name: 'Test Agent',
            type: 'frontend',
            aiConfiguration: 'test',
            downstreamAgents: [],
            toolGroups: ['builtin', 'builtin'] // duplicate group
          }
        }
      };

      const result = upgradeConfig(config);

      const tools = result.toolSets!['testAgent-tools'];
      // Should not have duplicates
      expect(tools.length).toBe(new Set(tools).size);
    });
  });

  describe('experience-level plugins conversion', () => {
    it('should convert plugins to default toolSet', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          mentor: {
            name: 'Mentor',
            type: 'frontend',
            aiConfiguration: 'test',
            downstreamAgents: []
          }
        },
        tools: {
          plugins: ['@primer/builtin-plugin', '@primer/slide-plugin']
        }
      };

      const result = upgradeConfig(config);

      // Should create default toolSet with tools from plugins
      expect(result.toolSets).toBeDefined();
      expect(result.toolSets!['default']).toBeDefined();
      
      const defaultTools = result.toolSets!['default'];
      expect(defaultTools).toContain('scene');
      expect(defaultTools).toContain('slide');

      // Should also create backend-default
      expect(result.toolSets!['backend-default']).toBeDefined();

      // Frontend agent should use default toolSet
      expect(result.agents.mentor.toolSets).toEqual(['default']);

      // tools.plugins should be removed
      expect(result.tools).toBeUndefined();
    });

    it('should assign backend-default to backend agents when using plugins', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          backendAgent: {
            name: 'Backend Agent',
            type: 'backend',
            aiConfiguration: 'test',
            downstreamAgents: []
          }
        },
        tools: {
          plugins: ['@primer/builtin-plugin']
        }
      };

      const result = upgradeConfig(config);

      // Backend agent should use backend-default
      expect(result.agents.backendAgent.toolSets).toEqual(['backend-default']);
    });
  });

  describe('mixed configurations', () => {
    it('should prioritize agent-level toolGroups over experience-level plugins', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          agentWithGroups: {
            name: 'Agent with Groups',
            type: 'backend',
            aiConfiguration: 'test',
            downstreamAgents: [],
            toolGroups: ['analytics'] // Specific toolGroups
          },
          agentWithoutGroups: {
            name: 'Agent without Groups',
            type: 'frontend',
            aiConfiguration: 'test',
            downstreamAgents: []
          }
        },
        tools: {
          plugins: ['@primer/builtin-plugin']
        }
      };

      const result = upgradeConfig(config);

      // Agent with toolGroups should get custom toolSet
      expect(result.agents.agentWithGroups.toolSets).toEqual(['agentWithGroups-tools']);
      expect(result.toolSets!['agentWithGroups-tools']).toContain('listClassSessions');

      // Agent without toolGroups should fall back to default
      expect(result.agents.agentWithoutGroups.toolSets).toEqual(['default']);
    });
  });

  describe('deprecated field removal', () => {
    it('should remove toolGroups from all agents', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          agent1: {
            name: 'Agent 1',
            type: 'frontend',
            aiConfiguration: 'test',
            downstreamAgents: [],
            toolGroups: ['builtin']
          }
        }
      };

      const result = upgradeConfig(config);
      expect(result.agents.agent1.toolGroups).toBeUndefined();
    });

    it('should remove availableTools from all agents', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          agent1: {
            name: 'Agent 1',
            type: 'frontend',
            aiConfiguration: 'test',
            downstreamAgents: [],
            availableTools: ['scene', 'information']
          }
        },
        tools: {
          plugins: ['@primer/builtin-plugin']
        }
      };

      const result = upgradeConfig(config);
      expect(result.agents.agent1.availableTools).toBeUndefined();
    });

    it('should remove tools.plugins', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          agent1: {
            name: 'Agent 1',
            type: 'frontend',
            aiConfiguration: 'test',
            downstreamAgents: []
          }
        },
        tools: {
          plugins: ['@primer/builtin-plugin']
        }
      };

      const result = upgradeConfig(config);
      expect(result.tools).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty toolGroups array', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          agent1: {
            name: 'Agent 1',
            type: 'backend',
            aiConfiguration: 'test',
            downstreamAgents: [],
            toolGroups: []
          }
        }
      };

      const result = upgradeConfig(config);
      
      // Should fall back to backend-default
      expect(result.agents.agent1.toolSets).toEqual(['backend-default']);
    });

    it('should handle agents with no tool configuration', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          agent1: {
            name: 'Agent 1',
            type: 'frontend',
            aiConfiguration: 'test',
            downstreamAgents: []
          }
        }
      };

      const result = upgradeConfig(config);
      
      // Should create both backend-default and default (from frontend-default) presets
      expect(result.toolSets).toBeDefined();
      expect(result.toolSets!['backend-default']).toBeDefined();
      expect(result.toolSets!['default']).toBeDefined();
      
      // Frontend agent should get 'default' toolSet (populated from frontend-default preset)
      expect(result.agents.agent1.toolSets).toEqual(['default']);
    });

    it('should not mutate original config', () => {
      const config: ExperienceConfig = {
        version: '1.0.0',
        title: 'Test',
        description: 'Test',
        aiConfigurations: {},
        agents: {
          agent1: {
            name: 'Agent 1',
            type: 'frontend',
            aiConfiguration: 'test',
            downstreamAgents: [],
            toolGroups: ['builtin']
          }
        }
      };

      const originalJson = JSON.stringify(config);
      upgradeConfig(config);
      const afterJson = JSON.stringify(config);

      expect(originalJson).toBe(afterJson);
    });
  });
});
