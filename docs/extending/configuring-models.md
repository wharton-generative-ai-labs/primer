# Configuring and Replacing AI Models

Primer uses two distinct AI paths — a **realtime voice path** (frontend, WebRTC) and a **text/agentic path** (backend agents, delegated tasks). Each is configured separately and can use different providers and models.

---

## How models are selected

### Per-experience configuration

Every experience defines its AI setup in `experience.json` under `aiConfigurations`. This object is loaded at play time and passed through the entire AI stack.

```json
{
  "aiConfigurations": {
    "provider": "openai",
    "api": "realtime",
    "model": "gpt-4o-realtime-preview",
    "streaming": true,
    "modalities": ["audio", "text"],
    "voice": "shimmer",
    "temperature": 0.8
  }
}
```

Individual agents within an experience can override the top-level config:

```json
{
  "agents": [
    {
      "id": "mentor",
      "aiConfig": {
        "provider": "anthropic",
        "model": "claude-opus-4-5"
      }
    }
  ]
}
```

### How the backend selects a provider

`src/app/api/backend-agent/utils/provider-adapter.ts` contains `shouldUseAnthropic()` and `getModelName()`. The logic is:

- If `aiConfig.provider === "anthropic"` → use Anthropic SDK.
- Otherwise → use OpenAI SDK.
- Model defaults: OpenAI → `gpt-4o`, Anthropic → `claude-3-5-sonnet-20241022`.

---

## Changing the default model

### Frontend (realtime voice)

Edit the `model` field in the experience's `aiConfigurations`. Available realtime models are in `src/app/lib/voices.ts`. The ephemeral key for the WebRTC session is issued by `src/app/api/session/route.ts` — that route passes the model name directly to the OpenAI Realtime API.

### Backend agents

To change the global default, edit `provider-adapter.ts`:

```ts
// src/app/api/backend-agent/utils/provider-adapter.ts

const OPENAI_DEFAULT_MODEL = 'gpt-4o';           // change here
const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-4-5'; // change here

export function getModelName(aiConfig: AIConfig | undefined, provider: 'openai' | 'anthropic'): string {
  return aiConfig?.model ?? (provider === 'anthropic' ? ANTHROPIC_DEFAULT_MODEL : OPENAI_DEFAULT_MODEL);
}
```

---

## Adding a new provider (e.g. Google Gemini for text)

The backend agent loop lives in `src/app/api/backend-agent/managers/AIRequestHandler.ts`. It branches between OpenAI and Anthropic. To add a third provider:

### 1. Install the SDK

```bash
npm install @google/generative-ai
```

### 2. Extend the provider adapter

In `provider-adapter.ts`, add a `shouldUseGemini()` function:

```ts
export function getProvider(aiConfig: AIConfig | undefined): 'openai' | 'anthropic' | 'gemini' {
  if (aiConfig?.provider === 'anthropic') return 'anthropic';
  if (aiConfig?.provider === 'gemini') return 'gemini';
  return 'openai';
}
```

### 3. Add a Gemini branch in AIRequestHandler

```ts
// src/app/api/backend-agent/managers/AIRequestHandler.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY!);

// Inside the request loop:
if (provider === 'gemini') {
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent({ ... });
  // convert result to OpenAI-format message for the rest of the loop
}
```

The rest of the tool-calling loop already uses a normalised OpenAI-format message history, so the only work is converting Gemini's response format into that shape (similar to how Anthropic's response is converted today in `convertAnthropicResponseToOpenAI`).

### 4. Add the API key env var

```
GOOGLE_AI_API_KEY=...
```

Register it in `src/config/env.ts` (Zod schema) so it is validated at startup.

---

## Configuring voice

Realtime voice settings live in two places:

1. **Per-experience** — `aiConfigurations.voice` in `experience.json` (e.g. `"alloy"`, `"shimmer"`, `"ballad"`).
2. **Per-agent** — `agents[n].voice` overrides the experience default.

Available voices are listed in `src/app/lib/voices.ts`. Adding a new voice only requires adding its name to that list — the string is passed verbatim to the OpenAI Realtime API.

---

## Switching to a locally-hosted model (Ollama / vLLM)

OpenAI-compatible local servers (Ollama, vLLM, LM Studio) expose the same REST interface. To point the backend agent at one:

1. Set `OPENAI_API_KEY=ollama` (any non-empty value).
2. Change the base URL in `AIRequestHandler.ts`:

```ts
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
});
```

Add `OPENAI_BASE_URL=http://localhost:11434/v1` to your env.

> Note: Local models do not support the Realtime API (WebRTC voice). Voice experiences always require OpenAI. Backend/text agents can be fully local.

---

## Environment variables reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | All OpenAI calls including Realtime |
| `ANTHROPIC_API_KEY` | No | Experiences configured with `provider: "anthropic"` |
| `GOOGLE_AI_API_KEY` | No | Image generation via Gemini; add for text if extended |
| `OPENAI_BASE_URL` | No | Override for local or proxy OpenAI-compatible server |
