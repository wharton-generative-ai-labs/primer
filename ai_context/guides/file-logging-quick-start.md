# File Logging - Quick Start

**Date**: 2026-01-13  
**Status**: ✅ Ready to use

## What Changed

Added file logging capability to the main Pino logger. Logs can now be written to both console and disk simultaneously.

## How to Enable

### Option 1: Environment Variable (Recommended)

Add to your `.env` file:

```bash
LOG_FILE_ENABLED=true
```

Then restart the dev server:

```bash
npm run dev
```

### Option 2: Set in Shell

```bash
LOG_FILE_ENABLED=true npm run dev
```

## Where Are Logs Stored?

Logs are written to:
```
storage/logs/app-YYYY-MM-DD.log
```

For example:
- `storage/logs/app-2026-01-13.log` (today's logs)
- `storage/logs/app-2026-01-12.log` (yesterday's logs)
- etc.

A new file is created automatically each day.

## Log Format

Logs are written in **JSON Lines** format (one JSON object per line):

```json
{"level":"info","time":1705161600000,"pid":12345,"hostname":"server","module":"socket-server","msg":"Server ready","port":3000}
{"level":"error","time":1705161601000,"pid":12345,"hostname":"server","module":"experience-plugin","errorCount":2,"errors":[...],"msg":"Component validation failed: game-of-life"}
```

## Viewing Logs

### Watch logs in real-time:
```bash
tail -f storage/logs/app-$(date +%Y-%m-%d).log
```

### View with pretty formatting:
```bash
cat storage/logs/app-2026-01-13.log | npx pino-pretty
```

### Search for specific logs:
```bash
# Find validation failures
grep "validation failed" storage/logs/app-*.log

# Find errors
grep '"level":"error"' storage/logs/app-*.log
```

### Using jq for JSON parsing:
```bash
# Find all validation failures with details
cat storage/logs/app-2026-01-13.log \
  | jq 'select(.msg | contains("validation failed"))'

# Count errors by module
cat storage/logs/app-2026-01-13.log \
  | jq 'select(.level == "error")' \
  | jq -s 'group_by(.module) | map({module: .[0].module, count: length})'

# Extract validation errors with suggestions
cat storage/logs/app-2026-01-13.log \
  | jq 'select(.msg | contains("validation failed")) | {
      time: .time,
      component: .componentId,
      errors: .errors | map(.message)
    }'
```

## Use Case: Debugging Interface Designer

With file logging enabled, you can now see exactly what happened during component validation:

```bash
# Terminal 1: Watch validation logs
tail -f storage/logs/app-$(date +%Y-%m-%d).log \
  | jq 'select(.module == "experience-plugin")'

# Terminal 2: Use the interface designer
# (create components, watch validation attempts appear in Terminal 1)
```

After the session, analyze what went wrong:

```bash
# Show all validation attempts with full error details
cat storage/logs/app-2026-01-13.log \
  | jq 'select(.msg | contains("validation")) | {
      time: (.time / 1000 | strftime("%H:%M:%S")),
      result: (if .msg | contains("passed") then "✓ PASS" else "✗ FAIL" end),
      component: .componentId,
      errorCount: .errorCount,
      errors: .errors
    }'
```

## Console vs File Differences

| Feature | Console | File |
|---------|---------|------|
| Format | Pretty-printed (dev) / JSON (prod) | Always JSON |
| Level | `info` in prod, `debug` in dev | Always `debug` (everything) |
| Colors | Yes (in dev) | No |
| Persistence | No | Yes |
| Searchable | No | Yes |

**Why this matters**: Even if you set console to `info` level in production, the file will still have all `debug` logs for forensic analysis.

## Log Rotation

Currently, logs rotate **daily** (one file per day).

To clean up old logs:

```bash
# Delete logs older than 30 days
find storage/logs -name "app-*.log" -mtime +30 -delete

# Compress old logs
gzip storage/logs/app-2026-01-*.log

# Keep only last 7 days
ls -t storage/logs/app-*.log | tail -n +8 | xargs rm
```

You can add this to a cron job:
```bash
# Add to crontab (runs daily at 3am)
0 3 * * * find /path/to/primer/storage/logs -name "app-*.log" -mtime +30 -delete
```

## Disk Space Considerations

Typical log file sizes:
- **Low activity**: ~1-5 MB per day
- **Normal activity**: ~10-50 MB per day
- **High activity**: ~100-500 MB per day

Monitor disk usage:
```bash
du -sh storage/logs
```

## Troubleshooting

### Logs not being written?

1. Check if file logging is enabled:
   ```bash
   echo $LOG_FILE_ENABLED
   ```

2. Check server output for initialization message:
   ```
   [logger] File logging enabled: /path/to/storage/logs/app-2026-01-13.log
   ```

3. Check directory exists and is writable:
   ```bash
   ls -la storage/logs/
   ```

4. Check for error messages in console:
   ```
   [logger] Failed to set up file logging, falling back to console only
   ```

### File is empty or missing entries?

- File streams are buffered. Wait a moment or restart the server to flush.
- Check that the date is correct (timezone issues).

### Permission denied?

```bash
chmod -R 755 storage/logs
```

## Disabling File Logging

Remove from `.env`:
```bash
# LOG_FILE_ENABLED=true  # commented out
```

Or set to false:
```bash
LOG_FILE_ENABLED=false
```

Then restart the server.

## Integration with Audit Logger

This is separate from the existing audit logger:

| Logger | Purpose | Location |
|--------|---------|----------|
| **Main Logger** (this) | All application logs | `storage/logs/app-*.log` |
| **Audit Logger** | Security/compliance events | `storage/audit-logs/YYYY-MM-DD.jsonl` |

Both can run simultaneously and have different use cases.

## Next Steps

For more advanced configuration (rotation strategies, compression, etc.), see:
- `ai_context/guides/logging-to-disk.md` - Full configuration guide

## Viewing Structured Error Data

After the fix on 2026-01-13, validation errors now include complete structured data:

```bash
# View a specific validation failure with all details
cat storage/logs/app-2026-01-13.log \
  | jq 'select(.msg | contains("validation failed")) | select(.componentId == "linear-functions")'
```

Output shows:
```json
{
  "level": "error",
  "time": 1768320904118,
  "env": "development",
  "module": "experience-plugin",
  "errorCount": 2,
  "warningCount": 1,
  "errors": [
    {
      "category": "syntax",
      "message": "Unbalanced braces: 45 opening, 44 closing",
      "suggestion": "Check for missing or extra braces"
    },
    {
      "category": "import",
      "message": "Cannot import 'three'...",
      "suggestion": "Access via window: if (!window.THREE) return;"
    }
  ],
  "warnings": [...],
  "msg": "Component validation failed: linear-functions"
}
```

## Example Analysis Script

Save this as `scripts/analyze-validation-logs.sh`:

```bash
#!/bin/bash

# Analyze validation logs from today

LOG_FILE="storage/logs/app-$(date +%Y-%m-%d).log"

if [ ! -f "$LOG_FILE" ]; then
  echo "No log file found: $LOG_FILE"
  exit 1
fi

echo "=== Validation Summary ==="
echo "Total validations: $(grep -c '"Validating component"' "$LOG_FILE")"
echo "Passed: $(grep -c '"validation passed"' "$LOG_FILE")"
echo "Failed: $(grep -c '"validation failed"' "$LOG_FILE")"
echo ""

echo "=== Failed Validations ==="
cat "$LOG_FILE" \
  | jq -r 'select(.msg | contains("validation failed")) | 
    "[\(.time / 1000 | strftime("%H:%M:%S"))] \(.componentId): \(.errorCount) errors"'
echo ""

echo "=== Most Common Errors ==="
cat "$LOG_FILE" \
  | jq -r 'select(.msg | contains("validation failed")) | .errors[] | .category' \
  | sort | uniq -c | sort -rn
```

Run it:
```bash
chmod +x scripts/analyze-validation-logs.sh
./scripts/analyze-validation-logs.sh
```

Output:
```
=== Validation Summary ===
Total validations: 12
Passed: 5
Failed: 7

=== Failed Validations ===
[10:32:15] game-of-life: 3 errors
[10:32:45] game-of-life: 2 errors
[10:33:01] game-of-life: 1 errors
...

=== Most Common Errors ===
      5 syntax
      3 import
      2 react-pattern
      1 memory-leak
```

This helps identify patterns in validation failures!
