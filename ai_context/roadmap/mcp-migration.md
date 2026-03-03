# MCP Server Migration Roadmap

> **Note**: This is a FUTURE PLAN, not current implementation. The current system uses the architecture described in `/architecture/`.

## Vision

Migrate Primer from its current Next.js-integrated architecture to a clean backend/frontend separation using Model Context Protocol (MCP) as the core abstraction for AI communication and tool execution.

## Proposed Architecture

### Three-Tier Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  • Scene Rendering  • Voice UI  • Transcript  • Experience UI   │
└─────────────────────────────┬───────────────────────────────────┘
                              │ REST API / WebSocket
┌─────────────────────────────┴───────────────────────────────────┐
│                      Backend API Server                         │
│  • Authentication  • Session Mgmt  • File Storage  • API Routes │
└─────────────────────────────┬───────────────────────────────────┘
                              │ MCP Protocol
┌─────────────────────────────┴───────────────────────────────────┐
│                        MCP Server                               │
│  • Experience Runtime  • Tool Registry  • Context Management    │
│  • AI Provider Abstraction  • State Orchestration               │
└─────────────────────────────────────────────────────────────────┘
```

## Why MCP?

### Current Challenges
- AI provider logic mixed with frontend code
- Plugin system embedded in the Next.js application
- Tool execution happening in various places
- Experience orchestration spread across client and server

### MCP Benefits
1. **Clean Separation**: Frontend focuses on UI, backend on logic, MCP on AI
2. **Provider Agnostic**: Easy to switch between AI providers
3. **Extensibility**: New tools as MCP extensions
4. **Standardization**: Tools follow MCP specification
5. **Scalability**: MCP servers can scale independently

## Implementation Phases

### Phase 1: Foundation
- Basic MCP server implementation
- Tool registration system
- Context management
- Essential tools (scene, sound, agent transition)

### Phase 2: Integration
- Realtime bridge for OpenAI Realtime API
- Socket.IO integration
- Experience loading
- State management

### Phase 3: Provider Expansion
- AI provider abstraction
- Anthropic integration
- Local LLM support
- Provider selection logic

### Phase 4: Tool Migration
- All tools migrated to MCP
- Plugin system via MCP tools
- Tool enhancements

### Phase 5: Production
- Performance optimization
- Monitoring setup
- Developer tools
- Documentation

## Hybrid Backend Architecture (Proposed)

### Django Backend (primer-django)
- Handles all traditional web application concerns
- RESTful API for CRUD operations
- User authentication and authorization
- File uploads and storage management
- Admin interface for content management

### FastAPI Service (primer-mcp)
- Handles all real-time and AI concerns
- MCP server implementation
- WebSocket connections
- AI provider management
- Tool execution
- Streaming responses

## Migration Strategy

### Step 1: Extract Tool System
- Create standalone tool definitions
- Implement MCP tool wrapper
- Test with existing functionality

### Step 2: Build MCP Server
- Implement core MCP protocol
- Add experience context management
- Create tool execution engine

### Step 3: Refactor Backend
- Move AI logic to MCP server
- Update API routes to use MCP
- Implement proper session management

### Step 4: Update Frontend
- Remove direct AI communication
- Use WebSocket for updates
- Simplify state management

### Step 5: Enhance and Extend
- Add new tools
- Implement advanced features
- Optimize performance

## Technical Considerations

### Realtime Compatibility
The MCP server must maintain OpenAI Realtime API support via a bridge:

```python
class RealtimeBridge:
    async def handle_realtime_event(self, event):
        # Translate Realtime events to MCP calls
        if event.type == "conversation.item.create":
            mcp_response = await self.mcp.process_message(event.content)
            return self.format_for_realtime(mcp_response)
```

### Security
- Tool sandboxing
- Input validation
- Rate limiting
- Authentication between services

### Performance
- Context size management
- Efficient state updates
- Caching strategies
- Connection pooling

## Success Metrics

### Technical
- All existing experiences work unchanged
- Response time <= current system
- 99.9% uptime for tool execution
- Support for 3+ AI providers

### Developer
- New tool creation < 30 minutes
- New provider integration < 1 day
- Clear documentation and examples
- Automated testing > 80% coverage

## Timeline

This is a long-term initiative with no fixed timeline. The current architecture (documented in `/architecture/`) remains the production system.

## Related Documents

- Current architecture: `/architecture/overview.md`
- Current tools system: `/architecture/tools-system.md`
- Provider expansion plans: `/roadmap/provider-expansion.md`
