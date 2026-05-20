/**
 * Client-safe registration for builtin tools.
 * This registers only the tools that can run in the browser.
 * Server-only tool actions (scene.describe, file.listUploaded, file.getInfo) are not available.
 */

import { ToolRegistry } from '@/app/lib/ToolRegistry';
import type { ExperienceConfig } from '@/app/lib/types';
import {
  scene,
  file,
  artifact,
  checklist,
  toast
} from './builtin';
import {
  workflowPhase,
  WORKFLOW_PHASE_ACTIONS,
  WORKFLOW_PHASE_DESCRIPTION,
} from './workflow-phase-tool';
import {
  finishExperience,
  FINISH_EXPERIENCE_DESCRIPTION,
} from './finish-experience-tool';
import { createToolStub } from '@/app/lib/tools/client/tool-calling-shim';

/**
 * Register client-safe builtin tools with the ToolRegistry.
 * This can be called from client contexts.
 *
 * Pass `config` to gate workflow-phase tools on experience config — see
 * `registerBuiltinTools` for the rationale.
 */
export async function registerClientBuiltinTools(
  config?: ExperienceConfig,
): Promise<void> {
  const registry = ToolRegistry.getInstance();
  const hasWorkflowPhases = (config?.workflowPhases?.length ?? 0) > 0;

  // Scene Management - consolidated tool with action parameter
  // Note: 'describe' action is server-only and will return an error
  await registry.register({
    type: 'function',
    name: 'scene',
    description: 'Manage the background scene panel. discover lists available scenes. set picks a scene and reveals the panel. reveal/hide toggle the panel without changing the selected scene. describe inspects a scene. addCustom/removeCustom manage custom scenes.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['discover', 'set', 'reveal', 'hide', 'describe', 'addCustom', 'removeCustom']
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

  // Workflow Phase Management - client-side handler. The realtime tool
  // dispatch in `useHandleServerEvent` wires up `setWorkflowPhase`,
  // `getCurrentWorkflowPhase`, etc. on the tool context.
  // Only registered when the experience declares workflow phases — see
  // `registerBuiltinTools` for the rationale.
  if (hasWorkflowPhases) {
    await registry.register({
      type: 'function',
      name: 'workflowPhase',
      description: WORKFLOW_PHASE_DESCRIPTION,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'The action to perform',
            enum: [...WORKFLOW_PHASE_ACTIONS]
          },
          phase: {
            type: 'string',
            description: 'Target phase id (required for set, setNext, suggestReturn).'
          },
          reason: {
            type: 'string',
            description: 'Reason shown to the user (required for suggestReturn).'
          },
          id: {
            type: 'string',
            description: 'Objective id (required for markObjective). Must match one of the objectives declared on the current phase.'
          },
          note: {
            type: 'string',
            description: 'Optional one-line note recorded with markObjective in the event log (not shown to the user).'
          }
        },
        required: ['action']
      }
    }, workflowPhase);

    // Finish-Experience tool — client-side handler. The realtime tool dispatch
    // in `useHandleServerEvent` wires up `finishExperience` on the tool context.
    await registry.register({
      type: 'function',
      name: 'finishExperience',
      description: FINISH_EXPERIENCE_DESCRIPTION,
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Optional rationale for finishing the experience.'
          }
        },
        required: []
      }
    }, finishExperience);
  }

  // Information Storage - client stub that forwards to server
  const informationDefinition = {
    type: 'function' as const,
    name: 'information',
    description: 'Share facts between agents via a simple key/value store. The tool name is `information`; you must also pass an `action` argument set to one of: `discover` (list existing keys), `get` (fetch a value, requires `key`), `save` (store a value, requires `key` and `value`), `delete` (remove, requires `key`).',
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
    description: 'Create and retrieve artifacts — persistent files (markdown, images, code) saved with the experience. Actions: list (see all), get (fetch one by id), create (new artifact), edit (update content by id), delete (remove by id). Storage only — this tool has NO display action. To display content in the document panel, use the slide tool: slide({ action: \'showArtifact\', artifactId: \'<id>\' }).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['list', 'get', 'create', 'edit', 'delete']
        },
        name: {
          type: 'string',
          description: 'Required for \'create\'. Name of the artifact'
        },
        id: {
          type: 'string',
          description: 'Required for \'get\', \'edit\', \'delete\'. Artifact id.'
        },
        content: {
          type: 'string',
          description: 'Required for \'create\' and \'edit\'. Content of the artifact.'
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
  const agentBaseDescription = 'Manage agents. Use \'discover\' to list all agents and what you can do with them. Use \'transfer\' to permanently hand off frontend control to another agent. Use \'delegate\' to send a task to a backend agent that will return results to you.';
  const agentPhaseSuffix = ' Workflow phases are active: \'transfer\' is restricted to agents in the current phase. To switch to an agent that anchors a later phase, call workflowPhase.nextPhase (or workflowPhase.set) — that drives the agent change as a side effect.';
  const agentDefinition = {
    type: 'function' as const,
    name: 'agent',
    description: hasWorkflowPhases ? agentBaseDescription + agentPhaseSuffix : agentBaseDescription,
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

  // UI Observation - client stub that forwards to server. See
  // builtin/register.ts for the full description; keep these strings in sync.
  const observeDefinition = {
    type: 'function' as const,
    name: 'observe',
    description: 'Report the current user-facing state. Returns the derived layout arrangement, scene/document visibility, activeDocument, viewedDocument, library, notes, current scene, current document tab, and current conversation agent. Call this when you need to know what the user sees before deciding what to show or hide.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    },
    handler: async () => ({ status: 'error' as const, data: { error: 'Not implemented' } })
  };
  const observeStub = createToolStub('observe', observeDefinition);
  await registry.register(observeDefinition, observeStub.handler);

  // Slide Creation - client stub that forwards to server
  const slideDefinition = {
    type: 'function' as const,
    name: 'slide',
    description: "Show or manage the document panel. REQUIRED: every call MUST include `action` (one of: show, showArtifact, list, close, hide, reveal). NEVER call slide without an action — calls without `action` always fail. Common shapes: `slide({ action: 'showArtifact', artifactId: '<id>' })` to display an existing artifact on the slide surface; `slide({ action: 'show', title: '...', content: '...' })` to display ad-hoc markdown content. Behavior by action — show: put markdown content in the active slot and reveal the panel; any previously active document moves into the library. showArtifact: same, rendered from an existing artifact. reveal/hide toggle the panel without changing the active document. list: returns every document currently in the active slot or library. close: remove a document from the library entirely (use its id). You do NOT need to close a document before showing a new one, before transferring to another agent, or to tidy up between topics — the library keeps past documents available; only close a document if it should not be reachable any more.",
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'REQUIRED. The action to perform. Must be one of the enum values; never omit.',
          enum: ['show', 'showArtifact', 'reveal', 'hide', 'list', 'close']
        },
        title: {
          type: 'string',
          description: 'Document title shown to the user (show).'
        },
        content: {
          type: 'string',
          description: 'Markdown content of the document (show).'
        },
        artifactId: {
          type: 'string',
          description: 'Id of an existing artifact to show (showArtifact).'
        },
        id: {
          type: 'string',
          description: 'Document id to remove from the library (close). Get ids from slide.list or observe.'
        }
      },
      required: ['action'] as string[]
    },
    handler: async () => ({ status: 'error' as const, data: { error: 'Not implemented' } })
  };
  const slideStub = createToolStub('slide', slideDefinition);
  await registry.register(slideDefinition, slideStub.handler);

  // Note tool - client stub that forwards to server.
  const noteDefinition = {
    type: 'function' as const,
    name: 'note',
    description: 'Manage sticky notes that appear in the document panel\'s Notes tab. add creates a note (display/create are accepted aliases). list returns all notes. get fetches one by id. changeColor recolors. delete removes. Notes auto-position in a grid — you don\'t specify coordinates. Use a note when the user mentions a discrete idea worth keeping visible during the conversation (a goal, a misconception, an example, a constraint, a name) — one idea per note. Prefer notes over slides for granular thinking that builds up over a back-and-forth; reserve slides for consolidated content the user will want to re-read.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['add', 'create', 'display', 'changeColor', 'get', 'list', 'delete']
        },
        noteId: {
          type: 'string',
          description: 'Note id (required for changeColor, get, delete).'
        },
        content: {
          type: 'string',
          description: 'Note content in markdown (required for add).'
        },
        color: {
          type: 'string',
          description: 'Note color. One of: yellow, pink, green, blue, purple, orange.'
        }
      },
      required: ['action'] as string[]
    },
    handler: async () => ({ status: 'error' as const, data: { error: 'Not implemented' } })
  };
  const noteStub = createToolStub('note', noteDefinition);
  await registry.register(noteDefinition, noteStub.handler);

  // Custom Component tool - client stub that forwards to server
  // Components render in the document panel as active document content.
  const customComponentDefinition = {
    type: 'function' as const,
    name: 'customComponent',
    description: 'Instantiate and manage custom React components. list shows which components the experience has registered. create instantiates one — the component becomes the active document in the document panel (the previous active document moves to the library, same as slide.show). updateState / getState manage component state. clearCache forces the component code to reload. To remove a component from view, use slide.close with its id. Use observe to see what\'s currently active.\n\nTHEMING: Components must be dark-mode aware. Components are always rendered on a bg-background surface (light: #ffffff, dark: #0f1729 deep navy) — all color choices must be readable against this background in both modes, following WCAG AA contrast rules (4.5:1 for text, 3:1 for UI components). (1) Content-heavy UI must use shadcn semantic tokens — bg-card, bg-background, bg-muted, bg-secondary, bg-accent, bg-primary, bg-destructive, bg-success, text-foreground, text-muted-foreground, border-border, ring-ring. These automatically adapt via CSS variables and are pre-tested for contrast. (2) Decorative/visual elements may use Tailwind palette classes only if: every utility prefix also has a dark: variant in the same file, the light value is readable on #ffffff, and the dark value is readable on #0f1729 (typically use -100/-200 bg + -900 text for light; -900 bg + -100 text for dark). (3) Inline SVG must use stroke="currentColor" or fill="currentColor" — never hardcoded color values. (4) Never build dark: class names at runtime (e.g. `dark:${variable}`) — Tailwind\'s scanner only processes literal class strings.',
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
