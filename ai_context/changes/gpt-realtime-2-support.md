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
event sent over the WebRTC data channel now includes `reasoning: { effort }`.
Non-reasoning models ignore this field, so it is safe for older models too — but
we omit it entirely when unset to keep diffs against existing behavior minimal.

### 3. Ephemeral session creation

`src/app/hooks/useRealtimeConnection.ts` forwards `reasoning: { effort }` to
`/api/session` when the configuration sets it, and `src/app/api/session/route.ts`
forwards the same field to OpenAI's `POST /v1/realtime/sessions`. The route only
includes the field when present, so requests for non-reasoning models look
identical to before.

### 4. Tests (`src/app/api/session/__tests__/route.test.ts`)

Added two cases:

- `reasoning.effort` is forwarded when provided (gpt-realtime-2)
- `reasoning` is omitted when not provided (gpt-realtime-1.5)

Existing tests continue to pass unchanged.

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
