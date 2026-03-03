# Jest Exit Issue - Fixed

**Date:** January 11, 2026
**Issue:** Jest warning "Jest did not exit one second after the test run has completed"
**Status:** ✅ Resolved

## Problem

After running tests, Jest would display a warning:
```
Jest did not exit one second after the test run has completed.
```

This indicated that async operations were keeping the Node.js process alive.

## Root Cause

Using `--detectOpenHandles`, we identified the issue in `src/app/lib/rate-limit.ts`:

```typescript
constructor() {
  // Clean up expired entries every 5 minutes
  this.cleanupInterval = setInterval(() => {
    this.cleanup();
  }, 5 * 60 * 1000);
}
```

The `setInterval` creates a timer that runs every 5 minutes to clean up expired rate limit entries. This timer keeps the Node.js event loop active, preventing Jest from exiting.

## Solution

Added `unref()` to the interval timer:

```typescript
constructor() {
  // Clean up expired entries every 5 minutes
  // Use unref() to allow Node.js to exit even if this timer is active
  this.cleanupInterval = setInterval(() => {
    this.cleanup();
  }, 5 * 60 * 1000);
  
  // Allow Node.js to exit even if this timer is active (important for tests)
  if (this.cleanupInterval.unref) {
    this.cleanupInterval.unref();
  }
}
```

### What `unref()` Does

From Node.js documentation:
> When a timer is "unref'd", it will not prevent the Node.js event loop from exiting if there are no other active references. This means the timer can still run if the process is alive for other reasons, but won't keep the process alive by itself.

### Benefits

1. **In Tests:** Jest can exit cleanly once all tests complete
2. **In Production:** The cleanup timer still runs normally
3. **No Behavior Change:** The timer works exactly the same, just doesn't block process exit

## Alternative Solutions Considered

### 1. Force Exit in Jest Config ❌
```javascript
// jest.config.mjs
forceExit: true
```
**Rejected:** This is a blunt solution that can hide real issues with async cleanup.

### 2. Manual Cleanup in afterAll ❌
```javascript
afterAll(() => {
  rateLimiter.destroy();
});
```
**Rejected:** Would need to be added to every test file that imports the rate limiter, and the singleton would be destroyed for subsequent tests.

### 3. Mock the Rate Limiter ❌
```javascript
jest.mock('@/app/lib/rate-limit');
```
**Rejected:** Would prevent testing actual rate limiting behavior.

## Verification

Before fix:
```
Test Suites: 18 passed, 18 total
Tests:       24 skipped, 542 passed, 566 total
Time:        1.726 s
Ran all test suites.
Jest did not exit one second after the test run has completed.
```

After fix:
```
Test Suites: 18 passed, 18 total
Tests:       24 skipped, 542 passed, 566 total
Time:        1.758 s
Ran all test suites.
```

✅ Clean exit, no warnings!

## Impact

- **Tests:** No impact, all tests still pass
- **Production:** No impact, timer still runs normally
- **Development:** Cleaner test output, faster test completion

## Recommendation

This pattern should be used for any long-running timers or intervals that are created at module initialization:

```typescript
const interval = setInterval(() => {
  // periodic task
}, intervalMs);

// Allow process to exit if this is the only thing keeping it alive
if (interval.unref) {
  interval.unref();
}
```

## Related Files

- `src/app/lib/rate-limit.ts` - Fixed file
- `jest.config.mjs` - No changes needed
- `jest.setup.ts` - No changes needed

## References

- [Node.js Timer.unref() documentation](https://nodejs.org/api/timers.html#timeoutunref)
- [Jest detectOpenHandles](https://jestjs.io/docs/cli#--detectopenhandles)
