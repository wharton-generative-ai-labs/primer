---
id: creating-first-experience
title: Creating Your First Experience
sidebar_position: 1
---

# Creating Your First Experience

Build a simple interactive experience from scratch.

## Step 1: Create Directory

```bash
cd storage
mkdir -p my-first-experience/resources/{scenes,sounds,instructions/agent}
cd my-first-experience
```

## Step 2: Create experience.json

```json
{
  "version": "1.0.0",
  "title": "My First Experience",
  "description": "A simple greeting experience",
  "agents": {
    "greeter": {
      "name": "Friendly Greeter",
      "voice": "nova",
      "publicDescription": "A warm and welcoming guide",
      "toolGroups": ["builtin", "notes"]
    }
  },
  "initialAgent": "greeter",
  "resources": {
    "instructions": {
      "agent": {
        "greeter": "resources/instructions/agent/greeter.md"
      }
    }
  }
}
```

## Step 3: Create Agent Instructions

Create `resources/instructions/agent/greeter.md`:

```markdown
# Friendly Greeter

You are a warm and welcoming guide for new users.

## Your Personality
- Enthusiastic and positive
- Patient and encouraging
- Clear and concise

## Your Role
1. Greet the user warmly
2. Ask their name
3. Explain what Primer is
4. Offer to show them around

## Available Tools
- `note`: Use to display key information
- `scene`: Use to change the background (if scenes available)
- `artifact`: Use to create welcome documents

## Example Flow
1. "Hello! Welcome to Primer! I'm so glad you're here."
2. "What's your name?"
3. [After response] "Great to meet you, [name]!"
4. "Let me show you what Primer can do..."
5. [Use note tool to display key features]
```

## Step 4: Test

1. Start Primer: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Load experience: Enter `my-first-experience` or upload
4. Grant microphone permission
5. Start talking!

## Step 5: Enhance

### Add a Scene

1. Add an image to `resources/scenes/welcome.png`
2. Update `experience.json`:

```json
{
  "resources": {
    "scenes": ["resources/scenes/welcome.png"],
    ...
  }
}
```

3. Update agent instructions to use the scene

### Add a Sound

1. Add audio to `resources/sounds/hello.mp3`
2. Update `experience.json`:

```json
{
  "resources": {
    "sounds": ["resources/sounds/hello.mp3"],
    ...
  }
}
```

3. Add `sound` to tool groups:

```json
{
  "agents": {
    "greeter": {
      "toolGroups": ["builtin", "notes", "sound"]
    }
  }
}
```

## Next Steps

- [Custom Tools](/developer/guides/custom-tools) - Add new capabilities
- [Experience Format](/developer/architecture/experience-format) - Full configuration
- [Deployment](/developer/guides/deployment) - Share your experience

## Troubleshooting

**Experience won't load**: Check JSON syntax in `experience.json`

**Agent doesn't respond**: Verify instruction file path is correct

**Tools not working**: Check tool groups are spelled correctly

**Voice issues**: Ensure microphone permissions are granted
