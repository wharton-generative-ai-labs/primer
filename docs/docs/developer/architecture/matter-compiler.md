---
id: matter-compiler
title: Matter Compiler
sidebar_position: 7
---

# Matter Compiler

The Matter Compiler is a tool system for programmatically modifying experience configurations.

## Purpose

Backend agents can use Matter Compiler tools to:
- Modify `experience.json` configuration
- Add/update agents
- Add scenes and sounds
- Create instruction files
- Build experiences programmatically

## Available Tools

### Experience Modification

```typescript
// Get current configuration
getExperience({ experienceId })

// Modify configuration
modifyExperience({
  experienceId,
  modifications: {
    title: "New Title",
    description: "Updated description"
  }
})
```

### Agent Management

```typescript
// Modify agent configuration
modifyAgent({
  experienceId,
  agentKey: "my-agent",
  modifications: {
    name: "New Name",
    temperature: 0.8,
    toolGroups: ["builtin", "notes"]
  }
})

// Create agent prompt
createAgentPrompt({
  experienceId,
  agentKey: "new-agent",
  content: "# Agent Instructions\n..."
})
```

### Resource Management

```typescript
// Add scene
modifyScene({
  experienceId,
  action: "add",
  sceneName: "classroom",
  scenePath: "resources/scenes/classroom.png"
})

// Add sound
addSound({
  experienceId,
  soundName: "bell",
  soundPath: "resources/sounds/bell.mp3"
})
```

### Instruction Files

```typescript
// List agent prompts
listAgentPrompts({ experienceId })

// Get prompt content
getAgentPrompt({ experienceId, agentKey: "tutor" })

// Create supplemental file
createSupplementalFile({
  experienceId,
  fileName: "rubric",
  content: "# Grading Rubric\n..."
})
```

## Use Cases

### 1. Experience Builder Agent

Backend agent that creates experiences from scratch:

```typescript
// Create base experience
createExperience({ experienceId, title, description })

// Add agents
modifyAgent({ experienceId, agentKey: "main", ... })

// Create prompts
createAgentPrompt({ experienceId, agentKey: "main", content })

// Add resources
modifyScene({ experienceId, ... })
```

### 2. Configuration Updater

Modify existing experiences:

```typescript
// Update agent settings
modifyAgent({
  experienceId,
  agentKey: "tutor",
  modifications: { temperature: 0.9 }
})

// Add new tool group
modifyAgent({
  experienceId,
  agentKey: "tutor",
  modifications: {
    toolGroups: [...existing, "new-group"]
  }
})
```

### 3. Template Instantiation

Create experiences from templates:

```typescript
// Copy template
copyTemplate({ templateId, newExperienceId })

// Customize
modifyExperience({ experienceId: newExperienceId, ... })
modifyAgent({ experienceId: newExperienceId, ... })
```

## Implementation

Matter Compiler tools are in `src/app/lib/tools/matter-compiler/`:

```
matter-compiler/
├── index.ts              # Registration
├── MatterCompiler.ts     # Core implementation
└── tools/
    ├── experience.ts     # Experience operations
    ├── agent.ts          # Agent operations
    └── resources.ts      # Resource operations
```

### Core Class

```typescript
class MatterCompiler {
  async modifyExperience(experienceId, modifications) {
    // Load experience.json
    // Apply modifications
    // Validate
    // Save
  }
  
  async modifyAgent(experienceId, agentKey, modifications) {
    // Load configuration
    // Update agent
    // Save
  }
  
  // ... more methods
}
```

## Configuration

### Enable in Experience

```json
{
  "agents": {
    "builder-agent": {
      "name": "Builder Agent",
      "type": "backend",
      "toolGroups": ["builtin", "experience", "matter-compiler"]
    }
  }
}
```

### Tool Group

Matter Compiler is in the `matter-compiler` tool group:

```typescript
TOOL_GROUPS = {
  'matter-compiler': [
    'modifyExperience',
    'modifyAgent',
    'modifyScene',
    'getExperience',
    'createAgentPrompt',
    // ...
  ]
};
```

## Safety

### Validation

All modifications are validated:
- JSON schema validation
- File path validation
- Agent reference validation
- Required field checks

### Atomic Operations

Modifications are atomic:
- Load → Modify → Validate → Save
- Failures don't corrupt files
- Original preserved on error

### Permissions

Only backend agents can use Matter Compiler:
- Not available to frontend agents
- Requires file system access
- Logged for audit

## Best Practices

### Design

1. **Validate inputs** before modification
2. **Use transactions** for multiple changes
3. **Provide clear errors** on failure
4. **Log all modifications** for audit
5. **Test modifications** before applying

### Usage

1. **Load before modify** to get current state
2. **Modify incrementally** rather than wholesale replacement
3. **Validate after changes** to ensure correctness
4. **Handle errors gracefully** with rollback if needed
5. **Document changes** in commit messages or logs

### Performance

1. **Batch operations** when possible
2. **Cache configurations** to avoid repeated loads
3. **Minimize file writes** by grouping changes
4. **Use appropriate locking** for concurrent access
5. **Clean up** temporary files

## Example: Building an Experience

```typescript
// 1. Create base experience
await createExperience({
  experienceId: "my-exp",
  title: "My Experience",
  description: "An interactive experience"
});

// 2. Add main agent
await modifyAgent({
  experienceId: "my-exp",
  agentKey: "main",
  modifications: {
    name: "Main Agent",
    voice: "nova",
    toolGroups: ["builtin", "notes"]
  }
});

// 3. Create agent prompt
await createAgentPrompt({
  experienceId: "my-exp",
  agentKey: "main",
  content: "# Main Agent\n\nYou are a helpful assistant..."
});

// 4. Add scene
await modifyScene({
  experienceId: "my-exp",
  action: "add",
  sceneName: "intro",
  scenePath: "resources/scenes/intro.png"
});

// 5. Set initial agent
await modifyExperience({
  experienceId: "my-exp",
  modifications: {
    initialAgent: "main"
  }
});
```

## Debugging

Enable logging:

```typescript
console.log('[MATTER-COMPILER] Modifying:', {
  experienceId,
  operation,
  modifications
});
```

Check:
- File permissions
- JSON validity
- Path correctness
- Agent references

## Next Steps

- [Experience Format](/developer/architecture/experience-format) - Configuration schema
- [Tools System](/developer/architecture/tools-system) - Tool architecture
- [Creating Experiences](/developer/experiences/overview) - Build experiences
