---
id: agents
title: Agents
sidebar_position: 3
---

# Designing Agents

Agents are AI personalities that interact with users.

## Agent Types

- **Frontend**: Voice interaction, real-time
- **Backend**: Complex processing, no voice

## Configuration

```json
{
  "agents": {
    "my-agent": {
      "name": "Friendly Name",
      "voice": "nova",
      "type": "frontend",
      "temperature": 0.7,
      "toolGroups": ["builtin", "notes"],
      "downstreamAgents": []
    }
  }
}
```

## Writing Instructions

Create clear, detailed prompts:

```markdown
# Agent Name

You are [personality description].

## Your Role
- [Responsibility 1]
- [Responsibility 2]

## Available Tools
- `tool`: Description

## Guidelines
1. [Guideline 1]
2. [Guideline 2]
```

## Next Steps

- [Tools](/developer/experiences/tools) - Agent capabilities
- [AI Providers](/developer/architecture/ai-providers) - Model selection
