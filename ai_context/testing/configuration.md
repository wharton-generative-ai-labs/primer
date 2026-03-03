# Testing Configuration

**Last Updated:** January 11, 2026

## Summary

Jest has been properly configured for TypeScript and React testing. The initial configuration issue (ESM/CommonJS compatibility) has been resolved, and the test infrastructure is fully operational.

## Problem & Solution

### Root Cause Identified
The project uses `"type": "module"` in `package.json` (ESM), but `jest.config.js` used CommonJS syntax (`module.exports`), causing a "module is not defined" error.

### Solution Implemented
Changed `jest.config.js` → `jest.config.mjs` with proper ESM syntax.

## Jest Configuration

### Configuration File: `jest.config.mjs`

**Key Configuration Points:**
- Uses standard `ts-jest` preset (not ESM preset)
- Configured for `jsdom` environment (React testing)
- Path aliases configured (`@/` → `src/`)
- Static asset mocking (CSS, images)
- TypeScript transformation with JSX support

```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
};
```

### Why Not ESM Preset?

Initially attempted to use `ts-jest/presets/default-esm` to match the project's ESM setup, but this caused JSX transformation issues. The standard `ts-jest` preset works correctly with TypeScript JSX/TSX files while maintaining compatibility with the ESM project structure.

## Test Infrastructure Files

### Core Files Created

1. **`jest.config.mjs`** - Main Jest configuration
2. **`jest.setup.ts`** - Test environment setup with Next.js mocks
3. **`__mocks__/styleMock.js`** - CSS import mocks
4. **`__mocks__/fileMock.js`** - Image/file import mocks
5. **`test/README.md`** - Comprehensive testing documentation

### Test Environment Setup: `jest.setup.ts`

The setup file provides:

**Polyfills:**
- TextEncoder/TextDecoder
- Fetch API (Request, Response, Headers) via node-fetch

**Next.js Mocks:**
- `next/navigation` - All router hooks
- `next/image` - Image component (renders as `<img>`)

These can be overridden in individual tests if needed.

## Dependencies Added

### Testing Libraries
```json
{
  "@testing-library/react": "latest",
  "@testing-library/jest-dom": "latest",
  "@testing-library/user-event": "latest",
  "@testing-library/dom": "latest",
  "jest-environment-jsdom": "latest",
  "identity-obj-proxy": "latest",
  "node-fetch": "^2.0.0",
  "whatwg-fetch": "latest"
}
```

### Why node-fetch v2?
Node-fetch v2 is used for compatibility with CommonJS test environment. Version 3+ is ESM-only and causes issues with Jest's module resolution.

## Package Scripts

```json
{
  "test": "jest --passWithNoTests",
  "test:watch": "jest --watch --passWithNoTests",
  "test:coverage": "jest --coverage --passWithNoTests"
}
```

The `--passWithNoTests` flag ensures the test command succeeds even when no test files match the pattern, which is useful during development.

## Features Supported

✅ **TypeScript** - Full TypeScript support with ts-jest
✅ **React/JSX** - React component testing with Testing Library
✅ **Next.js** - Mocked Next.js router and Image components
✅ **Path Aliases** - `@/` imports work correctly
✅ **Static Assets** - CSS and images are properly mocked
✅ **Coverage Reports** - Jest coverage configured
✅ **Watch Mode** - Tests can run in watch mode

## Path Alias Configuration

The `moduleNameMapper` in Jest config matches the `paths` configuration in `tsconfig.json`:

```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

This ensures imports like `import { foo } from '@/lib/utils'` work in tests.

## Next.js Mocking

The `jest.setup.ts` file automatically mocks:

### Router Hooks (`next/navigation`)
```typescript
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/test-path',
}));
```

### Image Component (`next/image`)
```typescript
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} />;
  },
}));
```

## Verification

All configuration tests pass:

```bash
$ npm test

PASS test/react.config.test.tsx
  React Testing Configuration
    ✓ should render React components
    ✓ should support TypeScript with React

PASS test/jest.config.test.ts
  Jest Configuration
    ✓ should support TypeScript
    ✓ should support ESM imports
    ✓ should support path aliases

Test Suites: 2 passed, 2 total
Tests:       5 passed, 5 total
```

## Testing Best Practices

### Test Structure
Follow the Arrange-Act-Assert pattern:

```typescript
describe('Component', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = doSomething(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Descriptive Test Names
Use descriptive test names that explain the expected behavior:

```typescript
// Good
it('should return empty array when no items match filter', () => {});

// Bad
it('test filter', () => {});
```

### Test Independence
Tests should not depend on each other:

```typescript
// Good - each test is independent
describe('Counter', () => {
  it('should start at 0', () => {
    const counter = new Counter();
    expect(counter.value).toBe(0);
  });
  
  it('should increment by 1', () => {
    const counter = new Counter();
    counter.increment();
    expect(counter.value).toBe(1);
  });
});

// Bad - tests depend on execution order
describe('Counter', () => {
  const counter = new Counter(); // Shared state
  
  it('should start at 0', () => {
    expect(counter.value).toBe(0);
  });
  
  it('should increment by 1', () => {
    counter.increment();
    expect(counter.value).toBe(1); // Depends on previous test
  });
});
```

## Troubleshooting

### Issue: "Cannot find module '@/...'"
**Solution:** Check that `moduleNameMapper` in `jest.config.mjs` matches `paths` in `tsconfig.json`.

### Issue: "ReferenceError: Request is not defined"
**Solution:** Ensure `jest.setup.ts` is loaded and includes fetch polyfills.

### Issue: "SyntaxError: Unexpected token 'export'"
**Solution:** Check that `transform` configuration includes the file extension.

### Issue: "Cannot use import statement outside a module"
**Solution:** Use `jest.config.mjs` (not `.js`) and ensure `package.json` has `"type": "module"`.

## Performance Considerations

Current test execution is very fast (~1.67 seconds for 540 tests). To maintain this:

1. **Avoid unnecessary setup** - Only set up what each test needs
2. **Mock expensive operations** - File I/O, network requests, etc.
3. **Use `beforeEach` wisely** - Only for truly shared setup
4. **Parallel execution** - Jest runs tests in parallel by default

## References

- Code Review: `context/code_reviews/open_source_readiness_review.md`
- Code Review: `context/code_reviews/code-review-dec-2025.md`
- Code Review: `context/code_reviews/open-source-release-review-2025-12.md`
- Test Documentation: `/test/README.md`
- Jest Config: `/jest.config.mjs`
- Jest Documentation: https://jestjs.io/
- Testing Library: https://testing-library.com/

## Status

🟢 **COMPLETE** - Jest is properly configured and ready for test implementation.

The testing framework is now fully functional. Developers can write tests following the patterns in `/test/README.md` and the examples in existing test files.
