# ToolGroups Upgrade Fix

**Date**: 2026-01-22  
**Status**: Completed

## Overview

Fixed the experience.json upgrade mechanism to accurately convert agent-level `toolGroups` to explicit `toolSets` with the correct tools.

## Problem

The original upgrade logic (in `upgradeLogic.ts`) was not handling agent-level `toolGroups` correctly:

1. It only processed experience-level `tools.plugins` array
2. It deleted agent-level `toolGroups` without converting them
3. All agents were assigned generic toolSets (`default` or `backend-default`) regardless of their specific `toolGroups` configuration

This meant that agents with specific toolGroups like `["builtin", "analytics"]` would lose their precise tool configuration during upgrade.

## Solution

### Agent-Level ToolGroups Conversion

The upgrade logic now:

1. **Detects agent-level toolGroups**: Checks each agent for a `toolGroups` array
2. **Converts to custom toolSets**: For each agent with toolGroups:
   - Collects all tools from each specified group
   - Creates a custom toolSet named `{agentKey}-tools`
   - Assigns the agent to use this custom toolSet
3. **Preserves exact tool lists**: The custom toolSet contains exactly the tools from the specified groups

### Example

**Before upgrade** (configVersion 1):
```json
{
  "agents": {
    "studentReport": {
      "name": "Student Report",
      "type": "backend",
      "toolGroups": ["builtin", "analytics"]
    }
  }
}
```

**After upgrade** (configVersion 2):
```json
{
  "configVersion": 2,
  "toolSets": {
    "studentReport-tools": [
      "agent",
      "artifact",
      "batchReadSessionFiles",
      "checklist",
      "file",
      "information",
      "listClassSessions",
      "listSessionFiles",
      "observe",
      "present",
      "readClassData",
      "readSessionFile",
      "scene",
      "slide",
      "toast",
      "writeClassData",
      "writeSessionFile"
    ],
    "backend-default": [...]
  },
  "agents": {
    "studentReport": {
      "name": "Student Report",
      "type": "backend",
      "toolSets": ["studentReport-tools"]
    }
  }
}
```

### Fallback Behavior

For agents without specific toolGroups:

- **Backend agents**: Get `backend-default` preset
- **Frontend agents**: Get `default` toolSet (from plugins or frontend-default preset)

### Experience-Level Plugins

The logic still handles experience-level `tools.plugins`:

1. Converts plugins to groups
2. Creates a `default` toolSet with all tools from those groups
3. Assigns frontend agents to use `default`

### Priority

Agent-level `toolGroups` take priority over experience-level `tools.plugins`. If an agent has specific toolGroups, those are used instead of the experience-level configuration.

## Testing

Created comprehensive test suite at:
- `src/app/api/experience/upgrade-config/__tests__/upgradeLogic.test.ts`

Tests cover:
- Agent-level toolGroups conversion
- Experience-level plugins conversion
- Mixed configurations (some agents with toolGroups, some without)
- Edge cases (empty arrays, no configuration, etc.)
- Non-mutation of original config

All 14 tests pass ✓

## Files Changed

1. **src/app/api/experience/upgrade-config/upgradeLogic.ts**
   - Added agent-level toolGroups detection and conversion
   - Fixed deep copy to prevent mutation
   - Added fallback to frontend-default preset when no plugins exist

2. **src/app/api/experience/upgrade-config/__tests__/upgradeLogic.test.ts** (new)
   - Comprehensive test coverage for upgrade logic

3. **src/app/api/backend-agent/managers/__tests__/ToolRegistrationManager.test.ts**
   - Updated mocks to include new functions: `getToolsForNames`, `expandToolSets`, `getPresetToolSet`
   - Updated test expectations to match new fallback behavior (backend-default preset)

## Impact

### Affected Templates

Two templates have agent-level toolGroups:
- `storage/teachback-template/experience.json`
- `storage/roleplay-template/experience.json`

Both have `studentReport` and `classAnalytics` agents with:
```json
"toolGroups": ["builtin", "analytics"]
```

After upgrade, these will get custom toolSets with the exact tools from those groups.

### User Experience

When users click "Upgrade Now" in the ConfigInspectorPanel:
1. Agent-specific toolGroups are preserved as custom toolSets
2. The exact tools from those groups are explicitly listed
3. No tool access is lost or incorrectly added
4. The upgrade is accurate and reversible (by examining the generated toolSets)

## Related Files

- `src/app/lib/ConfigAnalyzer.ts` - Already correctly analyzes agent-level toolGroups
- `src/app/components/ConfigInspectorPanel.tsx` - Triggers the upgrade
- `src/app/lib/tools/groups.ts` - Provides group-to-tools mapping functions
