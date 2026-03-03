---
id: configuration
title: Configuration
sidebar_position: 4
---

# Configuration

Primer uses environment variables and configuration files to control behavior.

## Environment Variables

### Required

```bash
# OpenAI API access (required for voice and AI)
OPENAI_API_KEY=sk-...
```

### Optional AI Providers

```bash
# Anthropic Claude (for backend agents)
ANTHROPIC_API_KEY=sk-ant-...

# Google Cloud (for Imagen)
GOOGLE_CLOUD_PROJECT=your-project-id
```

### Server Configuration

```bash
# Socket.IO server URL for frontend
NEXT_PUBLIC_SOCKET_SERVER_URL=http://localhost:3000

# Custom storage directory (default: {cwd}/storage)
STORAGE_ROOT_PATH=/absolute/path/to/storage
```

### Authentication (Production)

```bash
# NextAuth.js secret
NEXTAUTH_SECRET=your-random-secret-here

# Allowed CORS origins (comma-separated)
ALLOWED_ORIGINS=https://yourdomain.com,https://staging.yourdomain.com
```

## Next.js Configuration

**`next.config.ts`** controls Next.js behavior:

```typescript
const config = {
  // Enable experimental features
  experimental: {
    serverActions: true,
  },
  
  // Webpack customizations
  webpack: (config) => {
    // Custom rules...
    return config;
  },
  
  // Headers (CSP, CORS)
  async headers() {
    return [
      // Header configurations...
    ];
  },
};
```

## Content Security Policy

CSP is configured in `src/lib/csp.ts`:

- Controls which external resources can load
- Prevents XSS attacks
- Configured per-environment

See [Security & CSP](/developer/architecture/security-csp) for details.

## TypeScript Configuration

**`tsconfig.json`**: Main TypeScript config
- Strict type checking enabled
- Path aliases configured
- Excludes `context/` folder

**`tsconfig.server.json`**: Server-specific config
- Used by `server.ts`
- Node.js-specific settings

## Experience Configuration

Each experience has its own `experience.json`:

```json
{
  "version": "1.0.0",
  "title": "My Experience",
  "aiConfigurations": {
    "default": {
      "provider": "openai",
      "model": "gpt-4o"
    }
  },
  "agents": { ... },
  "resources": { ... }
}
```

See [Experience Format](/developer/architecture/experience-format) for full schema.

## Runtime Environments

Primer code runs in different environments:

| Environment | Where | Capabilities |
|-------------|-------|--------------|
| **Node.js** | API routes, server.ts | Full Node.js APIs |
| **Edge** | middleware.ts | No Node.js APIs |
| **Browser** | Client components | DOM APIs only |

## Development vs Production

### Development

```bash
npm run dev
```

- Hot reload enabled
- Source maps included
- Detailed error messages
- No optimizations

### Production

```bash
npm run build
npm start
```

- Optimized bundles
- Minified code
- Production error handling
- CSP enforced

## Deployment Configuration

### Render.com

Set these environment variables:

```
OPENAI_API_KEY=...
NEXT_PUBLIC_SOCKET_SERVER_URL=https://your-app.onrender.com
ALLOWED_ORIGINS=https://your-app.onrender.com
```

### Custom Deployment

1. Build the app: `npm run build`
2. Set environment variables
3. Run: `npm start`
4. Ensure port 3000 is accessible

## Storage Configuration

### Default Storage

By default, storage is at `{projectRoot}/storage/`.

### Custom Storage Path

Set `STORAGE_ROOT_PATH` to use a different location:

```bash
STORAGE_ROOT_PATH=/var/primer/storage
```

Must be an absolute path with read/write permissions.

## Logging Configuration

Logging is handled by Pino:

- Development: Pretty-printed logs
- Production: JSON logs
- Audit logs: `storage/audit-logs/`

## Next Steps

- Learn about [Security & CSP](/developer/architecture/security-csp)
- Understand [AI Providers](/developer/architecture/ai-providers)
- Read [Deployment Guide](/developer/guides/deployment)
