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

Continues to inject `reasoning: { effort }` into the `session.update` event
sent over the WebRTC data channel. This is intentional double-coverage: it
ensures the effort survives agent switches (which trigger fresh `session.update`
events without re-bootstrapping) and that any per-experience reasoning override
is reapplied after a session.update for any other reason.

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
  `reasoning: { effort }` and is backward-compatible with the legacy field
  layout (`modalities`, top-level `voice`, etc.). We left it on the legacy
  layout to keep the diff small; if a future model rejects the legacy field
  names there, we can migrate that event too.

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
- `src/app/api/session/route.ts`
- `src/app/api/session/__tests__/route.test.ts`
- `ai_context/architecture/experience-format.md`
