/**
 * Client-safe registration for builtin tools.
 * This registers only the tools that can run in the browser.
 * Server-only tool actions (scene.describe, file.listUploaded, file.getInfo) are not available.
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import {
  scene,
  file,
  artifact,
  checklist,
  toast
} from './builtin';
import { createToolStub } from '@/app/lib/tools/client/tool-calling-shim';

/**
 * Register client-safe builtin tools with the ToolRegistry.
 * This can be called from client contexts.
 */
export async function registerClientBuiltinTools(): Promise<void> {
  const registry = ToolRegistry.getInstance();

  // Scene Management - consolidated tool with action parameter
  // Note: 'describe' action is server-only and will return an error
  await registry.register({
    type: 'function',
    name: 'scene',
    description: 'Manage background scenes. Use discover to list available scenes, set to display one. Always set an appropriate scene at the start of a conversation.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['discover', 'set', 'describe', 'addCustom', 'removeCustom']
        },
        scene: {
          type: 'string',
          description: 'Scene name (required for set/describe actions)'
        },
        sceneName: {
          type: 'string',
          description: 'Custom scene name (required for addCustom/removeCustom actions)'
        },
        imageUrl: {
          type: 'string',
          description: 'Image URL (required for addCustom action)'
        }
      },
      required: ['action']
    }
  }, scene);

  // Information Storage - client stub that forwards to server
  const informationDefinition = {
    type: 'function' as const,
    name: 'information',
    description: 'Manage stored information. Use discover to list available keys, get to retrieve, save to store, delete to remove. Useful for maintaining continuity between agents and preparing summaries.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['discover', 'get', 'save', 'delete']
        },
        key: {
          type: 'string',
          description: 'The key of a key/value pair (required for get/save/delete)'
        },
        value: {
          type: 'string',
          description: 'The value to store (required for save)'
        }
      },
      required: ['action'] as string[]
    },
    handler: async () => ({ status: 'error' as const, data: { error: 'Not implemented' } })
  };
  const informationStub = createToolStub('information', informationDefinition);
  await registry.register(informationDefinition, informationStub.handler);

  // File Management - consolidated tool with action parameter
  // Note: 'listUploaded' and 'getInfo' actions are server-only and will return errors
  await registry.register({
    type: 'function',
    name: 'file',
    description: 'Manage user file uploads. Use listUploaded to see uploaded files, getInfo to read file content, requestUpload to ask for a file.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['listUploaded', 'getInfo', 'requestUpload']
        },
        fileInfoUrl: {
          type: 'string',
          description: 'File info URL returned from upload (required for getInfo)'
        },
        prompt: {
          type: 'string',
          description: 'Prompt to show user explaining what file to upload (required for requestUpload)'
        }
      },
      required: ['action']
    }
  }, file);

  // Artifact Management tools
  await registry.register({
    type: 'function',
    name: 'artifact',
    description: 'OFTEN use artifacts to discuss ideas rather than just talking about them. Can be used as a shared \'brainstorming\' utility. Like a whiteboard.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform: \'list\', \'create\', \'show\', \'delete\'',
          enum: ['list', 'create', 'show', 'delete']
        },
        name: {
          type: 'string',
          description: 'Required for \'create\'. Name of the artifact'
        },
        id: {
          type: 'string',
          description: 'Required for \'show\' and \'delete\'. ID of the artifact'
        },
        content: {
          type: 'string',
          description: 'Required for \'create\'. Content of the artifact'
        },
        type: {
          type: 'string',
          description: 'Optional for \'create\'. Type of the artifact (default: \'markdown\'). Accepts both short forms (jsx, tsx, markdown, etc.) and MIME types (text/jsx, text/tsx, text/markdown, etc.). Common short forms: markdown, checklist, javascript, jsx, typescript, tsx, html, css, json, python, png, jpg, jpeg, gif, svg, pdf, zip. Common MIME types: text/jsx, text/tsx, text/markdown, text/html, text/css, application/javascript, application/typescript, application/json, image/png, image/jpeg, etc.'
        }
      },
      required: ['action']
    }
  }, artifact);

  await registry.register({
    type: 'function',
    name: 'checklist',
    description: 'Manage checklist artifacts. Provides easy operations for checking/unchecking items and displaying progress.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['get', 'check', 'uncheck', 'showProgress', 'discover']
        },
        checklistName: {
          type: 'string',
          description: 'Optional name/pattern to find the checklist (defaults to "*Checklist*")'
        },
        itemText: {
          type: 'string',
          description: 'Text of the item to check/uncheck (required for check/uncheck actions)'
        },
        tags: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Optional array of tags to filter checklists by (e.g., [\'private:agentKey\'] or [\'shared\'])'
        }
      },
      required: ['action']
    }
  }, checklist);

  // Agent Management - client stub that forwards to server
  const agentDefinition = {
    type: 'function' as const,
    name: 'agent',
    description: 'Manage agents. Use \'discover\' to list all agents and what you can do with them. Use \'transfer\' to permanently hand off frontend control to another agent. Use \'delegate\' to send a task to a backend agent that will return results to you.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['discover', 'transfer', 'delegate']
        },
        destination: {
          type: 'string',
          description: 'Destination agent name (required for transfer)'
        },
        rationale: {
          type: 'string',
          description: 'Reasoning for the transfer (required for transfer)'
        },
        conversationContext: {
          type: 'string',
          description: 'Relevant context to pass to the destination agent (required for transfer)'
        },
        agentType: {
          type: 'string',
          description: 'The name or key of the backend agent to delegate to (required for delegate)'
        },
        artifactIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of artifact IDs to pass to the delegated agent (optional for delegate)'
        },
        taskDescription: {
          type: 'string',
          description: 'Description of what the delegated agent should do (optional for delegate)'
        },
        imageNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of image names for image generation tasks (optional for delegate)'
        }
      },
      required: ['action'] as string[]
    },
    handler: async () => ({ status: 'error' as const, data: { error: 'Not implemented' } })
  };
  const agentStub = createToolStub('agent', agentDefinition);
  await registry.register(agentDefinition, agentStub.handler);

  // Toast Management - consolidated tool with action parameter
  await registry.register({
    type: 'function',
    name: 'toast',
    description: 'Display toast notifications to the user with progress updates or messages.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['show']
        },
        message: {
          type: 'string',
          description: 'The message to display in the toast (required for show action)'
        },
        type: {
          type: 'string',
          description: 'The type of toast - \'default\' for normal messages, \'destructive\' for errors',
          enum: ['default', 'destructive']
        }
      },
      required: ['action', 'message']
    }
  }, toast);

  // UI Observation - client stub that forwards to server
  const observeDefinition = {
    type: 'function' as const,
    name: 'observe',
    description: 'Observe the current UI state. Returns information about all UI elements (visible and hidden), their positions, sizes, and spatial relationships. Use this to understand what\'s on screen and where things are located.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    },
    handler: async () => ({ status: 'error' as const, data: { error: 'Not implemented' } })
  };
  const observeStub = createToolStub('observe', observeDefinition);
  await registry.register(observeDefinition, observeStub.handler);

  // UI Presentation - client stub that forwards to server
  const presentDefinition = {
    type: 'function' as const,
    name: 'present',
    description: 'Manage UI elements (slides, components, notes). Control visibility, position, size, and maximize state. Use show/hide to toggle visibility (element remains in memory), destroy to permanently remove.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['show', 'hide', 'hideAll', 'move', 'resize', 'maximize', 'restore', 'destroy']
        },
        id: {
          type: 'string',
          description: 'UI element ID (required for show, hide, move, resize, maximize, restore, destroy)'
        },
        x: {
          type: 'number',
          description: 'X position in pixels (required for move)'
        },
        y: {
          type: 'number',
          description: 'Y position in pixels (required for move)'
        },
        w: {
          type: 'number',
          description: 'Width in pixels (required for resize)'
        },
        h: {
          type: 'number',
          description: 'Height in pixels (required for resize)'
        }
      },
      required: ['action'] as string[]
    },
    handler: async () => ({ status: 'error' as const, data: { error: 'Not implemented' } })
  };
  const presentStub = createToolStub('present', presentDefinition);
  await registry.register(presentDefinition, presentStub.handler);

  // Slide Creation - client stub that forwards to server
  const slideDefinition = {
    type: 'function' as const,
    name: 'slide',
    description: 'Create slides to display content. Use \'show\' to create a slide with markdown content, or \'showArtifact\' to create a slide from an artifact. Returns slideId for use with \'present\' tool for window management.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['show', 'showArtifact']
        },
        title: {
          type: 'string',
          description: 'Slide title'
        },
        content: {
          type: 'string',
          description: 'Slide content in markdown (for show action)'
        },
        artifactId: {
          type: 'string',
          description: 'Artifact ID to display (for showArtifact action)'
        }
      },
      required: ['action'] as string[]
    },
    handler: async () => ({ status: 'error' as const, data: { error: 'Not implemented' } })
  };
  const slideStub = createToolStub('slide', slideDefinition);
  await registry.register(slideDefinition, slideStub.handler);

  // Note tool - client stub that forwards to server
  // Notes are registered with UIElementManager for observe/present integration
  // UI manipulation (move, resize, show, hide) is handled by the 'present' tool
  const noteDefinition = {
    type: 'function' as const,
    name: 'note',
    description: 'Manage sticky notes. Use \'display\' to create, \'list\' to see all, \'get\' for details, \'delete\' to remove. For moving/resizing/showing/hiding notes, use the \'present\' tool.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['display', 'changeColor', 'toggleEffect', 'get', 'list', 'delete']
        },
        noteId: {
          type: 'string',
          description: 'Note ID (required for changeColor, toggleEffect, get, delete)'
        },
        content: {
          type: 'string',
          description: 'Note content in markdown (required for display)'
        },
        x: {
          type: 'number',
          description: 'X position (optional for display, defaults to random)'
        },
        y: {
          type: 'number',
          description: 'Y position (optional for display, defaults to random)'
        },
        w: {
          type: 'number',
          description: 'Width in pixels (optional for display, defaults to 200)'
        },
        h: {
          type: 'number',
          description: 'Height in pixels (optional for display, defaults to 150)'
        },
        color: {
          type: 'string',
          description: 'Note color: yellow, pink, green, blue, purple, orange'
        }
      },
      required: ['action'] as string[]
    },
    handler: async () => ({ status: 'error' as const, data: { error: 'Not implemented' } })
  };
  const noteStub = createToolStub('note', noteDefinition);
  await registry.register(noteDefinition, noteStub.handler);

  // Custom Component tool - client stub that forwards to server
  // Components are registered with UIElementManager for observe/present integration
  // Window management (move, resize, show, hide, destroy) is handled by the 'present' tool
  const customComponentDefinition = {
    type: 'function' as const,
    name: 'customComponent',
    description: 'Manage custom React components. Use \'list\' to see available components, \'create\' to instantiate, \'updateState\'/\'getState\' to manage state, \'clearCache\' to force reload. For window management (show/hide/move/resize/destroy), use the \'present\' tool. For seeing active components, use \'observe\'.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['list', 'create', 'updateState', 'getState', 'clearCache']
        },
        componentId: {
          type: 'string',
          description: 'Component ID (required for create, clearCache). Available components are defined in the experience configuration.'
        },
        instanceId: {
          type: 'string',
          description: 'Instance ID of the component (required for updateState, getState). Returned by create action.'
        },
        initialState: {
          type: 'object',
          description: 'Initial state for the component (optional for create). Keys and values depend on the component.'
        },
        stateUpdates: {
          type: 'object',
          description: 'State updates to apply (required for updateState). Use this to show hints, reveal steps, or guide the student.'
        }
      },
      required: ['action'] as string[]
    },
    handler: async () => ({ status: 'error' as const, data: { error: 'Not implemented' } })
  };
  const customComponentStub = createToolStub('customComponent', customComponentDefinition);
  await registry.register(customComponentDefinition, customComponentStub.handler);
}
