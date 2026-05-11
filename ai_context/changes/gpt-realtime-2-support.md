# gpt-realtime-2 Support (GA Realtime API migration)

## Summary

Added support for OpenAI's `gpt-realtime-2` reasoning-capable realtime model.
This required migrating from the legacy Realtime preview/beta REST endpoints
to the GA Realtime API endpoints, and adding a `reasoningEffort` configuration
field that gets plumbed through `experience.json` to the OpenAI session config.

## Background: legacy vs GA Realtime API

OpenAI ships two parallel HTTP surfaces for the Realtime API. They share the
WebRTC data-channel event vocabulary, but the REST bootstrap and SDP-exchange
endpoints are different. Newer models (`gpt-realtime-2`, `gpt-realtime-1.5`,
`gpt-realtime`, `gpt-realtime-mini`, `gpt-audio-1.5`, etc.) are gated to the GA
endpoints — calling the legacy endpoint with `gpt-realtime-2` returns:

```
"Model \"gpt-realtime-2\" is only available on the GA API."
```

|                       | Legacy (preview/beta) | GA |
|-----------------------|-----------------------|----|
| Mint ephemeral key    | `POST /v1/realtime/sessions` | `POST /v1/realtime/client_secrets` |
| WebRTC SDP exchange   | `POST /v1/realtime?model=...` | `POST /v1/realtime/calls` (no `?model=`) |
| Bootstrap body shape  | `{ model, modalities, voice }` | `{ session: { type:"realtime", model, audio:{output:{voice}}, output_modalities, reasoning:{effort} } }` |
| Voice location        | top-level `voice` | `audio.output.voice` |
| Modalities key        | `modalities` | `output_modalities` |
| Modalities values     | `["audio", "text"]` meant "both" | only `["text"]` OR `["audio"]`; `["audio"]` already includes a transcript |
| Ephemeral key in resp | `data.client_secret.value` | `data.value` |
| `reasoning.effort`    | ❌ rejected | ✅ accepted |
| `gpt-realtime-2`      | ❌ rejected | ✅ accepted |

References:
- [`gpt-realtime-2` model page](https://developers.openai.com/api/docs/models/gpt-realtime-2)
- [Realtime models prompting guide](https://developers.openai.com/api/docs/guides/realtime-models-prompting)
- [Client Secrets reference](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/)
- [Realtime API with WebRTC guide](https://developers.openai.com/api/docs/guides/realtime-webrtc)

## Reasoning effort levels

Per OpenAI's prompting guide, `gpt-realtime-2` accepts:

| Effort    | Use when                                       |
|-----------|------------------------------------------------|
| `minimal` | Lowest latency matters most, task is simple    |
| `low`     | Responsiveness plus basic reasoning (recommended starting point) |
| `medium`  | Multi-step tasks                               |
| `high`    | Deeper reasoning materially improves success   |
| `xhigh`   | Maximum reasoning is worth the latency/cost    |

Older non-reasoning models (`gpt-realtime`, `gpt-realtime-1.5`, the
`gpt-4o-realtime-preview` family) ignore the parameter.

## Changes Made

### 1. Type definitions (`src/app/lib/types.ts`)

Added `RealtimeReasoningEffort` union and an optional `reasoningEffort` field
on `AIConfiguration`:

```typescript
export type RealtimeReasoningEffort =
  'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface AIConfiguration {
  // ...existing fields
  reasoningEffort?: RealtimeReasoningEffort;
}
```

### 2. Session bootstrap (`src/app/api/session/route.ts`)

Migrated from `POST /v1/realtime/sessions` to `POST /v1/realtime/client_secrets`
and rebuilt the request body in the GA shape (`{ session: { type, model,
audio: { output: { voice } }, output_modalities, reasoning } }`). Reasoning is
forwarded only when present.

GA's `output_modalities` only accepts `["text"]` OR `["audio"]`, not both —
`["audio"]` already includes a transcript. Our existing `experience.json` files
use the legacy convention `["audio", "text"]` to mean "give me both", so the
route translates: if `audio` is in the requested list it sends `["audio"]`;
otherwise `["text"]`. This avoids forcing every shipped experience.json to be
edited.

The route also normalizes the GA response (`{ value, expires_at, session }`)
back to a legacy-compatible shape (`{ ..., client_secret: { value, expires_at } }`)
so `useRealtimeConnection` and any other callers reading `data.client_secret.value`
keep working without changes.

### 3. WebRTC SDP exchange (`src/app/lib/realtimeConnection.ts`)

Migrated from `POST /v1/realtime?model=<model>` to `POST /v1/realtime/calls`
(no `?model=` query parameter — the model is bound to the ephemeral key by the
`client_secrets` call). The `model` argument to `createRealtimeConnection` is
preserved in the function signature for back-compat but is no longer used.

### 4. Ephemeral-key forwarding (`src/app/hooks/useRealtimeConnection.ts`)

Now forwards `reasoning: { effort }` to `/api/session` when the experience's
AI configuration sets `reasoningEffort`, since the GA endpoint accepts it on
session bootstrap.

### 5. Session updates (`src/app/hooks/useSessionManagement.ts`)

The `session.update` event sent over the WebRTC data channel was migrated to
the GA `RealtimeSessionCreateRequest` shape:

- Added `session.type: "realtime"` (required by GA — server rejects with
  `Missing required parameter: 'session.type'.` otherwise).
- Moved flat audio fields under `audio.input.*` / `audio.output.*`:
  - `voice` → `audio.output.voice`
  - `input_audio_transcription` → `audio.input.transcription`
  - `turn_detection` → `audio.input.turn_detection`
- Dropped `modalities`, `input_audio_format`, and `output_audio_format` from
  the patch. `session.update` is a true PATCH per OpenAI's docs ("Only the
  fields that are present in the `session.update` are updated"), and these
  fields are already set correctly during ephemeral key creation. Re-sending
  the legacy `modalities: ["audio", "text"]` would also re-trigger the
  `Invalid modalities` validation error since GA only accepts `["text"]` OR
  `["audio"]`.
- Dropped `temperature`. The GA Realtime API removed it from the session
  schema (server returns `Unknown parameter: 'session.temperature'.`).
  Reasoning-capable models use `reasoning.effort` to control variability
  instead; non-reasoning GA models use a fixed default. `AgentConfig.temperature`
  itself is preserved because non-realtime flows (text chat, config inspector,
  etc.) still consume it.
- `reasoning: { effort }` continues to be injected when the experience config
  opts in. This is intentional double-coverage: GA accepts it on session
  bootstrap, and re-sending it on every `session.update` ensures the effort
  survives agent switches.

To clear `turn_detection` on mute, we pass `null` per GA's "clearing fields"
convention.

### 6. Tests (`src/app/api/session/__tests__/route.test.ts`)

Rewrote the integration tests for the GA endpoint and shape:

- Hits `POST /v1/realtime/client_secrets` with bearer auth
- Wraps caller fields in the `session` shape (model, `audio.output.voice`,
  `output_modalities`)
- Forwards `reasoning.effort` for reasoning-capable models
- Omits `reasoning` when not provided
- Maps GA `value` onto legacy `client_secret.value` for backward compatibility
- Preserves the full session config from the GA response
- Error-handling cases (OpenAI errors, network errors, malformed body)

11 tests pass; `tsc --noEmit`, `eslint`, and the related ConfigLoader/upgrade
test suites are also green.

### 7. Documentation (`ai_context/architecture/experience-format.md`)

Documented the `reasoningEffort` field on `AIConfiguration` and added a
side-by-side example showing both a non-reasoning voice agent and a reasoning
agent.

### 8. Renamed/added transcript events (`src/app/hooks/useHandleServerEvent.ts`)

GA changed several event names and added new lifecycle events:

| Concern                                | Legacy                                  | GA                                              |
|----------------------------------------|-----------------------------------------|-------------------------------------------------|
| Assistant audio transcript stream      | `response.audio_transcript.delta`       | `response.output_audio_transcript.delta`        |
| Assistant audio transcript final       | (n/a — only used `output_item.done`)    | `response.output_audio_transcript.done`         |
| Item added to conversation             | `conversation.item.created`             | `conversation.item.added` *(new)*               |
| Item finalized in conversation         | (n/a)                                   | `conversation.item.done` *(new)*                |

We previously only listened for the legacy names, which produced two
separate symptoms on GA:

1. **Assistant text didn't render**: the message item was created (timestamp
   visible in the conversation panel) but its body stayed empty because the
   streaming transcript chunks were silently dropped.
2. **User transcripts didn't render at all**: GA only fires
   `conversation.item.added` (not `created`) when the input audio buffer
   commits, so the user message item was never registered in the transcript.
   The later `input_audio_transcription.completed` update was a no-op
   because `updateTranscriptMessage` only updates existing items.

Fixes:

- Added `response.output_audio_transcript.delta` and `.done` handlers
  (kept the legacy names as fall-throughs for non-GA models).
- Made `conversation.item.added` and `conversation.item.created` share the
  same handler.
- Added a `conversation.item.done` handler as a defensive catch-all: if an
  item ever slips through without being added, this creates it with its
  final text from `item.content[0]?.text || .transcript` (the field shape
  is the same across legacy `audio`/`text` and GA `output_audio`/`output_text`/`input_audio`).
- Enhanced `response.output_item.done` with the same safety net so a single
  dropped delta no longer leaves the message body blank.

`response.output_text.delta` / `.done` were already handled under their GA
names so no change was needed for text-only output.

### 9. Error handling (`src/app/hooks/useHandleServerEvent.ts`)

Fixed a split-brain UI bug surfaced by GA validation errors. The previous
error handler called `setSessionStatus("DISCONNECTED")` for any
`invalid_request_error` other than the `conversation_already_has_active_response`
recoverable case. But that setter only flips React state — it does NOT close
the WebRTC peer connection. So when OpenAI rejected a malformed client event
(e.g. our pre-migration `session.update`), the audio path kept flowing while
the UI controls gated on `CONNECTED` (mute, speaker, etc.) silently
disappeared, leaving the user able to talk to the agent through controls
that no longer existed.

New behavior:

- `authentication_error` → still flips to `DISCONNECTED` (key is dead).
- `invalid_request_error` → log a warning + add a debug breadcrumb, but stay
  `CONNECTED`. The peer connection is still healthy; we shouldn't lie to the
  UI just because OpenAI rejected one event.
- Other error types → unchanged (warn and continue).

## Things that did not need to change despite earlier guesses

- **OpenAI npm SDK was not the problem.** We use `openai` (`^4.91.1`) only for
  non-realtime endpoints (image, vision, text, etc.). All realtime calls are
  hand-rolled `fetch`. No SDK upgrade was needed.
- **`reasoning` is not accepted on the legacy `/v1/realtime/sessions` REST
  endpoint** even when the model is reasoning-capable. The GA endpoint accepts
  it; the legacy one returns `Unknown parameter: 'reasoning'`. Be skeptical of
  ChatGPT-style answers that suggest sending `reasoning` to the legacy URL.
- **The `session.update` event over the data channel uses the
  `RealtimeSessionCreateRequest` schema**, which DOES accept
  `reasoning: { effort }`. Note: we initially assumed the legacy field layout
  (`modalities`, top-level `voice`, flat `turn_detection`, etc.) would still
  be accepted on this event for back-compat, but the GA server actually
  requires the new layout — at minimum `session.type: "realtime"` — and
  rejects the legacy modalities value. See section 5 above; this event was
  migrated to the GA shape.

## Opt-in example

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

## Backward compatibility

- `reasoningEffort` is optional. Experiences that omit it behave exactly as
  before (no `reasoning` field is sent on the wire).
- The session route still returns `data.client_secret.value` in addition to
  the GA `data.value`, so any client code that reads the legacy path keeps
  working.
- `createRealtimeConnection`'s `model` parameter is preserved as a no-op for
  call-site stability; it is no longer used since the GA endpoint binds the
  model to the ephemeral key.

## Related Files

- `src/app/lib/types.ts`
- `src/app/lib/realtimeConnection.ts`
- `src/app/hooks/useSessionManagement.ts`
- `src/app/hooks/useRealtimeConnection.ts`
- `src/app/hooks/useHandleServerEvent.ts`
- `src/app/api/session/route.ts`
- `src/app/api/session/__tests__/route.test.ts`
- `ai_context/architecture/experience-format.md`
