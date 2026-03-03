# User Kind Experience Type

## Date
2026-01-09

## Summary
Added a new "user" kind for experiences to distinguish user-created experiences from system experiences (bundled, meta, template, debugger). This provides better visual organization in the experience catalog and ensures newly created experiences are properly categorized.

## Changes Made

### 1. ExperienceCatalog Component (`src/app/components/ExperienceCatalog.tsx`)

#### Added User Kind Display
- Added visual indicator for "user" kind experiences with light grey background (`bg-white/15 text-white/80`)
- Matches the soft color tones of other experience kinds
- Auto-capitalizes "User" in the display

```tsx
{experience.kind === 'user' && (
  <span className="px-1.5 py-0.5 text-xs bg-white/15 text-white/80 rounded">
    User
  </span>
)}
```

#### Updated Sorting Logic
- Modified `kindPriority` to include "user" kind with priority 1 (after blank, before bundled)
- Updated priority values: blank (0), user (1), bundled (2), meta (3), debugger (4), template (5)
- Unknown kinds default to priority 6

### 2. Experience Builder Agent (`storage/intake-agent-staging/resources/instructions/agent/experience-builder.md`)

#### Updated Instructions
- Changed instruction from setting `"kind": ""` (empty string) to `"kind": "user"`
- Updated critical note: "Always set `"kind": "user"` to mark this as a user-created experience and make it visible in the catalog"
- Updated verification checklist to check for `kind: "user"` instead of empty status field
- Updated success criteria to reflect the new requirement

### 3. Backend Agent Context (`src/app/api/backend-agent/utils/context.ts`)

#### Updated `copyTemplate` Function
- Added automatic setting of `kind: "user"` when copying from template
- Ensures all template-based experiences are marked as user-created

```typescript
// Set kind to "user" for newly created experiences
experience.kind = "user";
```

#### Updated `createExperience` Function
- Added `kind: "user"` to the default experience configuration
- Ensures all newly created experiences have the user kind set

### 4. Experience Management Service (`src/app/lib/experience/ExperienceManagementService.ts`)

#### Updated `createExperience` Method
- Added `kind: "user"` to the default configuration object

#### Updated `copyTemplate` Method
- Added logic to read the copied experience.json
- Sets `kind: "user"` after copying
- Writes back the updated configuration

## Behavior Changes

### Before
- Newly created experiences had no kind field or empty string kind
- No visual distinction for user-created experiences in the catalog
- Experience builder agent was told to blank out the kind field

### After
- All newly created experiences automatically get `kind: "user"`
- User-created experiences display a "User" badge with light grey background
- Experience builder agent sets kind to "user" for all created experiences
- Sorting places user experiences after blank experiences but before bundled

## Impact

### User Experience
- Better visual organization in the experience catalog
- Clear distinction between user-created and system experiences
- Consistent categorization across all creation methods

### Developer Experience
- Clearer intent when creating experiences
- Consistent behavior across different creation paths (copyTemplate, createExperience)
- Updated agent instructions reflect the new behavior

## Files Modified
1. `src/app/components/ExperienceCatalog.tsx`
2. `storage/intake-agent-staging/resources/instructions/agent/experience-builder.md`
3. `src/app/api/backend-agent/utils/context.ts`
4. `src/app/lib/experience/ExperienceManagementService.ts`

## Testing Considerations
- Verify user kind displays correctly in the experience catalog
- Test that newly created experiences via intake agent have user kind
- Test that copyTemplate sets user kind correctly
- Verify sorting places user experiences in the correct position
- Ensure existing experiences without kind field still work correctly
