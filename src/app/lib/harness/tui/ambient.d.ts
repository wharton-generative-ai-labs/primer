// Ink ships ESM-only with conditional package.json exports that tsc's classic
// `moduleResolution: node` cannot follow. Declare the bits we use ambiently
// so the rest of the app's tsconfig stays untouched. Runtime resolution via
// tsx works regardless.

declare module 'ink' {
  import type { ReactNode, FC } from 'react';

  export const Box: FC<any>;
  export const Text: FC<any>;
  export function render(node: ReactNode): { waitUntilExit(): Promise<void> };
  export function useApp(): { exit(): void };
  export function useInput(
    fn: (
      input: string,
      key: {
        tab?: boolean;
        ctrl?: boolean;
        return?: boolean;
        escape?: boolean;
        upArrow?: boolean;
        downArrow?: boolean;
        leftArrow?: boolean;
        rightArrow?: boolean;
        pageUp?: boolean;
        pageDown?: boolean;
        meta?: boolean;
        shift?: boolean;
        backspace?: boolean;
        delete?: boolean;
      },
    ) => void,
    options?: { isActive?: boolean },
  ): void;
}

