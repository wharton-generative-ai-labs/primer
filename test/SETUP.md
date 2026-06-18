# Testing Setup - Quick Start Guide

## What Was Fixed

The Jest test framework was configured but had a critical TypeScript/ESM compatibility issue that prevented it from running. This has been resolved.

### Problem
- Project uses `"type": "module"` (ESM) in `package.json`
- Jest config used CommonJS syntax (`module.exports`)
- Error: `ReferenceError: module is not defined`

### Solution
✅ Converted `jest.config.js` → `jest.config.mjs` with proper ESM syntax
✅ Configured TypeScript transformation with JSX support
✅ Added React Testing Library
✅ Configured Next.js mocks
✅ Added path alias support (`@/` imports)

## Running Tests

```bash
# Run all tests
npm test

# Watch mode (re-runs on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

## Files Created/Modified

### Created
- `jest.config.mjs` - Main Jest configuration (replaces jest.config.js)
- `jest.setup.ts` - Test environment setup
- `__mocks__/styleMock.js` - CSS import mocks
- `__mocks__/fileMock.js` - Image/file import mocks
- `test/README.md` - Comprehensive testing guide
- `context/testing-configuration-2026-01-11.md` - Technical documentation

### Modified
- `package.json` - Added test:watch and test:coverage scripts

### Deleted
- `jest.config.js` - Replaced with jest.config.mjs

## Quick Start: Writing Your First Test

### 1. Testing a Utility Function

Create `src/lib/utils/myUtil.test.ts`:

```typescript
import { myFunction } from './myUtil';

describe('myFunction', () => {
  it('should return expected result', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### 2. Testing a React Component

Create `src/components/MyComponent.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### 3. Testing an API Route

Create `src/app/api/myroute/route.test.ts`:

```typescript
import { GET } from './route';

describe('GET /api/myroute', () => {
  it('should return 200', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });
});
```

## Testing Priorities

Based on code reviews, prioritize testing:

1. **Security** - Auth, upload validation, SSRF protection
2. **Business Logic** - Backend agents, experience loading
3. **API Endpoints** - Request/response handling
4. **Utilities** - Helper functions, validators
5. **User Flows** - Critical paths

## Documentation

- **Detailed Guide**: `test/README.md`
- **Technical Details**: `context/testing-configuration-2026-01-11.md`
- **Code Reviews**: `context/code_reviews/`

## Verification

Jest is working correctly. You can verify by running:

```bash
npm test
# Should output: "No tests found, exiting with code 0"
```

Once you add test files, they will be automatically discovered and run.

## Support

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [ts-jest](https://kulshekhar.github.io/ts-jest/)

---

**Status**: ✅ Ready for test implementation

The testing framework is fully configured. You can now write tests following the examples above.
