# Diagnostic Endpoints

These endpoints help diagnose issues with internal backend-to-socket communication in deployed environments.

## Endpoints

### `/api/diagnostic/ping`

Simple health check endpoint that returns a JSON response.

**Usage:**
```bash
curl http://localhost:3000/api/diagnostic/ping
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T...",
  "message": "pong"
}
```

### `/api/diagnostic/internal-fetch`

Comprehensive test of the backend's ability to fetch to itself via the configured `NEXT_PUBLIC_SOCKET_SERVER_URL`.

This endpoint tests:
1. Basic connectivity (ping endpoint)
2. Delegation status endpoint (`/api/socket-delegation-status`)
3. Toast notification endpoint (`/api/toast`)

**Usage:**
```bash
# Local testing
curl http://localhost:3000/api/diagnostic/internal-fetch

# Production testing
curl https://your-app.onrender.com/api/diagnostic/internal-fetch
```

**Response:**
```json
{
  "timestamp": "2026-01-15T...",
  "environment": {
    "NODE_ENV": "production",
    "NEXT_PUBLIC_SOCKET_SERVER_URL": "https://your-app.onrender.com",
    "PORT": "3000"
  },
  "baseUrl": "https://your-app.onrender.com",
  "tests": [
    {
      "test": "ping",
      "url": "https://your-app.onrender.com/api/diagnostic/ping",
      "duration": 123,
      "status": 200,
      "statusText": "OK",
      "ok": true,
      "body": "{\"status\":\"ok\",...}"
    },
    {
      "test": "delegation-status",
      "url": "https://your-app.onrender.com/api/socket-delegation-status",
      "duration": 145,
      "status": 200,
      "statusText": "OK",
      "ok": true,
      "body": {"success": true}
    },
    {
      "test": "toast",
      "url": "https://your-app.onrender.com/api/toast",
      "duration": 132,
      "status": 200,
      "statusText": "OK",
      "ok": true,
      "body": {"success": true}
    }
  ],
  "summary": {
    "allTestsPassed": true,
    "totalTests": 3,
    "passedTests": 3,
    "failedTests": 0
  }
}
```

## Troubleshooting

### If tests fail with fetch errors

This indicates the backend cannot reach itself via the public URL. Common causes:

1. **Network routing**: The server cannot reach its own public URL
2. **Firewall rules**: Internal requests to the public URL are blocked
3. **DNS issues**: The public hostname doesn't resolve correctly from within the server
4. **SSL/TLS issues**: Certificate validation problems

**Solution**: Use an internal URL for backend-to-socket communication:
- Add a new environment variable `INTERNAL_SOCKET_SERVER_URL=http://localhost:3000`
- Update `DelegationStatusManager` and `toast.ts` to use this for internal communication
- Keep `NEXT_PUBLIC_SOCKET_SERVER_URL` for client-side socket connections

### If tests pass but delegation status still doesn't work

Check the logs for:
1. Session ID matching issues
2. Socket connection problems from the client
3. CORS configuration issues
4. WebSocket transport issues

## Deployment Checklist

When deploying to a new environment:

1. ✅ Set `NEXT_PUBLIC_SOCKET_SERVER_URL` to your public URL
2. ✅ Run `/api/diagnostic/internal-fetch` to verify internal communication
3. ✅ Check logs for any fetch errors during delegation
4. ✅ Verify socket connections are established from the client
5. ✅ Test delegation status updates in the UI
