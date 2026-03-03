# Experience Catalog Permissions

## Overview

Access control for experiences uses a simple, layered approach:

1. **Permissions** (system-wide) - from roles defined in `.env` and `storage/config/users.json`
2. **Experience Authorship** - from `authorEmail` in `experience.json`
3. **Class Membership** - from `classes.json` in each experience folder

## Visibility Rules

Implemented in `canViewExperienceInCatalog` in `src/app/lib/experiencePermissions.ts`:

### Rule 1: VIEW_ALL_EXPERIENCES Permission
- Users with `VIEW_ALL_EXPERIENCES` permission can see **ALL** experiences
- This permission is granted to: ADMIN, EDITOR, TESTER roles

### Rule 2: Educators
- Can see experiences they authored (matching `authorEmail`)
- Can see experiences with `kind="meta"` or `kind="bundled"`

### Rule 3: Class Members
- Users listed as members in any active class (`classes.json`) can see that experience
- This is how students get access to play experiences

## Roles

| Role | Catalog Visibility | Key Capabilities |
|------|-------------------|------------------|
| **PLAYER** | Class experiences only | Play, list experiences |
| **EDUCATOR** | Own + meta/bundled | Create, edit own, manage own classes |
| **EDITOR** | All (VIEW_ALL_EXPERIENCES) | Edit any, switch agents |
| **TESTER** | All (VIEW_ALL_EXPERIENCES) | Editor + create + debug |
| **ADMIN** | All (VIEW_ALL_EXPERIENCES) | Everything (delete, view script, manage any classes, admin users) |
| **ADD_MAGIC** | (inherits from other roles) | Special AI features (additive role) |

### Role Design

- **All-encompassing**: Each role (except ADD_MAGIC) is self-contained with all needed permissions
- **Hierarchy**: PLAYER < EDUCATOR < EDITOR < TESTER < ADMIN (roughly)
- **Additive exception**: `ADD_MAGIC` is the only additive role, meant to be combined with others (e.g., EDUCATOR + ADD_MAGIC)

### Key Permissions by Role

| Permission | PLAYER | EDUCATOR | EDITOR | TESTER | ADMIN |
|------------|--------|----------|--------|--------|-------|
| play:experience | ✓ | ✓ | ✓ | ✓ | ✓ |
| list:experiences | ✓ | ✓ | ✓ | ✓ | ✓ |
| view:all_experiences | | | ✓ | ✓ | ✓ |
| create:experience | | ✓ | | ✓ | ✓ |
| edit:own_experience | | ✓ | | | |
| edit:any_experience | | | ✓ | ✓ | ✓ |
| delete:experience | | | | | ✓ |
| manage:own_classes | | ✓ | | | |
| manage:any_classes | | | | | ✓ |
| switch:agent | | | ✓ | ✓ | ✓ |
| enable:debug | | | | ✓ | ✓ |
| admin:users | | | | | ✓ |

## Special Experience Kinds

Experiences with special `kind` values have additional handling at the API layer:

- `kind="template"` - Admin-only, requires explicit `includeTemplates=true` param
- `kind="debugger"` - Admin-only, requires explicit `includeDebugger=true` param
- `kind="meta"` - Visible to educators (and above)
- `kind="bundled"` - Visible to educators (and above)

## Key Files

- `src/app/lib/experiencePermissions.ts` - `canViewExperienceInCatalog` function
- `src/app/lib/classAuth.ts` - `isClassMember` function
- `src/app/api/experiences/route.ts` - Catalog listing endpoint
- `src/config/auth.ts` - Roles and permissions definitions
- `src/config/user-storage.ts` - Role/permission checking utilities

## Adding Users to Experiences

The only way to grant a non-admin/editor/tester user access to an experience:

1. **For educators**: Set them as the `authorEmail` in `experience.json`
2. **For students**: Add them to a class via the Classes management UI

When adding a student to a class:
- They're added to `classes.json` under the specific class
- They're automatically given the PLAYER role in `storage/config/users.json`
- This enables them to see and play the experience
