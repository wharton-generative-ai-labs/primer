---
id: data-flows
title: Data Flow Patterns
sidebar_position: 9
---

# Data Flow Patterns

Understanding how data moves through Primer is essential for developing experiences and debugging issues. This document maps out the key data flows with detailed diagrams.

## Overview

Primer has four primary data flow patterns:
1. **Session Initialization** - Starting a new experience
2. **Voice Interaction** - Real-time conversation
3. **Tool Execution** - Agent capabilities
4. **Backend Delegation** - Complex task handoff
5. **File Upload** - User file handling

---

## 1. Session Initialization Flow

When a user launches an experience, several steps occur to prepare the runtime environment.

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Middleware
    participant API
    participant ConfigLoader
    participant Storage

    User->>Browser: Navigate to /play/experience-id
    Browser->>Middleware: Request page
    Middleware->>Middleware: Check authentication
    alt Not authenticated
        Middleware-->>Browser: Redirect to /auth/signin
    end

    Middleware->>API: Check access permissions
    API->>Storage: Load experience.json
    Storage-->>API: Experience config
    API->>API: Check permissions<br/>(owner, published, class)
    alt Access denied
        API-->>Browser: 403 Forbidden
    end

    Browser->>API: POST /api/session-init
    API->>Storage: Check for existing session<br/>(localStorage UUID)
    alt Session exists
        Storage-->>Browser: Prompt for recovery
        User->>Browser: Choose recover/new
    end

    API->>Storage: Create session directory
    Storage-->>API: session UUID
    API->>Storage: Write session.json
    API-->>Browser: Session metadata

    Browser->>ConfigLoader: Load experience config
    ConfigLoader->>Storage: Read experience.json
    ConfigLoader->>Storage: Load instruction files
    ConfigLoader->>Storage: Load resources (scenes, sounds)
    Storage-->>ConfigLoader: All resources
    ConfigLoader-->>Browser: ConfigResponse

    Browser->>Browser: Initialize Player
    Browser->>Browser: Connect to OpenAI Realtime

    Browser-->>User: Experience ready
```

### Loading Phases

The Player component displays progress through 11 phases:

| Phase | Description | What Happens |
|-------|-------------|--------------|
| 1 | Access Check | Verify user permissions |
| 2 | Session Recovery | Check for existing session |
| 3 | AI Configurations | Load provider settings |
| 4 | Agents | Load agent configurations |
| 5 | Sounds | Validate audio files |
| 6 | Scenes | Validate background images |
| 7 | Tools | Register tool groups |
| 8 | Plugins | Initialize plugins (legacy) |
| 9 | Audio Init | Set up microphone/speakers |
| 10 | Scene Init | Load initial background |
| 11 | Complete | Ready for interaction |

---

## 2. Voice Interaction Flow

Real-time conversation between user and frontend agent via OpenAI Realtime API.

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant OpenAI Realtime
    participant ToolRegistry
    participant UI

    User->>Browser: Speaks into microphone
    Browser->>OpenAI Realtime: Audio stream (WebRTC)

    Note over OpenAI Realtime: Transcribes audio<br/>Processes with agent instructions<br/>Decides on response

    alt Agent needs to use a tool
        OpenAI Realtime->>Browser: Tool call event
        Browser->>ToolRegistry: Execute tool
        ToolRegistry->>ToolRegistry: Validate args
        ToolRegistry->>UI: Execute tool handler
        UI-->>ToolRegistry: Tool result
        ToolRegistry-->>Browser: ToolResponse
        Browser->>OpenAI Realtime: Tool result
        Note over OpenAI Realtime: Incorporates result<br/>into response
    end

    OpenAI Realtime->>Browser: Audio response stream
    Browser->>User: Plays audio
    Browser->>UI: Update transcript

    Note over User,UI: Conversation continues...
```

### Voice Flow Details

1. **Audio Capture**: Browser captures microphone input
2. **WebRTC Streaming**: Audio sent to OpenAI in real-time
3. **Transcription**: OpenAI transcribes speech to text
4. **Agent Processing**: AI processes with agent instructions and context
5. **Tool Decisions**: If tools needed, sends tool call events
6. **Tool Execution**: Browser executes tools via ToolRegistry
7. **Response Generation**: OpenAI generates response incorporating tool results
8. **Audio Streaming**: Response streamed back as audio
9. **Playback**: Browser plays audio response to user
10. **Transcript Update**: Conversation logged to transcript

---

## 3. Tool Execution Flow

How tools are called and executed in both frontend and backend contexts.

### Frontend Tool Execution

```mermaid
flowchart TB
    START[AI Agent decides to use tool]
    CALL[OpenAI sends tool call event]
    RECEIVE[Browser receives tool call]
    VALIDATE[ToolRegistry validates]
    EXECUTE[Execute tool handler]
    RESULT[Generate ToolResponse]
    SEND[Send back to OpenAI]
    CONTINUE[AI continues]

    START --> CALL
    CALL --> RECEIVE
    RECEIVE --> VALIDATE

    VALIDATE --> CHECK_TOOL{Tool exists?}
    CHECK_TOOL -->|No| ERROR1[Return error]
    CHECK_TOOL -->|Yes| CHECK_ARGS{Args valid?}
    CHECK_ARGS -->|No| ERROR2[Return error]
    CHECK_ARGS -->|Yes| EXECUTE

    EXECUTE --> CHECK_SUCCESS{Success?}
    CHECK_SUCCESS -->|Yes| RESULT
    CHECK_SUCCESS -->|No| ERROR3[Return error]

    RESULT --> SEND
    ERROR1 --> SEND
    ERROR2 --> SEND
    ERROR3 --> SEND

    SEND --> CONTINUE

    style EXECUTE fill:#e8f5e9
    style ERROR1 fill:#ffcdd2
    style ERROR2 fill:#ffcdd2
    style ERROR3 fill:#ffcdd2
```

### Tool Execution Example

```typescript
// AI decides to show a scene
{
  "tool": "scene",
  "args": {
    "action": "show",
    "name": "forest-morning"
  }
}

// ToolRegistry executes
const result = await ToolRegistry.execute(
  "scene",
  { action: "show", name: "forest-morning" },
  frontendContext
);

// Tool handler runs
sceneContext.setScene("forest-morning");

// Returns success
{
  "success": true,
  "result": "Scene changed to forest-morning"
}
```

---

## 4. Backend Delegation Flow

Frontend agents delegate complex tasks to specialized backend agents.

```mermaid
sequenceDiagram
    participant FA as Frontend Agent<br/>(Voice)
    participant Browser
    participant Socket
    participant API as /api/backend-agent
    participant Config as ConfigLoader
    participant BA as Backend Agent
    participant AI as AI Provider
    participant Storage

    FA->>Browser: Decide to delegate
    Browser->>Browser: Call delegate tool
    Browser->>Socket: emit('agent.delegate')

    Socket->>API: POST /api/backend-agent
    Note over API: {<br/>  agentName: "Research Agent",<br/>  task: "Find examples",<br/>  experienceId,<br/>  sessionId<br/>}

    API->>Config: Load experience config
    Config->>Storage: Read experience.json
    Storage-->>Config: Config data
    Config-->>API: Experience loaded

    API->>API: Resolve agent by friendly name
    API->>Storage: Load instruction file
    Storage-->>API: Agent instructions

    API->>API: Create backend tool context<br/>(direct file access)

    API->>BA: Initialize backend agent
    BA->>AI: Connect to provider<br/>(OpenAI/Anthropic/Google)
    AI-->>BA: Connected

    BA->>AI: Send task with instructions

    loop Tool Call Loop (until complete)
        AI->>BA: Tool call
        BA->>BA: Execute with backend context
        BA->>Storage: Direct file access
        Storage-->>BA: File data
        BA-->>AI: Tool result
        AI->>AI: Process result
    end

    AI->>BA: Final response
    BA-->>API: Task complete + result

    API->>Socket: emit('agent.delegate.complete')
    Socket-->>Browser: Delegation result

    Browser->>FA: Return result to frontend agent
    FA->>FA: Incorporate result
    FA-->>Browser: Communicate to user
```

### Delegation Configuration

```json
{
  "agents": {
    "tutor": {
      "type": "frontend",
      "downstreamAgents": ["research", "content", "quiz"]
    },
    "research": {
      "type": "backend",
      "toolGroups": ["builtin", "web-search"],
      "aiConfiguration": "backend-claude"
    }
  }
}
```

### Delegation Timeout

Default: **15 minutes** (configurable via `DELEGATE_AGENT_TIMEOUT_MS`)

If backend agent exceeds timeout:
- Execution terminated
- Error returned to frontend agent
- Frontend agent can inform user and try alternative approach

---

## 5. File Upload Flow

How users upload files that agents can access.

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant API as /api/user-upload
    participant Storage
    participant Agent

    User->>Browser: Click upload button
    Browser->>User: File picker dialog
    User->>Browser: Select file

    Browser->>Browser: Validate file<br/>(type, size)
    alt Invalid file
        Browser-->>User: Error message
    end

    Browser->>API: POST with FormData
    Note over API: {<br/>  file: File,<br/>  sessionId: string,<br/>  experienceId: string<br/>}

    API->>API: Validate file again<br/>(type, size, safety)
    alt Invalid
        API-->>Browser: 400 error
    end

    API->>API: Generate unique filename<br/>(prevent collisions)
    API->>Storage: Write to<br/>storage/user-uploads/{sessionId}/
    Storage-->>API: File written

    API->>API: Create file metadata
    API-->>Browser: File info
    Note over API: {<br/>  id, name, path,<br/>  size, type, url<br/>}

    Browser->>Browser: Store in FileUploadContext

    Browser-->>User: Upload success

    Note over Agent: Agent can now access file

    Agent->>Agent: Call file.read tool
    Agent->>Storage: Read uploaded file
    Storage-->>Agent: File contents
    Agent->>Agent: Process file data
```

### File Upload Details

**Supported File Types** (configurable):
- Documents: PDF, DOCX, TXT, MD
- Images: PNG, JPG, JPEG, GIF, WEBP
- Data: CSV, JSON, XLSX
- Code: JS, TS, PY, etc.

**Size Limits**:
- Default: 10MB per file
- Configurable via environment

**Security**:
- Type validation
- Size validation
- Sanitized filenames
- Isolated per session
- Automatic cleanup (session end)

---

## 6. Artifact Creation Flow

Agents create artifacts (documents, reports, diagrams) during sessions.

```mermaid
flowchart TB
    START[Agent wants to create artifact]
    TOOL[Call artifact.create tool]
    VALIDATE[Validate parameters]
    GENERATE[Generate unique ID]
    WRITE[Write to session artifacts/]
    META[Create metadata]
    CONTEXT[Update ArtifactContext]
    UI[Display in UI]
    END[User sees artifact]

    START --> TOOL
    TOOL --> VALIDATE

    VALIDATE --> CHECK{Valid?}
    CHECK -->|No| ERROR[Return error]
    CHECK -->|Yes| GENERATE

    GENERATE --> WRITE
    WRITE --> META
    META --> CONTEXT
    CONTEXT --> UI
    UI --> END

    style WRITE fill:#e8f5e9
    style ERROR fill:#ffcdd2
```

### Artifact Types

| Type | Description | Rendering |
|------|-------------|-----------|
| `markdown` | Markdown document | Rendered as formatted text |
| `html` | HTML document | Sanitized and rendered |
| `code` | Source code | Syntax highlighted |
| `json` | JSON data | Formatted and collapsible |
| `csv` | Tabular data | Rendered as table |
| `image` | Image URL | Displayed as image |
| `mermaid` | Mermaid diagram | Rendered as diagram |

### Artifact Storage

```
storage/
└── experience-id/
    └── session_data/
        └── sess_uuid/
            └── artifacts/
                ├── artifact-1.md
                ├── artifact-2.html
                ├── artifact-3.json
                └── metadata.json
```

---

## 7. Session Transcript Flow

How conversations are logged and can be accessed.

```mermaid
flowchart LR
    subgraph "During Session"
        SPEAK[User speaks]
        TRANSCRIBE[OpenAI transcribes]
        RESPOND[Agent responds]
        LOG[Log to TranscriptContext]
        SAVE[Periodic save to disk]
    end

    subgraph "After Session"
        READ[Read transcript.json]
        ANALYZE[Analytics agent processes]
        REPORT[Generate reports]
    end

    SPEAK --> TRANSCRIBE
    TRANSCRIBE --> RESPOND
    RESPOND --> LOG
    LOG --> SAVE
    SAVE --> READ
    READ --> ANALYZE
    ANALYZE --> REPORT

    style LOG fill:#e3f2fd
    style SAVE fill:#e8f5e9
    style ANALYZE fill:#f3e5f5
```

### Transcript Format

```json
{
  "sessionId": "sess_uuid",
  "experienceId": "experience-id",
  "startTime": "2024-01-01T10:00:00Z",
  "messages": [
    {
      "timestamp": "2024-01-01T10:00:05Z",
      "role": "user",
      "content": "Hello, can you help me learn about physics?",
      "transcribed": true
    },
    {
      "timestamp": "2024-01-01T10:00:08Z",
      "role": "assistant",
      "agentName": "Physics Tutor",
      "content": "Of course! I'd be happy to help you learn about physics.",
      "toolCalls": []
    },
    {
      "timestamp": "2024-01-01T10:00:12Z",
      "role": "tool",
      "toolName": "scene",
      "args": { "action": "show", "name": "physics-lab" },
      "result": { "success": true }
    }
  ]
}
```

---

## 8. Event Logging Flow

System events and tool uses are logged for debugging and analytics.

```mermaid
graph TB
    EVENT[Event occurs]
    CAPTURE[EventContext captures]
    MEMORY[Store in memory]
    PERIODIC[Periodic flush]
    DISK[Write to events.json]

    EVENT --> CAPTURE
    CAPTURE --> MEMORY
    MEMORY --> PERIODIC
    PERIODIC --> DISK

    style CAPTURE fill:#e3f2fd
    style DISK fill:#e8f5e9
```

### Event Types

- **Session Events**: Start, end, pause, resume
- **Tool Events**: Tool calls and results
- **Agent Events**: Agent switches, delegations
- **UI Events**: Scene changes, slide shows, note displays
- **Error Events**: Errors and warnings
- **User Events**: User interactions with components

### Events File

```json
{
  "sessionId": "sess_uuid",
  "events": [
    {
      "timestamp": "2024-01-01T10:00:00Z",
      "type": "session.start",
      "data": { "experienceId": "exp-123" }
    },
    {
      "timestamp": "2024-01-01T10:00:05Z",
      "type": "tool.call",
      "data": {
        "tool": "scene",
        "action": "show",
        "args": { "name": "forest" }
      }
    },
    {
      "timestamp": "2024-01-01T10:00:06Z",
      "type": "ui.scene.change",
      "data": { "from": null, "to": "forest" }
    }
  ]
}
```

---

## 9. Analytics Flow

After a session completes, raw session data is processed by AI agents to generate meaningful insights for educators and students.

```mermaid
flowchart LR
    subgraph RAW["Raw Session Data"]
        TR["📝 Transcript<br/>Everything said"]
        AT["📄 Artifacts<br/>Created documents"]
        EV["📊 Events<br/>Tool uses, scenes"]
        TI["⏱️ Timing<br/>Pauses, duration"]
    end

    subgraph PROCESS["AI Processing"]
        IND["Individual<br/>Analysis Agent"]
        COH["Cohort<br/>Analysis Agent"]
    end

    subgraph INSIGHTS["Generated Insights"]
        PERF["Performance<br/>Assessment"]
        GAPS["Knowledge<br/>Gaps"]
        PATT["Behavioral<br/>Patterns"]
        REC["Recommendations"]
    end

    subgraph OUTPUT["Outputs"]
        STU_REP["Student<br/>Report"]
        EDU_REP["Educator<br/>Dashboard"]
        SYS_REP["System<br/>Improvements"]
    end

    RAW --> PROCESS
    PROCESS --> INSIGHTS
    INSIGHTS --> OUTPUT

    style RAW fill:#e3f2fd
    style PROCESS fill:#f3e5f5
    style INSIGHTS fill:#fff3e0
    style OUTPUT fill:#e8f5e9
```

### Analytics Pipeline

1. **Data Collection**
   - Transcript: Complete conversation history
   - Artifacts: All generated documents and materials
   - Events: Tool calls, UI changes, timing data
   - Metadata: Session duration, engagement metrics

2. **Individual Analysis**
   - AI agent processes single-student session data
   - Assesses understanding and performance
   - Identifies knowledge gaps and misconceptions
   - Generates personalized feedback

3. **Cohort Analysis**
   - Aggregates data across multiple students
   - Identifies common patterns and trends
   - Highlights areas where students struggle
   - Suggests experience improvements

4. **Output Generation**
   - Student reports with personalized feedback
   - Educator dashboards with cohort insights
   - System recommendations for experience refinement

**Note**: Analytics processing typically happens asynchronously after session completion to avoid impacting the student experience.

---

## Performance Considerations

### Optimization Strategies

1. **Parallel Loading**: Load resources in parallel during initialization
2. **Lazy Loading**: Load components only when needed
3. **Caching**: Cache experience configs in memory
4. **Streaming**: Stream AI responses for perceived speed
5. **WebRTC**: Direct audio streaming to OpenAI (bypass server)
6. **Socket.IO**: Real-time updates without polling

### Bottlenecks to Avoid

- ❌ Loading all artifacts at once
- ❌ Synchronous file operations
- ❌ Unvalidated user input
- ❌ Large transcript files without pagination
- ❌ Unoptimized images/audio

### Best Practices

- ✅ Validate early and often
- ✅ Use direct file access for backend agents
- ✅ Keep tool responses concise
- ✅ Compress large files
- ✅ Clean up temporary files
- ✅ Monitor delegation timeouts

---

## Debugging Data Flows

### Common Issues

| Issue | Symptom | Check |
|-------|---------|-------|
| Session not loading | Stuck on loading phase | Check ConfigLoader validation errors |
| Tool not working | Tool call fails | Check ToolRegistry registration |
| Delegation timeout | Backend agent doesn't respond | Check agent instruction file, tool availability |
| File upload fails | 400/500 error | Check file type, size, permissions |
| Audio not working | No voice input/output | Check WebRTC connection, browser permissions |

### Diagnostic Tools

- **Browser DevTools**: Network tab, console logs
- **API Endpoints**: `/api/diagnostic/*` routes
- **Logs**: Server logs (Pino structured logging)
- **Events**: Check events.json for detailed timeline
- **Transcript**: Review transcript.json for conversation flow

---

## Next Steps

- [Agent Architecture](./agent-architecture.md) - How agents work
- [Tools System](./tools-system.md) - Tool implementation details
- [Delegation](./delegation.md) - Deep dive on delegation
- [Security](./security-csp.md) - Security considerations in data flows
