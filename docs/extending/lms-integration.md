# LMS Integration

Primer is a standalone platform with its own class management. It has no built-in LMS connector, but it is designed to be extended. This article describes the two most practical integration paths: **LTI 1.3** (the modern standard for embedding tools inside an LMS) and **roster/grade-sync webhooks** (a lighter-weight option when full LTI is overkill).

---

## Option A — LTI 1.3 (Full Embedding)

LTI 1.3 lets an LMS (Canvas, Moodle, Blackboard, Brightspace, etc.) launch Primer as an embedded tool and optionally write grades back. The protocol is OAuth2-based and well-supported by the [`ltijs`](https://cvmcosta.me/ltijs/) Node.js library.

### 1. Add the `ltijs` dependency

```bash
npm install ltijs
```

`ltijs` requires a MongoDB or PostgreSQL database to store platform registrations and nonces. Add a `DATABASE_URL` env var and wire up the adapter of your choice (see [Adding a Database](adding-a-database.md)).

### 2. Register an LTI provider route

Create `src/app/api/lti/route.ts` (or a dedicated Express router mounted in `server.ts` before the Next.js handler). Key setup:

```ts
import Lti from 'ltijs';

Lti.setup(
  process.env.LTI_KEY!,          // random secret — keep private
  { url: process.env.DATABASE_URL! },
  {
    appUrl: '/lti/launch',
    loginUrl: '/lti/login',
    keysetUrl: '/lti/keys',
  }
);

// Called after a successful LTI launch
Lti.onConnect(async (token, req, res) => {
  const email = token.userInfo?.email;
  const courseId = token.platformContext?.context?.id;
  // Map LTI user → Primer session; redirect to /play/<experienceId>
  res.redirect(`/play/${req.query.experienceId}`);
});

await Lti.deploy({ serverless: true }); // attach to existing HTTP server
```

Mount the `ltijs` express app inside `server.ts`, before `nextHandler`:

```ts
import ltiApp from './src/lti/provider';
httpServer.on('request', (req, res) => {
  if (req.url?.startsWith('/lti')) return ltiApp(req, res);
  nextHandler(req, res);
});
```

### 3. Map LTI roles to Primer roles

Edit `src/lib/authOptions.ts`. Add a helper that converts an LTI launch token's `roles` claim (e.g. `http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor`) to a Primer `RoleKey`:

```ts
function ltiRoleToPrimerRole(ltiRoles: string[]): RoleKey {
  if (ltiRoles.some(r => r.includes('Instructor'))) return 'EDUCATOR';
  if (ltiRoles.some(r => r.includes('Administrator'))) return 'ADMIN';
  return 'PLAYER';
}
```

Store the resolved role in the NextAuth session (or in a short-lived cookie that your middleware reads) so the rest of Primer's permission checks work unchanged.

### 4. Grade passback (optional)

`ltijs` exposes `Lti.Grade.scorePublish()`. Call it from a server action or API route when a Primer session ends (e.g. when the `finishExperience` tool fires). Hook into `src/app/api/session-events/route.ts` — it already receives end-of-session events.

### 5. Environment variables to add

| Variable | Purpose |
|----------|---------|
| `LTI_KEY` | Random secret for ltijs signing |
| `LTI_PLATFORM_URL` | Your LMS issuer URL |
| `LTI_CLIENT_ID` | Client ID issued by your LMS |
| `LTI_DEPLOYMENT_ID` | Deployment ID from your LMS |

---

## Option B — Roster & Grade Sync via Webhooks (Lighter-Weight)

If full LTI embedding is more than you need, you can sync users and grades using the LMS's REST API (Canvas and Moodle both have good ones) without touching the auth flow at all.

### Roster sync

Write a script (or a cron-triggered API route at `/api/sync/roster`) that:

1. Calls the LMS REST API to fetch enrolled students for a course.
2. For each student email, calls Primer's existing class API (`POST /api/classes/[id]/members`) to add them to the appropriate Primer class.

This piggybacks on Primer's built-in class system with zero changes to auth.

### Grade passback

Listen for `session.finish` events (already emitted via Socket.IO) and POST a grade to the LMS using its REST API (e.g. Canvas's Submissions API or Moodle's `core_grades_update_grades` web service).

---

## Key files to know

| File | Role |
|------|------|
| `src/lib/authOptions.ts` | NextAuth config — add providers or callbacks here |
| `src/config/auth.ts` | Role/permission definitions |
| `src/config/user-storage.ts` | Where roles are resolved per-user |
| `src/app/api/classes/` | Class membership API |
| `src/app/api/session-events/route.ts` | Session lifecycle events |
| `server.ts` | HTTP server — mount the ltijs Express app here |
