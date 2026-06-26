# Testing Guide

This directory contains the test suite for Primer. The project uses Jest with TypeScript support for testing.

## Test Configuration

Jest is configured to work with:
- **TypeScript** - Full TypeScript support with ts-jest
- **React/JSX** - React component testing with @testing-library/react
- **Next.js** - Mocked Next.js router and Image components
- **Path Aliases** - Support for `@/` path imports
- **ESM** - Compatible with the project's ES Module setup

### Configuration Files

- `jest.config.mjs` - Main Jest configuration
- `jest.setup.ts` - Test environment setup (runs before each test suite)
- `__mocks__/` - Mock files for static assets (CSS, images)

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Pre-Commit Hook

Tests automatically run before every commit via a Husky pre-commit hook. This ensures that:
- ✅ All tests pass before code is committed
- ✅ The build succeeds
- ✅ No broken code enters the repository

See [Pre-Commit Hooks Documentation](../docs/testing/pre-commit-hooks.md) for more details.

## Writing Tests

### Basic Test Structure

```typescript
describe('Feature Name', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = someFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Testing React Components

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent message="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Testing with User Interactions

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/Button';

describe('Button', () => {
  it('should call onClick when clicked', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Testing Async Code

```typescript
describe('Async Function', () => {
  it('should resolve with data', async () => {
    const data = await fetchData();
    expect(data).toEqual({ id: 1, name: 'Test' });
  });
  
  it('should handle errors', async () => {
    await expect(fetchData('invalid')).rejects.toThrow('Error message');
  });
});
```

## Test Organization

Tests can be organized in two ways:

1. **Co-located tests** - Place test files next to the code they test:
   ```
   src/
     components/
       Button.tsx
       Button.test.tsx
   ```

2. **Centralized tests** - Place all tests in the `test/` directory:
   ```
   test/
     components/
       Button.test.tsx
   ```

Both approaches are supported by the Jest configuration.

## Mocking

### Mocking Modules

```typescript
jest.mock('@/utils/api', () => ({
  fetchData: jest.fn(() => Promise.resolve({ data: 'mocked' })),
}));
```

### Mocking Next.js Features

The setup file automatically mocks:
- `next/navigation` - Router hooks
- `next/image` - Image component

You can override these mocks in individual tests if needed.

## Coverage

To generate a coverage report:

```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory and include:
- HTML report: `coverage/lcov-report/index.html`
- Text summary in the terminal

## Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how it does it
2. **Keep tests simple** - One assertion per test when possible
3. **Use descriptive test names** - Test names should describe the expected behavior
4. **Arrange-Act-Assert** - Structure tests with clear setup, execution, and verification
5. **Avoid test interdependence** - Each test should be independent and runnable in isolation
6. **Mock external dependencies** - Don't make real API calls or database queries in tests
7. **Test edge cases** - Include tests for error conditions and boundary cases

## Testing Priorities

Based on code reviews, prioritize testing for:

1. **Security-critical code**
   - Authentication logic
   - File upload validation
   - SSRF protection
   - Input sanitization

2. **Business logic**
   - Backend agent managers
   - Experience loading and validation
   - State management

3. **API endpoints**
   - Request validation
   - Response formatting
   - Error handling

4. **Utility functions**
   - Data transformations
   - Validators
   - Helpers

5. **Critical user flows**
   - Experience initialization
   - Agent interactions
   - File operations

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Cannot find module"
- **Solution**: Check that path aliases are correctly configured in `jest.config.mjs`

**Issue**: React component tests fail with "React is not defined"
- **Solution**: Import React at the top of your test file: `import React from 'react';`

**Issue**: CSS/Image imports cause errors
- **Solution**: These should be automatically mocked. Check `moduleNameMapper` in `jest.config.mjs`

**Issue**: ESM import errors
- **Solution**: The project uses CommonJS for Jest. Ensure `jest.config.mjs` uses the standard `ts-jest` preset (not the ESM preset)

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library Documentation](https://testing-library.com/)
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest with TypeScript](https://kulshekhar.github.io/ts-jest/)

## Current Test Status

✅ Jest is properly configured for TypeScript
✅ React component testing is supported
✅ Path aliases work correctly
✅ Next.js features are mocked

⚠️ **Note**: As of the initial setup, the project has minimal test coverage. Tests should be added incrementally for critical functionality.
