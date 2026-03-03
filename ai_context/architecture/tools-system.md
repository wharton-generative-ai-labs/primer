# Primer Tools System

## Overview

Tools are functions that AI agents can call to perform actions in Primer. All tools are **centralized** in `src/app/lib/tools/` (not in separate plugin packages).

## Command/Action Pattern

Tools are consolidated into a **command/action pattern** where related functionality is grouped into single tools with an `action` parameter. This keeps the total number of tools to a minimum, aiding clarity for AI agents.

### Consolidated Tools

| Tool | Actions | Purpose |
|------|---------|---------|
| `scene` | discover, set, describe, addCustom, removeCustom | Background scene management |
| `information` | discover, get, save | Persistent key-value storage |
| `file` | listUploaded, getInfo, requestUpload | User file uploads |
| `agent` | discover, transfer | Agent transitions |
| `slide` | show, showExisting, hide, hideAll, list, listActive, getContent | Slide presentations |
| `sound` | discover, play | Audio playback |
| `note` | sync, display, move, hide, show, changeColor, bringToFront, toggleEffect, getScreenDimensions, get, list | Sticky notes |
| `checklist` | get, check, uncheck, showProgress, discover | Checklist artifact management |
| `diagram` | show, hide | Mermaid diagram display |
| `research` | webSearch | Research and web search |

### Example Usage

```typescript
// Old pattern (deprecated)
discoverScenes()
setScene({ scene: 'intro' })

// New pattern
scene({ action: 'discover' })
scene({ action: 'set', scene: 'intro' })
```

## Architecture

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| ToolRegistry | `src/app/lib/ToolRegistry.ts` | Singleton that manages tool registration and execution |
| Tool Groups | `src/app/lib/tools/groups.ts` | Maps group names to tool arrays |
| Tool Implementations | `src/app/lib/tools/{group}/` | Actual tool code |

### Registration Flow

1. **ConfigLoader** calls registration functions based on experience config
2. Each tool group has a `register*Tools()` function in its `index.ts`
3. Tools register with `ToolRegistry.getInstance().register(tool, handler)`
4. Agents receive tools filtered by their `toolGroups` configuration

```typescript
// Example: Registering builtin tools
import { registerBuiltinTools } from '@/app/lib/tools';
await registerBuiltinTools();
```

### Execution Flow

1. AI model returns a tool call with `name` and `arguments`
2. System calls `ToolRegistry.getInstance().execute(name, args, context)`
3. Registry looks up handler and executes with provided context
4. Handler returns `ToolResponse` with `status` and optional `data`

```typescript
interface ToolResponse {
  status: 'success' | 'error' | 'deferred';
  data?: any;
  message?: string;
}
```

## Tool Groups

### Frontend-Only Groups

These tools require browser context and are unavailable to backend agents:

| Group | Tools | Purpose |
|-------|-------|---------|
| `notes` | note | Sticky note UI |
| `slide` | slide | Slide presentation |
| `mermaid` | diagram | Diagram rendering |
| `sound` | sound | Audio playback |
| `celebrate` | celebrate | Celebration animations |
| `delegation` | delegate | Delegate to backend agents |

### Backend-Compatible Groups

These tools work in both frontend and backend contexts:

| Group | Tools | Purpose |
|-------|-------|---------|
| `builtin` | scene, information, file, artifact, checklist, agent, toast | Core functionality |
| `experience` | createExperience, copyTemplate, createDirectory, createFile, deleteDirectory, deleteFile, moveFile, moveDirectory, listResources, getResourceContent, deployArtifact, getTemplateAgentInstructions, listTemplateExperiences | File system operations |
| `matter-compiler` | modifyExperience, modifyAgent, modifyScene, getExperience, createAgentPrompt, createSupplementalFile, addSound, listAgentPrompts, getAgentPrompt, listSupplementalFiles, getSupplementalFile | Experience modification |
| `image-generator` | generateImage | AI image generation |
| `analytics` | listClassSessions, readSessionFile, writeSessionFile, listSessionFiles, readClassData, writeClassData, batchReadSessionFiles | Session analytics |
| `web-search` | research | Web search |

## Agent Tool Configuration

### Specifying Tool Groups

In `experience.json`, specify which tool groups an agent can access:

```json
{
  "agents": {
    "my-agent": {
      "name": "My Agent",
      "toolGroups": ["builtin", "notes", "sound"],
      "...": "..."
    }
  }
}
```

### Default Tool Groups

If `toolGroups` is not specified:
- **Frontend agents**: All tools registered during ConfigLoader initialization
- **Backend agents**: `["builtin", "experience", "matter-compiler", "image-generator"]`

### Recommended Configurations

| Agent Type | Recommended Tool Groups |
|------------|------------------------|
| Voice Tutor | `["builtin", "notes", "sound", "slide"]` |
| Design Agent (backend) | `["builtin", "experience", "matter-compiler"]` |
| Image Generator (backend) | `["builtin", "image-generator"]` |
| Minimal Backend | `["builtin"]` |

## Tool Context

Tools receive a `context` object with environment information and helper functions:

### Frontend Context

```typescript
{
  experienceId: string;
  sessionId: string;
  availableScenes: Record<string, { path: string; url: string }>;
  availableSounds: Record<string, { path: string; url: string }>;
  getInformation: (key: string) => any;
  saveInformation: (key: string, value: any) => void;
  // ... UI-specific functions
}
```

### Backend Context (Server-Side)

```typescript
{
  experienceId: string;
  sessionId: string;
  delegationId?: string;
  userInfo?: { name: string; email: string };
  
  // Artifact operations (direct file access)
  listArtifacts: () => Promise<Artifact[]>;
  getArtifact: (id: string) => Promise<Artifact | null>;
  createArtifact: (name, content, type) => Promise<string>;
  updateArtifact: (id, content) => Promise<void>;
  deleteArtifact: (id) => Promise<void>;
  
  // Experience operations
  createFile: (expId, path, content) => Promise<void>;
  listResources: (expId) => Promise<string[]>;
  // ...
}
```

The backend context is created in `/api/backend-agent/utils/context.ts` and provides direct file system access (no HTTP calls needed).

## Adding New Tools

See [../guides/adding-tools.md](../guides/adding-tools.md) for step-by-step instructions.

Quick overview:

1. Create tool file in appropriate group: `src/app/lib/tools/{group}/my-tool.ts`
2. Define tool schema and handler with `action` parameter for consolidated tools
3. Export from group's `index.ts`
4. Add to `TOOL_GROUPS` in `groups.ts`

## File Structure

```
src/app/lib/tools/
├── index.ts              # Exports all register functions
├── groups.ts             # TOOL_GROUPS mapping and helpers
├── types.ts              # Shared type definitions
├── builtin/
│   ├── index.ts          # registerBuiltinTools()
│   ├── builtin.ts        # Consolidated tool definitions (scene, information, file, agent)
│   ├── builtin-server.ts # Server-side implementations
│   ├── register.ts       # Tool registration
│   └── InformationManager.ts
├── sound/
│   ├── index.ts          # registerSoundTools()
│   ├── sound.ts          # Consolidated sound tool
│   └── AudioManager.ts
├── ui/
│   ├── index.ts          # UI tool registrations
│   ├── slides.ts         # Consolidated slide tool
│   ├── note.ts           # Consolidated note tool
│   ├── notes/            # Notes components and manager
│   ├── slides/           # Slide components and manager
│   ├── mermaid/          # Mermaid diagram support
│   └── ...
├── experience/
│   ├── index.ts          # registerExperienceTools()
│   ├── experience.ts     # Tool definitions
│   └── ExperienceManager.ts
├── matter-compiler/
│   ├── index.ts          # registerMatterCompilerTools()
│   ├── MatterCompiler.ts # Core implementation
│   └── ...
└── ...
```

## Backward Compatibility

For experiences using old plugin names, there's a mapping in `groups.ts`:

```typescript
const PLUGIN_NAME_TO_GROUP = {
  '@primer/builtin-plugin': 'builtin',
  '@primer/notes-plugin': 'notes',
  // ...
};
```

This allows old `experience.json` files with `tools.plugins` arrays to continue working.

## Debugging

Tools log execution with distinctive prefixes:

- `🔧 [CENTRALIZED]` - Tool from centralized system
- `🔧 [CENTRALIZED TOOL] Executing: toolName` - Tool execution start
- `✅ [CENTRALIZED TOOL] toolName completed` - Successful execution
- `❌ [CENTRALIZED TOOL] Error executing toolName` - Execution error

Enable debug logging by setting `DEBUG=true` or checking console output during development.
