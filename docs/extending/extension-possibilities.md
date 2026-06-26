# Extension Possibilities

Primer is designed to be composed and extended. Beyond the targeted integration articles (LMS, database, auth, models), this article surveys the main extension points for builders who want to go deeper.

---

## 1. Adding new tools

Tools are the primary extension mechanism for experience authors. Each tool is a function the AI agent can call, with a JSON schema definition and a server-side handler.

### Where tools live

```
src/app/lib/tools/
├── builtin/          # Core tools (scene, artifact, note, agent, etc.)
├── ui/               # Slides, diagrams
├── sound/            # Audio playback
├── image-generator/  # Multi-provider image generation
├── research/         # Web search
├── analytics/        # Session analytics
└── index.ts          # Tool registry
```

### Adding a tool

1. Create a folder under `src/app/lib/tools/your-tool/`.
2. Export a `ToolDefinition` object with:
   - `name` — the function name the AI calls.
   - `description` — plain-English description for the AI.
   - `parameters` — JSON Schema for the arguments.
   - `execute(args, context)` — async handler returning a result string.
3. Register it in `src/app/lib/tools/index.ts`.
4. Add the tool name to the appropriate `toolSet` in your `experience.json`.

Tools have access to the full `ToolExecutionContext`, which includes the Socket.IO socket (for emitting UI events), the current session, and the `StorageService`.

### Example: a "send email" tool

```ts
export const sendEmailTool: ToolDefinition = {
  name: 'send_email',
  description: 'Send a summary email to the student after the session ends.',
  parameters: {
    type: 'object',
    properties: {
      to:      { type: 'string', description: 'Recipient email' },
      subject: { type: 'string' },
      body:    { type: 'string' },
    },
    required: ['to', 'subject', 'body'],
  },
  async execute({ to, subject, body }, context) {
    await sendgrid.send({ to, from: 'primer@yourschool.edu', subject, text: body });
    return 'Email sent.';
  },
};
```

---

## 2. Custom React components inside experiences

The experience player can render arbitrary React components as "scenes" using the `ui/custom-component` tool. Drop a `.tsx` file into an experience's resources folder and reference it by name in a tool call. This lets experience authors embed rich interactive elements (quizzes, drag-and-drop exercises, data visualisations) without modifying the Primer platform itself.

The component receives `props` passed from the agent tool call and can emit events back to the experience via the `useExperienceEvents` hook.

---

## 3. Cloud / S3 storage

`@aws-sdk/client-s3` is already a listed dependency. To activate it:

1. Implement `S3StorageService` using the existing `StorageService` interface (`src/app/lib/storage/StorageService.ts`).
2. Return it from `StorageServiceFactory` when the env var `STORAGE_PROVIDER=s3` is set.
3. Add `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `S3_BUCKET_NAME` env vars.

This enables stateless Heroku deployments and multi-instance scaling without NFS or shared disks.

---

## 4. Custom module registries

Primer's module installer fetches a manifest from `MODULE_REGISTRY_URLS`. You can publish your own registry of institutional experiences:

1. Create a JSON manifest file listing your modules (same format as the official registry).
2. Host it on GitHub, S3, or any static server.
3. Set `MODULE_REGISTRY_URLS=https://your-host/manifest.json` on your Primer instance.
4. For private GitHub repos, set `MODULE_REGISTRY_TOKEN` to a fine-grained PAT with Contents: Read-only.

Students or educators using your Primer instance will see your experiences alongside (or instead of) the public modules.

---

## 5. Webhooks and event streaming

Socket.IO events are already emitted for every significant moment in a session (tool calls, agent switches, session start/end). To integrate Primer into a wider institutional workflow:

1. Add a `WebhookService` that listens on the Socket.IO event bus in `server.ts`.
2. POST structured event payloads to a configurable `WEBHOOK_URL` endpoint.
3. Use the webhook to trigger downstream systems: grade recording, learning analytics platforms (xAPI/TinCan), notification services, or data pipelines.

---

## 6. Multi-tenancy

The current single-tenant model (one `storage/` root, one user list) can be extended to support multiple institutions or departments on one Primer instance:

1. Namespace the storage root by tenant: `storage/{tenantId}/{experienceId}/`.
2. Add a `tenantId` field to the session JWT (derived from the OAuth domain or a subdomain).
3. Scope all `StorageService` calls with the tenant prefix.
4. Add a `TENANT_CONFIG` env var (JSON) mapping domains to tenant IDs and optional per-tenant API keys.

---

## 7. Analytics and learning dashboards

Session data (agent turns, tool calls, timing, completion) is already written to `storage/{experienceId}/session_data/`. To build richer analytics:

- **Export to xAPI/TinCan** — wrap session events in xAPI statements and POST to an LRS (Learning Record Store) like SCORM Cloud or a self-hosted Lernpoint.
- **Pipe to a data warehouse** — emit events to a Kafka topic or write directly to BigQuery/Redshift alongside the DB migration.
- **Custom dashboards** — Primer's backend-agent analytics tool already generates session summaries; extend it to produce structured JSON output that a BI tool can consume.

---

## 8. Harness: automated experience testing

Primer ships with a CLI test harness (`npm run harness`) that drives experiences headlessly through a scripted conversation. Use it for:

- **Regression testing** after model or prompt changes.
- **CI integration** — run the harness in a GitHub Actions workflow.
- **Experience validation** — confirm that an experience reaches expected states given predefined inputs.

See `src/app/lib/harness/` for the harness implementation and `test/` for example scripts.

---

## Quick-reference: where to add things

| What you want | Where to add it |
|---------------|----------------|
| New AI tool | `src/app/lib/tools/` + register in `index.ts` |
| New OAuth provider | `src/lib/authOptions.ts` |
| New AI provider | `src/app/api/backend-agent/utils/provider-adapter.ts` + `AIRequestHandler.ts` |
| Cloud file storage | `src/app/lib/storage/` (implement `StorageService`) |
| Database | `src/config/user-storage.ts`, `src/app/api/classes/`, `src/app/lib/artifacts/` |
| LMS integration | `server.ts` (mount LTI app) + `src/lib/authOptions.ts` |
| Module registry | `MODULE_REGISTRY_URLS` env var |
| Webhooks / events | `server.ts` Socket.IO event listeners |
| Custom UI component | Experience resources folder + `ui/custom-component` toolSet |
