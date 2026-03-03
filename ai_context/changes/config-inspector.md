# Configuration Inspector Feature

## Overview

The Configuration Inspector is a new feature in the Experience Editor that provides runtime analysis of `experience.json` files. It shows what the configuration actually means when loaded, making it easier to understand tool assignments, validate configurations, and preview upgrades.

## Location

**Access**: Experience Editor → Open `experience.json` → Click "Inspect" button in toolbar

## Features

### 1. Overview Section
- Basic metadata (title, version, configVersion, kind, author)
- Visual indicators for configuration version (legacy vs. new)

### 2. Statistics
- Total agent count (with frontend/backend breakdown)
- Unique tools count
- Resource counts (scenes, sounds, etc.)

### 3. Validation
- Structural validation (missing required fields)
- Reference validation (broken agent references, missing AI configurations)
- Tool configuration validation
- Severity levels: Error, Warning, Info

### 4. Upgrade Analysis
- Shows if upgrade is available (configVersion 1 → 2)
- Lists specific changes that will be made
- "Upgrade Now" button (when onUpgrade handler provided)

### 5. Agents & Tools (Key Feature!)
- **Per-agent breakdown** showing:
  - Agent name, type, model, provider
  - **Tool Source** - where tools come from:
    - `Explicit (availableTools)` - Legacy direct specification
    - `ToolSets: [names]` - ConfigVersion 2 format
    - `Groups: [names]` - Legacy agent-level groups
    - `Plugins → Groups: [names]` - Legacy experience-level plugins
    - `Fallback (all tools)` - No configuration
  - **Available Tools** - actual list of tools at runtime
  - Tool count
  - Downstream agents
  - Temperature setting

- **Expandable interface** - click agent to see details
- **Tool list display** - shows all tools as chips/badges

## Architecture

### Core Components

1. **ConfigAnalyzer** (`src/app/lib/ConfigAnalyzer.ts`)
   - Parses experience.json
   - Simulates runtime tool resolution
   - Validates configuration
   - Analyzes upgrade possibilities
   - Pure logic, no UI

2. **ConfigInspector** (`src/app/components/ConfigInspector.tsx`)
   - React component (modal dialog)
   - Uses ConfigAnalyzer for data
   - Displays results in scannable format
   - Expandable agent details

3. **Integration Points**
   - EditorPane: Added "Inspect" button (only for experience.json)
   - ExperienceEditor: Manages ConfigInspector state

### Data Flow

```
experience.json content (string)
  ↓
ConfigAnalyzer.analyze()
  ↓
ExperienceAnalysis object
  ├─ Basic info
  ├─ Statistics
  ├─ Validation issues
  ├─ Upgrade info
  └─ Agent analyses
      └─ For each agent:
          ├─ Tool source (how tools are determined)
          └─ Available tools (what they actually get)
  ↓
ConfigInspector UI
  └─ Renders in modal
```

### Tool Resolution Logic

The analyzer replicates the actual runtime logic:

```typescript
// Priority order (same as AgentConfigBuilder)
1. availableTools (explicit) → use as-is
2. toolSets (configVersion 2+) → expand to tool names
3. toolGroups (agent-level) → expand to tool names
4. plugins (experience-level) → convert to groups → expand to tools
5. fallback → "(all registered tools)"
```

## Use Cases

### 1. Pre-Migration Analysis
- Open legacy experience
- Click "Inspect"
- See current tool assignments
- Review what will change in upgrade
- Make informed decision

### 2. Post-Migration Verification
- Upgrade experience to configVersion 2
- Click "Inspect"
- Verify agents have correct tools
- Confirm no tools were lost/added unexpectedly

### 3. Debugging Tool Issues
- "Why doesn't my agent have tool X?"
- Open inspector
- See tool source for agent
- Understand which toolSet/group is being used
- Fix configuration accordingly

### 4. Configuration Documentation
- Share inspector output with team
- Visual representation of agent structure
- Clear tool assignments
- No need to manually trace through config

## Future Expansion

The architecture supports future enhancements:

### Visual Configuration Editor
- Click agent → edit toolSets
- Drag-and-drop tool assignment
- Visual agent hierarchy
- Real-time validation

### AI-Assisted Editing
- "Add research capability to agent X"
- AI suggests toolSet changes
- Preview impact before applying
- Explain tool dependencies

### Comparison View
- Compare two experience versions
- Show tool assignment differences
- Highlight breaking changes
- Migration impact analysis

### Export/Documentation
- Generate markdown documentation
- Export agent/tool matrix
- Create visual diagrams
- Share configuration summary

## Technical Notes

### Non-Destructive
- Analyzes current editor content (even unsaved changes)
- Never modifies files
- Safe to use anytime

### Performance
- Analysis is fast (< 100ms for typical configs)
- No network requests
- All computation client-side

### Extensibility
- ConfigAnalyzer returns structured data
- Easy to add new analysis types
- UI components are modular
- Can add new sections without breaking existing

## Testing

To test the feature:

1. Open Experience Editor
2. Navigate to any experience
3. Open `experience.json`
4. Click "Inspect" button in toolbar
5. Verify:
   - Overview shows correct info
   - Statistics are accurate
   - Agents list all agents
   - Expanding agent shows tools
   - Tool source is labeled correctly
   - Tool count matches list

## Related Files

- `src/app/lib/ConfigAnalyzer.ts` - Analysis logic
- `src/app/components/ConfigInspector.tsx` - UI component
- `src/app/components/ExperienceEditor/components/EditorPane.tsx` - Inspect button
- `src/app/components/ExperienceEditor/ExperienceEditor.tsx` - Integration
- `ai_context/changes/toolsets-migration.md` - Related migration docs
