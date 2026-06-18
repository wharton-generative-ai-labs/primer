/**
 * Jest Setup File
 * 
 * This file runs before each test suite and configures the testing environment.
 */

import '@testing-library/jest-dom';
import React from 'react';
import { TextEncoder, TextDecoder } from 'util';
import fetch, { Headers, Request, Response } from 'node-fetch';

// Provide required server env vars so import-time validation does not terminate test workers.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret';
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET || 'test-nextauth-secret-at-least-32-characters-long';

// Polyfill for TextEncoder/TextDecoder (required for Node.js < 18)
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Polyfill for fetch API (required for Next.js server-side code)
if (!global.fetch) {
  global.fetch = fetch as any;
  global.Headers = Headers as any;
  global.Request = Request as any;
  global.Response = Response as any;
}

// JSDOM doesn't implement Pointer Events, but Radix UI uses them
// extensively (Select, Dropdown, Popover, etc.). Without these stubs,
// `user-event`'s click on a Radix trigger throws "this.hasPointerCapture
// is not a function". Mirrors the workaround documented at
// https://github.com/radix-ui/primitives/issues/1822.
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// Mock Next.js Image component. Next-only props (`fill`, `priority`,
// `sizes`, `placeholder`, `blurDataURL`, `loader`, `quality`,
// `unoptimized`) are stripped so React DOM doesn't log unknown-attribute
// warnings during tests. Renders a plain <img> with the remaining props.
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const {
      fill: _fill,
      priority: _priority,
      sizes: _sizes,
      placeholder: _placeholder,
      blurDataURL: _blurDataURL,
      loader: _loader,
      quality: _quality,
      unoptimized: _unoptimized,
      ...rest
    } = props;
    return React.createElement('img', rest);
  },
}));

// Silence logger output during tests. Individual tests can still assert on specific
// calls via the spies (e.g. expect(console.error).toHaveBeenCalledWith(...)).
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});
