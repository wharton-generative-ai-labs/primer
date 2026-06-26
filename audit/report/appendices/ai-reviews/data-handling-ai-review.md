# Data Handling & Privacy - AI Review

- **Review Date:** 2026-01-27
- **Reviewer:** Claude (AI)
- [x] **Status:** Complete

---

## Scope

### Areas Reviewed

1. File upload security
2. Storage service abstraction
3. User data handling
4. Logging practices
5. Session data management

---

## Findings

### [INFORMATIONAL] File Upload Security - Strong Implementation

**Location:** `src/app/api/upload/route.ts`

**Controls Implemented:**

| Control              | Implementation                           |
| -------------------- | ---------------------------------------- |
| Rate limiting        | 10 uploads per hour per client           |
| File size limit      | `FILE_UPLOAD_LIMITS.EXPERIENCE_MAX_SIZE` |
| ZIP bomb protection  | Decompressed size limit                  |
| Path traversal       | `sanitizeZipEntryPath()` function        |
| SSRF protection      | `validateUrl()` for remote URLs          |
| File type validation | Requires `experience.json` in root       |
| Audit logging        | `auditExperienceUpload()` called         |
| Cleanup on failure   | Removes partially extracted files        |

**Assessment:** Comprehensive upload security implementation.

---

### [INFORMATIONAL] Storage Service Abstraction

**Location:** `src/app/lib/storage/StorageServiceFactory.ts`

**Description:** Storage is abstracted through a service factory, allowing for local or S3 backends.

**Security Benefits:**

1. Consistent path validation across storage backends
2. Centralized access control point
3. Easy to add encryption or additional security

---

### [LOW] User File-Based Storage Without Encryption

**Location:** `src/config/user-storage.ts`

**Description:** File-based users are stored in `users.json` without encryption.

**Evidence:**

```typescript
// Users stored in plaintext JSON
const fileData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
```

**Impact:**

1. User roles visible to anyone with file system access
2. No protection against file tampering

**Mitigating Factors:**

1. Environment-defined users take precedence
2. File should be in protected directory
3. No sensitive data (passwords, tokens) stored

**Recommendation:** Document that file system security is required for users.json protection.

---

### [INFORMATIONAL] Audit Logging Present

**Locations:**

- `src/lib/audit-logger.ts` - Audit logging utilities
- `src/app/api/admin/users/route.ts` - Admin action logging
- `src/app/api/upload/route.ts` - Upload logging
- `src/app/api/auth/[...nextauth]/route.ts` - Auth event logging

**Events Logged:**

- Sign-in events
- Sign-out events
- Authorization failures
- Admin user modifications
- Experience uploads

**Assessment:** Good audit coverage for security-relevant events.

---

### [LOW] Session Data in Memory Without Expiration

**Location:** `server.ts` (WebSocket session store)

**Description:** As noted in WebSocket review, sessions are stored in memory without TTL.

**Data Stored:**

```typescript
interface Session {
  id: string;
  socketId?: string;
  status: "connected" | "disconnected";
  createdAt: Date;
  lastActivity: Date;
  data?: any; // Arbitrary data can be stored
}
```

**Impact:**

1. Session data persists indefinitely
2. No automatic cleanup of old sessions
3. Potential memory growth over time

**Recommendation:** Implement session TTL and cleanup.

---

### [INFORMATIONAL] Structured Logging with Pino

**Location:** `src/lib/logger.ts`

**Assessment:** The application uses Pino for structured logging with module namespacing.

**Security Considerations:**

1. Structured logs are easier to analyze for security events
2. Module-based namespacing helps trace issues
3. Need to ensure sensitive data isn't logged

---

### [LOW] Potential PII in Logs

**Observation:** Email addresses are logged in various places for audit purposes.

**Examples:**

- Auth events include user email
- Admin actions include actor and target email
- Upload events include user email

**Assessment:** This is generally acceptable for audit logging, but:

1. Ensure logs are properly secured
2. Consider log retention policies
3. Be aware of GDPR/privacy implications if applicable

---

## Data Flow Analysis

### User Authentication Flow

```text
Google OAuth → NextAuth → JWT Session → Client
                ↓
         User email stored in:
         - Session token
         - Audit logs
         - File-based user storage (if assigned roles)
```

### Experience Upload Flow

```text
Client → Upload API → Storage Service
           ↓              ↓
      Rate limit      Path validation
      Size check      Sanitization
      Audit log       ZIP bomb check
```

### Session Data Flow

```text
Client → WebSocket → In-Memory Store
           ↓
      Session ID
      Socket ID
      Arbitrary data (from client)
```

---

## Positive Security Observations

1. **Storage abstraction** - Consistent security across backends
2. **Audit logging** - Comprehensive security event logging
3. **Upload validation** - Multiple layers of protection
4. **No password storage** - OAuth-only authentication
5. **Structured logging** - Pino with module namespacing

---

## Risk Assessment

### Overall Rating: LOW

**Data Security Posture:**

- Strong upload security
- Good audit logging
- Abstracted storage

**Privacy Considerations:**

- Email addresses in logs (acceptable for audit)
- User roles in file storage (not encrypted)
- Session data in memory (no expiration)

---

## Recommendations

### Priority 1 (Medium)

1. Implement session expiration and cleanup
2. Document file system security requirements for users.json

### Priority 2 (Low)

3. Review log retention policies
4. Consider log scrubbing for non-essential PII
5. Document data handling practices for compliance
