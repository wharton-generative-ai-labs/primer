# Authentication & Authorization - AI Review

- **Review Date:** 2026-01-27
- **Reviewer:** Claude (AI)
- [x] **Status:** Complete

---

## Scope

### Files Reviewed

| File                                      | Lines | Purpose                         |
| ----------------------------------------- | ----- | ------------------------------- |
| `src/config/auth.ts`                      | 216   | Role/permission definitions     |
| `src/config/user-storage.ts`              | 135   | File-based user management      |
| `src/config/env.ts`                       | 200   | Environment variable validation |
| `src/app/api/auth/[...nextauth]/route.ts` | 86    | NextAuth handler                |
| `src/middleware.ts`                       | 91    | Auth middleware                 |
| `src/app/lib/classAuth.ts`                | 112   | Class-based access control      |
| `src/app/lib/experiencePermissions.ts`    | 66    | Experience visibility rules     |

### Areas Examined

1. OAuth implementation (Google)
2. Session management (JWT via NextAuth)
3. Role-based access control (RBAC)
4. Route protection (middleware)
5. Permission checking functions
6. Class-based access control
7. Environment variable handling

---

## Findings

### [HIGH] No Authentication on New Users - Open Registration

**Location:** `src/config/auth.ts:167-172`, `src/app/api/auth/[...nextauth]/route.ts:43`

**Description:** The `signIn` callback always returns `true`, allowing any user with a valid Google account to authenticate. There's no allowlist enforcement at the authentication layer.

**Evidence:**

```typescript
// src/app/api/auth/[...nextauth]/route.ts:43
return true; // Always allows sign-in
```

```typescript
// src/config/auth.ts:167-172
export const getUserRoles = (userEmail: string): Role[] => {
  if (typeof window !== "undefined") {
    return [];
  }
  return USER_ROLES[userEmail] || []; // Returns empty array for unknown users
};
```

**Impact:** Any person with a Google account can authenticate to the system. While they receive no roles/permissions by default, they still:

1. Pass the middleware authentication check (have a valid token)
2. May access routes that only check for authentication, not authorization
3. Create a potential foothold for privilege escalation attacks

**Recommendation:** Either:

1. Implement allowlist enforcement in the `signIn` callback, OR
2. Ensure ALL routes check for specific permissions, not just authentication status

---

### [HIGH] Middleware Only Checks Authentication, Not Authorization - Fail-Open Architecture

**Location:** `src/middleware.ts:51-63`

**Description:** The middleware only verifies that a user has a valid token (is authenticated). It does not check if the user has any roles or permissions. This is a **fail-open** architecture where authorization is delegated to individual route handlers.

**Evidence:**

```typescript
// src/middleware.ts:51-63
if (!token) {
  const signInUrl = new URL("/auth/signin", request.url);
  signInUrl.searchParams.set("returnUrl", encodeURIComponent(currentUrl));
  return NextResponse.redirect(signInUrl);
}

// All authenticated users can proceed
// Individual pages and APIs check permissions using:
// - usePermissions hook (client-side)
// - hasPermission/hasMergedPermission functions (server-side)
```

**Impact:**

1. A user with no roles can access any non-public route as long as they're authenticated
2. Authorization is delegated to individual pages/APIs - a single forgotten check creates a breach
3. No centralized audit trail of authorization decisions
4. For a V1 public release, this architecture is high-risk: one missed route handler = full data exposure

**Recommendation:** Implement a **Mandatory Authorization Layer**:

1. Create a wrapper function for all API handlers that defaults to "Deny All"
2. Require explicit permission declarations at the route level
3. Audit all existing routes for authorization gaps
4. Consider implementing route-level permission metadata in Next.js config

---

### [MEDIUM] Session Fixation Vector via WebSocket Layer

**Location:** `server.ts:256-261`, `src/app/api/auth/[...nextauth]/route.ts`

**Description:** While NextAuth rotates session IDs on sign-in by default, the WebSocket layer introduces a parallel session mechanism that bypasses this protection. The socket server accepts arbitrary client-provided session IDs and adopts them without validation.

**Evidence:**

```typescript
// server.ts:256-261
} else {
    // Session not in socket store, but client has one
    // Adopt the client's session ID and create a socket session entry for it
    socket.data.sessionId = existingSessionId;
    createNewSession(existingSessionId);
}
```

**Impact:**

1. An attacker could provide a known session ID before authentication
2. After the victim authenticates (via NextAuth), the socket session remains fixed
3. The attacker could then connect with the same session ID to access the victim's socket session
4. This bypasses NextAuth's session rotation since socket sessions are independent

**Recommendation:**

1. Bind socket sessions to NextAuth session tokens
2. Validate that socket session IDs were server-generated (not client-provided)
3. Rotate socket session IDs when NextAuth session changes

---

### [MEDIUM] File-Based User Storage - No Input Validation on Roles

**Location:** `src/config/user-storage.ts:84-89`

**Description:** When loading file-based users, role keys are directly mapped to ROLES without validation that they are valid role keys.

**Evidence:**

```typescript
// src/config/user-storage.ts:84-89
Object.entries(fileData.users).forEach(([email, userData]) => {
  if (!result[email]) {
    result[email] = userData.roles.map((key) => ROLES[key]); // No validation
  }
});
```

**Impact:** If the `users.json` file is corrupted or tampered with, invalid role keys could cause undefined behavior. An attacker with file system access could potentially inject malformed data.

**Recommendation:** Validate role keys against the `RoleKey` type before mapping:

```typescript
result[email] = userData.roles
  .filter((key) => key in ROLES)
  .map((key) => ROLES[key]);
```

---

### [MEDIUM] Diagnostic Endpoints Publicly Accessible

**Location:** `src/middleware.ts:37`

**Description:** The `/api/diagnostic` path is in the public allowlist, meaning diagnostic endpoints can be accessed without authentication.

**Evidence:**

```typescript
// src/middleware.ts:32-41
const publicPaths = [
  "/auth/signin",
  "/auth/test",
  "/auth/unauthorized",
  "/api/auth",
  "/api/diagnostic", // Diagnostic endpoints for troubleshooting
  "/images",
  "/_next",
  "/favicon.ico",
];
```

**Impact:** Depending on what diagnostic endpoints expose, this could leak sensitive information about the system (versions, configurations, internal state).

**Recommendation:** Review diagnostic endpoints and either:

1. Remove from public allowlist if they contain sensitive info
2. Ensure they only expose non-sensitive health check data

---

### [LOW] Session Data Includes Full Role Objects

**Location:** `src/app/api/auth/[...nextauth]/route.ts:45-58`

**Description:** The session callback includes full `privileges` and `roles` arrays in the session object, which is sent to the client.

**Evidence:**

```typescript
// src/app/api/auth/[...nextauth]/route.ts:45-58
session: async ({ session }) => {
  if (session?.user?.email) {
    const privileges: Permission[] = getMergedUserPrivileges(
      session.user.email,
    );
    const roles: Role[] = getMergedUserRolesForUser(session.user.email);

    return {
      ...session,
      user: {
        ...session.user,
        privileges,
        roles,
      },
    };
  }
  return session;
};
```

**Impact:** Client-side code receives the full permission set, which:

1. Reveals the permission structure to potential attackers
2. Could be used to understand what actions are available (information disclosure)
3. Client-side permission checks can be bypassed (must always re-verify server-side)

**Recommendation:**

1. Ensure all permission checks are performed server-side
2. Consider sending only a minimal role identifier to the client

---

### [LOW] JSON Parsing Without Error Boundaries in Class Auth

**Location:** `src/app/lib/classAuth.ts:18-24`

**Description:** JSON parsing of `classes.json` catches errors but returns `false`, potentially hiding configuration issues.

**Evidence:**

```typescript
// src/app/lib/classAuth.ts:16-30
try {
  if (await storage.fileExists(classesPath)) {
    const content = await storage.readFile(classesPath);
    const config = JSON.parse(content.toString()) as ClassesConfig;
    // ...
  }
} catch (error) {
  logger.error(error, "Error checking class membership");
}
return false;
```

**Impact:** A malformed `classes.json` file would silently deny access to all class members rather than alerting administrators.

**Recommendation:** Consider distinguishing between "file doesn't exist" (expected) and "file is malformed" (error condition that should be flagged).

---

### [INFORMATIONAL] NEXTAUTH_SECRET Minimum Length Enforced

**Location:** `src/config/env.ts:65`

**Description:** The environment validation correctly enforces a 32-character minimum for NEXTAUTH_SECRET.

**Evidence:**

```typescript
NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
```

**Assessment:** This is a positive security control.

---

### [INFORMATIONAL] Case-Insensitive Email Comparison

**Location:** `src/app/lib/classAuth.ts:23`, `src/app/lib/experiencePermissions.ts:39`

**Description:** Email comparisons use `.toLowerCase()` for case-insensitive matching.

**Evidence:**

```typescript
// src/app/lib/classAuth.ts:23
cls.members.some((m) => m.email.toLowerCase() === userEmail.toLowerCase());

// src/app/lib/experiencePermissions.ts:39
const emailLower = userEmail.toLowerCase();
```

**Assessment:** This is a positive security practice preventing case-based bypasses.

---

## Positive Security Observations

1. **Zod validation for environment variables** - Strong schema validation prevents misconfiguration
2. **Audit logging for auth events** - Sign-in and sign-out events are logged
3. **Separate system for env vs file-based users** - Env users take precedence, preventing file-based override
4. **Permission-based access control** - Granular permissions instead of just roles
5. **CSP headers applied** - Content Security Policy is applied via middleware
6. **Case-insensitive email handling** - Prevents bypass via email case manipulation

---

## Risk Assessment

### Overall Rating: MEDIUM-HIGH

**Attack Surface:**

- Authentication is delegated to Google OAuth (reduced attack surface)
- Authorization is decentralized to individual routes (HIGH risk of gaps - fail-open architecture)
- File-based user storage adds local attack vector
- Parallel socket session mechanism bypasses NextAuth protections

**Key Risks:**

1. **Fail-open authorization** - Any forgotten route handler check = data breach
2. Open registration allows any Google user to authenticate
3. Session fixation possible via WebSocket layer
4. Diagnostic endpoints may leak information

**Compensating Controls:**

- Google OAuth provides strong authentication
- Audit logging provides forensic capability
- Environment validation prevents common misconfigurations

**Public Release Readiness:** NOT READY without centralized authorization layer

---

## Recommendations

### Priority 1 (Critical)

1. **Implement Mandatory Authorization Layer** - Create a wrapper for all API handlers that defaults to "Deny All" and requires explicit permission declarations
2. Bind socket sessions to NextAuth sessions to prevent session fixation

### Priority 2 (High)

3. Implement user allowlist enforcement in `signIn` callback OR audit ALL routes for authorization checks
4. Review and protect diagnostic endpoints

### Priority 3 (Medium)

5. Add role key validation in file-based user loading
6. Review what session data is exposed to client

### Priority 4 (Low)

7. Improve error handling in class auth to distinguish missing vs malformed files
