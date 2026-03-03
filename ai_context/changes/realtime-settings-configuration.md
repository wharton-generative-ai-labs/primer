# Realtime Settings Configuration

**Date:** 2026-01-09  
**Status:** Complete  
**Issue:** Interactive voice agents interrupting users or responding before they finish speaking

## Problem

Users reported that the interactive agent (running in realtime sessions with voice) was interrupting them or responding before they finished speaking. Investigation revealed that the `silence_duration_ms` was hardcoded to 200ms - less than half the OpenAI recommended default of 500ms. This caused the agent to interpret very short pauses (0.2 seconds) as the end of the user's turn.

## Solution

Made all OpenAI Realtime API Voice Activity Detection (VAD) settings configurable per AI configuration through a new `realtimeSettings` object. This allows tuning without code deployments.

## Changes Made

### 1. Type Definitions (`src/app/lib/types.ts`)

Added new `RealtimeSettings` interface and updated `AIConfiguration`:

```typescript
export interface RealtimeSettings {
  silence_duration_ms?: number;  // Duration of silence to detect speech stop (default: 500ms)
  threshold?: number;            // VAD activation threshold 0.0-1.0 (default: 0.5)
  prefix_padding_ms?: number;    // Audio to include before VAD detected speech (default: 300ms)
  create_response?: boolean;     // Auto-generate response on VAD stop (default: true)
  interrupt_response?: boolean;  // Auto-interrupt response on VAD start (default: true)
}

export interface AIConfiguration {
  provider: string;
  api: string;
  model: string;
  streaming: boolean;
  modalities: string[];
  realtimeSettings?: RealtimeSettings;  // Only used when api === 'realtime'
}
```

### 2. Session Management (`src/app/hooks/useSessionManagement.ts`)

Updated turn detection configuration to read from `aiConfiguration.realtimeSettings`:

**Before:**
```typescript
const turnDetection = isMuted
  ? null
  : {
    type: "server_vad",
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 200,  // Too short!
    create_response: true,
  };
```

**After:**
```typescript
const realtimeSettings = selectedConfig?.realtimeSettings;
const turnDetection = isMuted
  ? null
  : {
    type: "server_vad",
    threshold: realtimeSettings?.threshold ?? 0.5,
    prefix_padding_ms: realtimeSettings?.prefix_padding_ms ?? 300,
    silence_duration_ms: realtimeSettings?.silence_duration_ms ?? 500,
    create_response: realtimeSettings?.create_response ?? true,
    interrupt_response: realtimeSettings?.interrupt_response ?? true,
  };
```

### 3. Experience Configuration

Updated `storage/intake-agent-runcible/experience.json` with improved settings:

```json
{
  "aiConfigurations": {
    "voice-interactive": {
      "provider": "openai",
      "api": "realtime",
      "model": "gpt-realtime",
      "streaming": true,
      "modalities": ["audio", "text"],
      "realtimeSettings": {
        "silence_duration_ms": 800,
        "threshold": 0.5,
        "prefix_padding_ms": 300,
        "create_response": true,
        "interrupt_response": true
      }
    }
  }
}
```

### 4. Documentation

Updated `context/architecture/experience-format.md` with:
- Complete `RealtimeSettings` interface documentation
- Explanation of each setting and its impact
- Recommended values for natural conversation
- Example configuration

## Configuration Guide

### silence_duration_ms
- **Default:** 500ms (OpenAI default)
- **Previous:** 200ms (too short)
- **Recommended:** 700-1000ms for natural conversation
- **Impact:** 
  - Lower = faster responses but more interruptions
  - Higher = more patient listening but slower responses

### threshold
- **Default:** 0.5
- **Range:** 0.0 to 1.0
- **Impact:** Higher values require louder audio to activate
- **Use case:** Increase in noisy environments

### prefix_padding_ms
- **Default:** 300ms
- **Impact:** Ensures beginning of speech isn't cut off
- **Recommendation:** Keep at default unless issues arise

### create_response
- **Default:** true
- **Impact:** Auto-respond when VAD detects silence
- **Use case:** Set to false for manual control (push-to-talk)

### interrupt_response
- **Default:** true
- **Impact:** Allow user to interrupt agent's response
- **Recommendation:** Keep true for natural conversation

## Testing & Deployment

1. **No code changes required** - Settings are now in experience.json
2. **Test different values** by editing the experience.json file
3. **Monitor user feedback** on interruption behavior
4. **Adjust per-experience** as different use cases may need different settings

## Backward Compatibility

- All settings are optional with sensible defaults
- Existing experiences without `realtimeSettings` will use OpenAI defaults
- Default `silence_duration_ms` changed from 200ms to 500ms (OpenAI default)

## Related Files

- `src/app/lib/types.ts` - Type definitions
- `src/app/hooks/useSessionManagement.ts` - Session configuration logic
- `storage/intake-agent-runcible/experience.json` - Example configuration
- `context/architecture/experience-format.md` - Documentation
- `context/external/openai/realtime/client/session.txt` - OpenAI API reference
