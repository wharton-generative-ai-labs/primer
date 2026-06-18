# 05. AI Provider Adapters

## Overview

This section examines the security of Primer's multi-provider AI integration layer, which handles communication with OpenAI and Anthropic APIs. This is a critical area because it involves external API credentials, user-controlled input flowing into AI prompts, and AI-directed tool execution.

The adapter architecture converts between provider-specific formats (OpenAI and Anthropic) using a unified internal representation. User task descriptions are assembled into prompts, sent to the chosen AI provider, and responses are processed through a tool execution pipeline.

| Component | Technology | Purpose |
|-----------|------------|---------|
| `provider-adapter.ts` | TypeScript | Format conversion between OpenAI/Anthropic |
| `AIRequestHandler.ts` | TypeScript + OpenAI/Anthropic SDKs | API request orchestration |
| `ToolExecutionManager.ts` | TypeScript | Execute AI-requested tool calls |
| `ValidationManager.ts` | TypeScript | Request validation |
| `ToolRegistry.ts` | TypeScript | Tool allowlist and dispatch |

---

## Executive Summary

| Assessment | Result |
|------------|--------|
| **Overall Status** | :material-alert: **MEDIUM RISK** |
| **Risk Level** | Medium |
| **PoC Blocker** | No |
| **Action Required** | Documentation only |

**Review approach:** AI conducted static code analysis of the adapter layer (622 lines across 4 files). Human reviewer performed live testing including prompt injection attempts, error response inspection, and tool registry validation.

**Key findings:** The AI identified prompt injection and tool argument validation as theoretical risks, both rated Medium. Human testing confirmed prompt injection is possible but acceptable for trusted users. Human discovered that rate limiting and iteration limits were already implemented (addressing AI concerns), and that the tool allowlist architecture is robust. Output sanitization (XSS prevention) was identified as a gap for V2.

**Bottom Line:** The adapter layer is ready for PoC release with trusted users; prompt injection and output sanitization should be addressed before production.

---

## Finding Synthesis Matrix

**Synthesis Date:** 2026-02-04

| ID | Finding | AI | Human | Final Severity | PoC Status |
|----|---------|:--:|:-----:|----------------|------------|
| ADAPT-1 | Prompt injection (no sanitization) | Medium | Agreed | **Medium** | Acceptable |
| ADAPT-2 | Tool arguments not schema-validated | Medium | Agreed | **Medium** | Acceptable |
| ADAPT-3 | No rate limiting on AI calls | Low | Disputed | **Resolved** | Ready |
| ADAPT-4 | No iteration limits | Low | Disputed | **Resolved** | Ready |
| ADAPT-5 | Error messages may leak details | Low | Agreed | **Low** | Acceptable |
| ADAPT-6 | API keys at module level | Low | Agreed | **Low** | Acceptable |
| ADAPT-7 | Binary content metadata disclosure | Low | - | **Informational** | Acceptable |
| ADAPT-8 | Missing output sanitization (XSS) | NEW | Medium | **Medium** | Acceptable |

---

### ADAPT-1: Prompt Injection (No Sanitization)

**AI Assessment:** Medium - User task descriptions concatenated directly into AI prompts without sanitization.

**Human Assessment:** Agreed - Confirmed exploitable, but acceptable for trusted educational users.

| Aspect | Analysis |
|--------|----------|
| **The Issue** | User-provided task descriptions are directly interpolated into AI prompts, allowing injection of instructions that could override system behavior |
| **Location** | `src/app/api/backend-agent/managers/AIRequestHandler.ts:56-74` |
| **Evidence** | `taskMessage += \`Task: ${taskDescription}\n\n\`;` |
| **Impact** | Users can influence AI behavior beyond intended scope, potentially triggering unintended tool calls |

**Resolution:** Document as known limitation for PoC. Trusted users are unlikely to exploit this maliciously. For production, implement structured message separation or prompt injection detection.

---

### ADAPT-2: Tool Arguments Not Schema-Validated

**AI Assessment:** Medium - Tool call arguments from AI are parsed from JSON and passed to handlers without schema validation.

**Human Assessment:** Agreed - Confirmed that validation relies on individual tool handlers.

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Tool arguments are JSON-parsed and passed directly to tool handlers without validating against the tool's expected schema |
| **Location** | `src/app/api/backend-agent/managers/ToolExecutionManager.ts:28-30` |
| **Evidence** | `const toolArgs = JSON.parse(toolCall.function.arguments);` |
| **Impact** | Malformed AI responses could cause unexpected behavior; type confusion possible if tool handlers don't validate |

**Resolution:** Acceptable for PoC as current tools (observe, slide, present, etc.) are high-level and safe. For production, add Zod schema validation before tool execution.

---

### ADAPT-3: Rate Limiting (Resolved)

**AI Assessment:** Low - No rate limiting on AI API calls; potential for billing attacks.

**Human Assessment:** Disputed - Rate limiting is implemented.

| Aspect | Analysis |
|--------|----------|
| **The Issue** | AI review identified missing rate limiting |
| **Location** | `src/app/api/backend-agent/route.ts:27-44` |
| **Evidence** | `const limitResult = rateLimit(identifier, rateLimitConfigs.strict);` |
| **Impact** | None - control exists |

**Resolution:** No action needed. Rate limiting with 429 responses and retry headers is already implemented.

---

### ADAPT-4: Iteration Limits (Resolved)

**AI Assessment:** Low - No protection against runaway conversation loops.

**Human Assessment:** Disputed - Iteration limits are implemented.

| Aspect | Analysis |
|--------|----------|
| **The Issue** | AI review identified missing iteration limits |
| **Location** | `src/app/api/backend-agent/route.ts:166-170` |
| **Evidence** | `maxToolCalls` limit (default 100), consecutive failure tracking (stops after 5 failures) |
| **Impact** | None - controls exist |

**Resolution:** No action needed. Implementation includes configurable max tool calls per agent and consecutive failure detection.

---

### ADAPT-5: Error Message Exposure

**AI Assessment:** Low - Raw error messages included in responses could leak internal details.

**Human Assessment:** Agreed - Confirmed in both `ToolExecutionManager.ts` and `route.ts`.

| Aspect | Analysis |
|--------|----------|
| **The Issue** | Raw error messages are returned to clients without sanitization |
| **Location** | `src/app/api/backend-agent/managers/ToolExecutionManager.ts:83`, `route.ts:369` |
| **Evidence** | `data: { error: error instanceof Error ? error.message : 'Unknown error' }` |
| **Impact** | Could leak file paths, database details, or internal structure to users |

**Resolution:** Acceptable for PoC with trusted users. For production, map errors to safe messages and log full details server-side only.

---

### ADAPT-8: Missing Output Sanitization (XSS)

**AI Assessment:** Not identified

**Human Assessment:** Medium - AI responses are not sanitized before rendering in frontend.

| Aspect | Analysis |
|--------|----------|
| **The Issue** | If AI is tricked into generating malicious HTML/script content, the frontend might render it unsafely |
| **Location** | `src/app/api/backend-agent/managers/ToolExecutionManager.ts` |
| **Evidence** | Binary content is truncated, but text content passes through without XSS sanitization |
| **Impact** | Potential XSS if AI output is rendered without escaping |

**Resolution:** Acceptable for PoC (trusted source, trusted users). For V2, sanitize AI text output or ensure frontend escapes all AI-generated content.

---

## Positive Security Controls

| Control | Status | Notes |
|---------|--------|-------|
| API keys from environment | Correct | Not hardcoded, not logged |
| Request validation | Correct | Required fields checked via ValidationManager |
| Tool allowlist architecture | Correct | ToolRegistry + agent config filtering |
| Rate limiting | Correct | Implemented with 429 responses |
| Iteration limits | Correct | maxToolCalls and consecutive failure tracking |
| Provider abstraction | Correct | Reduces provider-specific vulnerabilities |
| Binary content protection | Correct | Prevents token exhaustion |

---

## Research Insights: AI vs Human Performance

### Detection Comparison

| Category | AI | Human | Notes |
|----------|:--:|:-----:|-------|
| Issues identified | 7 | 7 (2 new, 2 disputes, 3 validations) | Different focus areas |
| Concrete evidence | Partial | Yes | Human verified with live testing |
| False positives | 2 | 0 | AI missed existing rate limiting and iteration limits |

### AI Strengths

- Systematic identification of input validation gaps (prompt injection, tool arguments)
- Thorough code coverage across all adapter files
- Consistent documentation of findings with code evidence
- Identified potential information leakage in error handling

### AI Limitations

- Could not detect already-implemented controls (rate limiting, iteration limits) without running the application
- Missed output sanitization (XSS) vector - focused on input sanitization only
- Theoretical findings could not be validated without live testing
- Static analysis blind spots when controls are in separate files

### Human Strengths

- Verified actual exploitability of prompt injection
- Discovered implemented controls that AI flagged as missing
- Identified output sanitization gap (XSS) that AI missed
- Validated tool allowlist architecture through code tracing
- Practical risk assessment based on deployment context

### Human Limitations

- Review time constraints (2.5 hrs total across two sessions)
- Did not exhaustively test all tool argument edge cases
- Relied on AI review to scope initial investigation

---

## Consolidated Recommendations

### For PoC Release

| Priority | Action | Owner |
|----------|--------|-------|
| **Required** | Document prompt injection as known limitation | Docs |
| **Required** | Document error message exposure as known limitation | Docs |
| **Recommended** | Add deployment note about trusted user assumption | Docs |

### For Production Release

| Priority | Action | Effort |
|----------|--------|--------|
| **P1** | Implement output sanitization for AI responses | Medium |
| **P1** | Add Zod schema validation for tool arguments | Medium |
| **P2** | Implement prompt injection detection/filtering | Medium |
| **P2** | Sanitize error messages before returning to clients | Low |

---

## PoC Readiness

- [x] No PoC blockers identified
- [x] Rate limiting implemented
- [x] Iteration limits implemented
- [x] Tool allowlist architecture verified
- [x] API keys properly handled
- [x] Trusted user context documented

---

## Detailed Reviews

- [AI Review](../appendices/ai-reviews/adapters-ai-review.md)
- [Human Review](../appendices/human-reviews/adapters-human-review.md)
