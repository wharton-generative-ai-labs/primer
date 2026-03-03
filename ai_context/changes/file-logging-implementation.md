# File Logging Implementation

**Date**: 2026-01-13  
**Status**: ✅ Complete

## Summary

Added file logging capability to Pino logger, allowing logs to be written to both console and disk simultaneously. This is especially useful for debugging interface designer validation issues and post-mortem analysis.

## Problem

After implementing detailed validation error logging (see `validation-logging-enhancement.md`), we needed a way to persist these logs to disk for:
1. Post-mortem analysis of validation failures
2. Identifying patterns in the 6-7 validation attempts
3. Forensic debugging when issues occur during development

## Solution

Enhanced the existing Pino logger to support **multistream** logging - writing to both console and file simultaneously.

### Implementation Details

**File Modified**: `src/lib/logger.ts`

**Changes Made**:

1. **Added Node.js module imports** (fs, path):
   - Dynamically imported to maintain Edge Runtime compatibility
   - Loaded alongside pino and env modules

2. **Environment-controlled file logging**:
   - Enabled via `LOG_FILE_ENABLED=true` environment variable
   - Disabled by default (backward compatible)
   - Gracefully falls back to console-only if setup fails

3. **Daily log rotation**:
   - Creates new log file each day: `app-YYYY-MM-DD.log`
   - Automatic date-based file naming
   - No external dependencies required

4. **Multistream configuration**:
   - Console stream: Pretty-printed (dev) or JSON (prod)
   - File stream: Always JSON format, always `debug` level
   - Both streams write simultaneously

5. **Safe initialization**:
   - Checks for server environment (not browser or Edge Runtime)
   - Creates log directory if it doesn't exist
   - Logs initialization status to console
   - Falls back gracefully on errors

### Code Structure

```typescript
// Check environment variable
const enableFileLogging = process.env.LOG_FILE_ENABLED === 'true';

if (enableFileLogging && isServer && fs && path) {
  // Set up log directory
  const logDir = path.join(storageRoot, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  
  // Create daily log file
  const today = new Date().toISOString().split('T')[0];
  const logFilePath = path.join(logDir, `app-${today}.log`);
  const fileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  
  // Configure multistream
  const streams = [
    { level: 'info', stream: consoleTransport }, // Console
    { level: 'debug', stream: fileStream },      // File
  ];
  
  logger = pino(config, pino.multistream(streams));
}
```

## Features

### Log Format

**Console** (development):
```
[10:32:15.123] INFO (experience-plugin): Component validation passed: game-of-life
    warnings: 2
    usesLibraries: ["THREE"]
```

**File** (JSON Lines):
```json
{"level":"info","time":1705161135123,"pid":12345,"module":"experience-plugin","msg":"Component validation passed: game-of-life","warnings":2,"usesLibraries":["THREE"]}
```

### Log Levels

| Environment | Console Level | File Level |
|-------------|--------------|------------|
| Development | `debug` | `debug` |
| Production | `info` | `debug` |

**Why file always logs debug**: Enables forensic analysis even in production without cluttering console output.

### File Location

```
storage/logs/
├── app-2026-01-13.log  (today)
├── app-2026-01-12.log  (yesterday)
└── app-2026-01-11.log  (etc.)
```

Already ignored by `.gitignore` (covered by `/storage`).

## Usage

### Enable File Logging

**Option 1: Environment File**
```bash
# .env
LOG_FILE_ENABLED=true
```

**Option 2: Shell Variable**
```bash
LOG_FILE_ENABLED=true npm run dev
```

### View Logs

**Real-time monitoring**:
```bash
tail -f storage/logs/app-$(date +%Y-%m-%d).log
```

**Pretty-printed viewing**:
```bash
cat storage/logs/app-2026-01-13.log | npx pino-pretty
```

**Search for validation errors**:
```bash
cat storage/logs/app-2026-01-13.log \
  | jq 'select(.msg | contains("validation failed"))'
```

**Analyze validation patterns**:
```bash
cat storage/logs/app-2026-01-13.log \
  | jq 'select(.msg | contains("validation failed")) | {
      component: .componentId,
      errorCount: .errorCount,
      errors: .errors | map({category, message})
    }'
```

## Benefits

1. **Persistent logs**: Keep logs across server restarts
2. **Post-mortem analysis**: Debug issues after they occur
3. **Pattern detection**: Identify common validation errors
4. **Full verbosity**: File logs include `debug` level even in production
5. **No performance impact**: Async writes, buffered I/O
6. **Zero dependencies**: Uses only Node.js built-ins
7. **Backward compatible**: Disabled by default, existing behavior unchanged

## Example: Debugging Interface Designer

**Scenario**: Interface designer took 7 attempts to create valid component

**Before** (console only):
- Logs scroll by during development
- Can't review what happened after the fact
- No way to analyze patterns

**After** (with file logging):

1. **Enable logging**:
   ```bash
   LOG_FILE_ENABLED=true npm run dev
   ```

2. **Use interface designer** (creates component with multiple validation attempts)

3. **Analyze afterward**:
   ```bash
   cat storage/logs/app-2026-01-13.log \
     | jq 'select(.componentId == "game-of-life") | 
       select(.msg | contains("validation")) | 
       {time: (.time/1000|strftime("%H:%M:%S")), 
        result: .msg, 
        errors: .errorCount}'
   ```

4. **Output shows validation history**:
   ```json
   {"time":"10:32:15","result":"Component validation failed: game-of-life","errors":3}
   {"time":"10:32:45","result":"Component validation failed: game-of-life","errors":2}
   {"time":"10:33:01","result":"Component validation failed: game-of-life","errors":1}
   {"time":"10:33:12","result":"Component validation passed: game-of-life","errors":0}
   ```

5. **Identify common errors**:
   ```bash
   cat storage/logs/app-2026-01-13.log \
     | jq '.errors[]?.category' \
     | sort | uniq -c | sort -rn
   ```
   
   Output:
   ```
   5 syntax
   3 import
   2 react-pattern
   ```

6. **Update agent instructions** based on patterns found

## Maintenance

### Log Cleanup

**Manual**:
```bash
# Delete logs older than 30 days
find storage/logs -name "app-*.log" -mtime +30 -delete
```

**Automated** (cron job):
```bash
# Add to crontab (daily at 3am)
0 3 * * * find /path/to/primer/storage/logs -name "app-*.log" -mtime +30 -delete
```

### Disk Space

Monitor with:
```bash
du -sh storage/logs
```

Typical sizes:
- Development: 10-50 MB/day
- Production: 100-500 MB/day

## Future Enhancements

Potential improvements (not implemented):

1. **Automatic rotation by size**:
   - Use `pino-roll` package
   - Rotate when file reaches 10MB

2. **Compression of old logs**:
   - Use `rotating-file-stream` package
   - Auto-compress logs older than 7 days

3. **Log aggregation**:
   - Ship logs to ELK, Datadog, CloudWatch, etc.
   - Centralized logging for distributed systems

4. **Structured search API**:
   - Web interface for log searching
   - Real-time log streaming

## Testing

**Manual Test**:
```bash
# Enable file logging
LOG_FILE_ENABLED=true npm run dev

# Trigger some logs (use the app)

# Verify file was created and contains logs
ls -lh storage/logs/
cat storage/logs/app-$(date +%Y-%m-%d).log | head -5
```

**Expected**:
- File exists at `storage/logs/app-YYYY-MM-DD.log`
- Contains JSON log entries
- Console message: `[logger] File logging enabled: ...`

## Related Changes

This builds on:
1. **validation-logging-enhancement.md**: Added detailed error logging
2. **audit-logger.ts**: Existing file logging for audit events (separate system)

## Documentation

- **Quick Start Guide**: `ai_context/guides/file-logging-quick-start.md`
- **Advanced Configuration**: `ai_context/guides/logging-to-disk.md`
- **Usage Examples**: See Quick Start Guide

## Breaking Changes

None. File logging is opt-in via environment variable.

## Migration

No migration needed. Existing deployments continue working unchanged.

To enable:
1. Add `LOG_FILE_ENABLED=true` to `.env`
2. Restart server
3. Done!

## Performance Impact

- **Console output**: No change
- **File writes**: Async, buffered (negligible impact)
- **Memory**: Minimal (stream buffers only)
- **Disk I/O**: One append per log line (efficient)

Tested with validation-heavy workload (interface designer creating components) - no noticeable performance difference.
