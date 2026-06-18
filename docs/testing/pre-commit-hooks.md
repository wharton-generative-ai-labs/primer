# Pre-Commit Hooks

## Overview

Primer uses [Husky](https://typicode.github.io/husky/) to enforce code quality checks before commits. This ensures that only tested, linted, and buildable code is committed to the repository.

## Pre-Commit Hook

The pre-commit hook (`.husky/pre-commit`) runs automatically before every commit and performs the following checks in order:

### 1. Run Tests
```bash
npm test -- --passWithNoTests
```
- Runs all Jest tests
- Exits with error if any tests fail
- Uses `--passWithNoTests` to allow commits when no tests exist yet

### 2. Build Project
```bash
npm run build
```
- Builds the Next.js application
- Ensures the code compiles successfully
- Catches TypeScript errors and build issues

### 3. Version Bump
```bash
npm run bump-version
```
- Automatically increments the patch version
- Adds the updated `package.json` to the commit

## What Gets Blocked

The pre-commit hook will **prevent commits** if:
- ❌ Any test fails
- ❌ The build fails (TypeScript errors, missing imports, etc.)
- ❌ ESLint errors exist (checked during build)

## Bypassing the Hook (Not Recommended)

In rare cases where you need to bypass the pre-commit hook:

```bash
git commit --no-verify -m "Your commit message"
```

⚠️ **Warning:** Only use `--no-verify` in emergencies. Bypassing hooks can introduce broken code into the repository.

## Testing the Hook

To test that the pre-commit hook is working:

1. Make a change to a file
2. Stage the change: `git add .`
3. Try to commit: `git commit -m "test"`
4. The hook should run tests and build before allowing the commit

## Performance

The pre-commit hook runs:
- **Tests:** ~1-2 seconds (222 tests)
- **Build:** ~10-30 seconds (depending on cache)
- **Total:** ~15-35 seconds per commit

### Optimizing Performance

If the pre-commit hook is too slow, consider:

1. **Run only affected tests** (requires setup):
   ```bash
   npm test -- --onlyChanged
   ```

2. **Skip build in pre-commit** (not recommended):
   - Edit `.husky/pre-commit` to remove the build step
   - Rely on CI/CD for build validation instead

3. **Use lint-staged** for faster linting:
   ```bash
   npm install --save-dev lint-staged
   ```
   Then configure to only lint staged files.

## CI/CD Integration

The same checks run in CI/CD pipelines:
- GitHub Actions (if configured)
- Pre-push hooks (if configured)
- Pull request checks

This ensures code quality even if someone bypasses local hooks.

## Troubleshooting

### Hook Not Running

If the pre-commit hook doesn't run:

1. Ensure Husky is installed:
   ```bash
   npm run prepare
   ```

2. Check hook permissions:
   ```bash
   chmod +x .husky/pre-commit
   ```

3. Verify Git hooks path:
   ```bash
   git config core.hooksPath
   # Should output: .husky
   ```

### Tests Failing

If tests fail during commit:

1. Run tests manually to see details:
   ```bash
   npm test
   ```

2. Fix the failing tests

3. Try committing again

### Build Failing

If the build fails:

1. Run build manually:
   ```bash
   npm run build
   ```

2. Check for TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```

3. Fix the errors and try again

## Best Practices

1. **Run tests before committing**: `npm test`
2. **Run linter before committing**: `npm run lint`
3. **Keep commits small**: Smaller commits = faster pre-commit checks
4. **Fix issues immediately**: Don't let failing tests accumulate

## Related Documentation

- [Testing Guide](../../test/README.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)
- [ESLint Configuration](../development/eslint.md)
