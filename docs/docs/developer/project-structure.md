---
id: project-structure
title: Project Structure
sidebar_position: 3
---

# Project Structure

Understanding how Primer is organized will help you navigate and contribute to the codebase.

## High-Level Overview

```
primer/
├── src/                    # Source code
├── storage/                # Experience data
├── public/                 # Static assets
├── docs/                   # Documentation (Docusaurus)
├── scripts/                # Build and utility scripts
├── server.ts               # Custom server entry point
└── next.config.ts          # Next.js configuration
```

## Source Code (`src/`)

### App Directory (`src/app/`)

Next.js 15 App Router structure:

```
src/app/
├── api/                    # API routes
│   ├── backend-agent/     # Backend agent execution
│   ├── openai/            # OpenAI proxy endpoints
│   ├── storage/           # File storage operations
│   └── ...
├── lib/                   # Core libraries
│   ├── tools/             # Tool implementations
│   ├── ai/                # AI provider abstractions
│   ├── storage/           # Storage services
│   ├── ConfigLoader.ts    # Experience configuration
│   └── ToolRegistry.ts    # Tool registration
├── play/[id]/             # Experience player UI
├── manage/[id]/           # Experience editor UI
├── contexts/              # React contexts
└── components/            # Page-specific components
```

### Tools System (`src/app/lib/tools/`)

All tools are centralized here:

```
tools/
├── index.ts               # Exports all register functions
├── groups.ts              # Tool group mappings
├── types.ts               # Shared types
├── builtin/               # Core tools (scene, information, etc.)
├── sound/                 # Audio playback
├── ui/                    # UI tools (notes, slides, diagrams)
├── experience/            # File operations
├── matter-compiler/       # Experience modification
├── delegation/            # Agent delegation
├── image-generator/       # AI image generation
├── analytics/             # Session analytics
└── web-search/            # Web search capability
```

### Components (`src/components/`)

Shared React components:

```
components/
└── ui/                    # shadcn/ui components
    ├── button.tsx
    ├── dialog.tsx
    ├── input.tsx
    └── ...
```

## Storage Directory

Experience data and session information:

```
storage/
├── {experienceId}/
│   ├── experience.json         # Configuration
│   ├── classes.json            # Class management (optional)
│   ├── resources/
│   │   ├── scenes/             # Images
│   │   ├── sounds/             # Audio
│   │   └── instructions/
│   │       ├── agent/          # Agent prompts
│   │       └── supplemental/   # Shared instructions
│   ├── session_data/
│   │   └── sess_{uuid}/        # Per-session data
│   └── class_data/             # Class analytics (optional)
└── user-uploads/               # Uploaded files
```

## Key Files

### Server Entry Point

**`server.ts`**: Custom HTTP server integrating Next.js with Socket.IO
- Handles WebSocket connections
- Routes real-time updates
- Manages toast notifications

### Configuration

**`next.config.ts`**: Next.js configuration
- Webpack customizations
- CSP headers
- Runtime configurations

**`middleware.ts`**: Edge middleware
- Authentication
- Request routing
- Runs in Edge Runtime (no Node.js APIs)

### Type Definitions

**`src/app/lib/types.ts`**: Core TypeScript types
- ExperienceConfig
- AgentConfig
- ToolContext
- And more...

## API Routes

### Backend Agent (`/api/backend-agent/`)

```
backend-agent/
├── route.ts               # Main execution logic
└── utils/
    ├── context.ts         # Server-side tool context
    └── provider-adapter.ts # AI provider conversion
```

### Storage (`/api/storage/`)

File and experience management endpoints.

### OpenAI Proxy (`/api/openai/`)

Proxies requests to OpenAI API with authentication.

## Development Patterns

### Adding a New Feature

1. **API Route**: Add to `src/app/api/`
2. **UI Component**: Add to `src/components/` or `src/app/components/`
3. **Tool**: Add to `src/app/lib/tools/{group}/`
4. **Type**: Add to `src/app/lib/types.ts`

### File Naming Conventions

- **Components**: PascalCase (e.g., `Button.tsx`)
- **Utilities**: camelCase (e.g., `configLoader.ts`)
- **API Routes**: `route.ts` in directory
- **Types**: Interfaces and types in `types.ts`

## Build Artifacts

```
.next/                     # Next.js build output
build/                     # Production build
node_modules/              # Dependencies
```

## Configuration Files

- **`package.json`**: Dependencies and scripts
- **`tsconfig.json`**: TypeScript configuration
- **`eslint.config.mjs`**: Linting rules
- **`tailwind.config.ts`**: Tailwind CSS configuration
- **`components.json`**: shadcn/ui configuration

## Next Steps

- Explore [Architecture Guide](/developer/architecture/architecture-guide)
- Learn about [Tools System](/developer/architecture/tools-system)
- Read [Experience Format](/developer/architecture/experience-format)
