# gpt-realtime-2 Support

## Summary

Added support for OpenAI's `gpt-realtime-2` reasoning-capable realtime model
without changing defaults for existing experiences. The model can now be selected
in any `aiConfigurations` entry, and its new session-level `reasoning.effort`
parameter is configurable via a `reasoningEffort` field in `experience.json`.

## Background

OpenAI's realtime model lineup currently includes:

- `gpt-4o-realtime-preview` (and dated snapshots) — legacy preview, non-reasoning
- `gpt-realtime` — alias that today resolves to `gpt-realtime-1.5`, non-reasoning
- `gpt-realtime-1.5` — non-reasoning GA model
- `gpt-realtime-2` — reasoning-capable; supports `reasoning.effort` and a 128k
  context window; available on `/v1/realtime`, `/v1/realtime/translations`,
  `/v1/realtime/transcription_sessions`, and `/v1/responses`
- mini variants (`gpt-realtime-mini`, `gpt-audio-mini`, etc.)

The model name has always been an opaque string in our code path
(`experience.json` → `ConfigLoader` → `useRealtimeConnection` → query string on
`/v1/realtime`), so changing the model alone required no code change. The new
behavior that did require plumbing was `reasoning.effort`, which is a session
configuration field accepted by reasoning-capable realtime models.

## Reasoning effort levels

Per OpenAI's [realtime models prompting guide](https://developers.openai.com/api/docs/guides/realtime-models-prompting):

| Effort    | Use when                                       |
|-----------|------------------------------------------------|
| `minimal` | Lowest latency matters most, task is simple    |
| `low`     | Responsiveness plus basic reasoning            |
| `medium`  | Multi-step tasks                               |
| `high`    | Deeper reasoning materially improves success   |
| `xhigh`   | Maximum reasoning is worth the latency/cost    |

OpenAI recommends starting at `low` for production voice agents.

## Where `reasoning.effort` is and isn't accepted

This is the most important detail to get right and was a source of bugs:

- ✅ **`session.update` event over the WebRTC data channel** — the
  `RealtimeSessionCreateRequest` schema accepts `reasoning: { effort }` and
  explicitly lists `gpt-realtime-2` among supported models.
- ❌ **`POST /v1/realtime/sessions` (legacy REST bootstrap)** — uses an older,
  narrower schema that does NOT accept `reasoning`. Sending it returns
  `{ "error": { "message": "Unknown parameter: 'reasoning'.", "type":
  "invalid_request_error", "param": "reasoning", "code": "unknown_parameter" } }`
  even when the model is `gpt-realtime-2`.
- ✅ **`response.create` event** — accepts a per-response `reasoning: { effort }`
  override (not currently used by this codebase).

The fix is therefore: configure reasoning effort exclusively via
`session.update` after the data channel opens. The REST bootstrap continues to
send only `model`, `modalities`, `voice`.

> Heads up: ChatGPT-style answers will sometimes "helpfully" suggest sending
> `reasoning` to `POST /v1/realtime/sessions`. The live OpenAI sessions
> reference does not document `reasoning` there and the API rejects it. Trust
> the API error and the schema reference, not the suggestion.

## Changes Made

### 1. Type definitions (`src/app/lib/types.ts`)

Added `RealtimeReasoningEffort` union and an optional `reasoningEffort` field on
`AIConfiguration`:

```typescript
export type RealtimeReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface AIConfiguration {
  // ...existing fields
  reasoningEffort?: RealtimeReasoningEffort;
}
```

### 2. Session update event (`src/app/hooks/useSessionManagement.ts`)

When the active AI configuration sets `reasoningEffort`, the `session.update`
event sent over the WebRTC data channel includes `reasoning: { effort }`. We
omit it entirely when unset so non-reasoning model session updates are
byte-identical to before.

### 3. Ephemeral session creation (`src/app/api/session/route.ts`, `src/app/hooks/useRealtimeConnection.ts`)

The REST bootstrap call to `POST /v1/realtime/sessions` deliberately does NOT
forward `reasoning`. Both files include comments explaining why so future
contributors don't add it back. The route also has a regression test pinning
this behavior even if a caller mistakenly passes `reasoning` in the request body.

### 4. Tests (`src/app/api/session/__tests__/route.test.ts`)

Added a regression case asserting the route does NOT forward `reasoning` to
OpenAI even when the caller provides it (gpt-realtime-2). Existing tests
continue to pass unchanged.

### 5. Documentation (`ai_context/architecture/experience-format.md`)

Documented the `reasoningEffort` field on `AIConfiguration` and added an example
configuration showing both a non-reasoning voice agent and a reasoning agent
side-by-side.

## Opt-in example

To use `gpt-realtime-2` with low reasoning effort in an experience:

```json
{
  "aiConfigurations": {
    "voice-reasoning": {
      "provider": "openai",
      "api": "realtime",
      "model": "gpt-realtime-2",
      "streaming": true,
      "modalities": ["audio", "text"],
      "reasoningEffort": "low"
    }
  }
}
```

## What did NOT change

- Default model in `realtimeConnection.ts` (`gpt-4o-realtime-preview`),
  `ConfigLoader.ts`, and `ExperienceLoader.ts` — these are stale fallbacks but
  changing them is out of scope for this work.
- `storage/hal/experience.json` and other shipped experiences — none were
  migrated to `gpt-realtime-2`. Authors can opt in per experience.
- No UI was added; configuration is `experience.json`-only as requested.

## Backward compatibility

- `reasoningEffort` is optional. Experiences that omit it behave exactly as
  before.
- The session route omits `reasoning` from the OpenAI request body when the
  caller does not provide it, so requests against `gpt-realtime-1.5` and the
  `gpt-4o-realtime-preview` family are byte-identical to the previous behavior.

## Related Files

- `src/app/lib/types.ts`
- `src/app/hooks/useSessionManagement.ts`
- `src/app/hooks/useRealtimeConnection.ts`
- `src/app/api/session/route.ts`
- `src/app/api/session/__tests__/route.test.ts`
- `ai_context/architecture/experience-format.md`
- OpenAI references:
  - [`gpt-realtime-2` model page](https://developers.openai.com/api/docs/models/gpt-realtime-2)
  - [Realtime models prompting guide](https://developers.openai.com/api/docs/guides/realtime-models-prompting)
