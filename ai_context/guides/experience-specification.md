# Experience Specification

*Note: This specification is subject to change*

## Purpose

A Primer Experience is a self-contained definition of an interactive experience. It allows a Primer Application to run any valid Experience, provided it is capable of loading and executing that version.

Experiences can be loaded either directly as a single file from local storage, or via a URL.

## Packaging

During development of an Experience, it may be suitable to keep the files and folders as a typical directory structure on disk. However for publishing it is recommended to create a zip file for easier management.

## Project Structure

All resources should be organized under a `resources` directory that mirrors the structure defined in the experience.json. This makes the relationship between configuration and files clear and maintainable.

Recommended structure:

```
📦 project_name
├── 📂 metadata
│   ├── 📄 about.md
│   └── 🖼️ logo.png
├── 📂 resources
│   ├── 📂 instructions
│   │   ├── 📂 agent
│   │   │   ├── 📄 agent1.md
│   │   │   ├── 📄 agent2.md
│   │   │   └── 📄 agent3.md
│   │   └── 📂 supplemental
│   │       ├── 📄 include1.md
│   │       └── 📄 include2.md
│   ├── 📂 scenes
│   │   ├── 🖼️ image1.png
│   │   ├── 🖼️ image2.png
│   │   └── 🖼️ image3.png
│   └── 📂 sounds
│       ├── 🔊 sound1.mp3
│       └── 🔊 sound2.mp3
└── 📄 experience.json
```

This project structure organizes all assets under a `resources` directory with these main sections:

1. `resources/instructions/` - Contains markdown files for:
   - `agent/` - Agent-specific instructions
   - `supplemental/` - Additional configuration and shared instructions
2. `resources/scenes/` - Contains PNG image assets used in the game
3. `resources/sounds/` - Contains MP3 audio assets

The `metadata` directory contains project information and logo (future use)

The root directory contains only the experience.json configuration file.

The experience.json file defines:
- Basic project metadata (version, title, description)
- Resource references for all files (scenes, sounds, instructions)
- Agent configurations including names, voices, descriptions, and flow connections
- The initial agent to start the experience

## Example experience.json

```json
{
    "version": "1.0.0",
    "title": "project_name",
    "logo": "resources/brand/logo.png",
    "description": "Project description goes here",
    "resources": {
        "scenes": [
            "resources/scenes/image1.png",
            "resources/scenes/image2.png",
            "resources/scenes/image3.png"
        ],
        "sounds": [
            "resources/sounds/sound1.mp3",
            "resources/sounds/sound2.mp3"
        ],
        "instructions": {
            "agent": {
                "agent1": "resources/instructions/agent/agent1.md",
                "agent2": "resources/instructions/agent/agent2.md",
                "agent3": "resources/instructions/agent/agent3.md"
            },
            "supplemental": {
                "include1": "resources/instructions/supplemental/include1.md",
                "include2": "resources/instructions/supplemental/include2.md"
            }
        }
    },
    "agents": {
        "agent1": {
            "name": "Agent One",
            "voice": "voice1",
            "publicDescription": "Description of agent one",
            "downstreamAgents": [
                "agent2"
            ]
        },
        "agent2": {
            "name": "Agent Two", 
            "voice": "voice2",
            "publicDescription": "Description of agent two",
            "downstreamAgents": [
                "agent3"
            ]
        },
        "agent3": {
            "name": "Agent Three",
            "voice": "voice3",
            "publicDescription": "Description of agent three",
            "downstreamAgents": []
        }
    },
    "initialAgent": "agent1"
}
```

Key differences from previous versions:
1. All assets are now organized under a `resources` directory
2. File paths in experience.json include full path from project root
3. Agent instructions are now referenced in `resources.instructions.agent` instead of in agent properties
4. Supplemental instructions (formerly "includes") are now in `resources.instructions.supplemental`
5. Brand assets have a dedicated location in `resources/brand/`