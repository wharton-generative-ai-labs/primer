# Too much legacy console logging

There are many instances of 'over logging' where a bug was being analyzed and we chose to debug using console statements.

A lot of these have little or no value now and either give away information to the front-end or are just not needed anymore at all.

For those that have some value, put them behind a debug setting - only emit them in non-production environments.

For those with little or no value, just remove them.

## Status: ✅ Completed

**Completed:**
- Created structured logging utility (`src/lib/logger.ts`) using Pino
- Replaced all console statements in priority files:
  - `src/app/api/backend-agent/route.ts` (52+ occurrences) ✅
  - `src/app/api/backend-agent/utils/context.ts` (39 occurrences) ✅
  - `src/app/lib/tools/builtin/builtin.ts` (34 occurrences) ✅
  - `server.ts` (30 occurrences) ✅
  - `src/app/lib/ConfigLoader.ts` (32 occurrences) ✅
  - `src/app/api/save-resource/route.ts` (9 occurrences) ✅
  - `src/app/api/download/route.ts` (8 occurrences) ✅
  - `src/app/api/sessions/user/route.ts` (11 occurrences) ✅
- **Additional API routes migrated:**
  - `src/app/api/upload/route.ts` (7 occurrences) ✅
  - `src/app/api/artifacts/[id]/route.ts` (6 occurrences) ✅
  - `src/app/api/classes/route.ts` (5 occurrences) ✅
  - `src/app/api/resource-content/route.ts` (4 occurrences) ✅
  - `src/app/api/analytics/sessions-index/route.ts` (4 occurrences) ✅
  - `src/app/api/session-events/route.ts` (3 occurrences) ✅
  - `src/app/api/artifacts/list/route.ts` (3 occurrences) ✅
  - `src/app/api/session/route.ts` (1 occurrence) ✅
- **Additional API routes migrated (continued):**
  - `src/app/api/file-info/[...path]/route.ts` (1 occurrence) ✅
  - `src/app/api/session-init/route.ts` (2 occurrences) ✅
  - `src/app/api/session-metadata/route.ts` (2 occurrences) ✅
  - `src/app/api/artifacts/create/route.ts` (1 occurrence) ✅
  - `src/app/api/artifacts/[id]/update/route.ts` (1 occurrence) ✅
  - `src/app/api/experiences/route.ts` (2 occurrences) ✅
  - `src/app/api/experiences/[id]/route.ts` (2 occurrences) ✅
  - `src/app/api/experience/route.ts` (1 occurrence) ✅
  - `src/app/api/resources/route.ts` (2 occurrences) ✅
  - `src/app/api/resources/tools/route.ts` (1 occurrence) ✅
  - `src/app/api/storage/[...path]/route.ts` (1 occurrence) ✅
  - `src/app/api/user-upload/route.ts` (1 occurrence) ✅
  - `src/app/api/user-upload/list/route.ts` (2 occurrences) ✅
  - `src/app/api/classes/[classId]/route.ts` (3 occurrences) ✅
  - `src/app/api/classes/check-access/route.ts` (1 occurrence) ✅
  - `src/app/api/download/route.ts` (2 occurrences) ✅
- **Frontend components migrated:**
  - `src/app/components/SocketController.tsx` (14 occurrences) ✅
  - `src/app/components/RealtimeController.tsx` (14 occurrences) ✅
  - `src/app/hooks/useHandleServerEvent.ts` (14 occurrences) ✅
- Debug logs now only emit in non-production environments
- Error/warn logs remain but are now structured and always enabled
- All logs use structured JSON format in production, pretty-printed in development
- **Total migrated: ~400+ console statements across 62+ files**
- **Total removed: ~30+ excessive/unnecessary console statements**
- **Final migration: 4 additional files migrated to structured logging**

**Remaining:**
- ✅ **API routes completed:**
  - `src/app/api/openai/*` routes (5 files) ✅
  - `src/app/api/backend-agent/utils/provider-adapter.ts` ✅
  - `src/app/api/backend-agent/utils/toast.ts` ✅
  - `src/app/api/analytics/run/route.ts` ✅
  - `src/app/api/admin/users/route.ts` ✅
- ✅ **Core library files completed:**
  - `src/app/lib/HttpLoader.ts` (12 occurrences) ✅
  - `src/app/lib/tools/builtin/builtin-server.ts` (8 occurrences) ✅
  - `src/app/lib/tools/ui/index.ts` (8 occurrences) ✅
  - `src/app/lib/SceneManager.ts` (7 occurrences) ✅
  - `src/app/lib/tools/image-generator/image.ts` (7 occurrences) ✅
- ✅ **Additional library files migrated:**
  - `src/app/lib/session-utils.ts` (4 occurrences) ✅
  - `src/app/lib/ToolRegistry.ts` (3 occurrences) ✅
  - `src/app/lib/classAuth.ts` (3 occurrences) ✅
  - `src/app/lib/tools/delegation/DelegationManager.ts` (4 occurrences) ✅
- ✅ **Additional cleanup completed:**
  - Removed excessive registration logs (9 files) ✅
  - Removed excessive debug logs (SDP details, handleMouseDown, Function call received, etc.) ✅
  - Migrated remaining useful error logs to structured logging (14 files) ✅
  - Removed non-critical info/warn logs ✅
- ✅ **Final cleanup completed:**
  - Migrated error logs in `src/config/user-storage.ts` (2 occurrences) ✅
  - Migrated error log in `src/config/auth.ts` (1 occurrence) ✅
  - Migrated error log in `src/app/components/ErrorBoundary.tsx` (1 occurrence) ✅
  - Removed commented console.log in `src/app/hooks/useHandleServerEvent.ts` ✅
- **Remaining console statements (intentionally kept - verified complete):**
  - `src/config/env.ts` - 8 console.error statements for startup environment validation (appropriate for console output) ✅
  - `scripts/bump-version.js` - 1 console.log for script output (appropriate for build scripts) ✅
  - All other console statements found are in documentation/examples in `context/` directory (not actual code) ✅

**Important Notes:**
- Logger methods take an object first, then a message: `logger.debug({ data }, 'message')`
- Combine all data you want to log into one object before passing it
- Variables defined in try blocks may be out of scope in catch blocks - capture needed data before the try block or access it in the catch block
  - Example: If you need to log `userId` in a catch block, define it before the try block or capture it at the start of the try block
  - The error object is always available in catch blocks, but other variables from the try block may not be