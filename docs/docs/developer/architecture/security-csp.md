---
id: security-csp
title: Security & CSP
sidebar_position: 8
---

# Security & Content Security Policy

Primer implements multiple security layers to protect users and data.

## Content Security Policy (CSP)

CSP controls which external resources can load, preventing XSS and other attacks.

### Configuration

CSP is defined in `src/lib/csp.ts`:

```typescript
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'media-src': ["'self'", 'blob:'],
  'connect-src': ["'self'", 'https://api.openai.com'],
  // ...
};
```

### Adding External Resources

To allow a new external resource:

1. **Identify the directive**: `connect-src` for APIs, `img-src` for images, etc.
2. **Add the domain**: Include full domain or wildcard
3. **Test**: Verify in production mode
4. **Document**: Note why it's needed

Example:

```typescript
'connect-src': [
  "'self'",
  'https://api.openai.com',
  'https://api.anthropic.com',  // Added for Claude
],
```

### Testing CSP

```bash
npm run build
npm start
# Check browser console for CSP violations
```

## Authentication

NextAuth.js with file-based user management:

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  // Check authentication
  // Redirect to login if needed
}
```

### User Management

Users defined in configuration file (not committed):

```json
{
  "users": [
    {
      "email": "user@example.com",
      "name": "User Name",
      "password": "hashed-password"
    }
  ]
}
```

## Authorization

Permission-based access control:

```typescript
// src/app/lib/permissions.ts
export function checkPermission(user, action, resource) {
  // Check if user can perform action on resource
}
```

### Permission Levels

- **Admin**: Full access
- **Creator**: Can create/edit experiences
- **User**: Can play experiences
- **Guest**: Limited access

## SSRF Protection

URL validation prevents Server-Side Request Forgery:

```typescript
// src/app/lib/security/url-validation.ts
export function validateURL(url: string): boolean {
  // Check against allowlist
  // Block private IPs
  // Validate protocol
}
```

## HTML Sanitization

XSS prevention for dynamic content:

```typescript
// src/app/lib/security/html-sanitizer.ts
export function sanitizeHTML(html: string): string {
  // Remove dangerous tags
  // Strip event handlers
  // Validate attributes
}
```

## Rate Limiting

API request throttling:

```typescript
// src/app/lib/rate-limit.ts
export async function rateLimit(identifier: string) {
  // Check request count
  // Enforce limits
  // Return 429 if exceeded
}
```

## Audit Logging

Security event tracking:

```typescript
// src/lib/audit-logger.ts
auditLogger.log({
  event: 'user.login',
  user: userId,
  timestamp: new Date(),
  details: { ... }
});
```

Logs stored in `storage/audit-logs/`.

## Best Practices

### For Developers

1. **Never commit secrets** - use environment variables
2. **Validate all inputs** - don't trust user data
3. **Use parameterized queries** - prevent injection
4. **Sanitize outputs** - prevent XSS
5. **Log security events** - enable audit trail

### For Deployments

1. **Use HTTPS** - always in production
2. **Set strong secrets** - for NEXTAUTH_SECRET
3. **Restrict CORS** - limit allowed origins
4. **Enable CSP** - enforce in production
5. **Monitor logs** - watch for suspicious activity

### For Experiences

1. **Validate user uploads** - check file types and sizes
2. **Sanitize artifacts** - clean user-generated content
3. **Limit tool access** - use appropriate tool groups
4. **Log agent actions** - track what agents do
5. **Test security** - verify CSP and permissions

## Common Issues

### CSP Violations

**Symptom**: Resources blocked, console errors

**Solution**:
1. Check browser console for violation details
2. Add domain to appropriate CSP directive
3. Test in production mode
4. Verify no wildcards unless necessary

### Authentication Loops

**Symptom**: Redirects to login repeatedly

**Solution**:
1. Check NEXTAUTH_SECRET is set
2. Verify user credentials
3. Check middleware configuration
4. Clear browser cookies

### CORS Errors

**Symptom**: API calls blocked from frontend

**Solution**:
1. Add origin to ALLOWED_ORIGINS
2. Check NEXT_PUBLIC_SOCKET_SERVER_URL
3. Verify protocol (http vs https)
4. Test with curl to isolate issue

## Security Checklist

Before deploying:

- [ ] HTTPS enabled
- [ ] Secrets in environment variables
- [ ] CSP configured and tested
- [ ] Authentication working
- [ ] Rate limiting enabled
- [ ] Audit logging active
- [ ] File upload validation
- [ ] CORS properly restricted
- [ ] Error messages don't leak info
- [ ] Dependencies up to date

## Reporting Security Issues

If you find a security vulnerability:

1. **Don't open a public issue**
2. **Email security contact** (see SECURITY.md)
3. **Provide details**: Steps to reproduce, impact
4. **Allow time** for fix before disclosure

## Next Steps

- [Configuration](/developer/configuration) - Environment setup
- [Deployment](/developer/guides/deployment) - Production deployment
- [Contributing](/developer/contributing) - Security best practices
