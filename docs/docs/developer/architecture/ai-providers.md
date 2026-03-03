---
id: ai-providers
title: AI Providers
sidebar_position: 4
---

# AI Providers

Primer supports multiple AI providers for different use cases.

## Supported Providers

| Provider | Frontend | Backend | Image Gen |
|----------|----------|---------|-----------|
| OpenAI | ✅ (Realtime) | ✅ | ✅ (DALL-E) |
| Anthropic | ❌ | ✅ | ❌ |
| Google | ❌ | ❌ | ✅ (Imagen) |

## Configuration

### In experience.json

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
    }
  },
  "agents": {
    "my-agent": {
      "aiConfiguration": "claude-agent",
      ...
    }
  }
}
```

### Environment Variables

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_CLOUD_PROJECT=project-id
```

## OpenAI

### Frontend (Realtime API)

Voice interaction with real-time responses:
- WebRTC connection
- Streaming audio
- Tool calling support
- Only provider supporting voice

### Backend (Chat Completions)

Standard chat API for backend agents:
- **gpt-4o**: Recommended, balanced
- **gpt-4o-mini**: Faster, cheaper
- **o1-preview**: Advanced reasoning

### Image Generation

DALL-E 3 through `generateImage` tool.

## Anthropic Claude

Backend agents only. Excellent for:
- Complex reasoning
- Following detailed instructions
- Long context windows

**Models**:
- **claude-3-5-sonnet-20241022**: Recommended
- **claude-3-opus**: Most capable
- **claude-3-haiku**: Fastest

### Format Conversion

Automatic conversion between OpenAI and Anthropic formats:
- Tool definitions converted
- Messages reformatted
- Responses normalized

Implementation in `/api/backend-agent/utils/provider-adapter.ts`.

## Google Imagen

Image generation alternative to DALL-E:

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

## Best Practices

1. **Use Claude for complex reasoning**: Better at following detailed instructions
2. **Use GPT-4o-mini for simple tasks**: Faster and cheaper
3. **Frontend must use OpenAI**: Only provider with Realtime API
4. **Test with both providers**: Different strengths and weaknesses
5. **Set appropriate temperatures**: Lower (0.3) for precision, higher (0.8) for creativity

## Troubleshooting

**"API key not set"**: Add to `.env` file

**Tool calls failing**: Check tool definitions are valid JSON schema

**Model not found**: Verify model name and API key permissions

## Next Steps

- [Tools System](/developer/architecture/tools-system)
- [Delegation](/developer/architecture/delegation)
- [Experience Format](/developer/architecture/experience-format)
