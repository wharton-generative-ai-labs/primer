# Experience Format & Storage

## Overview

An Experience is a self-contained configuration that defines an interactive AI scenario. This document covers the file format and storage structure.

## Storage Structure

```
storage/{experienceId}/
├── experience.json              # Main configuration
├── classes.json                 # Class/student management (optional)
├── resources/
│   ├── scenes/                  # Background images (.png, .jpg)
│   ├── sounds/                  # Audio files (.mp3, .wav)
│   └── instructions/
│       ├── agent/               # Per-agent prompt files (.md)
│       └── supplemental/        # Shared instruction files (.md)
├── session_data/                # Per-session data
│   └── sess_{uuid}/
│       ├── session.json         # Session metadata
│       ├── artifacts/           # Session artifacts
│       └── analytics/           # Generated analytics
└── class_data/                  # Per-class analytics (optional)
    └── {classId}/
        └── sessions_index.json
```

## experience.json Schema

### Complete Example

```json
{
  "version": "1.0.0",
  "title": "My Experience",
  "description": "An interactive learning experience",
  "logo": "resources/brand/logo.png",
  
  "aiConfigurations": {
    "default": {
      "provider": "openai",
      "api": "realtime",
      "model": "gpt-realtime",
      "streaming": true,
      "modalities": ["audio", "text"],
      "realtimeSettings": {
        "silence_duration_ms": 800,
        "threshold": 0.5,
        "prefix_padding_ms": 300,
        "create_response": true,
        "interrupt_response": true
      }
    },
    "claude-agent": {
      "provider": "anthropic",
      "api": "responses",
      "model": "claude-3-5-sonnet-20241022",
      "streaming": false,
      "modalities": ["text"]
    }
  },
  
  "resources": {
    "scenes": [
      "resources/scenes/classroom.png",
      "resources/scenes/office.png"
    ],
    "sounds": [
      "resources/sounds/bell.mp3",
      "resources/sounds/success.mp3"
    ],
    "artifacts": [
      {
        "name": "Welcome Guide",
        "type": "markdown",
        "file": "resources/artifacts/welcome.md"
      }
    ],
    "instructions": {
      "agent": {
        "tutor": "resources/instructions/agent/tutor.md",
        "quiz-master": "resources/instructions/agent/quiz-master.md"
      },
      "supplemental": {
        "grading-rubric": "resources/instructions/supplemental/rubric.md"
      }
    }
  },
  
  "agents": {
    "tutor": {
      "name": "Friendly Tutor",
      "voice": "nova",
      "publicDescription": "A helpful learning assistant",
      "type": "frontend",
      "downstreamAgents": ["quiz-master"],
      "toolGroups": ["builtin", "notes", "sound", "slide"]
    },
    "quiz-master": {
      "name": "Quiz Master",
      "voice": "echo",
      "publicDescription": "Tests your knowledge",
      "type": "frontend",
      "downstreamAgents": [],
      "toolGroups": ["builtin", "notes"]
    },
    "design-agent": {
      "name": "Design Agent",
      "type": "backend",
      "temperature": 0.8,
      "aiConfiguration": "claude-agent",
      "toolGroups": ["builtin", "experience", "matter-compiler"],
      "downstreamAgents": []
    }
  },
  
  "initialAgent": "tutor",
  
  "tools": {
    "plugins": ["@primer/builtin-plugin"]
  }
}
```

### Field Reference

#### Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Semantic version |
| `title` | string | Yes | Experience title |
| `description` | string | Yes | Brief description |
| `logo` | string | No | Path to logo image |
| `created` | string | No | ISO 8601 creation date |
| `lastModified` | string | No | ISO 8601 last modified date |
| `author` | string | No | Creator's name |
| `authorEmail` | string | No | Creator's email |

#### AI Configurations

```typescript
interface RealtimeSettings {
  silence_duration_ms?: number;  // Duration of silence to detect speech stop (default: 500ms)
  threshold?: number;            // VAD activation threshold 0.0-1.0 (default: 0.5)
  prefix_padding_ms?: number;    // Audio to include before VAD detected speech (default: 300ms)
  create_response?: boolean;     // Auto-generate response on VAD stop (default: true)
  interrupt_response?: boolean;  // Auto-interrupt response on VAD start (default: true)
}

type RealtimeReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

interface AIConfiguration {
  provider: 'openai' | 'anthropic';
  model: string;
  api?: 'realtime' | 'responses';
  streaming?: boolean;
  modalities?: string[];
  realtimeSettings?: RealtimeSettings;        // Only used when api === 'realtime'
  reasoningEffort?: RealtimeReasoningEffort;  // Only used by reasoning-capable models (e.g., gpt-realtime-2)
}
```

**Realtime Settings** (for voice-interactive agents using OpenAI Realtime API):

- `silence_duration_ms`: How long the user must be silent before the agent responds (default: 500ms)
  - Lower values = faster responses but more interruptions
  - Higher values = more patient listening but slower responses
  - Recommended: 700-1000ms for natural conversation
  
- `threshold`: Voice Activity Detection sensitivity 0.0-1.0 (default: 0.5)
  - Higher values require louder audio to activate
  - Increase in noisy environments
  
- `prefix_padding_ms`: Audio captured before speech detection (default: 300ms)
  - Ensures the beginning of speech isn't cut off
  
- `create_response`: Auto-respond when silence detected (default: true)
  - Set to false for manual control (e.g., push-to-talk)
  
- `interrupt_response`: Allow user to interrupt agent (default: true)
  - Set to false to prevent interruptions during agent responses

**Reasoning Effort** (for reasoning-capable realtime models):

- `reasoningEffort`: One of `minimal`, `low`, `medium`, `high`, `xhigh`
  - Trades latency for deeper reasoning before the model speaks or calls tools
  - Only honored by reasoning-capable models such as `gpt-realtime-2`; ignored by
    `gpt-realtime-1.5`, `gpt-realtime` (alias), and the `gpt-4o-realtime-preview` family
  - OpenAI recommends starting at `low` for production voice agents and tuning up
    only when deeper planning materially improves success
  - Tune the prompt as well: tell the model when to reason vs respond directly
    (see OpenAI's [realtime models prompting guide](https://developers.openai.com/api/docs/guides/realtime-models-prompting))

**Example:**

```json
{
  "aiConfigurations": {
    "voice-interactive": {
      "provider": "openai",
      "api": "realtime",
      "model": "gpt-realtime",
      "streaming": true,
      "modalities": ["audio", "text"],
      "realtimeSettings": {
        "silence_duration_ms": 800,
        "threshold": 0.5,
        "prefix_padding_ms": 300,
        "create_response": true,
        "interrupt_response": true
      }
    },
    "voice-reasoning": {
      "provider": "openai",
      "api": "realtime",
      "model": "gpt-realtime-2",
      "streaming": true,
      "modalities": ["audio", "text"],
      "reasoningEffort": "low",
      "realtimeSettings": {
        "silence_duration_ms": 800
      }
    }
  }
}
```

#### Resources

| Field | Type | Description |
|-------|------|-------------|
| `scenes` | string[] | Paths to scene images |
| `sounds` | string[] | Paths to audio files |
| `artifacts` | ArtifactConfig[] | Pre-configured artifacts |
| `instructions.agent` | Record<string, string> | Agent key → instruction file path |
| `instructions.supplemental` | Record<string, string> | Shared instruction files |

#### Agent Configuration

```typescript
interface AgentConfig {
  name: string;                    // Friendly display name
  voice?: string;                  // OpenAI voice (frontend only)
  publicDescription: string;       // Shown to users
  type?: 'frontend' | 'backend';   // Default: frontend
  temperature?: number;            // Default: 0.7
  aiConfiguration?: string;        // Reference to aiConfigurations
  toolGroups?: string[];           // Available tool groups
  downstreamAgents: string[];      // Agents this can transfer to
  analyticsConfig?: AnalyticsConfig; // For analytics agents
}
```

## Agent Instructions

Agent instruction files are Markdown files containing the system prompt:

```markdown
# Friendly Tutor

You are a patient and encouraging tutor helping students learn.

## Your Personality
- Warm and supportive
- Never condescending
- Celebrates progress

## Tools Available
- Use notes to highlight key concepts
- Use scenes to set the learning environment
- Transfer to Quiz Master when ready to test

## Guidelines
1. Start with a warm greeting
2. Ask about the student's goals
3. Adapt to their pace
...
```

## Session Data

Each session creates its own data directory:

```
session_data/sess_{uuid}/
├── session.json         # Session metadata
└── artifacts/           # Session-specific artifacts
    ├── {artifactId}.json     # Artifact metadata
    └── {artifactId}.{ext}    # Artifact content
```

### session.json

```json
{
  "sessionId": "sess_abc123",
  "userName": "Student Name",
  "userEmail": "student@example.com",
  "startTime": "2025-01-01T10:00:00Z",
  "experienceId": "my-experience"
}
```

## Classes Configuration

`classes.json` manages student groups:

```json
{
  "classes": [
    {
      "id": "class-fall-2025",
      "name": "Fall 2025 Physics",
      "description": "Intro to Physics",
      "createdBy": "teacher@school.edu",
      "createdAt": "2025-01-01T00:00:00Z",
      "isActive": true,
      "members": [
        {
          "email": "student1@school.edu",
          "addedAt": "2025-01-01T00:00:00Z",
          "name": "Alice Student"
        }
      ]
    }
  ],
  "lastModified": "2025-01-15T00:00:00Z"
}
```

## Loading Experiences

Experiences can be loaded:

1. **From storage**: `/api/storage/{experienceId}/experience.json`
2. **From URL**: Any publicly accessible `experience.json`
3. **From ZIP**: ZIP file containing experience structure

### ZIP Format

```
my-experience.zip
├── experience.json
└── resources/
    ├── scenes/
    ├── sounds/
    └── instructions/
```

## Validation

The `ConfigLoader` validates:
- All referenced files exist
- Agent instruction files are loadable
- Resource paths are valid
- Agent references (downstreamAgents) point to existing agents

## Key Types

See `src/app/lib/types.ts` for TypeScript definitions:
- `ExperienceConfig`
- `AgentConfig`
- `AIConfiguration`
- `Resource`
- `ArtifactConfig`
