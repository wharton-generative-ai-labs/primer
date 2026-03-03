/**
 * Experience file management tools for creating and manipulating experiences.
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import {
  createExperience,
  copyTemplate,
  createDirectory,
  createFile,
  deleteDirectory,
  deleteFile,
  moveFile,
  moveDirectory,
  listResources,
  getResourceContent,
  deployArtifact,
  validateComponent,
  generateComponentStyles
} from './experience';
import { getTemplateAgentInstructions, listTemplateExperiences } from './template-tools';

// Export the tool functions
export {
  createExperience,
  copyTemplate,
  createDirectory,
  createFile,
  deleteDirectory,
  deleteFile,
  moveFile,
  moveDirectory,
  listResources,
  getResourceContent,
  deployArtifact,
  validateComponent,
  generateComponentStyles,
  getTemplateAgentInstructions,
  listTemplateExperiences
};

// Export manager and types
export * from './ExperienceManager';
export * from './types';

/**
 * Register all experience tools with the ToolRegistry.
 * This should be called during application initialization.
 */
export async function registerExperienceTools(): Promise<void> {
  const registry = ToolRegistry.getInstance();

  await registry.register({
    type: 'function',
    name: 'createExperience',
    description: 'Create a new experience with a randomly generated ID.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }, createExperience);

  await registry.register({
    type: 'function',
    name: 'copyTemplate',
    description: 'Create a new experience by copying from a template experience. This copies the entire directory structure including experience.json, supplemental files, and all resources.',
    parameters: {
      type: 'object',
      properties: {
        templateExperienceId: {
          type: 'string',
          description: 'The ID of the template experience to copy from'
        }
      },
      required: ['templateExperienceId']
    }
  }, copyTemplate);

  await registry.register({
    type: 'function',
    name: 'createDirectory',
    description: 'Create a new directory in an experience. Defaults to current experience if experienceId not provided.',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'Optional: The ID of the experience. Defaults to current experience.'
        },
        path: {
          type: 'string',
          description: 'The path of the directory to create'
        }
      },
      required: ['path']
    }
  }, createDirectory);

  await registry.register({
    type: 'function',
    name: 'createFile',
    description: 'Create a new file in an experience. Defaults to current experience if experienceId not provided.',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'Optional: The ID of the experience. Defaults to current experience.'
        },
        path: {
          type: 'string',
          description: 'The path of the file to create'
        },
        content: {
          type: 'string',
          description: 'The content of the file'
        }
      },
      required: ['path', 'content']
    }
  }, createFile);

  await registry.register({
    type: 'function',
    name: 'deleteDirectory',
    description: 'Delete a directory in an experience. Defaults to current experience if experienceId not provided.',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'Optional: The ID of the experience. Defaults to current experience.'
        },
        path: {
          type: 'string',
          description: 'The path of the directory to delete'
        }
      },
      required: ['path']
    }
  }, deleteDirectory);

  await registry.register({
    type: 'function',
    name: 'deleteFile',
    description: 'Delete a file in an experience. Defaults to current experience if experienceId not provided.',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'Optional: The ID of the experience. Defaults to current experience.'
        },
        path: {
          type: 'string',
          description: 'The path of the file to delete'
        }
      },
      required: ['path']
    }
  }, deleteFile);

  await registry.register({
    type: 'function',
    name: 'moveFile',
    description: 'Move a file in an experience. Defaults to current experience if experienceId not provided.',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'Optional: The ID of the experience. Defaults to current experience.'
        },
        sourcePath: {
          type: 'string',
          description: 'The source path of the file'
        },
        destinationPath: {
          type: 'string',
          description: 'The destination path of the file'
        }
      },
      required: ['sourcePath', 'destinationPath']
    }
  }, moveFile);

  await registry.register({
    type: 'function',
    name: 'moveDirectory',
    description: 'Move a directory in an experience. Defaults to current experience if experienceId not provided.',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'Optional: The ID of the experience. Defaults to current experience.'
        },
        sourcePath: {
          type: 'string',
          description: 'The source path of the directory'
        },
        destinationPath: {
          type: 'string',
          description: 'The destination path of the directory'
        }
      },
      required: ['sourcePath', 'destinationPath']
    }
  }, moveDirectory);

  await registry.register({
    type: 'function',
    name: 'listResources',
    description: 'List resources in an experience. Defaults to current experience if experienceId not provided.',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'Optional: The ID of the experience. Defaults to current experience.'
        }
      },
      required: []
    }
  }, listResources);

  await registry.register({
    type: 'function',
    name: 'getResourceContent',
    description: 'Get the content of a resource in an experience. Defaults to current experience if experienceId not provided.',
    parameters: {
      type: 'object',
      properties: {
        experienceId: {
          type: 'string',
          description: 'Optional: The ID of the experience. Defaults to current experience.'
        },
        path: {
          type: 'string',
          description: 'The path of the resource'
        }
      },
      required: ['path']
    }
  }, getResourceContent);

  // Template-related tools
  await registry.register({
    type: 'function',
    name: 'getTemplateAgentInstructions',
    description: 'Get agent instruction content from a template experience',
    parameters: {
      type: 'object',
      properties: {
        templateExperienceId: {
          type: 'string',
          description: 'The ID of the template experience'
        },
        agentKey: {
          type: 'string',
          description: 'The key/ID of the agent whose instructions to retrieve'
        }
      },
      required: ['templateExperienceId', 'agentKey']
    }
  }, getTemplateAgentInstructions);

  await registry.register({
    type: 'function',
    name: 'listTemplateExperiences',
    description: 'List all available template experiences in the system. Returns template metadata including folder IDs (which may be UUIDs or custom names), titles, descriptions, kind field, and available agents. Use this to discover template IDs dynamically rather than assuming fixed folder names.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }, listTemplateExperiences);

  await registry.register({
    type: 'function',
    name: 'deployArtifact',
    description: 'Deploy an artifact\'s content to a specific location in an experience directory. Copies artifact from session storage to permanent experience storage. Defaults to current experience if experienceId not provided.',
    parameters: {
      type: 'object',
      properties: {
        artifactId: {
          type: 'string',
          description: 'The ID of the artifact to deploy'
        },
        experienceId: {
          type: 'string',
          description: 'Optional: The ID of the target experience. Defaults to current experience.'
        },
        destinationPath: {
          type: 'string',
          description: 'The path within the experience where the file should be copied (e.g., "resources/instructions/agent")'
        },
        fileName: {
          type: 'string',
          description: 'Optional: New filename (if different from artifact name). If not provided, uses artifact name with appropriate extension.'
        }
      },
      required: ['artifactId', 'destinationPath']
    }
  }, deployArtifact);

  await registry.register({
    type: 'function',
    name: 'validateComponent',
    description: 'Validate custom React component JSX code before deployment. Checks for syntax errors, security issues, required exports, and Primer integration patterns. Returns validation result with any errors or warnings. Use this BEFORE deploying component code to catch issues early. Defaults to current experience.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The JSX component code to validate'
        },
        componentId: {
          type: 'string',
          description: 'The ID/name of the component (used for kebab-case validation)'
        },
        experienceId: {
          type: 'string',
          description: 'Optional: The ID of the experience (for context). Defaults to current experience.'
        }
      },
      required: ['code', 'componentId']
    }
  }, validateComponent);

  await registry.register({
    type: 'function',
    name: 'generateComponentStyles',
    description: 'Generate Tailwind CSS styles for a component by running Tailwind CLI. Call this AFTER deploying the component JSX file to generate a companion CSS file. This enables Tailwind utility classes to work in the component. Defaults to current experience.',
    parameters: {
      type: 'object',
      properties: {
        componentId: {
          type: 'string',
          description: 'The ID/name of the component (e.g., "simple-counter")'
        },
        experienceId: {
          type: 'string',
          description: 'Optional: The ID of the experience. Defaults to current experience.'
        }
      },
      required: ['componentId']
    }
  }, generateComponentStyles);
}

