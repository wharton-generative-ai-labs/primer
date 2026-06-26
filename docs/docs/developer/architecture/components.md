---
id: components
title: Core Components
sidebar_position: 2
---

# Core Components

Primer is built from 12 fundamental architectural components that work together to deliver AI-powered interactive experiences. This document provides an overview of each component and how they interact.

## Component Overview

```mermaid
graph TB
    subgraph "Layer 1: Infrastructure"
        SERVER[1. Server Layer]
        STORAGE[10. Storage System]
        SECURITY[12. Security & Auth]
    end

    subgraph "Layer 2: Configuration & Coordination"
        CONFIG[6. Configuration System]
        EXP[2. Experience System]
        AIPROV[11. AI Provider Abstraction]
    end

    subgraph "Layer 3: Runtime"
        PLAYER[8. Player Runtime]
        EDITOR[9. Experience Editor]
        API[7. API Layer]
    end

    subgraph "Layer 4: Agent & Tools"
        AGENTS[3. Agent Architecture]
        TOOLS[4. Tools System]
        DELEGATION[5. Delegation System]
    end

    SERVER --> CONFIG
    CONFIG --> EXP
    EXP --> PLAYER
    EXP --> EDITOR
    PLAYER --> AGENTS
    AGENTS --> TOOLS
    AGENTS --> DELEGATION
    TOOLS --> AIPROV
    API --> STORAGE
    SECURITY --> API

    style SERVER fill:#e3f2fd
    style AGENTS fill:#f3e5f5
    style TOOLS fill:#e8f5e9
    style EXP fill:#fff3e0
```

---

## 1. Server Layer

**Location**: `server.ts`

### Purpose
Custom Node.js server that integrates Next.js with Socket.IO for real-time bidirectional communication.

### Key Responsibilities
- HTTP request handling (via Next.js)
- WebSocket connection management
- Real-time message routing
- Session management (in-memory)
- Tool execution coordination via sockets
- Toast notification broadcasting

### Architecture
```mermaid
graph LR
    HTTP[HTTP Requests] --> NEXT[Next.js Handler]
    WS[WebSocket] --> SOCKETIO[Socket.IO Server]
    NEXT --> APP[Next.js App]
    SOCKETIO --> EVENTS[Event Handlers]
    EVENTS --> SESSIONS[Session Store]

    style NEXT fill:#e3f2fd
    style SOCKETIO fill:#f3e5f5
```

### Socket Events
- `client:message` - Incoming messages from client
- `server:message` - Outgoing messages to client
- `tool.call` - Tool execution requests
- `tool.response` - Tool execution results
- `agent.delegate` - Backend agent delegation
- `ui.observe.request/response` - UI element observation
- `component.event` - Component interaction events

**Read more**: [System Overview](./system-overview.md) - See complete system architecture

---

## 2. Experience System

**Location**: `storage/{experienceId}/`

### Purpose
Self-contained interactive scenarios that package AI agents, resources, and configurations into portable units.

### Structure
```
experience-id/
├── experience.json          # Main configuration
├── classes.json            # Class management (optional)
├── resources/
│   ├── scenes/             # Background images
│   ├── sounds/             # Audio files
│   ├── artifacts/          # Pre-defined artifacts
│   ├── components/         # Custom React components
│   └── instructions/
│       ├── agent/          # Per-agent prompts
│       └── supplemental/   # Shared instructions
├── session_data/           # Runtime session data
│   └── sess_{uuid}/
│       ├── session.json
│       ├── transcript.json
│       ├── artifacts/
│       └── events.json
└── class_data/             # Class analytics (optional)
    └── {classId}/
        └── sessions_index.json
```

### Key Features
- **Self-contained**: Everything needed for the experience in one directory
- **Portable**: Can be exported/imported as a single unit
- **Versioned**: Version tracking in experience.json
- **Multi-provider**: Supports OpenAI, Anthropic, Google AI

**Read more**: [Experience Format](./experience-format.md)

---

## 3. Agent Architecture

**Location**: `src/app/lib/ai/`

### Purpose
Dual-agent architecture separating real-time voice interaction from complex processing tasks.

### Agent Types

```mermaid
graph TB
    subgraph "Frontend Agents"
        FA1[Teaching Agent]
        FA2[Coach Agent]
        FA3[Interview Agent]
    end

    subgraph "Backend Agents"
        BA1[Research Agent]
        BA2[Content Agent]
        BA3[Analytics Agent]
        BA4[Design Agent]
    end

    subgraph "AI Providers"
        REALTIME[OpenAI Realtime API]
        CHAT[OpenAI/Anthropic/Google Chat]
    end

    FA1 & FA2 & FA3 --> REALTIME
    BA1 & BA2 & BA3 & BA4 --> CHAT

    FA1 -.->|Delegate| BA1
    FA1 -.->|Delegate| BA2
    FA2 -.->|Delegate| BA3

    style FA1 fill:#e3f2fd
    style FA2 fill:#e3f2fd
    style FA3 fill:#e3f2fd
    style BA1 fill:#f3e5f5
    style BA2 fill:#f3e5f5
    style BA3 fill:#f3e5f5
    style BA4 fill:#f3e5f5
```

#### Frontend Agents
- Real-time voice interaction via WebRTC
- Direct user engagement
- UI tool access (notes, slides, scenes)
- Can delegate to backend agents
- Single active frontend agent per session

#### Backend Agents
- Complex processing tasks
- Direct file system access (no HTTP/auth overhead)
- Can modify experiences
- Generate analytics and reports
- Multiple backend agents can run concurrently

### Context Differences

**Frontend Context** (UI-focused):
```typescript
{
  experienceId: string;
  sessionId: string;
  availableScenes: Record<string, ResourceInfo>;
  availableSounds: Record<string, ResourceInfo>;
  setScene: (name: string) => void;
  playSound: (name: string) => void;
  // ... UI manipulation functions
}
```

**Backend Context** (File-focused):
```typescript
{
  experienceId: string;
  sessionId: string;
  delegationId?: string;
  userInfo?: { name: string; email: string };
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  listArtifacts: () => Promise<Artifact[]>;
  createArtifact: (name, content, type) => Promise<string>;
  // ... direct file operations
}
```

**Read more**: [Agent Architecture](./agent-architecture.md)

---

## 4. Tools System

**Location**: `src/app/lib/tools/`, `plugins/`

### Purpose
Extensible framework providing capabilities to AI agents through a unified interface.

### Tool Organization

```mermaid
graph TB
    REGISTRY[Tool Registry<br/>Central Management]

    FRONTEND[Frontend Tools<br/>UI-focused]
    SHARED[Shared Tools<br/>Available to both]
    BACKEND[Backend Tools<br/>Processing-focused]
    COORD[Coordination Tools<br/>Agent collaboration]

    REGISTRY --> FRONTEND
    REGISTRY --> SHARED
    REGISTRY --> BACKEND
    REGISTRY --> COORD

    FRONTEND --> FT[notes, slide, sound,<br/>mermaid, celebrate]
    SHARED --> ST[builtin, scene,<br/>artifact, file]
    BACKEND --> BT[experience, matter-compiler,<br/>analytics, image-generator,<br/>web-search]
    COORD --> CT[delegation, information]

    style REGISTRY fill:#fff3e0
    style FRONTEND fill:#e3f2fd
    style SHARED fill:#e8f5e9
    style BACKEND fill:#f3e5f5
    style COORD fill:#ffe0b2
    style FT fill:#bbdefb
    style ST fill:#c8e6c9
    style BT fill:#e1bee7
    style CT fill:#ffcc80
```

### Tool Groups
Tools are organized into groups that agents can be assigned:
- **builtin**: Core functionality
- **notes**: Sticky note UI
- **slide**: Presentation slides
- **sound**: Audio playback
- **mermaid**: Diagram rendering
- **celebrate**: Celebration animations
- **delegation**: Backend agent delegation
- **experience**: File/directory operations
- **matter-compiler**: Experience config modification
- **image-generator**: AI image generation
- **analytics**: Session analytics
- **web-search**: Research capability

### Command/Action Pattern
Tools use an `action` parameter to group related functionality:
```typescript
// Instead of: scene_show, scene_hide, scene_list
// We have: scene with actions: show, hide, list
{
  name: "scene",
  actions: ["show", "hide", "list"],
  // ...
}
```

**Read more**: [Tools System](./tools-system.md)

---

## 5. Delegation System

**Location**: `src/app/lib/tools/delegation/`, `/api/backend-agent`

### Purpose
Enables frontend agents to hand off complex tasks to specialized backend agents.

### Delegation Flow

```mermaid
sequenceDiagram
    participant FA as Frontend Agent
    participant SOCK as Socket.IO
    participant API as /api/backend-agent
    participant BA as Backend Agent
    participant AI as AI Provider
    participant FS as File System

    FA->>SOCK: delegate(agentName, task)
    SOCK->>API: POST request
    API->>API: Load experience config
    API->>API: Resolve agent by name
    API->>API: Load instruction file
    API->>BA: Create with direct file context
    BA->>AI: Initialize with tools

    loop Tool Call Loop
        AI->>BA: Call tool
        BA->>FS: Direct file access
        FS-->>BA: Result
        BA-->>AI: Tool response
    end

    AI-->>BA: Final response
    BA-->>API: Complete
    API-->>SOCK: Result
    SOCK-->>FA: Delegation result

    Note over FA,FS: Total time: configurable (default 15 min)
```

### Key Features
- **Direct File Access**: Backend agents bypass HTTP/authentication
- **Configurable Timeout**: Default 15 minutes, can be customized
- **Real-time Status**: Socket updates keep frontend informed
- **Error Handling**: Graceful failure with detailed error messages
- **Tool Isolation**: Backend agents only get their assigned tool groups

**Read more**: [Delegation](./delegation.md)

---

## 6. Configuration System

**Location**: `src/app/lib/ConfigLoader/`

### Purpose
Loads, validates, and processes experience configurations with specialized managers.

### Architecture

```mermaid
graph TB
    LOADER[ConfigLoader]

    subgraph "Managers"
        VAL[ValidationManager]
        RES[ResourceManager]
        EXP[ExperienceLoader]
        INST[InstructionProcessor]
        ART[ArtifactManager]
        TOOL[ToolProcessor]
        AGENT[AgentConfigBuilder]
    end

    LOADER --> EXP
    LOADER --> VAL
    EXP --> INST
    EXP --> RES
    EXP --> ART
    EXP --> TOOL
    EXP --> AGENT

    VAL -.->|Validates| EXP
    VAL -.->|Validates| RES
    VAL -.->|Validates| INST

    style LOADER fill:#e3f2fd
    style VAL fill:#ffe0b2
```

### Loading Sequence
1. **Reset State** - Clear previous configuration
2. **Load Experience** - Parse experience.json
3. **Load Instructions** - Process agent instruction files (parallel)
4. **Load Artifacts** - Validate pre-defined artifacts (parallel)
5. **Process Tools** - Register tools based on toolGroups
6. **Build Agents** - Create agent configurations
7. **Validate** - Check all resources and return errors/warnings
8. **Return ConfigResponse** - Complete configuration object

### Validation Levels
- **Errors**: Block experience from running
- **Warnings**: Allow running but notify of issues
- **Info**: Informational messages

**Read more**: See experience loading details in [Data Flows](./data-flows.md)

---

## 7. API Layer

**Location**: `src/app/api/`

### Purpose
RESTful endpoints for all server operations with authentication and authorization.

### API Categories

```mermaid
graph TB
    subgraph "Core APIs"
        BACKEND_API["api/backend-agent"]
        SESSION_INIT_API["api/session-init"]
        EXP_API["api/experience"]
    end

    subgraph "Storage APIs"
        STORAGE_API["api/storage/*"]
        UPLOAD_API["api/upload"]
        DOWNLOAD_API["api/download"]
        USER_UPLOAD_API["api/user-upload/*"]
    end

    subgraph "Analytics APIs"
        ANALYTICS_API["api/analytics/*"]
        SESSIONS_API["api/sessions/*"]
        EXPORT_API["api/download-session-data"]
    end

    subgraph "Class APIs"
        CLASSES_API["api/classes/*"]
        ACCESS_API["api/classes/check-access"]
    end

    subgraph "Auth & Utility"
        AUTH_API["api/auth/nextauth"]
        HEALTH_API["api/health"]
        PROXY_API["api/proxy"]
    end

    style BACKEND_API fill:#f3e5f5
    style SESSION_INIT_API fill:#e3f2fd
    style ANALYTICS_API fill:#e8f5e9
    style AUTH_API fill:#ffe0b2
```

### 28+ API Routes
- **Core**: Backend agent execution, session management, experience CRUD
- **Storage**: File operations, uploads, downloads
- **Analytics**: Session data, reports, exports
- **Classes**: Class management, access control
- **Auth**: NextAuth.js authentication
- **Utilities**: Health checks, proxy (SSRF-protected), diagnostics

### Security
- NextAuth.js authentication on protected routes
- CORS protection with allowlist
- Rate limiting
- Input validation with Zod
- SSRF protection on proxy endpoint

**Read more**: See API routes in [Architecture Guide](./architecture-guide.md)

---

## 8. Player Runtime

**Location**: `src/app/play/[id]/page.tsx`

### Purpose
Main user interface for playing experiences with voice interaction and visual elements.

### Architecture

```mermaid
graph TB
    subgraph "Player Components"
        MAIN[PlayPage Component]
        AUDIO[Audio Manager]
        SCENE[Scene Manager]
        UI[UI Element Manager]
        TRANS[Transcript Manager]
    end

    subgraph "Connections"
        WEBRTC[WebRTC to OpenAI]
        SOCKET[Socket.IO to Server]
    end

    subgraph "State Management"
        CTX1[TranscriptContext]
        CTX2[SceneContext]
        CTX3[ArtifactContext]
        CTX4[EventContext]
    end

    MAIN --> AUDIO
    MAIN --> SCENE
    MAIN --> UI
    MAIN --> TRANS

    MAIN --> WEBRTC
    MAIN --> SOCKET

    TRANS --> CTX1
    SCENE --> CTX2
    UI --> CTX3
    MAIN --> CTX4

    style MAIN fill:#e3f2fd
    style WEBRTC fill:#f3e5f5
    style SOCKET fill:#f3e5f5
```

### Loading Phases
1. Access check
2. Session recovery check
3. AI configurations
4. Agents
5. Sounds
6. Scenes
7. Tools
8. Plugins
9. Audio initialization
10. Scene initialization
11. Complete

### Features
- Session management (creation, recovery)
- Real-time voice interaction
- Scene/background management
- Sound playback
- UI elements (notes, slides, artifacts)
- Tool execution coordination
- Access control

**Read more**: See player details in [Data Flows](./data-flows.md)

---

## 9. Experience Editor

**Location**: `src/app/manage/[id]/`

### Purpose
Interface for creating and configuring experiences.

### Capabilities
- **Metadata Editing**: Title, description, version
- **Agent Configuration**: Add/edit/remove agents
- **Resource Management**: Upload scenes, sounds, instructions
- **Tool Assignment**: Assign tool groups to agents
- **AI Configuration**: Set up provider settings
- **Import/Export**: Share experiences
- **Template System**: Start from templates

### Editor Flow
```mermaid
graph LR
    CREATE[Create New] --> METADATA[Edit Metadata]
    METADATA --> AGENTS[Configure Agents]
    AGENTS --> RESOURCES[Add Resources]
    RESOURCES --> TOOLS[Assign Tools]
    TOOLS --> TEST[Test in Player]
    TEST --> PUBLISH[Publish]

    style CREATE fill:#e3f2fd
    style PUBLISH fill:#e8f5e9
```

---

## 10. Storage System

**Location**: `src/app/lib/storage/`

### Purpose
Abstracted file system operations for experiences and sessions.

### Architecture

```mermaid
graph TB
    FACTORY[StorageServiceFactory]
    INTERFACE[StorageService Interface]
    LOCAL[LocalStorageService]

    FACTORY --> INTERFACE
    INTERFACE --> LOCAL

    subgraph "Future Providers"
        S3[S3StorageService]
        GCS[GCSStorageService]
        AZURE[AzureStorageService]
    end

    INTERFACE -.->|Future| S3
    INTERFACE -.->|Future| GCS
    INTERFACE -.->|Future| AZURE

    style LOCAL fill:#e8f5e9
    style S3 fill:#f5f5f5
    style GCS fill:#f5f5f5
    style AZURE fill:#f5f5f5
```

### Operations
- **Read**: Read file contents
- **Write**: Write file contents
- **Delete**: Remove files
- **List**: List directory contents
- **Move**: Move files/directories
- **Copy**: Copy files/directories
- **Exists**: Check if path exists

### Storage Paths
- **Experiences**: `storage/{experienceId}/`
- **Sessions**: `storage/{experienceId}/session_data/sess_{uuid}/`
- **User Uploads**: `storage/user-uploads/`

---

## 11. AI Provider Abstraction

**Location**: `src/app/lib/ai/`

### Purpose
Multi-provider support for different AI services with a unified interface.

### Provider Hierarchy

```mermaid
classDiagram
    class BaseAIProvider {
        <<abstract>>
        +model: string
        +temperature: number
        +registerTool()
        +execute()
    }

    class RealtimeAIProvider {
        +setupRealtimeConnection()
        +handleAudioStream()
    }

    class TextAIProvider {
        +sendMessage()
        +handleStreaming()
    }

    class OpenAIRealtime {
        +WebRTC connection
    }

    class OpenAIChat {
        +Chat completions
    }

    class AnthropicProvider {
        +Messages API
    }

    class GoogleProvider {
        +Gemini API
    }

    BaseAIProvider <|-- RealtimeAIProvider
    BaseAIProvider <|-- TextAIProvider
    RealtimeAIProvider <|-- OpenAIRealtime
    TextAIProvider <|-- OpenAIChat
    TextAIProvider <|-- AnthropicProvider
    TextAIProvider <|-- GoogleProvider
```

### Supported Providers
- **OpenAI Realtime API** - Voice interaction (frontend agents)
- **OpenAI Chat API** - Text processing (backend agents)
- **Anthropic Claude** - Alternative text processing
- **Google Gemini** - Alternative text processing

### Configuration
Each experience can define multiple AI configurations:
```json
{
  "aiConfigurations": {
    "default": {
      "provider": "openai-realtime",
      "model": "gpt-4o-realtime-preview",
      "temperature": 0.8
    },
    "backend-claude": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "temperature": 0.7
    }
  }
}
```

---

## 12. Security & Authentication

**Location**: `src/lib/csp.ts`, `src/middleware.ts`, `src/app/api/auth/`

### Purpose
Comprehensive security framework protecting users and data.

### Security Layers

```mermaid
graph TB
    L1[1. Network Security<br/>CORS, HTTPS]
    L2[2. Content Security Policy<br/>XSS Prevention]
    L3[3. Authentication<br/>NextAuth.js]
    L4[4. Authorization<br/>Role-based Access]
    L5[5. Input Validation<br/>Zod Schemas]
    L6[6. Output Sanitization<br/>HTML Sanitization]
    L7[7. Audit Logging<br/>Security Events]

    L1 --> L2 --> L3 --> L4 --> L5 --> L6 --> L7

    style L1 fill:#ffcdd2
    style L2 fill:#f8bbd0
    style L3 fill:#e1bee7
    style L4 fill:#d1c4e9
    style L5 fill:#c5cae9
    style L6 fill:#bbdefb
    style L7 fill:#b3e5fc
```

### Components
- **Content Security Policy**: XSS and injection protection
- **NextAuth.js**: Google OAuth integration
- **Permission System**: Role-based access control (admin/teacher/student)
- **SSRF Protection**: URL validation for proxy requests
- **HTML Sanitization**: Safe dynamic content rendering
- **Audit Logging**: Security event tracking
- **Rate Limiting**: API request throttling

### Authentication Flow
```mermaid
sequenceDiagram
    participant User
    participant App
    participant Google
    participant NextAuth
    participant Storage

    User->>App: Click "Sign In"
    App->>NextAuth: Redirect to sign in
    NextAuth->>Google: OAuth request
    Google->>User: Login prompt
    User->>Google: Credentials
    Google->>NextAuth: OAuth token
    NextAuth->>Storage: Load/create user
    Storage-->>NextAuth: User data
    NextAuth->>App: Set session
    App-->>User: Authenticated
```

**Read more**: [Security Architecture](./security-csp.md)

---

## Component Interactions

### How Components Work Together

```mermaid
graph TB
    USER[User] --> PLAYER
    PLAYER[8. Player Runtime] --> SERVER[1. Server Layer]
    PLAYER --> SECURITY[12. Security]

    SERVER --> API[7. API Layer]
    API --> CONFIG[6. Config System]

    CONFIG --> EXP[2. Experience System]
    CONFIG --> STORAGE[10. Storage]

    EXP --> AGENTS[3. Agents]
    AGENTS --> TOOLS[4. Tools]
    AGENTS --> DELEGATION[5. Delegation]
    AGENTS --> AIPROV[11. AI Providers]

    TOOLS --> STORAGE
    DELEGATION --> API

    EDITOR[9. Editor] --> API
    EDITOR --> STORAGE

    style USER fill:#e8f5e9
    style PLAYER fill:#e3f2fd
    style AGENTS fill:#f3e5f5
    style TOOLS fill:#fff3e0
```

---

## Next Steps

Now that you understand the core components, explore:

- [System Overview](./system-overview.md) - Complete system architecture with diagrams
- [Agent Architecture](./agent-architecture.md) - Frontend and backend agents
- [Data Flows](./data-flows.md) - How data moves through the system
- [Tools System](./tools-system.md) - How tools work
- [Delegation](./delegation.md) - Agent coordination
