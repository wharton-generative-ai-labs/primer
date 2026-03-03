# Matter Compiler Tools Architecture

## Overview
The Matter Compiler tools provide high-level domain operations for manipulating Primer experiences. They offer a semantic interface for working with experience.json files, abstracting away the low-level file operations.

## Directory Structure

```
matter-compiler/
├── index.ts                    # Main export point
├── matter-compiler.ts          # Consolidated re-exports
├── register.ts                 # Tool registration ('use server')
├── experience-tool.ts          # Experience metadata operations
├── agent-tool.ts               # Agent CRUD operations
├── scene-tool.ts               # Scene management
├── prompt-tool.ts              # Agent prompt file operations
├── supplemental-tool.ts        # Supplemental file operations
├── sound-tool.ts               # Sound resource management
├── MatterCompiler.ts           # Core compiler implementation
└── types.ts                    # TypeScript type definitions
```

## Tool Categories

### 1. Experience Management (`experience-tool.ts`)
Manages experience-level metadata and configuration.

**Tools:**
- `modifyExperience(experienceId, operation)` - Modify title, version, description, status
- `getExperience(experienceId)` - Retrieve full experience configuration

**Use Cases:**
- Updating experience metadata
- Retrieving experience configuration
- Modifying experience status

### 2. Agent Management (`agent-tool.ts`)
Handles agent lifecycle within an experience.

**Tools:**
- `modifyAgent(experienceId, operation)` - Create, modify, or delete agents

**Operations:**
- `create` - Add new agent to experience
- `modify` - Update existing agent properties
- `delete` - Remove agent from experience
- `setAsInitial` - Set agent as the initial/entry point

**Use Cases:**
- Creating new conversation agents
- Updating agent properties (name, voice, description)
- Managing agent delegation chains
- Setting initial agent

### 3. Scene Management (`scene-tool.ts`)
Manages background scenes for the experience.

**Tools:**
- `modifyScene(experienceId, operation)` - Add, modify, or delete scenes

**Operations:**
- `add` - Add scene to experience
- `modify` - Update scene properties
- `delete` - Remove scene from experience

**Use Cases:**
- Adding background images
- Updating scene paths
- Removing unused scenes

### 4. Prompt Management (`prompt-tool.ts`)
Handles agent prompt files and content.

**Tools:**
- `createAgentPrompt(experienceId, agentId, content)` - Create prompt file
- `listAgentPrompts(experienceId)` - List all agent prompts
- `getAgentPrompt(experienceId, agentId)` - Get prompt content

**Use Cases:**
- Creating agent instruction files
- Listing available prompts
- Retrieving prompt content for editing

### 5. Supplemental File Management (`supplemental-tool.ts`)
Manages supplemental instruction files.

**Tools:**
- `createSupplementalFile(experienceId, fileName, content)` - Create file
- `listSupplementalFiles(experienceId)` - List all supplemental files
- `getSupplementalFile(experienceId, fileName)` - Get file content

**Use Cases:**
- Creating shared instruction files
- Managing reusable content
- Organizing experience documentation

### 6. Sound Management (`sound-tool.ts`)
Handles audio resources for the experience.

**Tools:**
- `addSound(experienceId, soundPath)` - Add sound to experience

**Use Cases:**
- Adding background music
- Including sound effects
- Managing audio resources

## Core Components

### MatterCompiler (`MatterCompiler.ts`)
The core compiler class that implements the actual manipulation logic.

**Responsibilities:**
- Reading and parsing experience.json
- Modifying experience structure
- Writing updated experience.json
- Validating operations
- Managing resource paths

**Key Methods:**
- `modifyExperience()` - Update experience metadata
- `modifyAgent()` - Agent CRUD operations
- `modifyScene()` - Scene operations
- `createAgentPrompt()` - Create prompt files
- `createSupplementalFile()` - Create supplemental files
- `addSound()` - Add sound resources
- `getExperience()` - Retrieve experience data
- `listAgentPrompts()` - List prompts
- `getAgentPrompt()` - Get prompt content
- `listSupplementalFiles()` - List supplemental files
- `getSupplementalFile()` - Get file content

### Types (`types.ts`)
TypeScript type definitions for the matter compiler system.

**Key Types:**
- `Experience` - Experience configuration structure
- `Agent` - Agent definition
- `Scene` - Scene definition
- `AgentOperation` - Agent operation types
- `SceneOperation` - Scene operation types
- `ExperienceOperation` - Experience operation types
- `MatterCompilerContext` - Extended tool context

## Context Requirements

### MatterCompilerContext
Extended context interface required by all matter compiler tools.

**Required Functions:**
- `getResourceContent(experienceId, path)` - Read resource files
- `createFile(experienceId, path, content)` - Write resource files
- `createDirectory(experienceId, path)` - Create directories
- `listResources(experienceId)` - List all resources

**Provided By:**
- Backend agent route (`/api/backend-agent/route.ts`)
- Experience editor context
- Tool execution environment

## Registration

### Tool Registration (`register.ts`)
Server-side registration of all matter compiler tools.

**Function:**
```typescript
export async function registerMatterCompilerTools(): Promise<void>
```

**Registered Tools:**
1. `modifyExperience` - Experience metadata modification
2. `modifyAgent` - Agent CRUD operations
3. `modifyScene` - Scene management
4. `getExperience` - Experience retrieval
5. `createAgentPrompt` - Prompt file creation
6. `createSupplementalFile` - Supplemental file creation
7. `addSound` - Sound resource addition
8. `listAgentPrompts` - Prompt listing
9. `getAgentPrompt` - Prompt retrieval
10. `listSupplementalFiles` - Supplemental file listing
11. `getSupplementalFile` - Supplemental file retrieval

**Usage:**
```typescript
import { registerMatterCompilerTools } from '@/app/lib/tools/matter-compiler';

// During application initialization
await registerMatterCompilerTools();
```

## Export Structure

### Main Export (`index.ts`)
```typescript
// Tool functions
export {
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

// Core components
export * from './MatterCompiler';
export * from './types';

// Registration
export { registerMatterCompilerTools } from './register';
```

### Consolidated Export (`matter-compiler.ts`)
```typescript
export { modifyExperience, getExperience } from './experience-tool';
export { modifyAgent } from './agent-tool';
export { modifyScene } from './scene-tool';
export { createAgentPrompt, listAgentPrompts, getAgentPrompt } from './prompt-tool';
export { createSupplementalFile, listSupplementalFiles, getSupplementalFile } from './supplemental-tool';
export { addSound } from './sound-tool';
```

## Usage Examples

### Modifying Experience Metadata
```typescript
await modifyExperience({
  experienceId: 'my-experience',
  operation: {
    type: 'modify',
    data: {
      title: 'Updated Title',
      version: '2.0.0',
      description: 'New description'
    }
  }
}, context);
```

### Creating an Agent
```typescript
await modifyAgent({
  experienceId: 'my-experience',
  operation: {
    type: 'create',
    id: 'new-agent',
    data: {
      name: 'New Agent',
      voice: 'alloy',
      publicDescription: 'Agent description',
      downstreamAgents: ['other-agent']
    },
    setAsInitial: true
  }
}, context);
```

### Adding a Scene
```typescript
await modifyScene({
  experienceId: 'my-experience',
  operation: {
    type: 'add',
    path: 'scenes/background.jpg'
  }
}, context);
```

### Creating an Agent Prompt
```typescript
await createAgentPrompt({
  experienceId: 'my-experience',
  agentId: 'my-agent',
  promptContent: 'You are a helpful assistant...'
}, context);
```

## Integration Points

### Backend Agent Route
The matter compiler tools are registered and used in the backend agent route:

```typescript
// /api/backend-agent/route.ts
import { registerMatterCompilerTools } from '@/app/lib/tools';

await registerMatterCompilerTools();
```

### Config Loader
The config loader manages tool registration based on experience configuration:

```typescript
// ConfigLoader.ts
import { registerMatterCompilerTools } from './tools/matter-compiler';

const toolRegistrations = {
  'matter-compiler': registerMatterCompilerTools,
  // ... other tools
};
```

### Tool Registry
All tools are registered with the central ToolRegistry:

```typescript
// ToolRegistry.ts
const registry = ToolRegistry.getInstance();
await registry.register(toolDefinition, toolHandler);
```

## Design Principles

1. **High-Level Abstraction** - Semantic operations vs low-level file manipulation
2. **Type Safety** - Full TypeScript type definitions
3. **Error Handling** - Comprehensive error messages
4. **Validation** - Input validation before operations
5. **Consistency** - Follows builtin tools pattern
6. **Modularity** - Each tool category in separate file
7. **Testability** - Pure functions with injected context

## Comparison to Experience Tools

### Experience Tools (Low-Level)
- Direct file operations (create, read, update, delete)
- Generic file system operations
- No domain knowledge
- Works with any file type

### Matter Compiler Tools (High-Level)
- Semantic domain operations (modify agent, add scene)
- Experience-specific operations
- Understands experience structure
- Works with experience.json and related files

## Future Enhancements

Potential areas for expansion:
1. Tool validation operations
2. Experience migration tools
3. Batch operations
4. Experience templates
5. Resource optimization
6. Dependency management
7. Version control integration

## Related Documentation

- `/context/architecture/tools-system.md` - Overall tools architecture
- `/context/guides/adding-tools.md` - Tool development guide
- `/context/architecture/experience-format.md` - Experience file format
- `/ExperienceSpecification.md` - Experience specification

