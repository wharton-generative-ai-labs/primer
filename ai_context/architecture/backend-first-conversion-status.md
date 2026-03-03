# Backend-First Tool Conversion Status

**Last Updated:** 2026-01-29

This document tracks which tools have been converted to the backend-first pattern (using socket events) and which still need conversion. See `backend-first-tool-pattern.md` for the architectural details.

## Conversion Status Summary

- **Converted:** 7 tools
- **Not Converted (need conversion):** 11 tools with UI or state effects
- **Backend-Only (will remain so):** 25+ tools

---

## Converted to Backend-First

These tools use `context.sendClientEvent` and `requestManager` to communicate via socket events.

| Tool | Socket Events | UI Component | Notes |
|------|--------------|--------------|-------|
| `slide` | `ui.slide.create` → `tool_result` | SlideComponent | Creates windowed slides |
| `observe` | `ui.observe.request` → `ui.observe.response` | None (reads state) | Queries UIElementManager |
| `present` | `ui.element.show/hide/move/resize/maximize/destroy` → `tool_result` | None (controls existing) | Manipulates UI elements. `destroy` permanently removes elements. |
| `note` | `ui.note.display/update/delete/getScreenDimensions` → `tool_result` | NotesComponent | Creates sticky notes |
| `information` | Via `createToolStub` → `tool.call` | None | Uses InformationStore on backend |
| `delegate` | `agent.delegate` → `tool.response` | DelegationStatusComponent | Backend agent delegation |
| `customComponent` | `ui.component.create/updateState/getState/clearCache` → `tool_result` | ComponentWrapper | `list` is server-only (reads experience.json). Window management via `present`. |

---

## Not Converted - Need Conversion

These tools use direct context functions and would benefit from backend-first conversion for consistency and logging.

| Tool | Current Pattern | Has UI Effect? | Priority |
|------|----------------|----------------|----------|
| `scene` | Direct context (`setScene`, `getAvailableScenes`) | Yes (background change) | Medium |
| `file` | HTTP API + direct context for `requestUpload` | Yes (upload prompt) | Medium |
| `artifact` | Direct context (`createArtifact`, `getArtifact`) | No | Low |
| `checklist` | Depends on artifact context functions | No | Low |
| `agent` | Direct context (`setQueuedAgentTransfer`) | Yes (agent transfer) | Medium |
| `toast` | Direct `context.toast()` | Yes (toast notification) | Low |
| `sound` | Direct context (`playSound`) | Yes (audio playback) | Medium |
| `research` | Direct context (`searchWeb`) | No | Low |
| `diagram` | Direct context (`showMermaidDiagram`) | Yes (mermaid overlay) | Medium |
| `celebrate` | Direct DOM manipulation (browser-only) | Yes (confetti) | Low |
| `sessionEvent` | HTTP API calls | No | Low |

### Conversion Benefits

Converting these tools would provide:
- Centralized logging of all tool calls
- Consistent behavior between frontend and backend agents
- Ability to add authorization/rate limiting
- Better debugging via socket event traces

---

## Backend-Only Tools

These tools run exclusively on the server and will likely remain backend-only. Some may benefit from socket notifications to inform the frontend that an action occurred.

### Matter Compiler Tools

| Tool | Socket Notification Needed? | Notes |
|------|---------------------------|-------|
| `modifyExperience` | Maybe | Modifies experience.json |
| `modifyAgent` | Maybe | Modifies agent config |
| `modifyScene` | Maybe | Modifies scene config |
| `getExperience` | No | Read-only |
| `createAgentPrompt` | Maybe | Creates prompt files |
| `listAgentPrompts` | No | Read-only |
| `getAgentPrompt` | No | Read-only |
| `createSupplementalFile` | Maybe | Creates supplemental files |
| `listSupplementalFiles` | No | Read-only |
| `getSupplementalFile` | No | Read-only |
| `addSound` | Maybe | Adds sound to experience |

### Experience Management Tools

| Tool | Socket Notification Needed? | Notes |
|------|---------------------------|-------|
| `createExperience` | Maybe | Creates new experience folder |
| `copyTemplate` | Maybe | Copies template experience |
| `createDirectory` | Maybe | Creates directory |
| `createFile` | Maybe | Creates file |
| `deleteDirectory` | Maybe | Deletes directory |
| `deleteFile` | Maybe | Deletes file |
| `moveFile` | Maybe | Moves file |
| `moveDirectory` | Maybe | Moves directory |
| `listResources` | No | Read-only |
| `getResourceContent` | No | Read-only |
| `deployArtifact` | Maybe | Deploys artifact to experience |
| `validateComponent` | No | Validates JSX code |
| `generateComponentStyles` | No | Generates CSS |
| `getTemplateAgentInstructions` | No | Read-only |
| `listTemplateExperiences` | No | Read-only |

### Analytics Tools

| Tool | Socket Notification Needed? | Notes |
|------|---------------------------|-------|
| `listClassSessions` | No | Read-only |
| `readSessionFile` | No | Read-only |
| `writeSessionFile` | Maybe | Analytics write |
| `listSessionFiles` | No | Read-only |
| `readClassData` | No | Read-only |
| `writeClassData` | Maybe | Analytics write |
| `batchReadSessionFiles` | No | Read-only |

### Image Generation Tools

| Tool | Socket Notification Needed? | Notes |
|------|---------------------------|-------|
| `generateImages` | Maybe (progress) | Server-side NanoBanana API |

---

## Implementation Files Reference

### Converted Tools
- `src/app/lib/tools/ui/slides.ts` - slide tool
- `src/app/lib/tools/builtin/observe-tool.ts` - observe tool
- `src/app/lib/tools/builtin/present-tool.ts` - present tool (includes `destroy` action)
- `src/app/lib/tools/builtin/note-tool.ts` - note tool
- `src/app/lib/tools/builtin/information-tool.ts` - information tool
- `src/app/lib/tools/builtin/custom-component-tool.ts` - customComponent tool
- `src/app/lib/tools/delegation/delegate.ts` - delegate tool

### Frontend Event Handlers
- `src/app/lib/tools/client/ui-event-handlers.ts` - UI element event handlers
- `src/app/hooks/useHandleServerEvent.ts` - Main server event handler

### Client Stub System
- `src/app/lib/tools/client/tool-calling-shim.ts` - `createToolStub` function
- `src/app/lib/tools/builtin/register-client.ts` - Client-side tool registration

### Server-Side Registration
- `src/app/lib/tools/builtin/register.ts` - Server-side builtin tools
- `src/app/lib/tools/matter-compiler/register.ts` - Matter compiler tools
- `src/app/lib/tools/experience/index.ts` - Experience tools
- `src/app/lib/tools/analytics/index.ts` - Analytics tools

---

## Related Documents

- `ai_context/architecture/backend-first-tool-pattern.md` - Architectural pattern details
- `ai_context/architecture/socket-emission-pattern.md` - Socket event patterns
- `ai_context/architecture/tools-system.md` - Tools system overview
