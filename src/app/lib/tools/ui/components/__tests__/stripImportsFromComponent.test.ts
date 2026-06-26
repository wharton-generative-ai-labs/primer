import { stripImportsFromComponent } from '../ComponentManager';

describe('stripImportsFromComponent', () => {
  describe('single-line imports', () => {
    it('strips a default React import', () => {
      const code = `import React from 'react';
export default function MyComponent() {
  return <div />;
}`;
      const { cleanedCode } = stripImportsFromComponent(code);
      expect(cleanedCode).not.toContain('import');
      expect(cleanedCode).toContain('function MyComponent');
    });

    it('strips a named import', () => {
      const code = `import { useState } from 'react';
export default function MyComponent() {
  const [s, setS] = useState(0);
  return <div />;
}`;
      const { cleanedCode } = stripImportsFromComponent(code);
      expect(cleanedCode).not.toContain('import');
      expect(cleanedCode).toContain('useState');
    });

    it('strips shadcn/ui imports', () => {
      const code = `import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
export default function MyComponent() {
  return <Button />;
}`;
      const { cleanedCode } = stripImportsFromComponent(code);
      expect(cleanedCode).not.toContain('import');
      expect(cleanedCode).toContain('Button');
    });
  });

  describe('multi-line imports — regression for "Identifier already declared" error', () => {
    it('strips a multi-line named import from react', () => {
      const code = `import {
  useState,
  useEffect
} from 'react';
export default function MyComponent() {
  const [s, setS] = useState(0);
  return <div />;
}`;
      const { cleanedCode } = stripImportsFromComponent(code);
      expect(cleanedCode).not.toContain('import');
      // useState appears in the body; useEffect only appeared in the import block
      expect(cleanedCode).toContain('useState(0)');
      expect(cleanedCode).toContain('function MyComponent');
    });

    it('strips multiple multi-line imports', () => {
      const code = `import React from 'react';
import {
  useState,
  useEffect,
  useRef
} from 'react';
import {
  Button
} from '@/components/ui/button';
export default function PressConferencePanel({ initialState }) {
  const [state, setState] = useState({ ...initialState });
  return <Button />;
}`;
      const { cleanedCode } = stripImportsFromComponent(code);
      expect(cleanedCode).not.toContain('import');
      expect(cleanedCode).toContain('useState');
      expect(cleanedCode).toContain('PressConferencePanel');
    });
  });

  describe('export stripping', () => {
    it('removes "export default" keyword, keeping the function', () => {
      const code = `export default function MyComponent() {
  return <div />;
}`;
      const { cleanedCode } = stripImportsFromComponent(code);
      expect(cleanedCode).not.toContain('export default');
      expect(cleanedCode).toContain('function MyComponent');
    });

    it('removes named export blocks', () => {
      const code = `function MyComponent() { return <div />; }
export { MyComponent };`;
      const { cleanedCode } = stripImportsFromComponent(code);
      expect(cleanedCode).not.toContain('export');
    });
  });

  describe('defaultExportName extraction', () => {
    it('extracts the component name from "export default function"', () => {
      const code = `export default function PressConferencePanel() { return <div />; }`;
      const { defaultExportName } = stripImportsFromComponent(code);
      expect(defaultExportName).toBe('PressConferencePanel');
    });

    it('extracts the component name from "export default Identifier"', () => {
      const code = `const MyComponent = () => <div />;
export default MyComponent;`;
      const { defaultExportName } = stripImportsFromComponent(code);
      expect(defaultExportName).toBe('MyComponent');
    });

    it('returns null for anonymous default export', () => {
      const code = `export default () => <div />;`;
      const { defaultExportName } = stripImportsFromComponent(code);
      expect(defaultExportName).toBeNull();
    });
  });
});
