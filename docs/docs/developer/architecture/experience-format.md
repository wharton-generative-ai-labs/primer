---
id: experience-format
title: Experience Format
sidebar_position: 3
---

# Experience Format

Experiences are self-contained packages defined by an `experience.json` file and associated resources.

## Storage Structure

```
storage/{experienceId}/
├── experience.json              # Main configuration
├── classes.json                 # Class management (optional)
├── resources/
│   ├── scenes/                  # Background images
│   ├── sounds/                  # Audio files
│   └── instructions/
│       ├── agent/               # Agent prompts
│       └── supplemental/        # Shared instructions
└── session_data/                # Per-session data
    └── sess_{uuid}/
        ├── session.json
        └── artifacts/
```

## experience.json Schema

### Minimal Example

```json
{
  "version": "1.0.0",
  "title": "My Experience",
  "description": "A simple interactive experience",
  "agents": {
    "main-agent": {
      "name": "Friendly Assistant",
      "voice": "nova",
      "publicDescription": "A helpful AI assistant",
      "toolGroups": ["builtin", "notes"]
    }
  },
  "initialAgent": "main-agent"
}
```

### Complete Example

```json
{
  "version": "1.0.0",
  "title": "Learning Experience",
  "description": "Interactive tutoring with AI",
  "logo": "resources/brand/logo.png",
  "created": "2025-01-01T00:00:00Z",
  "author": "Your Name",
  
  "aiConfigurations": {
    "default": {
      "provider": "openai",
      "model": "gpt-4o"
    },
    "claude-backend": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022"
    }
  },
  
  "resources": {
    "scenes": [
      "resources/scenes/classroom.png",
      "resources/scenes/library.png"
    ],
    "sounds": [
      "resources/sounds/bell.mp3"
    ],
    "instructions": {
      "agent": {
        "tutor": "resources/instructions/agent/tutor.md",
        "quiz-master": "resources/instructions/agent/quiz.md"
      },
      "supplemental": {
        "rubric": "resources/instructions/supplemental/rubric.md"
      }
    }
  },
  
  "agents": {
    "tutor": {
      "name": "Friendly Tutor",
      "voice": "nova",
      "publicDescription": "Your learning guide",
      "type": "frontend",
      "temperature": 0.7,
      "toolGroups": ["builtin", "notes", "sound", "delegation"],
      "downstreamAgents": ["quiz-master"]
    },
    "quiz-master": {
      "name": "Quiz Master",
      "voice": "echo",
      "publicDescription": "Tests your knowledge",
      "type": "frontend",
      "toolGroups": ["builtin", "notes"]
    }
  },
  
  "initialAgent": "tutor"
}
```

## Field Reference

### Metadata

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Semantic version (e.g., "1.0.0") |
| `title` | string | Yes | Experience name |
| `description` | string | Yes | Brief description |
| `logo` | string | No | Path to logo image |
| `created` | string | No | ISO 8601 creation date |
| `author` | string | No | Creator name |

### AI Configurations

Define AI provider settings:

```json
{
  "aiConfigurations": {
    "config-name": {
      "provider": "openai" | "anthropic",
      "model": "model-name",
      "temperature": 0.7,
      "streaming": true
    }
  }
}
```

**Providers**:
- `openai`: GPT models
- `anthropic`: Claude models

**Common Models**:
- OpenAI: `gpt-4o`, `gpt-4o-mini`
- Anthropic: `claude-3-5-sonnet-20241022`

### Resources

```json
{
  "resources": {
    "scenes": ["path/to/image.png"],
    "sounds": ["path/to/audio.mp3"],
    "instructions": {
      "agent": {
        "agent-key": "path/to/prompt.md"
      },
      "supplemental": {
        "doc-key": "path/to/doc.md"
      }
    }
  }
}
```

All paths are relative to the experience directory.

### Agent Configuration

```json
{
  "agents": {
    "agent-key": {
      "name": "Display Name",
      "voice": "nova",
      "publicDescription": "User-facing description",
      "type": "frontend" | "backend",
      "temperature": 0.7,
      "aiConfiguration": "config-name",
      "toolGroups": ["builtin", "notes"],
      "downstreamAgents": ["other-agent-key"]
    }
  }
}
```

**Agent Fields**:
- `name`: Friendly display name
- `voice`: OpenAI voice (frontend only)
- `type`: `frontend` (voice) or `backend` (no voice)
- `temperature`: 0.0-2.0, controls randomness
- `aiConfiguration`: Reference to AI config
- `toolGroups`: Available tool groups
- `downstreamAgents`: Agents this can transfer to

**Available Voices**: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

### Workflow Phases (optional)

Split an experience into ordered beats. When omitted, the experience runs in single-screen mode with no navigation strip.

```json
{
  "workflowPhases": [
    {
      "id": "warmup",
      "title": "Get oriented",
      "heading": "Let's get you ready to pitch.",
      "initialAgent": "narrator"
    },
    {
      "id": "pitch",
      "title": "Pitch a VC",
      "initialAgent": "mentor"
    }
  ],
  "initialWorkflowPhase": "warmup",
  "showPhaseCount": true
}
```

**Phase fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Stable, unique within the experience |
| `title` | string | Yes | Strip label — `Phase N of M — {title}` |
| `heading` | string | No | Central headline above the layout (optional) |
| `description` | string | No | Surfaced to the agent, not the user |
| `initialAgent` | string | No | Agent on first entry. Must exist in `agents` |
| `reentryAgent` | string | No | Authoritative agent override on every return |
| `objectives` | array | No | `{ id, description }` items, listed when skipped |
| `promptFragments` | object | No | `coldStart` / `reentry` / `afterSkip` strings |
| `mode` | string | No | `'interactive'` (default), `'build'`, or `'result'`. Picks the top-level surface. |
| `buildConfig` | object | No | `{ title, subtitle }` for `mode: 'build'` |

**Experience-level options**:

| Field | Default | Behavior |
|-------|---------|----------|
| `initialWorkflowPhase` | first phase id | Override the starting phase |
| `showPhaseCount` | `true` | When `false`, hides `Phase N of M` from the strip |

See [Workflow Phases (architecture)](/developer/architecture/workflow-phases) for runtime semantics, transition ops, and event log; [Workflow Phases (authoring)](/developer/experiences/workflow-phases) for an author-facing walkthrough.

### Tool Groups

Common tool groups:

| Group | Purpose | Agent Type |
|-------|---------|------------|
| `builtin` | Core functionality | Both |
| `notes` | Sticky notes | Frontend |
| `sound` | Audio playback | Frontend |
| `slide` | Presentations | Frontend |
| `delegation` | Backend agent calls | Frontend |
| `experience` | File operations | Backend |
| `matter-compiler` | Config modification | Backend |

See [Tools System](/developer/architecture/tools-system) for complete list.

## Agent Instructions

Agent instructions are Markdown files:

```markdown
# Friendly Tutor

You are a patient and encouraging tutor.

## Your Personality
- Warm and supportive
- Never condescending
- Celebrates progress

## Tools Available
- Use `note` to highlight key concepts
- Use `scene` to set the environment
- Use `delegate` to hand off to Quiz Master

## Guidelines
1. Start with a warm greeting
2. Ask about learning goals
3. Adapt to student pace
```

## Loading Experiences

### From Storage

```
GET /api/storage/{experienceId}/experience.json
```

### From URL

Any publicly accessible `experience.json`:

```
https://example.com/my-experience/experience.json
```

### From ZIP

ZIP file containing:
```
my-experience.zip
├── experience.json
└── resources/
    ├── scenes/
    ├── sounds/
    └── instructions/
```

## Validation

The ConfigLoader validates:
- All referenced files exist
- Agent keys match instruction files
- Resource paths are valid
- Agent references are correct
- Required fields are present

## Best Practices

### Organization

- Use clear, descriptive agent keys
- Group related instructions
- Keep prompts in separate files
- Use supplemental files for shared content

### Naming

- Agent keys: `kebab-case` (e.g., `quiz-master`)
- Display names: `Title Case` (e.g., `Quiz Master`)
- Files: `kebab-case.md`

### Prompts

- Be specific about agent personality
- List available tools
- Provide clear guidelines
- Include examples

### Resources

- Optimize images (< 1MB)
- Use appropriate formats (PNG/JPG for images, MP3 for audio)
- Provide multiple scenes for variety
- Keep sounds short (< 10 seconds)

## Example Experiences

See `storage/` directory for examples:
- `intake-agent`: Patient intake with delegation
- `teachback-template`: Educational template
- `roleplay-template`: Role-play scenario

## Next Steps

- Learn about [AI Providers](/developer/architecture/ai-providers)
- Understand [Tools System](/developer/architecture/tools-system)
- Read [Creating Your First Experience](/developer/guides/creating-first-experience)
