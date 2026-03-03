# Artifact to Experience Workflow

## Overview

This document describes the `deployArtifact` tool and its role in the educational content creation workflow, where backend agents collaborate to generate complete experiences from educator input.

## Workflow Context

The system follows a 5-step delegation workflow:

1. **Educator** speaks to **Front-end AI**
2. **Front-end AI** delegates to **Backend Agents** 
3. **Backend Agents** create artifacts:
   - **Image Generation Agent** creates image artifacts (PNG/JPG files)
   - **Prompt Writing Agent** creates text artifacts (agent instruction files)
4. **Final Compilation Agent** compiles the new experience by:
   - Moving artifacts from temporary storage to permanent experience structure
   - Writing experience configuration files
   - Organizing resources in the correct directory structure

## File Storage Architecture

### Artifact Storage (Session-Scoped)
- **Location:** `storage/{experienceId}/session_data/{sessionId}/artifacts/`
- **Structure:** 
  - `{artifactId}.json` (metadata)
  - `{artifactId}.{extension}` (content)
- **Purpose:** Session-scoped storage for artifacts created during a session

### Experience Storage (Permanent)
- **Location:** `storage/{experienceId}/`
- **Structure:**
  ```
  storage/{experienceId}/
  ├── experience.json
  ├── resources/
  │   ├── images/
  │   ├── sounds/
  │   └── instructions/
  │       ├── agent/
  │       └── supplemental/
  ```
- **Purpose:** Permanent storage for complete experiences

## The deployArtifact Tool

### Purpose
Copies an artifact's content from temporary artifact storage to a specific location in the permanent experience directory structure.

### Parameters
- `artifactId` (required): The ID of the artifact to copy
- `experienceId` (required): The ID of the target experience
- `destinationPath` (required): The path within the experience where the file should be copied
- `fileName` (optional): New filename (if not provided, uses artifact name with appropriate extension)

### Behavior
- **Overwrite:** Replaces existing files at the destination
- **Auto-directory creation:** Creates necessary parent directories
- **File type handling:** Handles both text and binary files correctly
- **Name cleaning:** Sanitizes artifact names for filesystem compatibility
- **Extension mapping:** Automatically determines file extension based on artifact type

### Usage Examples

#### Copy Generated Image
```javascript
await deployArtifact({
  artifactId: "img-artifact-uuid-123",
  experienceId: "new-experience-456",
  destinationPath: "resources/images",
  fileName: "lesson-hero-image.png"
});
```

#### Copy Agent Prompt
```javascript
await deployArtifact({
  artifactId: "prompt-artifact-uuid-789", 
  experienceId: "new-experience-456",
  destinationPath: "resources/instructions/agent",
  fileName: "mentor-agent.md"
});
```

#### Copy Without Renaming
```javascript
await deployArtifact({
  artifactId: "artifact-uuid-456",
  experienceId: "new-experience-456", 
  destinationPath: "resources/images"
  // fileName not provided - uses artifact name + appropriate extension
});
```

## Agent Roles and Tool Usage

### Image Generation Agent
- **Creates:** Image artifacts (PNG, JPG, SVG)
- **Artifacts contain:** Base64-encoded image data
- **Next step:** Compilation agent copies to `resources/images/`

### Prompt Writing Agent  
- **Creates:** Text artifacts (Markdown files with agent instructions)
- **Artifacts contain:** Agent prompt text, behavioral instructions
- **Next step:** Compilation agent copies to `resources/instructions/agent/`

### Final Compilation Agent
- **Uses:** `deployArtifact` to move artifacts to permanent storage
- **Also uses:** Matter compiler tools to update `experience.json` configuration
- **Responsibilities:**
  - Copy all generated artifacts to appropriate experience directories
  - Update experience configuration with metadata
  - Organize resources according to experience structure conventions

## Integration with Existing Tools

### Works with these context functions:
- `getArtifact()` - Retrieves artifact content from temporary storage
- `createFile()` - Creates files in experience directory
- `createDirectory()` - Creates directories in experience structure

### Complements these tools:
- **Artifact tools:** `artifact()` for creating/managing artifacts
- **Experience tools:** `createExperience()`, `listResources()`, etc.
- **Matter compiler tools:** `modifyExperience()`, `modifyAgent()`, etc.

## Key Design Decisions

1. **Overwrite behavior:** Simplifies file management, prevents conflicts
2. **No automatic config updates:** Keeps tool focused, allows higher-level tools to handle configuration
3. **Single artifact operations:** Maintains predictable interface
4. **Automatic context handling:** Uses current experience/session automatically
5. **Filesystem-safe naming:** Prevents issues with special characters in artifact names

## Agent Prompt Considerations

When writing agent prompts, ensure agents understand:

1. **Artifact Creation Phase:** Agents should create artifacts first using the `artifact` tool
2. **Compilation Phase:** The final agent should use `deployArtifact` to move artifacts to permanent storage
3. **File Organization:** Follow the experience directory structure conventions
4. **Error Handling:** Check for successful artifact creation before attempting to copy
5. **Naming Conventions:** Use descriptive filenames that indicate purpose and type

## Example Agent Workflow

```
1. Image Agent: Creates artifact "lesson-diagram" (PNG)
2. Prompt Agent: Creates artifact "mentor-instructions" (Markdown)
3. Compilation Agent: 
   - Copies "lesson-diagram" to "resources/images/lesson-diagram.png"
   - Copies "mentor-instructions" to "resources/instructions/agent/mentor.md"
   - Updates experience.json with references to these resources
```

This workflow enables seamless collaboration between specialized agents while maintaining clean separation of concerns and proper file organization. 