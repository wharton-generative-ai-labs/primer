#!/usr/bin/env bash
# create-audit-issues.sh — Creates GitHub issues from security audit findings
# Usage: ./create-audit-issues.sh [--dry-run]

set -euo pipefail

REPO="wharton-generative-ai-labs/runcible"  # <-- change when moving to public repo

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE — no issues will be created ==="
  echo ""
fi

CREATED=0
FAILED=0
SKIPPED=0

create_issue() {
  local title="$1"
  local labels="$2"
  local body="$3"
  local audit_ref="$4"

  if $DRY_RUN; then
    echo "────────────────────────────────────────"
    echo "TITLE:  $title"
    echo "LABELS: $labels"
    echo ""
    echo "$body"
    echo ""
    CREATED=$((CREATED + 1))
    return
  fi

  # Dedup check: search for an existing issue with the same audit ref
  local existing
  if [[ "$audit_ref" == "QUICK-WINS" ]]; then
    # Quick-wins issue has no single audit ref — match by title
    existing=$(gh issue list --repo "$REPO" --label audit \
      --search "\"$title\"" --state all \
      --json number,title --jq ".[] | select(.title == \"$title\") | .number" 2>/dev/null | head -1)
  else
    existing=$(gh issue list --repo "$REPO" --label audit \
      --search "\"Audit ref: ${audit_ref}\"" --state all \
      --json number --jq '.[0].number // empty' 2>/dev/null)
  fi
  if [[ -n "$existing" ]]; then
    echo "SKIP: \"$title\" already exists as #$existing"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  if gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --label "$labels" \
    --body "$body"; then
    CREATED=$((CREATED + 1))
  else
    echo "ERROR: Failed to create issue: $title"
    FAILED=$((FAILED + 1))
  fi
}

# ─── Create labels (idempotent) ───────────────────────────────────────────────

create_labels() {
  if $DRY_RUN; then
    echo "Would create labels: audit, high-priority, quick-win,"
    echo "  severity:high, severity:medium, severity:low,"
    echo "  websocket, auth, frontend, api, config, adapter, code-quality, data"
    echo ""
    return
  fi

  echo "Creating labels..."
  local labels=(
    "audit|0e8a16|Security audit finding"
    "high-priority|b60205|Should be addressed before public release"
    "quick-win|0e8a16|Low-effort fix"
    "severity:high|b60205|High severity finding"
    "severity:medium|d93f0b|Medium severity finding"
    "severity:low|e4e669|Low severity finding"
    "websocket|1d76db|WebSocket layer"
    "auth|5319e7|Authentication / Authorization"
    "frontend|f9d0c4|Frontend security"
    "api|fbca04|API endpoint"
    "config|d4c5f9|Configuration"
    "adapter|bfdadc|AI provider adapter"
    "code-quality|c2e0c6|Code quality / maintainability"
    "data|006b75|Data handling / storage"
  )

  for entry in "${labels[@]}"; do
    IFS='|' read -r name color desc <<< "$entry"
    gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" --force 2>/dev/null || true
  done
  echo "Labels ready."
  echo ""
}

create_labels

# ═══════════════════════════════════════════════════════════════════════════════
# HIGH PRIORITY (5 issues)
# ═══════════════════════════════════════════════════════════════════════════════

create_issue \
  "Add authentication to internal endpoints" \
  "audit,high-priority,severity:medium,websocket" \
  "$(cat <<'EOF'
## Problem

The `/api/toast` and `/api/socket-delegation-status` endpoints are raw HTTP handlers registered directly on the Express server. They bypass Next.js middleware entirely and have no authentication checks.

**Location:** `server.ts:81-117` (toast), `server.ts:119-159` (delegation status)

## Evidence

```bash
# No auth required — anyone who can reach the server can inject toasts
curl -X POST http://localhost:3000/api/toast \
  -d '{"sessionId":"test","message":"spoofed"}'   # 200 OK
```

## Impact

- Arbitrary toast injection into user sessions
- Potential phishing vector (e.g., "Session expired, click here to re-authenticate")
- Socket delegation status leaks internal session state

## Remediation

1. **Short-term:** Add a shared secret or token check to both handlers (e.g., verify a header matches a server-side env var)
2. **Long-term:** Migrate these endpoints into Next.js API routes so they pass through the existing auth middleware, or add Express-level auth middleware that validates the NextAuth session cookie

> Audit ref: WS-5
EOF
)" \
  "WS-5"

create_issue \
  "Strengthen Content Security Policy" \
  "audit,high-priority,severity:high,frontend" \
  "$(cat <<'EOF'
## Problem

The Content Security Policy includes `'unsafe-eval'` and `'unsafe-inline'` in the `script-src` directive. This significantly weakens CSP as a defense-in-depth control against XSS.

**Location:** `src/lib/csp.ts`

## Evidence

```typescript
'script-src': [
  "'self'",
  "'unsafe-eval'",    // Required for Babel (custom components) and dev HMR
  "'unsafe-inline'",  // Required for Next.js inline scripts
  "https://cdnjs.cloudflare.com",
  "https://cdn.jsdelivr.net",
],
```

## Why this matters

If any XSS injection point exists (see the AI output sanitization issue), the CSP will not block script execution. React's default escaping provides primary protection, but CSP should be the safety net — not a paper wall.

## Remediation

1. **Investigate `unsafe-eval` removal:** Determine if Mermaid/Babel usage in custom components can use a sandboxed iframe or pre-compilation step instead of runtime eval
2. **Replace `unsafe-inline` with nonces:** Next.js supports CSP nonces — configure `nonce` in the CSP header and pass it to `<Script>` components
3. **Add SRI hashes** for CDN scripts (cdnjs.cloudflare.com, cdn.jsdelivr.net)
4. **Add `object-src 'none'`** and **`base-uri 'self'`** if not already present

> Audit ref: FE-1
EOF
)" \
  "FE-1"

create_issue \
  "Add server-side permission checks" \
  "audit,high-priority,severity:medium,auth" \
  "$(cat <<'EOF'
## Problem

The `usePermissions` hook checks permissions client-side from the session context, but there is no guarantee that every API route mirrors these checks server-side. A user who bypasses the UI can call API routes directly.

**Location:** `src/app/hooks/usePermissions.ts`

## Evidence

```typescript
const privileges = session?.user?.privileges || [];
const can = useCallback(
  (permission: Permission): boolean => {
    return privileges.includes(permission);
  },
  [session, privileges],
);
```

Client-side checks like `can(Permission.MANAGE_USERS)` gate UI elements but don't prevent direct API calls.

## Impact

If any API route relies solely on the frontend to enforce permissions, an authenticated user can bypass restrictions by calling the endpoint directly (e.g., via curl or browser devtools).

## Remediation

1. Audit every `can(Permission.X)` usage in UI components
2. For each, verify the corresponding API route has a matching `hasPermission` server-side check
3. Add a shared `requirePermission(session, Permission.X)` utility for route handlers to make enforcement consistent
4. See also the deny-by-default authorization middleware issue

> Audit ref: FE-3
EOF
)" \
  "FE-3"

create_issue \
  "Add output sanitization for AI-generated content" \
  "audit,high-priority,severity:medium,adapter" \
  "$(cat <<'EOF'
## Problem

AI-generated output is rendered in the UI without sanitization. If an AI model returns content containing HTML or script tags, it could execute in the user's browser.

Additionally, user-provided task descriptions are interpolated directly into AI prompts without sanitization:

**Location:** `src/app/api/backend-agent/managers/AIRequestHandler.ts:56-74`

```typescript
taskMessage += `Task: ${taskDescription}\n\n`;
```

## Impact

- **XSS via AI output:** A prompt injection that causes the model to emit `<script>` or `<img onerror=...>` could execute arbitrary JavaScript in the user's browser
- **Prompt injection:** Users can influence AI behavior beyond intended scope, potentially triggering unintended tool calls

## Remediation

1. **Sanitize AI output before rendering:** Use [DOMPurify](https://github.com/cure53/DOMPurify) to sanitize any AI-generated HTML/markdown before inserting into the DOM
2. **Treat AI output as untrusted:** Even in a trusted-user PoC, the AI model itself is an untrusted source — its output should never be rendered as raw HTML
3. **Structured prompt separation:** Use distinct system/user message roles rather than string interpolation to reduce prompt injection surface

> Audit ref: ADAPT-1
EOF
)" \
  "ADAPT-1"

create_issue \
  "Add missing security headers" \
  "audit,high-priority,severity:low,config" \
  "$(cat <<'EOF'
## Problem

The application is missing several recommended security headers.

**Location:** `next.config.ts` (headers configuration)

## Missing Headers

| Header | Purpose |
|--------|---------|
| `Strict-Transport-Security` with `preload` | HSTS preload list inclusion for HTTPS enforcement |
| `X-Content-Type-Options: nosniff` | Prevent MIME-type sniffing |
| `Permissions-Policy` | Restrict browser feature access (camera, mic, geolocation) |

## Remediation

Add to the `headers()` config in `next.config.ts`:

```typescript
{ key: 'X-Content-Type-Options', value: 'nosniff' },
{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
```

Verify existing headers aren't already covering some of these, then add the missing ones.

> Audit ref: CONFIG-3
EOF
)" \
  "CONFIG-3"

# ═══════════════════════════════════════════════════════════════════════════════
# STANDARD PRIORITY (9 issues)
# ═══════════════════════════════════════════════════════════════════════════════

create_issue \
  "Bind WebSocket sessions to authenticated users" \
  "audit,severity:low,websocket" \
  "$(cat <<'EOF'
## Problem

Clients can provide their own session ID during the WebSocket handshake. The server adopts it if not already in the session store, meaning session identity is client-controlled rather than server-assigned.

**Location:** `server.ts:256-261`

```typescript
socket.data.sessionId = existingSessionId;
createNewSession(existingSessionId);
```

## Current Mitigation

Session IDs use UUIDv4 (122 bits of entropy via `crypto.randomUUID()`), making brute-force impractical (~2^61 attempts). No leakage vectors were identified (not in URLs, logs, or API responses).

## Why it still matters for production

- Defense-in-depth: server should be the authority on session identity
- Session lifecycle should be tied to NextAuth authentication state
- If a session ID ever leaks (future logging, error reporting), hijacking becomes trivial

## Remediation

1. **Server-assigned IDs only:** Ignore client-provided session IDs; always generate server-side
2. **Bind to NextAuth:** On WebSocket connection, validate the NextAuth session cookie and associate the socket session with the authenticated user
3. **Session expiry:** Invalidate WebSocket sessions when the NextAuth session expires or is revoked

> Audit ref: WS-2
EOF
)" \
  "WS-2"

create_issue \
  "Implement deny-by-default authorization middleware" \
  "audit,severity:high,auth" \
  "$(cat <<'EOF'
## Problem

The current authorization architecture is fail-open: middleware checks for a valid token but not for roles/permissions. Individual route handlers are responsible for their own permission checks, and if one is missed, the endpoint is open to any authenticated user.

**Location:** `src/middleware.ts`, various API route handlers

## Evidence (human-verified)

| Route | Expected | Actual | Result |
|-------|----------|--------|--------|
| `GET /api/admin/users` | 403 | 403 | Pass |
| `POST /api/experiences` | 403 | 403 | Pass |
| `GET /api/storage/...` | 403 | 200 | **FAIL** |

The storage API confirms the risk: any authenticated user (regardless of roles) can read stored files.

## Impact

Every new API route is open-by-default unless the developer remembers to add permission checks. One missed check = data exposure.

## Remediation

1. **Deny-by-default middleware:** Create an Express/Next.js middleware that rejects requests to `/api/*` unless the route is explicitly marked as public or the user has the required permission
2. **Route permission map:** Maintain a declarative map of route patterns to required permissions
3. **Allowlist public routes:** Explicitly mark routes like `/api/auth/*` and health checks as public
4. **Fix the storage API:** Add permission checks to storage endpoints immediately

> Audit ref: AUTH-2
EOF
)" \
  "AUTH-2"

create_issue \
  "Block unauthenticated users without roles at sign-in" \
  "audit,severity:medium,auth" \
  "$(cat <<'EOF'
## Problem

Users without assigned roles can still authenticate via NextAuth. Once authenticated, they have a valid session and can access any endpoint that only checks for authentication (not authorization).

## Impact

Combined with the fail-open authorization architecture (see deny-by-default middleware issue), a roleless user can access endpoints that lack explicit permission checks.

## Remediation

1. **Enforce roles at sign-in:** In the NextAuth `signIn` callback, reject users who have no roles assigned
2. **Or implement an allowlist:** Maintain a list of permitted email addresses/domains and reject sign-in for unlisted users
3. **Provide a clear error message:** Users denied at sign-in should see a meaningful message (e.g., "Your account has not been provisioned. Contact an administrator.")

> Audit ref: AUTH-3
EOF
)" \
  "AUTH-3"

create_issue \
  "Add rate limiting to WebSocket events" \
  "audit,severity:medium,websocket" \
  "$(cat <<'EOF'
## Problem

WebSocket event handlers (`client:message`, `tool.call`, etc.) process every incoming message without any rate limiting or throttling.

**Location:** `server.ts:283-341`, `server.ts:349-467`

## Impact

- **Cost exhaustion:** Each `client:message` can trigger an OpenAI/Anthropic API call. A malicious or buggy client could rapidly exhaust API budgets.
- **Financial DoS:** Even without malicious intent, a runaway client loop could generate significant API costs.
- **Resource starvation:** Excessive messages could overwhelm the server, degrading service for other users.

## Remediation

1. **Token bucket rate limiter:** Implement per-session rate limiting (e.g., 10 messages/minute for AI-triggering events)
2. **Budget caps:** Set per-user or per-session spending limits that pause processing when exceeded
3. **Backpressure:** When rate-limited, send an event back to the client indicating throttling
4. **Monitoring:** Add billing alerts at $50/$100 thresholds on OpenAI/Anthropic dashboards as an immediate stopgap

> Audit ref: WS-3
EOF
)" \
  "WS-3"

create_issue \
  "Extend rate limiting to all API endpoints" \
  "audit,severity:medium,api" \
  "$(cat <<'EOF'
## Problem

Rate limiting is implemented for some endpoints (e.g., uploads at 10/hour) but coverage is incomplete across all API routes.

## Impact

Unprotected endpoints are vulnerable to:
- Brute-force attacks (e.g., auth-adjacent endpoints)
- Resource exhaustion via rapid repeated calls
- Cost amplification for AI-proxying endpoints

## Remediation

1. **Global rate limiter:** Add a baseline rate limit to all `/api/*` routes (e.g., 100 requests/minute per IP)
2. **Tiered limits:** Apply stricter limits to expensive operations (AI calls, file uploads) and looser limits to read-only endpoints
3. **Consistent implementation:** Use the same rate-limiting library/approach across Express handlers and Next.js API routes
4. **429 responses:** Return proper `429 Too Many Requests` with `Retry-After` header

> Audit ref: API-RATE
EOF
)" \
  "API-RATE"

create_issue \
  "Remove eval-require pattern" \
  "audit,severity:low,frontend" \
  "$(cat <<'EOF'
## Problem

Server-side code uses `eval('require')` to dynamically load Node.js modules, bypassing the module bundler.

**Location:** `src/app/lib/tools/groups.ts:48-50`

```typescript
const path = eval("require")("path");
const fs = eval("require")("fs");
const { env } = eval("require")("@/config/env");
```

## Why this matters

- `eval` is flagged by security scanners and CSP policies
- Makes code harder to statically analyze and tree-shake
- If the pattern were ever used with user-controlled input, it would be an RCE vector
- Currently safe because the require paths are hardcoded, but the pattern is a footgun

## Remediation

Replace with proper dynamic imports:

```typescript
import path from 'path';
import fs from 'fs';
import { env } from '@/config/env';
```

Or if dynamic loading is truly needed:

```typescript
const path = await import('path');
const fs = await import('fs');
```

> Audit ref: FE-2
EOF
)" \
  "FE-2"

create_issue \
  "Refactor useHandleServerEvent god hook" \
  "audit,severity:medium,code-quality" \
  "$(cat <<'EOF'
## Problem

The `useHandleServerEvent` hook is 700+ lines long and handles every server event type in a single function. This makes it difficult to review for security issues, reason about state transitions, and maintain.

**Location:** `src/app/hooks/useHandleServerEvent.ts`

## Why this matters

- **Security review difficulty:** A 700-line function with mixed concerns is easy to miss bugs in during code review
- **Tight coupling:** All event handlers share scope, making unintended interactions likely
- **Testing:** The monolithic structure makes unit testing individual event handlers impractical

## Remediation

1. **Extract event handlers:** Create focused handler functions/hooks for each event type (e.g., `useHandleTranscriptEvent`, `useHandleToolCallEvent`)
2. **Event handler registry:** Use a map of event type → handler function for dispatch
3. **Shared state via context:** Move shared state into React context rather than closure variables
4. **Incremental approach:** Extract one handler at a time, starting with the most complex ones

> Audit ref: CODE-1
EOF
)" \
  "CODE-1"

create_issue \
  "Remove X-Powered-By header" \
  "audit,severity:low,config" \
  "$(cat <<'EOF'
## Problem

Next.js sends an `X-Powered-By: Next.js` header by default, disclosing the framework to potential attackers.

**Location:** `next.config.ts`

## Impact

Information disclosure that aids targeted attacks against known Next.js vulnerabilities. Minor on its own, but trivial to fix.

## Remediation

Add to `next.config.ts`:

```typescript
const nextConfig = {
  poweredByHeader: false,
  // ... rest of config
};
```

Also included in the quick-wins bundle issue.

> Audit ref: CONFIG-4
EOF
)" \
  "CONFIG-4"

create_issue \
  "Add prompt injection detection" \
  "audit,severity:medium,adapter" \
  "$(cat <<'EOF'
## Problem

There is no monitoring or detection for prompt injection attempts in either user input or AI model output. Tool call arguments from the AI are parsed from JSON and passed to handlers without schema validation.

**Location:** `src/app/api/backend-agent/managers/ToolExecutionManager.ts:28-30`

```typescript
const toolArgs = JSON.parse(toolCall.function.arguments);
```

## Impact

- **Input side:** Users could craft prompts that override system instructions or trigger unintended tool usage
- **Output side:** A compromised or manipulated model response could pass malformed arguments to tool handlers, causing unexpected behavior

## Remediation

1. **Zod schema validation for tool arguments:** Define schemas for each tool's expected arguments and validate before execution
2. **Input heuristics:** Flag common injection patterns in user input (e.g., "ignore previous instructions", "system:", role-switching attempts)
3. **Output monitoring:** Log and flag unexpected patterns in AI responses (e.g., attempts to call tools not in the provided set)
4. **Guardrails layer:** Consider a lightweight classifier or rule set that screens prompts before they reach the model

> Audit ref: ADAPT-2
EOF
)" \
  "ADAPT-2"

# ═══════════════════════════════════════════════════════════════════════════════
# LOW PRIORITY (5 issues)
# ═══════════════════════════════════════════════════════════════════════════════

create_issue \
  "Trim session payload" \
  "audit,severity:low,auth" \
  "$(cat <<'EOF'
## Problem

The NextAuth session includes full role objects with all their properties. This bloats every authenticated request and exposes internal data structures to the client.

## Impact

- Increased bandwidth and latency on every request (session is sent with each)
- Client-side code has access to internal role metadata that it doesn't need
- Larger attack surface if session data is ever logged or leaked

## Remediation

1. **Minimize session payload:** In the NextAuth `session` callback, include only the fields the client needs (e.g., `userId`, `email`, `privileges` array)
2. **Flatten roles:** Instead of full role objects, send only `role.name` or the derived privilege list
3. **Server-side lookups:** For admin operations that need full role details, look them up server-side rather than trusting the session

> Audit ref: AUTH-5
EOF
)" \
  "AUTH-5"

create_issue \
  "Add Zod schema validation to socket events" \
  "audit,severity:low,websocket" \
  "$(cat <<'EOF'
## Problem

`session.update` messages merge client-provided data into the session store via object spread without any schema validation.

**Location:** `server.ts:283-295`

```typescript
sessionStore.update(..., { data: { ...currentSession?.data, ...parsed.session } })
```

Socket event data in general is not validated against schemas.

## Impact

- **Data pollution:** Clients can inject arbitrary keys into session data
- **Logic bugs:** Server-side code that reads session.data may encounter unexpected types
- **Memory exhaustion:** Large payloads could bloat the session store

## Remediation

1. **Define Zod schemas** for every socket event type (`session.update`, `client:message`, `tool.call`, etc.)
2. **Validate on receipt:** Parse incoming event data through the schema before processing
3. **Field allowlist:** For `session.update`, explicitly list which fields clients can modify
4. **Reject invalid data:** Return an error event to the client for malformed messages

> Audit ref: WS-6
EOF
)" \
  "WS-6"

create_issue \
  "Remove server timestamp from ping endpoint" \
  "audit,severity:low,api" \
  "$(cat <<'EOF'
## Problem

The health/ping endpoint returns the server timestamp, which is minor information disclosure.

## Impact

- Server clock information can aid timing attacks
- Reveals server is running and responsive (though this is inherent to any health endpoint)
- Very low severity — informational only

## Remediation

Return a static response body (e.g., `{"status":"ok"}`) without including the server timestamp. If the timestamp is needed for monitoring, move it to a protected diagnostics endpoint.

> Audit ref: API-1
EOF
)" \
  "API-1"

create_issue \
  "Clean up console.log statements" \
  "audit,severity:low,code-quality" \
  "$(cat <<'EOF'
## Problem

Production code paths contain `console.log` statements that may output sensitive information (session data, request details, internal state) to stdout.

## Impact

- **Information disclosure:** Logs may contain user data, session tokens, or internal state
- **Log noise:** Makes it harder to find meaningful log entries in production
- **Compliance:** Logging user data may conflict with data handling policies

## Remediation

1. **Audit console.log usage:** Search for all `console.log` calls in `src/` and categorize as debug, info, warning, or error
2. **Replace with structured logger:** Use a logging library (e.g., `pino` or `winston`) with configurable log levels
3. **Remove debug logs:** Delete `console.log` calls that were used during development
4. **Retain meaningful logs:** Convert important operational logs to the structured logger at appropriate levels

> Audit ref: API-2
EOF
)" \
  "API-2"

create_issue \
  "Evaluate file storage encryption at rest" \
  "audit,severity:low,data" \
  "$(cat <<'EOF'
## Problem

User-uploaded files (experiences, assets) are stored on the filesystem without encryption at rest.

## Current context

The upload pipeline has strong security controls (rate limiting, ZIP bomb protection, path traversal prevention, file type validation). The gap is only about at-rest encryption.

## Impact

If the server's filesystem is compromised, user files are readable in plain text. This matters more as the platform scales to handle sensitive educational content.

## Remediation

1. **Assess data sensitivity:** Determine if uploaded content warrants encryption at rest
2. **Filesystem encryption:** Use OS-level encryption (LUKS, dm-crypt) or cloud provider encryption (EBS encryption, S3 SSE)
3. **Application-level encryption:** For sensitive fields, encrypt before writing and decrypt on read
4. **Key management:** If encrypting, use a proper key management solution (not hardcoded keys)

This is informational — the existing upload security controls are solid. Encryption at rest is a defense-in-depth consideration for production.

> Audit ref: DATA-1
EOF
)" \
  "DATA-1"

# ═══════════════════════════════════════════════════════════════════════════════
# QUICK WINS (1 bundled issue)
# ═══════════════════════════════════════════════════════════════════════════════

create_issue \
  "Low-effort code fixes from audit" \
  "audit,quick-win,severity:low,code-quality,config" \
  "$(cat <<'EOF'
## Overview

These are low-effort, low-risk fixes identified during the security audit. Each can be done independently in a few minutes.

## Checklist

- [ ] **Set `poweredByHeader: false` in `next.config.ts`** — Removes the `X-Powered-By: Next.js` header
- [ ] **Remove unused `next.config.mjs`** — Both `next.config.ts` and `next.config.mjs` exist; only `.ts` has security headers. Remove `.mjs` to eliminate confusion and the risk of accidentally loading the headerless config.
- [ ] **Fix duplicate `response.completed` case** — Check for duplicate case handling in server event processing
- [ ] **Fix `getArtifact` loading state bug** — Loading state not properly managed in artifact retrieval
- [ ] **Add debug logging to swallowed errors** — Several `catch` blocks silently swallow errors with no logging, making debugging difficult. Add `console.error` or structured logging to these blocks.

> Audit ref: Various quick wins from security audit
EOF
)" \
  "QUICK-WINS"

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "════════════════════════════════════════"
if $DRY_RUN; then
  echo "DRY RUN COMPLETE: $CREATED issues previewed"
  echo "Run without --dry-run to create them."
else
  echo "DONE: $CREATED created, $SKIPPED skipped, $FAILED failed"
  echo "Verify: gh issue list -R $REPO --label audit"
fi
echo "════════════════════════════════════════"
