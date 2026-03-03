# ToolSets Configuration Migration

## Overview

This document describes the migration from the legacy plugin-based tool configuration (configVersion 1) to the new toolSets-based configuration (configVersion 2).

## Motivation

The original tool configuration system used "plugins" - a legacy pattern from when tools were distributed as separate npm packages. This had several limitations:

1. **Coarse granularity**: Tools could only be specified at the experience level, not per-agent
2. **Implicit behavior**: Backend agents received a hardcoded set of tools, not explicitly configured
3. **Hardcoded mappings**: Plugin-to-group and group-to-tool mappings were embedded in code
4. **Limited flexibility**: No way to create custom tool combinations for specific agents

## New Configuration Format

### configVersion 2

The new format introduces:

1. **Explicit toolSets**: Named collections of tools defined at the experience level
2. **Per-agent toolSets**: Each agent specifies which toolSets it uses
3. **External mappings**: Tool mappings moved to `storage/config/tool-mappings.json`
4. **Preset toolSets**: Common tool combinations (frontend-default, backend-default, minimal)

### Example Configuration

```json
{
  "configVersion": 2,
  "toolSets": {
    "default": ["scene", "information", "file", "artifact", ...],
    "backend-default": ["scene", "information", "createExperience", ...],
    "custom": ["scene", "toast"]
  },
  "agents": {
    "hal": {
      "name": "HAL",
      "type": "frontend",
      "toolSets": ["default"]
    },
    "backend": {
      "name": "Backend Agent",
      "type": "backend",
      "toolSets": ["backend-default"]
    }
  }
}
```

## Migration Process

### Automated Migration

Use the migration script to convert existing experiences:

```bash
# Dry run (preview changes)
npm run migrate:configs:dry-run

# Migrate all experiences in storage/
npm run migrate:configs

# Migrate specific directory
npm run migrate:configs -- --storage-path storage/my-experience
```

### Manual Migration

If you prefer to migrate manually:

1. Add `"configVersion": 2` to the experience.json
2. Create `toolSets` object with tool collections
3. Add `toolSets` array to each agent
4. Remove the legacy `tools.plugins` array
5. Remove deprecated `toolGroups` and `availableTools` from agents

## Tool Mappings Configuration

Tool mappings are now externalized to `storage/config/tool-mappings.json`:

```json
{
  "version": "1.0.0",
  "pluginToGroup": {
    "@primer/builtin-plugin": "builtin",
    ...
  },
  "groupToTools": {
    "builtin": ["scene", "information", "file", ...],
    ...
  },
  "presetToolSets": {
    "frontend-default": [...],
    "backend-default": [...]
  }
}
```

This allows:
- Easy updates without code changes
- Single source of truth for tool organization
- Version tracking of tool mappings

## Backward Compatibility

The system supports both configVersion 1 and 2:

- **configVersion 1** (or no configVersion): Uses legacy `tools.plugins` format
- **configVersion 2+**: Uses new `toolSets` format

Legacy configurations will continue to work but will log deprecation warnings.

## Code Changes

### Key Files Modified

1. **src/app/lib/types.ts**: Added `configVersion`, `toolSets` fields
2. **src/app/lib/tools/groups.ts**: Refactored to load from external config
3. **src/app/lib/ConfigLoader/ToolProcessor.ts**: Added configVersion detection
4. **src/app/lib/ConfigLoader/AgentConfigBuilder.ts**: Computes `availableTools` from `toolSets` at config load time
5. **src/app/api/backend-agent/managers/ToolRegistrationManager.ts**: Added toolSets support for backend agents
6. **src/app/hooks/useSessionManagement.ts**: Added warning when falling back to all tools
7. **storage/config/tool-mappings.json**: New external configuration file

### New Functions

- `getToolsForNames(toolNames: string[])`: Get tools by explicit names
- `getPresetToolSet(name: string)`: Get a preset toolSet
- `expandToolSets(toolSetNames, customToolSets)`: Expand toolSet names to tool names
- `computeAvailableTools(agentData, experienceConfig)`: Compute availableTools from toolSets/toolGroups/availableTools

### Critical Runtime Behavior

**availableTools Computation**: The `AgentConfigBuilder` now automatically computes `availableTools` for each agent at config load time:

1. **Priority Order**:
   - Explicit `availableTools` (legacy configVersion 1) - used as-is
   - `toolSets` (configVersion 2+) - expanded to tool names and deduplicated
   - `toolGroups` (legacy) - expanded to tool names and deduplicated
   - `undefined` - falls back to all registered tools in `useSessionManagement`

2. **Frontend Agents**: Use `availableTools` to filter which tools are sent to the AI
3. **Backend Agents**: Use `toolSets` or `toolGroups` directly in `ToolRegistrationManager`

This ensures that with configVersion 2, agents get exactly the tools specified in their `toolSets`, not all registered tools.

## Benefits

1. **Explicit configuration**: Clear which tools each agent can use
2. **Flexible granularity**: Different agents can have different tool access
3. **Easier maintenance**: Tool mappings in JSON, not code
4. **Better defaults**: Preset toolSets for common patterns
5. **Custom combinations**: Create specific tool sets for specialized agents

## Deployment Notes

### For Local Development

1. Run migration script on local storage
2. Test experiences to ensure tools work correctly
3. Commit migrated experience.json files

### For Staging/Production

1. Deploy updated code to environment
2. SSH into environment or use deployment scripts
3. Run: `npm run migrate:configs`
4. Verify experiences load correctly
5. Monitor logs for any deprecation warnings

### Rollback Plan

If issues arise:
1. The old configVersion 1 format is still supported
2. Revert experience.json files from git
3. System will automatically use legacy code path

## Future Improvements

1. Remove configVersion 1 support in a future major version
2. Add validation for toolSet definitions
3. Create UI for managing toolSets
4. Add toolSet inheritance/composition

## Testing

All existing tests pass with the new implementation:
- `src/app/lib/tools/__tests__/groups.test.ts`: 52 tests passing
- Backward compatibility maintained through Proxy objects
- Migration script tested on 8 local experiences

## Questions?

Contact: Ben Przystanski (bprzy@wharton.upenn.edu)
