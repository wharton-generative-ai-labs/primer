# Production CSP Setup Guide

## Overview

The Content Security Policy (CSP) implementation automatically adapts to development and production environments. This guide explains what you need to configure for production deployments.

## Required Environment Variable

### `NEXT_PUBLIC_SOCKET_SERVER_URL`

**Purpose**: Tells the CSP which domain to whitelist for WebSocket connections in production.

**Format**: Full URL including protocol (https:// or http://)

**Examples**:
- Render: `https://your-app.onrender.com`
- Vercel: `https://your-app.vercel.app`
- Custom domain: `https://primer.yourdomain.com`

**Important**: This must be set **before build time** because Next.js embeds `NEXT_PUBLIC_*` variables during the build process.

## How It Works

### Development Mode (NODE_ENV=development)
```bash
# No NEXT_PUBLIC_SOCKET_SERVER_URL needed
# CSP automatically allows:
connect-src:
  'self'
  https://api.openai.com
  ws://localhost:*
  wss://localhost:*
  http://localhost:*
```

### Production Mode (NODE_ENV=production)
```bash
# With NEXT_PUBLIC_SOCKET_SERVER_URL=https://your-app.onrender.com
# CSP automatically allows:
connect-src:
  'self'
  https://api.openai.com
  wss://your-app.onrender.com    ← WebSocket protocol
  https://your-app.onrender.com  ← HTTP/HTTPS for Socket.io polling fallback
```

## Deployment Checklist

### 1. Set Environment Variable

**Render**:
```
Environment → Add Environment Variable
Key: NEXT_PUBLIC_SOCKET_SERVER_URL
Value: https://your-app.onrender.com
```

**Vercel**:
```
Settings → Environment Variables
Key: NEXT_PUBLIC_SOCKET_SERVER_URL
Value: https://your-app.vercel.app
```

**Docker/Self-hosted**:
```bash
# In .env or docker-compose.yml
NEXT_PUBLIC_SOCKET_SERVER_URL=https://your-domain.com
```

### 2. Rebuild Application

After setting the environment variable, you **must rebuild** the application:

```bash
npm run build
```

The CSP configuration is embedded at build time, so changes to `NEXT_PUBLIC_SOCKET_SERVER_URL` require a rebuild.

### 3. Verify CSP Headers

After deployment, check the CSP headers:

```bash
curl -I https://your-app.onrender.com
```

Look for the `Content-Security-Policy` header and verify it includes your domain:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ... connect-src 'self' https://api.openai.com wss://your-app.onrender.com https://your-app.onrender.com; ...
```

### 4. Test WebSocket Connection

1. Open your production app in a browser
2. Open DevTools → Console
3. Try to use a feature that requires WebSocket (e.g., Realtime API)
4. Check for CSP violations in the console
5. Verify Socket.io connects successfully

## Common Issues

### Issue: WebSocket Connection Blocked

**Symptom**: Console error: "Refused to connect to 'wss://your-app.onrender.com' because it violates the following Content Security Policy directive"

**Cause**: `NEXT_PUBLIC_SOCKET_SERVER_URL` not set or set incorrectly

**Solution**:
1. Verify the environment variable is set correctly
2. Rebuild the application: `npm run build`
3. Redeploy

### Issue: Socket.io Falls Back to Polling

**Symptom**: Socket.io works but uses long-polling instead of WebSocket

**Cause**: WebSocket URL not whitelisted in CSP

**Solution**: Same as above - ensure `NEXT_PUBLIC_SOCKET_SERVER_URL` is set and rebuild

### Issue: CSP Header Missing Production URLs

**Symptom**: CSP header doesn't include your production domain

**Cause**: Environment variable set after build, or not available during build

**Solution**:
1. Ensure `NEXT_PUBLIC_SOCKET_SERVER_URL` is set in your deployment platform
2. Trigger a new build (don't just restart)
3. Verify the variable is available during build by checking build logs

## Environment Variable Precedence

The CSP uses this logic:

```typescript
if (NODE_ENV === 'development') {
  // Allow localhost connections
  allow: ws://localhost:*, wss://localhost:*, http://localhost:*
} else if (NEXT_PUBLIC_SOCKET_SERVER_URL is set) {
  // Parse URL and allow WebSocket connections to that domain
  const url = new URL(NEXT_PUBLIC_SOCKET_SERVER_URL);
  allow: wss://url.host, https://url.host
} else {
  // No additional URLs (only 'self' and api.openai.com)
  // WebSocket will only work if on same domain
}
```

## Multiple Domains / Load Balancers

If you have multiple domains or a load balancer:

### Option 1: Use Primary Domain
Set `NEXT_PUBLIC_SOCKET_SERVER_URL` to your primary domain. Users accessing via other domains may have issues.

### Option 2: Modify CSP Code
Edit `src/lib/csp.ts` to add additional domains:

```typescript
'connect-src': [
  "'self'",
  "https://api.openai.com",
  ...productionWsUrls,
  "wss://domain1.com",
  "https://domain1.com",
  "wss://domain2.com",
  "https://domain2.com",
  // ... more domains
].filter(Boolean),
```

### Option 3: Use Wildcard (Less Secure)
For subdomains, you can use wildcards:

```typescript
"wss://*.yourdomain.com",
"https://*.yourdomain.com",
```

**Warning**: Wildcards are less secure. Only use if you trust all subdomains.

## Testing Script

Use the included test script to verify CSP configuration:

```bash
# Test production deployment
./scripts/test-csp.sh https://your-app.onrender.com

# Test local development
./scripts/test-csp.sh http://localhost:3000
```

The script will:
- Check if CSP header is present
- Verify all required directives
- Check for production-specific URLs
- Validate other security headers

## Security Considerations

### Why This Approach?

1. **Security**: Only whitelists the specific domain you're deploying to
2. **Flexibility**: Works with any hosting provider
3. **Automatic**: No manual CSP editing needed per deployment
4. **Safe Default**: If not set, falls back to same-origin only

### What's Protected?

- ✅ XSS attacks (script injection)
- ✅ Clickjacking (frame embedding)
- ✅ Data exfiltration (unauthorized connections)
- ✅ Resource injection (unauthorized external resources)

### What's Allowed?

- ✅ OpenAI API (`https://api.openai.com`)
- ✅ Wharton fonts (`https://gail.wharton.upenn.edu`)
- ✅ Your production domain (from `NEXT_PUBLIC_SOCKET_SERVER_URL`)
- ✅ Same-origin resources

## Monitoring

Consider implementing CSP violation reporting in production:

1. Add a CSP report endpoint: `/api/csp-report`
2. Update CSP to include: `report-uri /api/csp-report`
3. Log violations for analysis
4. Monitor for:
   - Legitimate resources being blocked
   - Attempted XSS attacks
   - Misconfigured external resources

## Support

For issues or questions:
- **Documentation**: `context/architecture/security-csp.md`
- **Implementation**: `CSP-IMPLEMENTATION.md`
- **Configuration**: `src/lib/csp.ts`
- **Testing**: `scripts/test-csp.sh`

## Quick Reference

| Environment | NEXT_PUBLIC_SOCKET_SERVER_URL | WebSocket URLs Allowed |
|-------------|------------------------------|------------------------|
| Development | Not needed | `ws://localhost:*`, `wss://localhost:*` |
| Production | `https://your-app.onrender.com` | `wss://your-app.onrender.com`, `https://your-app.onrender.com` |
| Production (not set) | Not set | Only same-origin |

## Example Deployment Workflows

### Render

```yaml
# render.yaml
services:
  - type: web
    name: primer
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run start
    envVars:
      - key: NODE_ENV
        value: production
      - key: NEXT_PUBLIC_SOCKET_SERVER_URL
        sync: false  # Set manually in Render dashboard
```

### Vercel

```json
// vercel.json
{
  "env": {
    "NEXT_PUBLIC_SOCKET_SERVER_URL": "https://your-app.vercel.app"
  }
}
```

### Docker

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Build with environment variable
ARG NEXT_PUBLIC_SOCKET_SERVER_URL
ENV NEXT_PUBLIC_SOCKET_SERVER_URL=$NEXT_PUBLIC_SOCKET_SERVER_URL

RUN npm run build

CMD ["npm", "run", "start"]
```

```bash
# Build with environment variable
docker build \
  --build-arg NEXT_PUBLIC_SOCKET_SERVER_URL=https://your-domain.com \
  -t primer .
```
