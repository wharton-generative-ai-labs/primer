---
id: deployment
title: Deployment
sidebar_position: 3
---

# Deployment Guide

Deploy Primer to production environments.

## Prerequisites

- Node.js 20+ on server
- HTTPS certificate (required for voice)
- Domain name
- API keys (OpenAI, etc.)

## Environment Variables

Set these in production:

```bash
# Required
OPENAI_API_KEY=sk-...
NEXTAUTH_SECRET=your-random-secret

# Server URLs
NEXT_PUBLIC_SOCKET_SERVER_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com

# Optional
ANTHROPIC_API_KEY=sk-ant-...
STORAGE_ROOT_PATH=/var/primer/storage
```

## Build Process

```bash
# Install dependencies
npm install

# Build application
npm run build

# Start production server
npm start
```

## Render.com Deployment

### 1. Create Web Service

- Connect your GitHub repository
- Select "Node" environment
- Set build command: `npm install && npm run build`
- Set start command: `npm start`

### 2. Configure Environment

Set environment variables in Render dashboard:

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SOCKET_SERVER_URL` (your Render URL)
- `ALLOWED_ORIGINS` (your Render URL)
- `NEXTAUTH_SECRET`

### 3. Deploy

Render will automatically deploy on push to main branch.

## Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t primer .
docker run -p 3000:3000 --env-file .env primer
```

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Security Checklist

Before going live:

- [ ] HTTPS enabled
- [ ] Strong NEXTAUTH_SECRET set
- [ ] CSP configured
- [ ] CORS restricted
- [ ] Rate limiting enabled
- [ ] Audit logging active
- [ ] File upload limits set
- [ ] Error messages sanitized
- [ ] Dependencies updated

## Monitoring

### Health Check

Create `/api/health/route.ts`:

```typescript
export async function GET() {
  return Response.json({ status: 'ok' });
}
```

### Logs

Monitor application logs:

```bash
# View logs
npm start 2>&1 | tee primer.log

# Watch for errors
tail -f primer.log | grep ERROR
```

### Metrics

Track:
- Response times
- Error rates
- Active sessions
- API usage
- Storage usage

## Backup

### Storage Directory

```bash
# Backup storage
tar -czf primer-storage-$(date +%Y%m%d).tar.gz storage/

# Restore
tar -xzf primer-storage-YYYYMMDD.tar.gz
```

### Database (if using)

Follow your database backup procedures.

## Troubleshooting

**Port already in use**: Change port or kill process

**WebSocket not connecting**: Check CORS and proxy configuration

**Voice not working**: Verify HTTPS is enabled

**High memory usage**: Check for memory leaks, restart periodically

## Scaling

For high traffic:

1. **Horizontal scaling**: Multiple instances behind load balancer
2. **Shared storage**: Use network storage (NFS, S3)
3. **Redis**: For session management
4. **CDN**: For static assets

## Next Steps

- [Configuration](/developer/configuration) - Environment setup
- [Security & CSP](/developer/architecture/security-csp) - Security hardening
- [Contributing](/developer/contributing) - Report issues
