# Tool Groups Quick Reference

## Summary Table

| Group | Count | Frontend | Backend | Primary Purpose |
|-------|-------|----------|---------|-----------------|
| `builtin` | 7 | ✅ | ✅ | Core functionality |
| `notes` | 1 | ✅ | ❌ | Sticky notes UI |
| `slide` | 1 | ✅ | ❌ | Slide presentations |
| `sound` | 1 | ✅ | ❌ | Audio playback |
| `mermaid` | 1 | ✅ | ❌ | Diagram rendering |
| `celebrate` | 1 | ✅ | ❌ | Animations |
| `delegation` | 1 | ✅ | ❌ | Backend agent delegation |
| `experience` | 13 | ✅ | ✅ | File operations |
| `matter-compiler` | 11 | ✅ | ✅ | Experience modification |
| `image-generator` | 1 | ✅ | ✅ | AI image generation |
| `analytics` | 7 | ❌ | ✅ | Session analytics |
| `web-search` | 1 | ✅ | ✅ | Web search |

---

## Command/Action Pattern

Tools have been consolidated into a command/action pattern where related functionality is grouped into single tools with an `action` parameter:

- `scene` (actions: discover, set, describe, addCustom, removeCustom)
- `information` (actions: discover, get, save)
- `file` (actions: listUploaded, getInfo, requestUpload)
- `agent` (actions: discover, transfer)
- `slide` (actions: show, showExisting, hide, hideAll, list, listActive, getContent)
- `sound` (actions: discover, play)
- `note` (actions: sync, display, move, hide, show, changeColor, bringToFront, toggleEffect, getScreenDimensions, get, list)
- `checklist` (actions: get, check, uncheck, showProgress, discover)
- `toast` (actions: show)
- `diagram` (actions: show, hide)
- `research` (actions: webSearch)

---

## Detailed Tool Lists

### builtin (7 tools)

**Scene Management:**
- `scene` - Manage background scenes
  - Actions: discover, set, describe, addCustom, removeCustom

**Information Storage:**
- `information` - Manage stored information
  - Actions: discover, get, save

**File Access:**
- `file` - Manage user file uploads
  - Actions: listUploaded, getInfo, requestUpload

**Artifacts:**
- `artifact` - Manage artifacts (list, create, show, delete)
- `checklist` - Manage checklist artifacts
  - Actions: get, check, uncheck, showProgress, discover

**Agent Control:**
- `agent` - Manage agent transitions
  - Actions: discover, transfer

**UI:**
- `toast` - Display toast notifications
  - Actions: show

---

### notes (1 tool)

- `note` - Manage sticky notes on screen
  - Actions: sync, display, move, hide, show, changeColor, bringToFront, toggleEffect, getScreenDimensions, get, list

---

### slide (1 tool)

- `slide` - Manage slide presentations
  - Actions: show, showExisting, hide, hideAll, list, listActive, getContent

---

### sound (1 tool)

- `sound` - Manage audio playback
  - Actions: discover, play

---

### mermaid (1 tool)

- `diagram` - Display Mermaid diagrams
  - Actions: show, hide

---

### celebrate (1 tool)

- `celebrate` - Trigger celebration animation (confetti)

---

### delegation (1 tool)

- `delegate` - Delegate task to a backend agent

---

### experience (15 tools)

**Creation:**
- `createExperience` - Create new experience with random ID
- `copyTemplate` - Copy from template experience

**File Operations:**
- `createDirectory` - Create directory in experience
- `createFile` - Create file in experience
- `deleteDirectory` - Delete directory in experience
- `deleteFile` - Delete file in experience
- `moveFile` - Move file in experience
- `moveDirectory` - Move directory in experience

**Reading:**
- `listResources` - List resources in experience
- `getResourceContent` - Get resource content

**Artifact Deployment:**
- `deployArtifact` - Deploy artifact from session storage to experience directory

**Component Generation:**
- `validateComponent` - Validate custom React component JSX before deployment
- `generateComponentStyles` - Generate Tailwind CSS for component after deployment

**Templates:**
- `getTemplateAgentInstructions` - Get agent instructions from template
- `listTemplateExperiences` - List available templates

---

### matter-compiler (11 tools)

**Experience Config:**
- `modifyExperience` - Modify experience metadata
- `getExperience` - Get full experience configuration

**Agents:**
- `modifyAgent` - Create, modify, or delete agent
- `createAgentPrompt` - Create agent prompt file
- `listAgentPrompts` - List all agent prompts
- `getAgentPrompt` - Get agent prompt content

**Scenes:**
- `modifyScene` - Add, modify, or delete scene

**Supplemental:**
- `createSupplementalFile` - Create supplemental file
- `listSupplementalFiles` - List supplemental files
- `getSupplementalFile` - Get supplemental file content

**Resources:**
- `addSound` - Add sound to experience

---

### image-generator (1 tool)

- `generateImage` - Generate image using AI (DALL-E or Imagen)

---

### analytics (7 tools)

- `listClassSessions` - List sessions for a class
- `readSessionFile` - Read file from session
- `writeSessionFile` - Write file to session
- `listSessionFiles` - List files in session
- `readClassData` - Read class-level data
- `writeClassData` - Write class-level data
- `batchReadSessionFiles` - Read multiple session files

---

### web-search (1 tool)

- `research` - Research information from various sources
  - Actions: webSearch

---

## Common Configurations

### Voice Tutor Agent
```json
"toolGroups": ["builtin", "notes", "sound", "slide"]
```

### Design/Planning Agent (Backend)
```json
"toolGroups": ["builtin", "experience", "matter-compiler"]
```

### Image Generation Agent (Backend)
```json
"toolGroups": ["builtin", "image-generator"]
```

### Full Experience Builder (Backend)
```json
"toolGroups": ["builtin", "experience", "matter-compiler", "image-generator"]
```

### Analytics Agent (Backend)
```json
"toolGroups": ["builtin", "analytics"]
```

### Minimal Processing (Backend)
```json
"toolGroups": ["builtin"]
```

---

## Backend Agent Defaults

If `toolGroups` is not specified for a backend agent, it defaults to:
```json
["builtin", "experience", "matter-compiler", "image-generator"]
```

## Never Give Backend Agents

These groups require browser context and will not work for backend agents:
- `notes` - Requires DOM
- `slide` - Requires DOM
- `mermaid` - Requires DOM
- `sound` - Requires browser audio
- `celebrate` - Requires DOM
- `delegation` - Backend agents shouldn't delegate to other backend agents
