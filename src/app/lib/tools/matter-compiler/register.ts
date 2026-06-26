'use server';

/**
 * Registration function for matter compiler tools.
 * This is in a separate file to follow the same pattern as builtin tools.
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import {
  modifyExperience,
  modifyAgent,
  modifyScene,
  getExperience,
  createAgentPrompt,
  createSupplementalFile,
  addSound,
  listAgentPrompts,
  getAgentPrompt,
  listSupplementalFiles,
  getSupplementalFile
} from './matter-compiler';

/**
 * Register all matter compiler tools with the ToolRegistry.
 * This should be called during application initialization.
 */
export async function registerMatterCompilerTools(): Promise<void> {
  const registry = ToolRegistry.getInstance();

  await registry.register({
    type: 'function',
    name: 'modifyExperience',
    description: 'Modify an experience\'s metadata (title, version, description, status)',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'The ID of the experience'
        },
        operation: {
          type: 'object',
          description: 'The operation to perform',
          properties: {
            type: {
              type: 'string',
              enum: ['modify'],
              description: 'The type of operation'
            },
            data: {
              type: 'object',
              description: 'The data to modify',
              properties: {
                version: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string' }
              }
            }
          },
          required: ['type', 'data']
        }
      },
      required: ['experienceId', 'operation']
    }
  }, modifyExperience);

  await registry.register({
    type: 'function',
    name: 'modifyAgent',
    description: 'Create, modify, or delete an agent in an experience',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'The ID of the experience'
        },
        operation: {
          type: 'object',
          description: 'The operation to perform',
          properties: {
            type: {
              type: 'string',
              enum: ['create', 'modify', 'delete'],
              description: 'The type of operation'
            },
            id: {
              type: 'string',
              description: 'The ID of the agent'
            },
            data: {
              type: 'object',
              description: 'The agent data (required for create/modify)',
              properties: {
                name: { type: 'string' },
                voice: { type: 'string' },
                publicDescription: { type: 'string' },
                downstreamAgents: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            },
            setAsInitial: {
              type: 'boolean',
              description: 'Whether to set this agent as the initial agent'
            }
          },
          required: ['type', 'id']
        }
      },
      required: ['experienceId', 'operation']
    }
  }, modifyAgent);

  await registry.register({
    type: 'function',
    name: 'modifyScene',
    description: 'Add, modify, or delete a scene in an experience',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'The ID of the experience'
        },
        operation: {
          type: 'object',
          description: 'The operation to perform',
          properties: {
            type: {
              type: 'string',
              enum: ['add', 'modify', 'delete'],
              description: 'The type of operation'
            },
            path: {
              type: 'string',
              description: 'The path of the scene'
            }
          },
          required: ['type', 'path']
        }
      },
      required: ['experienceId', 'operation']
    }
  }, modifyScene);

  await registry.register({
    type: 'function',
    name: 'getExperience',
    description: 'Get the full experience configuration',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'The ID of the experience'
        }
      },
      required: ['experienceId']
    }
  }, getExperience);

  await registry.register({
    type: 'function',
    name: 'createAgentPrompt',
    description: 'Create a prompt file for an agent',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'The ID of the experience'
        },
        agentId: {
          type: 'string',
          description: 'The ID of the agent'
        },
        promptContent: {
          type: 'string',
          description: 'The content of the prompt'
        }
      },
      required: ['experienceId', 'agentId', 'promptContent']
    }
  }, createAgentPrompt);

  await registry.register({
    type: 'function',
    name: 'createSupplementalFile',
    description: 'Create a supplemental file',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'The ID of the experience'
        },
        fileName: {
          type: 'string',
          description: 'The name of the file (without extension)'
        },
        content: {
          type: 'string',
          description: 'The content of the file'
        }
      },
      required: ['experienceId', 'fileName', 'content']
    }
  }, createSupplementalFile);

  await registry.register({
    type: 'function',
    name: 'addSound',
    description: 'Add a sound to an experience',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'The ID of the experience'
        },
        soundPath: {
          type: 'string',
          description: 'The path of the sound file'
        }
      },
      required: ['experienceId', 'soundPath']
    }
  }, addSound);

  await registry.register({
    type: 'function',
    name: 'listAgentPrompts',
    description: 'List all agent prompts in an experience',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'The ID of the experience'
        }
      },
      required: ['experienceId']
    }
  }, listAgentPrompts);

  await registry.register({
    type: 'function',
    name: 'getAgentPrompt',
    description: 'Get the content of an agent prompt',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'The ID of the experience'
        },
        agentId: {
          type: 'string',
          description: 'The ID of the agent'
        }
      },
      required: ['experienceId', 'agentId']
    }
  }, getAgentPrompt);

  await registry.register({
    type: 'function',
    name: 'listSupplementalFiles',
    description: 'List all supplemental files in an experience',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'The ID of the experience'
        }
      },
      required: ['experienceId']
    }
  }, listSupplementalFiles);

  await registry.register({
    type: 'function',
    name: 'getSupplementalFile',
    description: 'Get the content of a supplemental file',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'The ID of the experience'
        },
        fileName: {
          type: 'string',
          description: 'The name of the file (without extension)'
        }
      },
      required: ['experienceId', 'fileName']
    }
  }, getSupplementalFile);
}

