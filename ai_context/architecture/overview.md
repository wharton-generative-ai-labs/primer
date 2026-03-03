# Primer Architecture Overview

## What is Primer?

Primer is an experimental platform for creating interactive AI experiences that combine voice, visuals, and autonomous decision-making. It's a runtime that plays "experiences" - self-contained interactive scenarios where AI agents can:

- Talk with users using realistic voice (via OpenAI Realtime API)
- Display contextual images and scenes
- Make autonomous decisions about what happens next
- Use various tools (notes, image generation, web search, etc.)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 with App Router |
| Language | TypeScript |
| Server | Custom HTTP server with Socket.IO integration (`server.ts`) |
| AI Providers | OpenAI (Realtime + Responses APIs), Anthropic Claude |
| UI | React 19, Tailwind CSS, Radix UI, Framer Motion |
| Auth | NextAuth.js |
| File Processing | PDF-parse, Mammoth (Word docs) |

## Application Structure

```
primer/
├── server.ts                    # Custom server with Socket.IO
├── src/app/
│   ├── api/                     # API routes
│   │   ├── backend-agent/       # Backend agent execution
│   │   ├── openai/              # OpenAI proxy endpoints
│   │   ├── storage/             # File storage operations
│   │   └── ...
│   ├── lib/                     # Core libraries
│   │   ├── tools/               # All tool implementations
│   │   ├── ai/                  # AI provider abstractions
│   │   ├── ConfigLoader.ts      # Experience configuration loading
│   │   ├── ToolRegistry.ts      # Tool registration and execution
│   │   └── ...
│   ├── play/[id]/               # Experience player
│   ├── manage/[id]/             # Experience editor
│   └── contexts/                # React contexts
├── storage/                     # Experience and session data
└── public/                      # Static assets
```

## Core Concepts

### 1. Experiences

An **Experience** is a self-contained configuration that defines an interactive AI scenario. Each experience lives in its own directory under `storage/` and contains:

```
storage/{experienceId}/
├── experience.json              # Main configuration
├── resources/
│   ├── scenes/                  # Background images
│   ├── sounds/                  # Audio files
│   └── instructions/
│       ├── agent/               # Per-agent prompt files
│       └── supplemental/        # Shared instruction files
├── session_data/                # Per-session artifacts and data
└── classes.json                 # Class/student management (optional)
```

The `experience.json` file defines:
- Metadata (title, version, description)
- AI configurations (provider, model, settings)
- Agents (personalities, voices, instructions, tools)
- Resources (scenes, sounds, artifacts)

### 2. Agents

Agents are AI personalities that interact with users. There are two types:

| Type | API | Use Case |
|------|-----|----------|
| **Frontend** | OpenAI Realtime API | Voice interaction, real-time conversation |
| **Backend** | OpenAI/Anthropic Chat API | Complex processing, file operations, delegation targets |

**Agent Configuration** (in `experience.json`):
```json
{
  "agents": {
    "tutor": {
      "name": "Friendly Tutor",
      "voice": "nova",
      "publicDescription": "A helpful learning assistant",
      "type": "frontend",
      "downstreamAgents": ["quiz-master"],
      "toolGroups": ["builtin", "notes", "sound"]
    },
    "design-agent": {
      "name": "Design Agent",
      "type": "backend",
      "temperature": 0.8,
      "aiConfiguration": "claude-agent",
      "toolGroups": ["builtin", "experience", "matter-compiler"]
    }
  }
}
```

### 3. Tools

Tools are functions that agents can call to perform actions. All tools are centralized in `src/app/lib/tools/` and organized into groups:

| Group | Purpose | Agent Type |
|-------|---------|------------|
| `builtin` | Core functionality (scenes, artifacts, information) | Both |
| `notes` | Sticky note display and management | Frontend |
| `slide` | Slide presentation | Frontend |
| `sound` | Audio playback | Frontend |
| `mermaid` | Diagram rendering | Frontend |
| `celebrate` | Celebration animations | Frontend |
| `delegation` | Delegate to backend agents | Frontend |
| `experience` | File/directory operations | Backend |
| `matter-compiler` | Experience configuration modification | Backend |
| `image-generator` | AI image generation | Backend |
| `analytics` | Session analytics operations | Backend |
| `web-search` | Web search capability | Both |

See [tools-system.md](tools-system.md) for detailed tool documentation.

### 4. Delegation

Frontend agents can delegate complex tasks to specialized backend agents. The delegation flow:

1. Frontend agent calls `delegate` tool with agent name and task
2. Backend agent route (`/api/backend-agent`) loads the target agent's configuration
3. Backend agent executes with its own tool set (no UI tools)
4. Results are returned to the frontend agent

See [delegation.md](delegation.md) for the complete delegation architecture.

## Key Entry Points

### Server (`server.ts`)

The custom server integrates Next.js with Socket.IO for real-time communication:
- Handles HTTP requests via Next.js
- Manages WebSocket connections for live updates
- Routes delegation status updates to connected clients
- Manages toast notifications

### Experience Player (`/play/[id]/page.tsx`)

The main UI for playing experiences:
- Establishes WebRTC connection to OpenAI Realtime API
- Renders scenes, notes, slides, and other UI elements
- Handles voice input/output
- Manages tool execution context

### Backend Agent Route (`/api/backend-agent/route.ts`)

Executes backend agents:
- Loads experience and agent configuration
- Registers appropriate tools based on `toolGroups`
- Supports both OpenAI and Anthropic providers
- Handles tool call loops until completion

### ConfigLoader (`src/app/lib/ConfigLoader.ts`)

Loads and validates experience configurations:
- Parses `experience.json`
- Validates resource paths
- Registers tools based on experience configuration
- Loads agent instructions from files

## AI Provider Support

Primer supports multiple AI providers:

| Provider | APIs | Use Cases |
|----------|------|-----------|
| OpenAI | Realtime, Responses, Chat Completions | Voice agents, backend agents |
| Anthropic | Messages API | Backend agents (Claude models) |

Provider configuration in `experience.json`:
```json
{
  "aiConfigurations": {
    "default": {
      "provider": "openai",
      "model": "gpt-4o"
    },
    "claude-agent": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022"
    }
  }
}
```

## Storage Patterns

### Experience Storage
- Location: `storage/{experienceId}/`
- Contains: Configuration, resources, session data
- Managed by: StorageService (`src/app/lib/storage/`)

### Session Data
- Location: `storage/{experienceId}/session_data/sess_{uuid}/`
- Contains: Artifacts, transcripts, analytics
- Created per-user-session

### User Uploads
- Location: `storage/user-uploads/`
- Contains: Files uploaded during experiences

## Runtime Environments

Primer runs in multiple Next.js runtime environments:

| Runtime | Where | Capabilities | Limitations |
|---------|-------|--------------|-------------|
| **Node.js** | API routes, Server Components, `server.ts` | Full Node.js APIs (fs, path, etc.) | N/A |
| **Edge Runtime** | Middleware (`middleware.ts`) | Fast, globally distributed | No Node.js APIs (fs, path, child_process, etc.) |
| **Browser** | Client components | DOM APIs, WebRTC | No server-side APIs |

### Edge Runtime Considerations

The middleware runs in Next.js Edge Runtime for optimal performance and global distribution. This has important implications:

- **No Node.js APIs**: Cannot use `fs`, `path`, `child_process`, or other Node.js modules
- **No Audit Logging**: The audit logger requires file system access, so it's skipped in middleware
- **Lightweight**: Keep middleware imports minimal to reduce bundle size
- **Authentication Only**: Middleware handles authentication; authorization is done in API routes

When adding new functionality:
1. Check if it needs to run in middleware (Edge Runtime)
2. If yes, ensure it doesn't import Node.js APIs
3. Use dynamic imports or conditional logic to avoid Edge Runtime incompatibilities
4. Test with `npm run build` to catch Edge Runtime warnings

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API access |
| `ANTHROPIC_API_KEY` | Anthropic Claude access |
| `NEXT_PUBLIC_SOCKET_SERVER_URL` | Socket.IO server URL |
| `STORAGE_ROOT_PATH` | Custom storage directory path |
| `NEXTAUTH_SECRET` | NextAuth.js secret |

## Security

Primer implements multiple security measures:

| Security Feature | Implementation | Documentation |
|-----------------|----------------|---------------|
| **Content Security Policy (CSP)** | `src/lib/csp.ts`, `src/middleware.ts`, `next.config.ts` | [security-csp.md](security-csp.md) |
| **Authentication** | NextAuth.js with file-based users | `src/middleware.ts` |
| **Authorization** | Permission-based access control | `src/app/lib/permissions.ts` |
| **SSRF Protection** | URL validation for proxy requests | `src/app/lib/security/url-validation.ts` |
| **HTML Sanitization** | XSS prevention for dynamic content | `src/app/lib/security/html-sanitizer.ts` |
| **Rate Limiting** | API request throttling | `src/app/lib/rate-limit.ts` |
| **Audit Logging** | Security event tracking | `src/lib/audit-logger.ts` |

See [security-csp.md](security-csp.md) for detailed CSP configuration and external resource management.

## Common Development Tasks

| Task | Where to Look |
|------|---------------|
| Add a new tool | `src/app/lib/tools/`, see [adding-tools.md](../guides/adding-tools.md) |
| Modify agent behavior | `experience.json` agents section, agent instruction files |
| Add new API endpoint | `src/app/api/` |
| Change UI components | `src/app/components/`, `src/components/ui/` |
| Modify experience loading | `src/app/lib/ConfigLoader.ts` |
| Add external resource | Update CSP in `src/lib/csp.ts`, see [security-csp.md](security-csp.md) |
