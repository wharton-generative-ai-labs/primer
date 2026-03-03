# Diagram 2: System Architecture

## How the Pieces Fit Together

```mermaid
graph TB
    classDef user fill:#2d3748,stroke:#e2e8f0,color:#e2e8f0,stroke-width:2px
    classDef browser fill:#3182ce,stroke:#bee3f8,color:#fff,stroke-width:1px
    classDef socket fill:#d69e2e,stroke:#fefcbf,color:#1a202c,stroke-width:2px
    classDef server fill:#805ad5,stroke:#d6bcfa,color:#fff,stroke-width:1px
    classDef ai fill:#e53e3e,stroke:#fed7d7,color:#fff,stroke-width:1px
    classDef storage fill:#38a169,stroke:#c6f6d5,color:#fff,stroke-width:1px

    USER[/"👤 User\n(Educator or Student)"/]:::user

    subgraph BROWSER["Web Application (Browser)"]
        direction TB
        
        subgraph UI["React UI Layer"]
            direction LR
            SCENE["Scene\n(Background)"]:::browser
            SLIDES["Slides\n(Markdown)"]:::browser
            ARTIFACTS["Artifacts\n(Documents)"]:::browser
            WMAN["Window\nManager"]:::browser
            TRANSCRIPT["Live\nTranscript"]:::browser
            CONTROLS["Audio\nControls"]:::browser
        end

        subgraph AGENT_FE["Front-End Agent"]
            direction TB
            RT["OpenAI Realtime API\n(WebRTC Voice)"]:::ai
            TR["Tool Registry\n(Client Stubs)"]:::browser
        end

        RT -->|"Agent decides\nto call a tool"| TR
        TR -->|"All tool calls\nrouted to server"| SOCK_OUT

        SOCK_IN -->|"UI events\n(create slide,\nset scene, etc.)"| UI
    end

    USER <-->|"Voice + Visual\nInteraction"| BROWSER

    subgraph SOCKETIO["Socket.IO (Bidirectional)"]
        direction LR
        SOCK_OUT["tool.call\nagent.delegate"]:::socket
        SOCK_IN["ui.slide.create\nui.element.*\ntool.response\ndelegation:status"]:::socket
    end

    subgraph SERVER["Node.js Server"]
        direction TB
        
        subgraph TOOLSYS["Tool Execution Engine"]
            direction TB
            TREG["Tool Registry\n(Server)"]:::server
            VAL["Parameter\nValidation"]:::server
            LOG["Centralized\nLogging"]:::server
            TREG --> VAL --> LOG
        end

        subgraph TOOLS["Tool Implementations"]
            direction LR
            UI_TOOLS["UI Tools\nslide, scene,\nsound, present,\nobserve"]:::server
            DATA_TOOLS["Data Tools\nartifact, checklist,\njournal, file"]:::server
            META_TOOLS["Meta Tools\ndelegate,\nsessionEvent,\nresearch"]:::server
            BUILD_TOOLS["Builder Tools\ncopyTemplate,\nmodifyExperience,\ndeployArtifact,\ngenerateImages"]:::server
        end

        TOOLSYS --> TOOLS

        subgraph DELEGATION["Backend Agent Executor"]
            direction TB
            DEL["Delegation\nManager"]:::server
            BA1["Backend Agent\n(e.g. Design Agent)"]:::ai
            BA2["Backend Agent\n(e.g. Casting Director)"]:::ai
            BA3["Backend Agent\n(e.g. Image Gen)"]:::ai
            DEL --> BA1
            DEL --> BA2
            DEL --> BA3
        end

        BA1 -->|"Backend agents\nmake their own\ntool calls"| TREG
        BA2 --> TREG
        BA3 --> TREG
    end

    SOCK_OUT -->|"tool.call"| TREG
    SOCK_OUT -->|"agent.delegate"| DEL
    TOOLS -->|"sendClientEvent\n(UI commands)"| SOCK_IN
    DELEGATION -->|"delegation:status\ntool.response"| SOCK_IN

    subgraph EXTERNAL["External AI Services"]
        direction LR
        OAI["OpenAI\n(Realtime Voice,\nGPT-4o)"]:::ai
        ANT["Anthropic\n(Claude Opus\nfor backend agents)"]:::ai
        GOO["Google\n(Gemini/Imagen\nfor image gen)"]:::ai
    end

    RT <-->|"WebRTC"| OAI
    BA1 <-->|"API"| ANT
    BA3 <-->|"API"| GOO

    subgraph STORAGE["File System Storage"]
        direction TB
        EXP["Experience Configs\n(experience.json)"]:::storage
        RES["Resources\n(prompts, scenes,\nsounds, supplements)"]:::storage
        SESS["Session Data\n(artifacts, transcripts,\njournals, checklists)"]:::storage
        TMPL["Templates\n(roleplay, teachback)"]:::storage
    end

    TOOLS <-->|"Read/Write"| STORAGE
    DELEGATION <-->|"Read/Write"| STORAGE
```

## Annotation

Primer's architecture follows a **backend-first** pattern: every tool call — whether initiated by a front-end voice agent running in the browser or a backend agent running on the server — is executed on the server. This seemingly redundant round-trip for front-end agents is intentional: it creates a single code path for all tool execution, enabling centralized logging, validation, authorization, and a unified programming model.

The **front-end agent** connects to the OpenAI Realtime API via WebRTC for low-latency voice conversation. When the agent decides to call a tool (show a slide, set a scene, create an artifact), the call is intercepted by a client-side **tool stub** that serializes it and sends it to the server over **Socket.IO**. The server's **Tool Registry** validates parameters, logs the invocation, and executes the tool implementation. If the tool has a UI effect (e.g., creating a slide), the server emits a socket event back to the browser, where a React event handler creates the corresponding component and registers it with the **UIElementManager** — a singleton that tracks all on-screen elements (position, size, visibility, z-index). The browser then sends a confirmation back to the server, which completes the tool call and returns the result to the agent.

**Backend agents** are invoked through the **delegate** tool. When the front-end agent delegates a task, the server spawns a backend agent execution context with full socket awareness — meaning backend agents can trigger UI changes on the educator's screen in real time (showing progress overlays, status updates, even creating slides). Backend agents use different AI providers depending on their task: Anthropic Claude for instruction-following tasks (design, casting, building), and Google Gemini for image generation. Each backend agent has access to the same tool registry and can make its own tool calls, including reading and writing artifacts to the file system.

The **storage layer** is file-system-based. Each experience is a directory containing an `experience.json` configuration file, resource directories for agent prompts, supplemental instructions, scene images, and sounds. Session data — artifacts, transcripts, journals, checklists — is stored per-session within the experience directory. Templates are special experiences marked with `kind: "template"` that serve as the structural foundation for new experiences created by the Experience Builder.
