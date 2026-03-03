# RESOLVED

This has been implemented via a centralized `canViewExperienceInCatalog` function in `src/app/lib/experiencePermissions.ts`.

## Rules implemented:

1. **Users with VIEW_ALL_EXPERIENCES permission** (ADMIN, EDITOR, TESTER) can see ALL experiences
2. **Educators** can see:
   - Experiences they authored
   - Experiences with `kind="meta"` or `kind="bundled"`
3. **Class members** can see experiences they are members of (via `classes.json`)

Note: Access is now controlled solely through `classes.json` for student access. The previous `permissions.json` file has been removed as it was redundant with class membership.

Note: Visibility now uses permission-based checks (`VIEW_ALL_EXPERIENCES`) rather than role-based checks, fixing the TESTER role bug where testers couldn't see any experiences.

Note: Experiences with `kind="template"` or `kind="debugger"` have separate visibility logic handled at the API layer (admin-only with explicit request params).

---

## Original requirements:

Only the roles admin, and editor, and educators that authored an Experience, OR class-members of an Experience can see it listed in the experience catalog.

That is to say:

If I'm an admin or an editor - I can see all experiences regardless of who authored them.

If I'm an educator - I can see experiences that I authored.

If I don't have a specific role in Primer, but I am a member of a class for a specific Experience - I can see the Experience.

This ruleset applies only to Experiences that currently do not have a kind

In addition to the Experiences authorized by the above rules, educators should be able to see kind="meta" and kind="bundled"

Admins and Editors can see all experiences regardless of any other authorization logic.
