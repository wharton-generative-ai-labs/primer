# Primer Delegation System Architecture

## Overview

The Primer system uses a sophisticated delegation architecture where agents can hand off tasks to specialized backend agents for complex processing. This document captures the complete understanding of how this system works.

## Core Concepts

### Experience Structure
Every experience in Primer is self-contained within a directory structure:
```
storage/{experienceId}/
├── experience.json          # Main configuration file
└── resources/
    ├── scenes/             # Scene images
    ├── sounds/             # Audio files
    ├── artifacts/          # User-generated content
    └── instructions/
        ├── agent/          # Agent-specific prompts
        └── supplemental/   # Shared instruction files
```

### Agent Types
- **Frontend Agents**: Use OpenAI Realtime API, interact directly with users
- **Backend Agents**: Use standard OpenAI/Anthropic API, work behind the scenes
- **Agent Flow**: Frontend → Backend → Frontend (seamless handoffs)

## Experience Configuration (experience.json)

### Agent Definition Structure
```json
{
  "agents": {
    "agent-key": {
      "name": "Friendly Display Name",
      "publicDescription": "Description...",
      "type": "frontend|backend",
      "temperature": 0.7,
      "toolGroups": ["builtin", "experience"],
      "downstreamAgents": []
    }
  },
  "resources": {
    "instructions": {
      "agent": {
        "agent-key": "path/to/instructions.md"
      }
    }
  }
}
```

### Key Relationships
- Agent keys (e.g., "design-agent") map to friendly names (e.g., "Design Agent")
- Instruction files are loaded based on agent key mapping
- Backend agents have temperature and tool configurations

## Delegation System Architecture

### How Delegation Works

1. **Frontend Initiation**: Intake agent calls `delegate` tool with friendly name
   ```javascript
   delegate({
     agentType: "Design Agent",  // Friendly name, not key
     artifactIds: ["uuid-1", "uuid-2"],
     taskDescription: "Create design document..."
   })
   ```

2. **Backend Processing**: `/api/backend-agent` route:
   - Loads `experience.json` from experience directory
   - Maps friendly name → agent key → instruction file path
   - Loads actual instruction file from file system
   - Creates server-side tool context with direct file access
   - Calls AI provider with proper instructions and tools

3. **Tool Context**: Backend agents get full tool access via direct file system operations:
   - **Artifacts**: Direct JSON file read/write (no HTTP/auth issues)
   - **Files**: Direct file system access within experience directory
   - **Resources**: Direct directory traversal and file access

4. **Response**: Backend agent returns results to frontend via delegation response

### Authentication Resolution
**Problem**: Server-side HTTP requests to internal APIs fail due to auth redirects
**Solution**: Direct file system access bypasses authentication entirely
- All artifact operations use direct JSON file manipulation
- All file operations use direct file system access
- No HTTP requests = no authentication issues

## Agent Instruction Loading

### Current Approach
1. Delegation call specifies friendly agent name: `"Design Agent"`
2. Backend loads `storage/{experienceId}/experience.json`
3. Finds agent key where `agents[key].name === "Design Agent"` → `"design-agent"`
4. Gets instruction path: `resources.instructions.agent["design-agent"]` → `"resources/instructions/agent/design-agent.md"`
5. Loads file: `storage/{experienceId}/resources/instructions/agent/design-agent.md`
6. Uses content as AI system prompt

### Benefits
- Server has authoritative access to current instructions
- No large prompt files sent over wire
- Friendly names for delegation calls
- Instructions always current (no frontend caching issues)
- Backend agents don't leak internal key names

## Tool Context Implementation

### Server-Side Tool Context
The backend agent gets a complete `ToolContext` with direct file system access:

```typescript
// All operations bypass HTTP/auth via direct file access
{
  experienceId: string;
  sessionId: string;
  delegationId?: string;
  userInfo?: { name: string; email: string };
  
  listArtifacts: () => /* Direct JSON file reads */,
  getArtifact: (id) => /* Direct JSON file read */,
  createArtifact: (name, content, type) => /* Direct JSON file write */,
  updateArtifact: (id, content) => /* Direct JSON file update */,
  deleteArtifact: (id) => /* Direct file deletion */,
  
  // Experience operations
  createFile: (expId, path, content) => /* Direct file write */,
  listResources: (expId) => /* Direct directory traversal */,
  // ... etc
}
```

### Tool Groups for Backend Agents
Default backend tool groups: `["builtin", "experience", "matter-compiler", "image-generator"]`

See [tools-system.md](tools-system.md) for complete tool reference.

## Design Agent Workflow Example

### Typical Design Agent Flow
1. **Receives delegation** with artifact IDs and task description
2. **Retrieves artifacts** using `artifact` tool with `"get"` action
3. **Analyzes content** from retrieved artifacts
4. **Creates design document** using `artifact` tool with `"create"` action
5. **Returns success** with new artifact ID for design document

### Design Agent Instructions Location
- File: `storage/{experienceId}/resources/instructions/agent/design-agent.md`
- Contains: Complete design agent prompt including artifact creation instructions

## Error Handling and Logging

### Comprehensive Logging
All operations include detailed logging:
- **Backend-agent route**: Request parameters, agent lookup, instruction loading
- **Tool execution**: Arguments, context validation, results
- **File operations**: Paths, success/failure, file sizes
- **Artifact operations**: IDs, names, actions performed

### Error Recovery
- **Agent not found**: Clear error with available agent names
- **Missing instruction file**: Specific path and file error
- **File system errors**: Detailed error messages with paths
- **Tool failures**: Comprehensive error context

## Best Practices

### For Backend Agent Development
1. **Always create artifacts** for substantial outputs
2. **Use descriptive artifact names** that users will understand
3. **Include comprehensive logging** for debugging
4. **Handle file system errors gracefully**
5. **Follow experience directory structure**

### For Frontend Agent Integration
1. **Use friendly agent names** in delegation calls
2. **Provide meaningful task descriptions**
3. **Include relevant artifact IDs** for context
4. **Handle delegation errors gracefully**
5. **Present artifact results** to users appropriately

### For Experience Configuration
1. **Use consistent agent naming** (friendly names vs keys)
2. **Maintain instruction file mappings** in config
3. **Set appropriate temperatures** for different agent types
4. **Configure toolGroups** based on agent needs
5. **Keep instruction files** in standard locations

## Key Files

| File | Purpose |
|------|---------|
| `/api/backend-agent/route.ts` | Main backend agent execution |
| `/api/backend-agent/utils/context.ts` | Server-side tool context creation |
| `/lib/tools/delegation/delegate.ts` | Delegate tool implementation |
