# Logging to Disk Configuration

**Date**: 2026-01-13

## Overview

This guide explains how to configure Pino logger to write logs to both console (stdout) and disk files simultaneously.

## Current Setup

The project uses **Pino** for structured logging with the following configuration:

- **Development**: Pretty-printed logs to console (via `pino-pretty`)
- **Production**: JSON logs to console
- **Audit logs**: Already writes to disk in JSONL format at `storage/audit-logs/YYYY-MM-DD.jsonl`

## Solution: Add File Logging to Main Logger

Pino supports multiple destinations using `pino.multistream()`. Here's how to add file logging:

### Option 1: Simple File Logging (Recommended)

This approach uses Pino's built-in file rotation capabilities.

**Installation**:
```bash
npm install pino-roll
```

**Modify `src/lib/logger.ts`**:

```typescript
// At the top, add to the dynamic imports
let pinoRoll: any = null;
let pinoRollPromise: Promise<any> | null = null;

// In initNonEdgeModules(), add:
if (!pinoRoll && !pinoRollPromise) {
  pinoRollPromise = import('pino-roll').then(module => {
    pinoRoll = module.default;
    return pinoRoll;
  });
}

// Add to Promise.all:
await Promise.all([pinoPromise, envPromise, pinoRollPromise]);

// Then in the logger initialization (around line 112-143), replace with:
if (!isEdgeRuntime) {
  initNonEdgeModules().then(() => {
    if (pino) {
      const logDir = env?.STORAGE_ROOT_PATH 
        ? `${env.STORAGE_ROOT_PATH}/logs`
        : './storage/logs';

      // Create the logs directory if it doesn't exist
      import('fs/promises').then(fs => {
        fs.mkdir(logDir, { recursive: true }).catch(err => {
          console.error('Failed to create log directory:', err);
        });
      });

      const streams = [];

      // Console stream (with pretty printing in dev)
      if (usePrettyTransport) {
        streams.push({
          level: isProduction ? 'info' : 'debug',
          stream: pino.transport({
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          }),
        });
      } else {
        streams.push({
          level: isProduction ? 'info' : 'debug',
          stream: process.stdout,
        });
      }

      // File stream with daily rotation
      streams.push({
        level: 'debug', // Log everything to file
        stream: pinoRoll({
          file: `${logDir}/app.log`,
          frequency: 'daily', // Rotate daily
          size: '10m', // Rotate if file exceeds 10MB
          extension: '.log',
        }),
      });

      logger = pino(
        {
          level: isProduction ? 'info' : 'debug',
          formatters: {
            level: (label: string) => {
              return { level: label };
            },
          },
          base: {
            env: getNodeEnvSync(),
          },
        },
        pino.multistream(streams)
      );
    }
  }).catch(err => {
    console.error('Failed to initialize pino logger, using console fallback:', err);
  });
}
```

**Result**:
- Console: Pretty-printed logs (dev) or JSON (prod)
- File: `storage/logs/app.log` with daily rotation
- Old logs: `storage/logs/app.log.2026-01-12.log`, etc.

### Option 2: Advanced File Logging with pino-rotating-file-stream

For more advanced rotation options (hourly, by size, compression):

**Installation**:
```bash
npm install rotating-file-stream
```

**Configuration**:
```typescript
// In initNonEdgeModules()
if (!rfs && !rfsPromise) {
  rfsPromise = import('rotating-file-stream').then(module => {
    rfs = module.createStream;
    return module;
  });
}

// In logger initialization:
const rfs = (await import('rotating-file-stream')).createStream;

const streams = [
  // Console stream
  {
    level: isProduction ? 'info' : 'debug',
    stream: usePrettyTransport
      ? pino.transport({ target: 'pino-pretty', options: {...} })
      : process.stdout,
  },
  // File stream with advanced rotation
  {
    level: 'debug',
    stream: rfs('app.log', {
      interval: '1d', // Rotate daily
      maxFiles: 30, // Keep 30 days of logs
      path: `${logDir}`,
      compress: 'gzip', // Compress old logs
    }),
  },
];

logger = pino(
  {
    level: isProduction ? 'info' : 'debug',
    formatters: { level: (label) => ({ level: label }) },
    base: { env: getNodeEnvSync() },
  },
  pino.multistream(streams)
);
```

**Result**:
- Console: Pretty-printed (dev) or JSON (prod)
- File: `storage/logs/app.log` with daily rotation
- Old logs: Compressed as `app.log.20260112.gz`, etc.
- Auto-cleanup: Keeps only last 30 days

### Option 3: Simple Append to File (No Dependencies)

If you don't want additional dependencies:

**Configuration**:
```typescript
import fs from 'fs';
import path from 'path';

// In logger initialization:
const logDir = env?.STORAGE_ROOT_PATH 
  ? `${env.STORAGE_ROOT_PATH}/logs`
  : './storage/logs';

// Ensure directory exists
fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
const fileStream = fs.createWriteStream(logFile, { flags: 'a' });

const streams = [
  // Console
  {
    level: isProduction ? 'info' : 'debug',
    stream: usePrettyTransport
      ? pino.transport({ target: 'pino-pretty', options: {...} })
      : process.stdout,
  },
  // File (JSON format)
  {
    level: 'debug',
    stream: fileStream,
  },
];

logger = pino(
  {
    level: isProduction ? 'info' : 'debug',
    formatters: { level: (label) => ({ level: label }) },
    base: { env: getNodeEnvSync() },
  },
  pino.multistream(streams)
);
```

**Result**:
- Console: Pretty-printed (dev) or JSON (prod)
- File: `storage/logs/app-2026-01-13.log` (new file each day)
- Format: JSON lines (one log entry per line)
- Manual cleanup needed for old logs

## Environment Configuration

Add to your environment configuration:

**Option 1: Use existing STORAGE_ROOT_PATH**
```bash
# Already exists
STORAGE_ROOT_PATH=/path/to/storage
# Logs will be at: /path/to/storage/logs/
```

**Option 2: Add dedicated LOG_FILE_PATH**
```typescript
// In src/config/env.ts
export const env = {
  // ... existing vars ...
  LOG_FILE_PATH: process.env.LOG_FILE_PATH || path.join(STORAGE_ROOT_PATH, 'logs'),
  LOG_FILE_ENABLED: process.env.LOG_FILE_ENABLED === 'true', // Optional: toggle file logging
};

// In .env
LOG_FILE_ENABLED=true
LOG_FILE_PATH=/path/to/logs
```

## Log File Formats

### JSON Lines Format (Default)
```json
{"level":"info","time":1705161600000,"pid":12345,"hostname":"server","module":"experience-plugin","msg":"Validating component: game-of-life"}
{"level":"error","time":1705161601000,"pid":12345,"hostname":"server","module":"experience-plugin","errorCount":2,"errors":[...],"msg":"Component validation failed: game-of-life"}
```

### Benefits:
- Easy to parse programmatically
- Structured data preserved
- Can be ingested by log aggregators (ELK, Datadog, etc.)

### Pretty Format (for debugging)
If you want human-readable file logs, add to file stream options:
```typescript
stream: pino.transport({
  target: 'pino-pretty',
  options: {
    destination: logFilePath,
    colorize: false, // No ANSI colors in files
    translateTime: 'yyyy-mm-dd HH:MM:ss',
  },
})
```

## Log Rotation Best Practices

1. **Daily rotation**: Good for most applications
2. **Size-based**: Rotate when file reaches 10-50MB
3. **Retention**: Keep 7-30 days depending on disk space
4. **Compression**: Compress old logs to save space
5. **Cleanup**: Auto-delete logs older than retention period

## Monitoring Log Files

### View live logs:
```bash
tail -f storage/logs/app.log
```

### Search logs:
```bash
# Search for validation failures
grep "validation failed" storage/logs/app.log

# Search with jq (for JSON logs)
cat storage/logs/app.log | jq 'select(.module == "experience-plugin")'

# Count errors today
grep "\"level\":\"error\"" storage/logs/app-$(date +%Y-%m-%d).log | wc -l
```

### Analyze validation errors:
```bash
# Extract all validation errors
cat storage/logs/app.log \
  | jq 'select(.msg | contains("validation failed")) | {component: .componentId, errors: .errors}' \
  | jq -s '.'
```

## Production Considerations

1. **Disk space**: Monitor log directory size
2. **Performance**: File I/O is async in Pino (minimal impact)
3. **Permissions**: Ensure write access to log directory
4. **Log aggregation**: Consider shipping logs to centralized service
5. **Sensitive data**: Ensure no secrets/PII in logs

## Comparison with Audit Logger

The existing `audit-logger.ts` already writes to disk for security events. Here's the difference:

| Feature | Main Logger | Audit Logger |
|---------|------------|--------------|
| Purpose | Application logs (debug, info, errors) | Security/compliance events |
| Format | JSON/Pretty | JSONL |
| Location | `storage/logs/` | `storage/audit-logs/` |
| Retention | 7-30 days | Longer (90+ days for compliance) |
| When to use | All logging | Auth, admin actions, sensitive operations |

## Recommended Approach

For your use case (debugging interface designer validation):

**Use Option 1 (pino-roll)** because:
- ✅ Simple setup
- ✅ Automatic rotation
- ✅ Built for Pino
- ✅ No manual cleanup needed
- ✅ Good performance

Then you can:
```bash
# Watch validation logs live
tail -f storage/logs/app.log | grep "validation"

# Analyze today's validation failures
cat storage/logs/app.log | jq 'select(.msg | contains("validation failed"))'
```

## Implementation Steps

1. **Install dependency**:
   ```bash
   npm install pino-roll
   ```

2. **Update `src/lib/logger.ts`** with Option 1 code above

3. **Restart dev server**:
   ```bash
   npm run dev
   ```

4. **Verify logs are written**:
   ```bash
   ls -lh storage/logs/
   tail storage/logs/app.log
   ```

5. **Add to .gitignore** (if not already):
   ```
   storage/logs/
   ```

## Example: Debugging Validation Issues

After implementing file logging:

```bash
# Terminal 1: Watch validation logs
tail -f storage/logs/app.log | jq 'select(.module == "experience-plugin")'

# Terminal 2: Interact with interface designer
# (create components, watch validation errors appear in Terminal 1)

# Later: Analyze all validation failures from today
cat storage/logs/app-$(date +%Y-%m-%d).log \
  | jq 'select(.msg | contains("validation failed")) | {
      time: .time,
      component: .componentId,
      errorCount: .errorCount,
      errors: .errors | map(.message)
    }'
```

This will give you full visibility into the 6-7 validation attempts and what errors occurred each time!
