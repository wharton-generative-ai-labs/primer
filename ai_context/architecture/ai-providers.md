# AI Provider Configuration

Primer supports multiple AI providers for different use cases. This document covers current provider support and configuration.

## Supported Providers

| Provider | Frontend (Realtime) | Backend | Image Generation |
|----------|---------------------|---------|------------------|
| OpenAI | ✅ | ✅ | ✅ |
| Anthropic | ❌ | ✅ | ❌ |
| Google | ❌ | ❌ | ✅ (Imagen) |

## Configuration in experience.json

### AI Configurations Block

Define provider configurations in the `aiConfigurations` section:

```json
{
  "aiConfigurations": {
    "default": {
      "provider": "openai",
      "model": "gpt-4o"
    },
    "claude-agent": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022"
    },
    "fast-model": {
      "provider": "openai",
      "model": "gpt-4o-mini"
    }
  }
}
```

### Assigning to Agents

Reference configurations in agent definitions:

```json
{
  "agents": {
    "design-agent": {
      "name": "Design Agent",
      "type": "backend",
      "temperature": 0.8,
      "aiConfiguration": "claude-agent",
      "toolGroups": ["builtin", "experience", "matter-compiler"]
    },
    "quick-helper": {
      "name": "Quick Helper",
      "type": "backend",
      "aiConfiguration": "fast-model",
      "toolGroups": ["builtin"]
    }
  }
}
```

## Environment Variables

| Variable | Required For | Example |
|----------|--------------|---------|
| `OPENAI_API_KEY` | OpenAI provider | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic provider | `sk-ant-...` |
| `GOOGLE_CLOUD_PROJECT` | Google Imagen | Project ID |

## OpenAI

### Frontend Agents (Realtime API)

Frontend agents use the OpenAI Realtime API for voice interaction:

- Requires WebRTC connection
- Supports real-time voice input/output
- Only provider that supports voice agents

### Backend Agents (Chat Completions)

Default for backend agents if no `aiConfiguration` is specified.

**Available Models:**
- `gpt-4o` (recommended)
- `gpt-4o-mini` (faster, cheaper)
- `gpt-4-turbo`
- `o1-preview` (reasoning)

### Image Generation

Uses DALL-E through the `generateImage` tool:
- DALL-E 3 for high quality
- Configurable size and quality

## Anthropic Claude

### Backend Agents Only

Claude models can power backend agents for delegation tasks.

**Available Models:**
- `claude-opus-4-1-20250805` (most capable - Opus 4.1, released Aug 2025)
- `claude-opus-4-20250514` (Opus 4, released May 2025)
- `claude-3-5-sonnet-20241022` (recommended for most tasks)
- `claude-3-opus-20240229` (Claude 3 Opus - legacy)
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307` (fastest)

### Automatic Format Conversion

The system handles format differences automatically:

1. **Tool Definitions**: Written in OpenAI format, converted to Anthropic format at runtime
2. **Messages**: System messages handled separately per Anthropic's requirements
3. **Tool Calls**: Anthropic format converted back to OpenAI format for consistent processing
4. **Responses**: Normalized to OpenAI format for tool execution code

### Implementation Details

Conversion handled in `/api/backend-agent/utils/provider-adapter.ts`:

```typescript
// Key functions
shouldUseAnthropic(aiConfig) // Checks if provider is anthropic
convertOpenAIToolsToAnthropic(tools) // Converts tool definitions
convertMessagesToAnthropic(messages) // Converts message history
convertAnthropicResponseToOpenAI(response) // Normalizes response
getModelName(aiConfig, provider) // Gets appropriate model name
```

## Google (Imagen)

Used for image generation as an alternative to DALL-E:

```json
{
  "aiConfigurations": {
    "image-gen": {
      "provider": "google",
      "model": "imagen-3.0"
    }
  }
}
```

The `generateImage` tool can use either provider based on configuration.

## Default Behavior

### No aiConfiguration Specified

| Agent Type | Default Provider | Default Model |
|------------|------------------|---------------|
| Frontend | OpenAI | Realtime API model |
| Backend | OpenAI | gpt-4o |

### No aiConfigurations Block

If no `aiConfigurations` block exists in experience.json, agents use OpenAI with default models.

## Best Practices

1. **Use Claude for complex reasoning**: Claude models often excel at following detailed instructions
2. **Use GPT-4o-mini for simple tasks**: Faster and cheaper for straightforward operations
3. **Keep frontend on OpenAI**: Only OpenAI supports realtime voice
4. **Set appropriate temperatures**: Lower for precise tasks, higher for creative tasks
5. **Test with both providers**: Different models may interpret prompts differently

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
Add the API key to your `.env` file.

### Tool calls failing with Claude
Check that tool definitions don't use unsupported parameter types. Claude is strict about JSON schema.

### Model not found
Verify the model name is correct and your API key has access to that model.

## Key Files

| File | Purpose |
|------|---------|
| `/api/backend-agent/route.ts` | Provider selection and execution |
| `/api/backend-agent/utils/provider-adapter.ts` | Format conversion utilities |
| `/lib/ai/AIProviderFactory.ts` | Provider abstraction (frontend) |
