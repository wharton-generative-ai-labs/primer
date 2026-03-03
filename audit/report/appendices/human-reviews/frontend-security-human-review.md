# Frontend Security - Human Review

---

??? info "AI Review Guidance :material-robot-outline:"
    **No AI review exists for this category.** Your findings are unique and will not have an AI comparison counterpart. This makes your review particularly valuable for the research comparison — it shows what a human finds that the AI never examined.

    ### What to Focus On

    1. **XSS vectors — the #1 frontend risk.** Search for:
       - Any use of `dangerouslySetInnerHTML` — what's rendered and is it sanitized?
       - Markdown rendering — is the markdown library configured to sanitize HTML?
       - AI-generated content rendered to the DOM — is it escaped?
       - URL parameters rendered without encoding

    2. **Client-side auth state.** Check `usePermissions.ts` and the context providers:
       - Is permission checking done only client-side, or also server-side?
       - Can you bypass UI permission gates by modifying React state in DevTools?
       - What happens if you modify the session object in browser storage?

    3. **Client storage (sessionStorage / localStorage).** Check what's stored:
       - Are tokens, session IDs, or sensitive data in client storage?
       - Is anything sensitive visible in DevTools > Application > Storage?
       - XSS + client storage = credential theft

    4. **WebSocket client security.** Look at `SocketController.tsx` and `useRealtimeConnection.ts`:
       - What auth data is sent in the socket handshake?
       - Is the socket URL hardcoded or configurable (redirect attack potential)?
       - How are incoming socket events handled — is any data rendered unsanitized?

    5. **File upload security.** Check `FileUpload.tsx`:
       - Is file type validation client-side only or also server-side?
       - What happens if you upload a `.html` file? Could it be served back as HTML (stored XSS)?

    6. **CSP effectiveness.** Read `src/lib/csp.ts`:
       - `unsafe-eval` is present (noted in earlier audit). Verify what requires it (likely mermaid.js)
       - Is `unsafe-inline` present for styles or scripts?
       - Would the CSP actually block a realistic XSS payload?

    ### Practical Test Steps

    ```bash
    # Code search
    grep -r "dangerouslySetInnerHTML" src/
    grep -r "sessionStorage\|localStorage" src/
    grep -r "innerHTML" src/
    grep -r "unsafe-inline\|unsafe-eval" src/

    # Live testing
    # 1. Open DevTools > Application > Storage — note what's there
    # 2. Try injecting `<img src=x onerror=alert(1)>` into any text input
    # 3. Inspect the CSP header in Network tab responses
    # 4. Open React DevTools, find permission state, try modifying it
    # 5. Upload a .html file and check if it can be served back as HTML
    ```

---

## Scope

### Files Reviewed

_List all files you reviewed:_

- [x] `src/middleware.ts`
- [x] `src/config/auth.ts`
- [x] `src/app/providers.tsx` — Standard NextAuth session provider wrapping
- [x] `src/app/contexts/ArtifactContext.tsx` — API calls use fetch, session comes from provider
- [x] `src/app/lib/session-utils.ts` — UUID generation for session IDs (crypto.randomUUID)
- [x] `src/app/components/FileUpload.tsx` — File type validation is client-side only (see Finding 4)
- [x] `src/app/hooks/useRealtimeConnection.ts` — WebRTC connection setup
- [x] `src/app/components/SocketController.tsx` — Socket.io client (covered in WebSocket review)
- [x] `src/app/play/[id]/page.tsx` — Main experience page, uses React state
- [x] `src/app/contexts/EventContext.tsx` — Uses localStorage for event persistence
- [x] `src/lib/csp.ts`
- [x] `src/app/auth/signin/page.tsx` — Standard NextAuth signin redirect
- [x] `src/app/hooks/usePermissions.ts`
- [x] `src/app/lib/tools/ui/mermaid/MermaidDiagram.tsx`
- [x] `src/app/lib/security/html-sanitizer.ts`
- [x] `src/app/lib/tools/groups.ts`

### Methodology

_Describe your review approach:_

**Tools Used:**

- [x] Browser DevTools
- [x] React DevTools
- [x] Network inspection
- [x] Manual code review
- [x] `grep` searches

**Approach:**
Conducted static analysis of key frontend components and security configuration. Focused on XSS vectors (`dangerouslySetInnerHTML`, `innerHTML`, `eval`), CSP configuration, and client-side permission logic. Verified sanitization implementation for dynamic content.

---

## Findings

### Finding 1: Weak Content Security Policy (CSP)

**Severity:** High

**Location:** `src/lib/csp.ts`

**Description:**
The CSP configuration includes both `'unsafe-eval'` and `'unsafe-inline'` for scripts and styles.

- `'unsafe-eval'` is used for "Next.js development mode HMR" and "Babel (custom components)".
- `'unsafe-inline'` is used for "Tailwind and dynamic styles" and "Next.js inline scripts".

**Impact:**
This configuration significantly weakens the protection against Cross-Site Scripting (XSS). If an attacker can inject a script, the CSP will not block it from executing or loading external resources (due to `https://cdnjs.cloudflare.com` and `https://cdn.jsdelivr.net` being allowed).

**Evidence:**

```typescript
'script-src': [
  "'self'",
  "'unsafe-eval'", // Required for Babel (custom components) and dev HMR
  "'unsafe-inline'", // Required for Next.js inline scripts
  "https://cdnjs.cloudflare.com",
  "https://cdn.jsdelivr.net",
],
```

**Recommendation:**
Refine the CSP for production:

1.  Remove `'unsafe-eval'` if possible (verify if custom components strictly require it in prod).
2.  Use nonces or hashes for inline scripts instead of `'unsafe-inline'`.
3.  Restrict CDN allowlists to specific libraries/files if possible.

---

### Finding 2: Server-Side `eval` Usage

**Severity:** Low (PoC Acceptable)

**Location:** `src/app/lib/tools/groups.ts:48-50`

**Description:**
The code uses `eval('require')` to dynamically load `fs`, `path`, and `@/config/env` in a server-side context. This is likely done to bypass build-time bundling issues or for dynamic configuration loading.

**Impact:**
While currently restricted to server-side code loading a local config file, usage of `eval` is a dangerous pattern. If the `tool-mappings.json` path could be manipulated or if the file content were user-controlled (e.g. via shared storage), this could lead to Remote Code Execution (RCE).

**Evidence:**

```typescript
const path = eval("require")("path");
const fs = eval("require")("fs");
const { env } = eval("require")("@/config/env");
```

**Recommendation:**
Replace `eval('require')` with proper dynamic imports (`import()`) or restructure the code to avoid runtime require of standard libraries.

---

### Finding 3: Client-Side Permission Checks

**Severity:** Medium

**Location:** `src/app/hooks/usePermissions.ts`

**Description:**
The `usePermissions` hook relies entirely on the `session` object present in the React context. While standard for UI toggling, if API endpoints do not mirror these checks (as noted in Authentication Review), a user could modify their local session state or replay requests to bypass UI restrictions.

**Impact:**
A user could enable UI elements (e.g., "Edit" buttons) that they shouldn't see. If the backend fails to validate the request, unauthorized actions will succeed.

**Evidence:**

```typescript
const privileges = session?.user?.privileges || [];
const can = useCallback(
  (permission: Permission): boolean => {
    return privileges.includes(permission);
  },
  [session, privileges],
);
```

**Recommendation:**
Ensure all actions gated by `usePermissions` in the UI have a corresponding `hasPermission` check in the API route or Server Action.

---

### Finding 4: Client-Side Only File Type Validation

**Severity:** Medium

**Location:** `src/app/components/FileUpload.tsx`

**Description:**
The file upload component validates file types on the client side via the `accept` attribute and JavaScript checks before upload. However, client-side validation can be trivially bypassed using browser DevTools or by crafting requests directly.

**Impact:**
An attacker could upload files with unexpected extensions or content types. If uploaded files are served back with their original content type (e.g., `.html` files served as `text/html`), this creates a stored XSS vector.

**Evidence:**
```tsx
// Client-side accept attribute
<input type="file" accept=".pdf,.doc,.docx,.txt" ... />

// No corresponding server-side MIME type verification visible
```

**Recommendation:**
1. Implement server-side file type validation using magic bytes (file signatures), not just extensions.
2. Ensure uploaded files are served with `Content-Disposition: attachment` or stored with sanitized extensions.
3. Consider content scanning for HTML/script content in uploaded files.

---

### Finding 5: localStorage Event Persistence

**Severity:** Low

**Location:** `src/app/contexts/EventContext.tsx`

**Description:**
The EventContext stores event data in localStorage for persistence across page reloads. The data stored appears to be event IDs and UI state rather than sensitive auth tokens.

**Impact:**
Low risk. XSS would allow an attacker to read localStorage, but the data stored here isn't particularly sensitive. The session token is managed by NextAuth via httpOnly cookies (verified in Network tab), not localStorage.

**Evidence:**
Reviewed localStorage in DevTools Application tab — contains event preferences and UI state, no auth tokens.

**Recommendation:**
No action required for PoC. For production, consider whether event data could leak sensitive information about user activity patterns.

---

### Finding 6: CDN Script Sources in CSP

**Severity:** Informational

**Location:** `src/lib/csp.ts`

**Description:**
The CSP allows scripts from `cdnjs.cloudflare.com` and `cdn.jsdelivr.net`. These are large public CDNs hosting thousands of JavaScript libraries.

**Impact:**
If an attacker finds an XSS injection point, they could load any library from these CDNs. Some libraries on public CDNs have been used in supply chain attacks. This expands the attack surface beyond just `unsafe-eval`.

**Evidence:**
```typescript
'script-src': [
  "'self'",
  // ...
  "https://cdnjs.cloudflare.com",
  "https://cdn.jsdelivr.net",
],
```

**Recommendation:**
For production, pin to specific library versions with Subresource Integrity (SRI) hashes, e.g.:
```html
<script src="https://cdn.jsdelivr.net/npm/library@1.2.3/dist/lib.min.js"
        integrity="sha384-abc123..." crossorigin="anonymous">
```

---

## Positive Security Observations

Document security controls that are well-implemented:

1. **HTML Sanitization:** `MermaidDiagram.tsx` correctly uses `sanitizeHtml` (stripping scripts and event handlers) before rendering SVG content via `dangerouslySetInnerHTML`.
2. **Backend Validation:** The `backend-agent` API endpoint (`src/app/api/backend-agent/route.ts`) implements robust validation, rate limiting, and tool execution limits (max calls, max failures) to prevent abuse.
3. **Session Token Handling:** NextAuth stores session tokens in httpOnly cookies, not accessible to JavaScript. Verified in Network tab — no bearer tokens in localStorage or sessionStorage.
4. **Secure Session ID Generation:** `session-utils.ts` uses `crypto.randomUUID()` which provides cryptographically secure random UUIDs, not predictable sequential IDs.
5. **React Default Escaping:** Throughout the codebase, dynamic content is rendered via JSX (`{variable}`) which automatically escapes HTML entities. `dangerouslySetInnerHTML` usage is limited and sanitized.

---

## Risk Assessment

### Overall Frontend Security Posture

**Rating:** Medium

**Summary:**
The frontend has basic protections but relies heavily on a permissive CSP and client-side state. The use of `dangerouslySetInnerHTML` is generally well-guarded by sanitizers, but the wide-open CSP reduces the "defense in depth" value.

### Attack Surface Analysis

| Vector         | Risk Level | Notes                                                                  |
| -------------- | ---------- | ---------------------------------------------------------------------- |
| XSS            | Medium     | Mitigated by React default escaping & `sanitizeHtml`, but CSP is weak. |
| Client Storage | Low        | Session in httpOnly cookie. localStorage has non-sensitive event data. |
| Input Handling | Low        | Most inputs go to AI or structured APIs.                               |
| Auth Bypass    | Medium     | UI checks are client-side; dependent on backend consistency.           |
| WebSocket      | High       | (Covered in WebSocket review) - major exposure point.                  |
| File Upload    | Medium     | Client-side validation only. Server must validate MIME types.          |

---

## Recommendations

### Priority Order

1. **Strengthen CSP:** Remove `'unsafe-eval'` and implement nonces for `'unsafe-inline'` in production builds.
2. **Server-Side File Validation:** Add MIME type validation using magic bytes on the server, not just client-side checks.
3. **Verify API Parity:** Systematic audit to ensure every `can(Permission.X)` check in UI has a matching `hasPermission` check in the backend handler.
4. **Refactor `eval`:** Remove the `eval('require')` pattern in `groups.ts`.
5. **SRI for CDN Scripts:** Add Subresource Integrity hashes when loading scripts from public CDNs.

---

## Sign-off

- **Reviewer Name:** Chris (Technical Auditor)
- **Date:** 2026-02-03 (updated)
- **Time Spent:** 3 hrs
- **Confidence Level:** High

**Notes:**
- The server-side `eval` finding was unexpected in a "Frontend" review but was found during `grep` scans for dangerous patterns. It should be tracked as a backend code quality/security issue.
- Updated 2026-02-03: Completed review of remaining unchecked files. Added findings for file upload validation (Finding 4), localStorage usage (Finding 5), and CDN script sources (Finding 6). Added positive observations for session token handling and secure UUID generation.
