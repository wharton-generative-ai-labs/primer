# CSS Generation Bug Fix - January 2026

## Problem Summary

The `generateComponentStyles` tool was not being called by backend agents (specifically the Interface Designer agent) even though:
1. The tool was implemented in `/src/app/lib/tools/experience/experience.ts`
2. The tool was registered in the ToolRegistry
3. The Interface Designer instructions explicitly called for it in Step 5

**Symptoms:**
- Dynamic JSX components were deployed successfully
- Components appeared in the UI with correct functionality
- Tailwind utility classes were present in JSX but had no effect
- No `.css` file was created alongside the `.jsx` file
- The agent generated 4 images instead of calling `generateComponentStyles`

**Root Cause:**
The `generateComponentStyles` and `validateComponent` tools were **not included in the `TOOL_GROUPS['experience']` array** in `/src/app/lib/tools/groups.ts`, even though they were registered in the ToolRegistry. Backend agents receive tools based on their `toolGroups` configuration, which uses the `TOOL_GROUPS` mapping to determine which tools are available.

## Technical Details

### Tool Availability Flow

1. Backend agent specifies `toolGroups: ["builtin", "experience", "matter-compiler", "image-generator"]` (default)
2. `ToolRegistrationManager.getToolsForAgent()` calls `getToolsForGroups(toolGroups)`
3. `getToolsForGroups()` looks up tool names in `TOOL_GROUPS` mapping
4. Only tools listed in the specified groups are returned to the agent

### What Was Missing

In `/src/app/lib/tools/groups.ts`, the 'experience' tool group was:

```typescript
'experience': [
  'createExperience',
  'copyTemplate',
  'createDirectory',
  'createFile',
  'deleteDirectory',
  'deleteFile',
  'moveFile',
  'moveDirectory',
  'listResources',
  'getResourceContent',
  'deployArtifact',
  'getTemplateAgentInstructions',
  'listTemplateExperiences'
]
```

Missing: `'validateComponent'` and `'generateComponentStyles'`

## The Fix

### Code Changes

**File: `/src/app/lib/tools/groups.ts`**

Added the missing tools to the 'experience' tool group:

```typescript
'experience': [
  'createExperience',
  'copyTemplate',
  'createDirectory',
  'createFile',
  'deleteDirectory',
  'deleteFile',
  'moveFile',
  'moveDirectory',
  'listResources',
  'getResourceContent',
  'deployArtifact',
  'validateComponent',           // ← ADDED
  'generateComponentStyles',     // ← ADDED
  'getTemplateAgentInstructions',
  'listTemplateExperiences'
]
```

**File: `/src/app/lib/tools/__tests__/groups.test.ts`**

Updated test expectations:

```typescript
it('should define experience tool group', () => {
  expect(TOOL_GROUPS['experience']).toContain('createExperience');
  // ... other tools ...
  expect(TOOL_GROUPS['experience']).toContain('validateComponent');
  expect(TOOL_GROUPS['experience']).toContain('generateComponentStyles');
  expect(TOOL_GROUPS['experience']).toContain('getTemplateAgentInstructions');
  expect(TOOL_GROUPS['experience']).toContain('listTemplateExperiences');
});
```

### Documentation Updates

**File: `/ai_context/reference/tool-groups.md`**

Updated experience tool group from 13 to 15 tools, added section:

```markdown
**Component Generation:**
- `validateComponent` - Validate custom React component JSX before deployment
- `generateComponentStyles` - Generate Tailwind CSS for component after deployment
```

**File: `/ai_context/roadmap/custom-components/TAILWIND-CSS-GENERATION.md`**

Added missing files to "Files Changed" section:
- `/src/app/lib/tools/groups.ts`
- `/src/app/lib/tools/__tests__/groups.test.ts`
- `/ai_context/reference/tool-groups.md`

**File: `/docs/artifact-types.md`** (new)

Created comprehensive documentation for artifact types, MIME types, and file extensions.

## Verification

### Tests

```bash
npm test -- src/app/lib/tools/__tests__/groups.test.ts
```

Result: ✅ All 51 tests passed

### Expected Behavior After Fix

When a user asks the Interface Designer to create a component:

1. ✅ Agent creates JSX component code
2. ✅ Agent calls `validateComponent()` to check for errors
3. ✅ Agent creates artifact with `type: 'text/jsx'`
4. ✅ Agent calls `deployArtifact()` to save to `resources/components/`
5. ✅ **Agent calls `generateComponentStyles()`** to create CSS file ← NOW AVAILABLE
6. ✅ CSS file created at `resources/components/component-name.css`
7. ✅ Component loads with working Tailwind styles

### What Changed for Agents

**Before:**
- Tools available: 32 tools (missing `validateComponent`, `generateComponentStyles`)
- Interface Designer couldn't find `generateComponentStyles` in tool list
- Agent would skip CSS generation step or try workarounds (like generating images)

**After:**
- Tools available: 34 tools (includes `validateComponent`, `generateComponentStyles`)
- Interface Designer can execute full workflow
- CSS generation happens automatically after deployment

## Files Modified

### Core Fix
- `/src/app/lib/tools/groups.ts` - Added 2 tools to 'experience' group

### Tests
- `/src/app/lib/tools/__tests__/groups.test.ts` - Updated test expectations

### Documentation
- `/ai_context/reference/tool-groups.md` - Updated tool count and descriptions
- `/ai_context/roadmap/custom-components/TAILWIND-CSS-GENERATION.md` - Added missing files
- `/docs/artifact-types.md` - New comprehensive artifact type documentation
- `/ai_context/changes/css-generation-bugfix.md` - This document

## Lessons Learned

### Process Improvements

1. **Tool Registration Checklist**: When adding new tools, ensure:
   - [ ] Tool implemented in appropriate file
   - [ ] Tool exported from index file
   - [ ] Tool registered with ToolRegistry
   - [ ] **Tool added to `TOOL_GROUPS` mapping** ← THIS WAS MISSED
   - [ ] Tests updated
   - [ ] Documentation updated

2. **Debugging Tool Availability**: To check which tools an agent has access to:
   - Look at backend agent logs for `toolNames` array
   - Check `TOOL_GROUPS` mapping for the agent's tool groups
   - Verify tool is in ToolRegistry AND in the group mapping

3. **Agent Instructions vs Tool Availability**: Agent instructions that reference tools are useless if those tools aren't actually available via the tool groups system.

## Related Issues

This fix resolves:
- Missing CSS files for dynamically generated components
- Tailwind utility classes not working in custom components
- Interface Designer agents generating images instead of calling CSS generation

## Next Steps

1. ✅ Fix deployed
2. ✅ Tests passing
3. ✅ Documentation updated
4. ⏳ Test with actual component generation workflow
5. ⏳ Monitor for successful CSS generation in production

## Timeline

- **Discovered**: January 12, 2026
- **Root Cause Identified**: January 12, 2026
- **Fixed**: January 12, 2026
- **Verified**: January 12, 2026

## Related Documentation

- [Tool Groups Architecture](/ai_context/architecture/tools-system.md)
- [Tailwind CSS Generation](/ai_context/roadmap/custom-components/TAILWIND-CSS-GENERATION.md)
- [Interface Designer Instructions](/storage/deckard/resources/instructions/agent/interface-designer.md)
- [Tool Groups Reference](/ai_context/reference/tool-groups.md)
