# Pre-Commit Testing Hooks

**Last Updated:** January 11, 2026

## Summary

Husky pre-commit hook automatically runs tests before every commit, ensuring that failing tests cannot be committed to the repository.

## How It Works

### Commit Flow

1. Developer runs `git commit -m "message"`
2. Husky intercepts the commit
3. Pre-commit hook executes:
   - **Step 1:** Run all tests (`npm test`)
     - If tests fail → commit is blocked ❌
     - If tests pass → continue to next step ✅
   - **Step 2:** Build the project (`npm run build`)
     - If build fails → commit is blocked ❌
     - If build succeeds → continue to next step ✅
   - **Step 3:** Bump version and add to commit
4. Commit proceeds if all checks pass

### Pre-Commit Hook Configuration

**File:** `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run tests first
echo "Running tests..."
npm test -- --passWithNoTests || exit 1

# Run the build
echo "Building..."
npm run build || exit 1

# If build succeeds, bump version and add to staged changes
new_version=$(npm run bump-version --silent)
git add package.json
```

## What Gets Blocked

Commits will be **automatically blocked** if:
- ❌ Any test fails
- ❌ TypeScript compilation errors
- ❌ ESLint errors (checked during build)
- ❌ Build failures

## Performance

Current performance metrics:
- **Tests:** ~1.67 seconds (540 tests)
- **Build:** ~10-30 seconds (varies with cache)
- **Total:** ~15-35 seconds per commit

This is acceptable for ensuring code quality. The build step catches:
- TypeScript errors
- Missing imports
- Configuration issues
- ESLint violations

## Benefits

### 1. Prevents Broken Code
- No failing tests can be committed
- No code that doesn't compile can be committed
- Catches issues before they reach the repository

### 2. Enforces Quality Standards
- All code must pass tests
- All code must build successfully
- Maintains consistent quality across the codebase

### 3. Reduces CI/CD Failures
- Issues caught locally before pushing
- Faster feedback loop for developers
- Less time wasted on CI/CD failures

### 4. Team Collaboration
- Ensures all team members follow the same standards
- No "it works on my machine" issues
- Clean commit history

## Bypassing (Emergency Only)

In rare emergencies, the hook can be bypassed:

```bash
git commit --no-verify -m "Emergency fix"
```

⚠️ **Warning:** This should only be used in critical situations. Bypassing hooks can introduce broken code.

## Testing the Setup

### Test 1: Successful Commit
```bash
# Make a valid change
echo "// test comment" >> src/app/lib/uuid.ts

# Stage and commit
git add src/app/lib/uuid.ts
git commit -m "test: verify pre-commit hook"

# Expected: Tests run, build runs, commit succeeds
```

### Test 2: Failing Test
```bash
# Create a failing test
echo "test('fail', () => { expect(true).toBe(false); });" >> src/test-fail.test.ts

# Stage and commit
git add src/test-fail.test.ts
git commit -m "test: verify hook blocks failing tests"

# Expected: Tests run, test fails, commit is blocked
```

### Test 3: Build Error
```bash
# Create a TypeScript error
echo "const x: string = 123;" >> src/app/lib/test-error.ts

# Stage and commit
git add src/app/lib/test-error.ts
git commit -m "test: verify hook blocks build errors"

# Expected: Tests pass, build fails, commit is blocked
```

## Troubleshooting

### Hook Not Running

If the pre-commit hook doesn't execute:

1. **Reinstall Husky:**
   ```bash
   npm run prepare
   ```

2. **Check Git hooks path:**
   ```bash
   git config core.hooksPath
   # Should output: .husky
   ```

3. **Verify hook permissions:**
   ```bash
   chmod +x .husky/pre-commit
   ```

### Slow Performance

If pre-commit is too slow:

1. **Profile the steps:**
   ```bash
   time npm test
   time npm run build
   ```

2. **Consider optimizations:**
   - Use `--onlyChanged` for tests
   - Cache build artifacts
   - Move build to pre-push hook

3. **Adjust based on team needs:**
   - Balance speed vs. safety
   - Consider team size and workflow

### Tests Pass Locally But Fail in Hook

1. **Check for uncommitted changes:**
   ```bash
   git status
   ```

2. **Ensure all dependencies are installed:**
   ```bash
   npm install
   ```

3. **Clear Jest cache:**
   ```bash
   npm test -- --clearCache
   ```

## Future Enhancements

### Potential Optimizations

1. **Lint-Staged Integration**
   - Only run tests related to changed files
   - Faster feedback for large codebases
   - Install: `npm install --save-dev lint-staged`

   ```javascript
   // package.json
   {
     "lint-staged": {
       "*.ts": ["npm test -- --findRelatedTests", "npm run build"]
     }
   }
   ```

2. **Parallel Execution**
   - Run tests and linting in parallel
   - Reduce total pre-commit time
   - Requires configuration changes

3. **Incremental Testing**
   - Use Jest's `--onlyChanged` flag
   - Only test files affected by changes
   - Faster for large test suites

   ```bash
   npm test -- --onlyChanged
   ```

4. **Pre-Push Hook**
   - Move build step to pre-push
   - Faster commits, comprehensive checks before push
   - Balance between speed and safety

   ```bash
   # .husky/pre-push
   #!/usr/bin/env sh
   . "$(dirname -- "$0")/_/husky.sh"
   
   npm run build || exit 1
   ```

### Additional Hooks

Consider adding:

1. **Pre-push hook:** Run full test suite + build
2. **Commit-msg hook:** Enforce commit message format
3. **Post-commit hook:** Notify team of commits

Example commit-msg hook:
```bash
# .husky/commit-msg
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Enforce conventional commits format
npx --no -- commitlint --edit "$1"
```

## Impact Assessment

### Before Pre-Commit Hooks
- Developers could commit failing tests
- Broken code could reach the repository
- CI/CD would catch issues (slower feedback)
- Manual discipline required

### After Pre-Commit Hooks
- ✅ Failing tests automatically blocked
- ✅ Build errors caught before commit
- ✅ Faster feedback loop (local)
- ✅ Enforced code quality standards
- ✅ Cleaner commit history
- ✅ Reduced CI/CD failures

## Metrics

- **Tests:** 540 passing tests
- **Hook Execution Time:** ~15-35 seconds
- **Files Protected:** All source files
- **Team Impact:** All developers benefit from automatic quality checks

## Best Practices

### 1. Keep Hooks Fast
- Optimize test execution
- Cache build artifacts
- Consider moving expensive checks to pre-push

### 2. Make Hooks Reliable
- Ensure hooks work on all team members' machines
- Test hooks in different environments
- Document any special requirements

### 3. Communicate Changes
- Notify team when adding/modifying hooks
- Document hook behavior
- Provide troubleshooting guide

### 4. Balance Safety and Speed
- Don't make hooks so slow that developers bypass them
- Don't make hooks so lenient that they don't catch issues
- Adjust based on team feedback

## Related Documentation

- [Testing Overview](./overview.md)
- [Testing Configuration](./configuration.md)
- [Test Guide](/test/README.md)
- [Contributing Guidelines](/CONTRIBUTING.md)

## Status

✅ **COMPLETE** - Pre-commit testing is fully configured and operational.

Commits with failing tests are now automatically blocked, ensuring code quality and preventing broken code from entering the repository.
