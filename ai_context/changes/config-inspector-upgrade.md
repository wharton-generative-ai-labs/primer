# Configuration Inspector - In-App Upgrade Feature

## Overview

Added the ability to upgrade experience.json configurations directly from the Configuration Inspector UI, without needing to run the migration script manually.

## Implementation

### API Endpoint

**`/api/experience/upgrade-config`** (POST)
- Accepts `experienceId` and `configContent`
- Validates that upgrade is needed (configVersion < 2)
- Applies the upgrade transformation
- Writes the upgraded config back to disk
- Returns the upgraded configuration

### Upgrade Logic Module

**`src/app/api/experience/upgrade-config/upgradeLogic.ts`**
- Shared upgrade logic that can be used by both the API and migration scripts
- Converts legacy `tools.plugins` to `toolSets`
- Assigns appropriate toolSets to agents based on their type
- Removes deprecated fields (`toolGroups`, `availableTools`)
- Sets `configVersion: 2`

### UI Integration

**ConfigInspectorPanel**
- Added `experienceId` prop to identify which experience to upgrade
- Added `handleUpgrade` function that calls the API endpoint
- Shows "Upgrading..." state during the operation
- On success, calls `onUpgradeComplete` to reload the file
- Displays errors if upgrade fails

**EditorPane**
- Passes `experienceId` to ConfigInspectorPanel
- Implements `handleUpgradeComplete` to switch back to code view and reload
- Added `onReloadFile` prop to trigger file reload

**ExperienceEditor**
- Passes `experienceId` down to EditorPane
- Implements reload logic by temporarily clearing and resetting `selectedPath`

## User Flow

1. User opens `experience.json` in the editor
2. User clicks "Inspect" to view the Configuration Inspector
3. If the config is version 1, an "Upgrade Available" section appears
4. User clicks "Upgrade Now" button
5. API upgrades the file on disk
6. UI automatically switches back to code view and reloads the file
7. User sees the upgraded configuration with `configVersion: 2`

## Benefits

- No need to run command-line migration scripts
- Immediate visual feedback on what changed
- Safe operation with error handling
- Automatic file reload after upgrade
- Works in all environments (local, staging, production)

## Error Handling

- Validates that upgrade is needed before proceeding
- Catches and displays errors during upgrade
- Logs all operations for debugging
- Gracefully handles file system errors

## Future Enhancements

- Add a "Preview Changes" mode before applying upgrade
- Support for future config version migrations (v2 → v3, etc.)
- Backup creation before upgrade
- Undo functionality
