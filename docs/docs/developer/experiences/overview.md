---
id: overview
title: Experiences Overview
sidebar_position: 1
---

# Creating Experiences

Learn how to build interactive AI experiences with Primer.

## What You'll Learn

- [Configuration](/developer/experiences/configuration) - Structure and schema
- [Agents](/developer/experiences/agents) - Designing AI personalities
- [Scenes & Sounds](/developer/experiences/scenes-and-sounds) - Visual and audio elements
- [Tools](/developer/experiences/tools) - Agent capabilities

## Quick Start

### 1. Create Directory Structure

```bash
mkdir -p storage/my-experience/resources/{scenes,sounds,instructions/agent}
```

### 2. Create experience.json

```json
{
  "version": "1.0.0",
  "title": "My Experience",
  "description": "An interactive experience",
  "agents": {
    "main": {
      "name": "Main Agent",
      "voice": "nova",
      "publicDescription": "Your guide",
      "toolGroups": ["builtin", "notes"]
    }
  },
  "initialAgent": "main",
  "resources": {
    "instructions": {
      "agent": {
        "main": "resources/instructions/agent/main.md"
      }
    }
  }
}
```

### 3. Create Agent Instructions

```markdown
# Main Agent

You are a friendly and helpful guide.

## Your Role
- Welcome users warmly
- Guide them through the experience
- Use notes to highlight key points

## Available Tools
- `scene`: Change background
- `note`: Display information
- `artifact`: Create documents
```

### 4. Test

Load at `http://localhost:3000` and test your experience.

## Experience Types

### Educational
- Tutoring and coaching
- Practice scenarios
- Assessments

### Professional
- Role-play training
- Interview practice
- Skill development

### Creative
- Collaborative writing
- Brainstorming
- Design thinking

## Best Practices

1. **Start simple** - Basic agent, then add complexity
2. **Test frequently** - Try after each change
3. **Clear instructions** - Detailed agent prompts
4. **Use tools wisely** - Don't overwhelm with options
5. **Get feedback** - Test with real users

## Next Steps

- [Configuration](/developer/experiences/configuration) - Detailed schema
- [Agents](/developer/experiences/agents) - Agent design
- [Creating First Experience](/developer/guides/creating-first-experience) - Step-by-step guide
