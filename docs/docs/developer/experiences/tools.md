---
id: tools
title: Tools
sidebar_position: 5
---

# Experience Tools

Tools define what agents can do.

## Tool Groups

Assign tool groups to agents:

```json
{
  "agents": {
    "my-agent": {
      "toolGroups": ["builtin", "notes", "sound"]
    }
  }
}
```

## Available Groups

| Group | Purpose | Agent Type |
|-------|---------|------------|
| `builtin` | Core functionality | Both |
| `notes` | Sticky notes | Frontend |
| `sound` | Audio playback | Frontend |
| `slide` | Presentations | Frontend |
| `delegation` | Backend agents | Frontend |
| `experience` | File operations | Backend |
| `matter-compiler` | Config modification | Backend |

## Common Tools

- **scene**: Change background
- **note**: Display information
- **artifact**: Create documents
- **sound**: Play audio
- **delegate**: Call backend agent

## Next Steps

- [Tools System](/developer/architecture/tools-system) - Complete reference
- [Custom Tools](/developer/guides/custom-tools) - Build your own
