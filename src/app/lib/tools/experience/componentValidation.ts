/**
 * Component Validation Utilities
 * 
 * Enhanced validation for custom React components to catch common runtime errors
 * before deployment. These checks are designed to prevent the class of issues
 * that cause components to fail silently or with cryptic error messages.
 */

import * as ts from 'typescript';

export interface ValidationIssue {
  type: 'error' | 'warning';
  category: string;
  message: string;
  suggestion?: string;
  line?: number;
  /** Number of underlying occurrences aggregated into this issue (used by migration tooling). */
  count?: number;
}

/**
 * Strip single-line and multi-line comments from JSX/TSX code using TypeScript's
 * compiler scanner. This correctly handles comments inside template literals,
 * regex literals, and protocol-relative URLs — unlike naive regex approaches.
 * Falls back to the original code if the scanner throws on malformed input.
 */
function stripComments(code: string): string {
  try {
    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      /* skipTrivia */ false,
      ts.LanguageVariant.JSX,
      code,
    );
    const ranges: Array<[number, number]> = [];
    let kind: ts.SyntaxKind;
    while ((kind = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
      if (
        kind === ts.SyntaxKind.SingleLineCommentTrivia ||
        kind === ts.SyntaxKind.MultiLineCommentTrivia
      ) {
        ranges.push([scanner.getTokenStart(), scanner.getTokenEnd()]);
      }
    }
    // Splice from end so earlier indices stay valid.
    let out = code;
    for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) {
      out = out.slice(0, start) + out.slice(end);
    }
    return out;
  } catch {
    return code;
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: {
    componentId: string;
    size: number;
    lines: number;
    hasDefaultExport: boolean;
    hasPrimerProps: boolean;
    usesExternalLibraries: string[];
  };
}

/**
 * Comprehensive component validation
 */
export function validateComponentCode(code: string, componentId: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const usesExternalLibraries: string[] = [];

  // Component ID is used for debugging context (passed to formatValidationResult)

  // 1. Check for default export
  const hasDefaultExport = /export\s+default\s+/.test(code) || 
                           /export\s*{\s*\w+\s+as\s+default\s*}/.test(code);
  
  if (!hasDefaultExport) {
    errors.push({
      type: 'error',
      category: 'structure',
      message: 'Component must have a default export',
      suggestion: 'Add: export default function MyComponent({ ... }) { ... }'
    });
  }

  // 2. Security checks - forbidden patterns
  const forbiddenPatterns = [
    { pattern: /\beval\s*\(/g, message: 'eval() is not allowed', suggestion: 'Remove eval() calls' },
    { pattern: /\bnew\s+Function\s*\(/g, message: 'new Function() is not allowed', suggestion: 'Remove new Function() calls' },
    { pattern: /localStorage/g, message: 'localStorage is blocked', suggestion: 'Use component state instead' },
    { pattern: /sessionStorage/g, message: 'sessionStorage is blocked', suggestion: 'Use component state instead' },
    { pattern: /document\.cookie/g, message: 'Cookie access is not allowed', suggestion: 'Use component state instead' },
    { pattern: /XMLHttpRequest/g, message: 'XMLHttpRequest is blocked', suggestion: 'Components cannot make network requests' },
    { pattern: /\bfetch\s*\(/g, message: 'fetch() is blocked', suggestion: 'Components cannot make network requests' }
  ];
  
  for (const { pattern, message, suggestion } of forbiddenPatterns) {
    if (pattern.test(code)) {
      errors.push({
        type: 'error',
        category: 'security',
        message: `Security violation: ${message}`,
        suggestion
      });
    }
  }

  // 3. External library import detection
  const externalLibraries = [
    { name: 'three', windowName: 'THREE', pattern: /import\s+.*\s+from\s+['"]three['"]/gi },
    { name: 'mathjs', windowName: 'math', pattern: /import\s+.*\s+from\s+['"]mathjs['"]/gi },
    { name: 'lodash', windowName: '_', pattern: /import\s+.*\s+from\s+['"]lodash['"]/gi },
    { name: 'recharts', windowName: 'Recharts', pattern: /import\s+.*\s+from\s+['"]recharts['"]/gi }
  ];

  for (const { name, windowName, pattern } of externalLibraries) {
    if (pattern.test(code)) {
      errors.push({
        type: 'error',
        category: 'import',
        message: `Cannot import '${name}' - external libraries are pre-loaded and available on window`,
        suggestion: `Access via window: if (!window.${windowName}) return; const ${windowName} = window.${windowName};`
      });
    }
  }

  // 4. Check for external library usage and availability checks
  const libraryUsagePatterns = [
    { windowName: 'THREE', pattern: /\bTHREE\./g },
    { windowName: 'math', pattern: /\bmath\./g },
    { windowName: '_', pattern: /\b_\./g },
    { windowName: 'Recharts', pattern: /\bRecharts\./g }
  ];

  for (const { windowName, pattern } of libraryUsagePatterns) {
    if (pattern.test(code)) {
      usesExternalLibraries.push(windowName);
      
      // Check if there's a safety check for the library
      const hasWindowCheck = new RegExp(`window\\.${windowName}`, 'g').test(code) ||
                            new RegExp(`if\\s*\\(!${windowName}\\)`, 'g').test(code);
      
      if (!hasWindowCheck) {
        warnings.push({
          type: 'warning',
          category: 'library-check',
          message: `Using ${windowName} without checking availability (libraries load asynchronously)`,
          suggestion: `Add in useEffect: if (!window.${windowName}) return; const ${windowName} = window.${windowName};`
        });
      }
    }
  }

  // 4b. Check for Three.js addon usage (OrbitControls, GLTFLoader, etc.)
  const availableThreeAddons = ['OrbitControls', 'TrackballControls', 'GLTFLoader', 'OBJLoader'];
  const unavailableThreeAddons = [
    'FlyControls', 'FirstPersonControls', 'PointerLockControls',
    'FBXLoader', 'ColladaLoader', 'STLLoader', 'PLYLoader',
    'EffectComposer', 'RenderPass', 'ShaderPass', 'UnrealBloomPass'
  ];

  // Check for available addons (should still verify availability)
  for (const addon of availableThreeAddons) {
    const pattern = new RegExp(`THREE\\.${addon}\\b`, 'g');
    if (pattern.test(code)) {
      const hasCheck = new RegExp(`THREE\\.${addon}\\s*&&`, 'g').test(code) ||
                      new RegExp(`if\\s*\\(.*THREE\\.${addon}`, 'g').test(code);
      
      if (!hasCheck) {
        warnings.push({
          type: 'warning',
          category: 'library-check',
          message: `Using THREE.${addon} without checking availability (addons load asynchronously)`,
          suggestion: `Add in useEffect: if (!window.THREE || !THREE.${addon}) return;`
        });
      }
    }
  }

  // Check for unavailable addons (hard error)
  for (const addon of unavailableThreeAddons) {
    const pattern = new RegExp(`THREE\\.${addon}\\b`, 'g');
    if (pattern.test(code)) {
      errors.push({
        type: 'error',
        category: 'library-availability',
        message: `THREE.${addon} is not available in the runtime`,
        suggestion: `Only these Three.js addons are available: ${availableThreeAddons.join(', ')}`
      });
    }
  }

  // 5. State mutation detection (anti-pattern)
  const stateMutationPattern = /\bstate\.\w+\s*=/g;
  const matches = code.match(stateMutationPattern);
  
  if (matches) {
    // Filter out setState calls
    const actualMutations = matches.filter(m => !m.includes('setState'));
    if (actualMutations.length > 0) {
      errors.push({
        type: 'error',
        category: 'react-pattern',
        message: 'Direct state mutation detected',
        suggestion: 'Use setState instead: setState(prev => ({ ...prev, property: value }))'
      });
    }
  }

  // 6. Animation frame cleanup
  const hasRequestAnimationFrame = /requestAnimationFrame/g.test(code);
  const hasCancelAnimationFrame = /cancelAnimationFrame/g.test(code);
  
  if (hasRequestAnimationFrame && !hasCancelAnimationFrame) {
    warnings.push({
      type: 'warning',
      category: 'memory-leak',
      message: 'requestAnimationFrame used without cleanup',
      suggestion: 'Store animation ID in ref and cancel in useEffect cleanup: return () => cancelAnimationFrame(animationId.current);'
    });
  }

  // 7. Three.js resource disposal
  const usesThreeJS = /THREE\./g.test(code) || /window\.THREE/g.test(code);
  const hasDispose = /\.dispose\(\)/g.test(code);
  
  if (usesThreeJS && !hasDispose) {
    warnings.push({
      type: 'warning',
      category: 'memory-leak',
      message: 'Three.js resources should be disposed in cleanup',
      suggestion: 'In useEffect cleanup, call dispose() on geometries, materials, and renderer'
    });
  }

  // 8. Heavy operations in render path
  const expensiveOpsInEffect = /useEffect\([^}]+new\s+THREE\./g.test(code);
  const hasStateDependency = /useEffect\([^,]+,\s*\[[^\]]*state[^\]]*\]\)/g.test(code);
  
  if (expensiveOpsInEffect && hasStateDependency) {
    warnings.push({
      type: 'warning',
      category: 'performance',
      message: 'Expensive Three.js operations in useEffect with state dependency',
      suggestion: 'Use empty dependency array [] for Three.js setup to run only once'
    });
  }

  // 9. Check for React import (unnecessary)
  if (/import\s+React/g.test(code)) {
    warnings.push({
      type: 'warning',
      category: 'import',
      message: 'React is already available in scope - no need to import it',
      suggestion: 'Remove: import React from "react"'
    });
  }

  // 10. Check for shadcn/ui imports (unnecessary)
  const shadcnImportPattern = /import\s+.*\s+from\s+['"]@\/components\/ui\//g;
  if (shadcnImportPattern.test(code)) {
    warnings.push({
      type: 'warning',
      category: 'import',
      message: 'shadcn/ui components are already in scope',
      suggestion: 'Remove imports - Button, Card, etc. are already available'
    });
  }

  // 11. Check for proper props structure
  const hasPropsParameter = /function\s+\w+\s*\(\s*{\s*/.test(code) || 
                            /=\s*\(\s*{\s*/.test(code) ||
                            /function\s+\w+\s*\(\s*\w+/.test(code);
  
  if (!hasPropsParameter) {
    warnings.push({
      type: 'warning',
      category: 'structure',
      message: 'Component should accept props parameter',
      suggestion: 'Add: function MyComponent({ initialState, onEvent, ... }) { ... }'
    });
  }

  // 12. Check for Primer integration props
  const hasPrimerProps = code.includes('initialState') || 
                         code.includes('externalState') ||
                         code.includes('onEvent') || 
                         code.includes('onSubmit');
  
  if (!hasPrimerProps) {
    warnings.push({
      type: 'warning',
      category: 'integration',
      message: 'Component may not integrate with Primer properly',
      suggestion: 'Use Primer props: initialState, externalState, onEvent, onSubmit, onStateChange'
    });
  }

  // 13. Check for JSX return
  const hasReturn = /return\s*\(/g.test(code) || /return\s*</g.test(code);
  
  if (!hasReturn) {
    errors.push({
      type: 'error',
      category: 'structure',
      message: 'Component must return JSX',
      suggestion: 'Add a return statement with JSX: return <div>...</div>'
    });
  }

  // 14. Basic syntax checks - balanced braces
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    errors.push({
      type: 'error',
      category: 'syntax',
      message: `Unbalanced braces: ${openBraces} opening, ${closeBraces} closing`,
      suggestion: 'Check for missing or extra braces'
    });
  }

  // 15. Check for balanced parentheses
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  
  if (openParens !== closeParens) {
    errors.push({
      type: 'error',
      category: 'syntax',
      message: `Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`,
      suggestion: 'Check for missing or extra parentheses'
    });
  }

  // 16. Check for balanced brackets
  const openBrackets = (code.match(/\[/g) || []).length;
  const closeBrackets = (code.match(/]/g) || []).length;
  
  if (openBrackets !== closeBrackets) {
    errors.push({
      type: 'error',
      category: 'syntax',
      message: `Unbalanced brackets: ${openBrackets} opening, ${closeBrackets} closing`,
      suggestion: 'Check for missing or extra brackets'
    });
  }

  // 17. Check for common typos in React hooks (all lowercase)
  const commonHookTypos = [
    { wrong: 'usestate', correct: 'useState' },
    { wrong: 'useeffect', correct: 'useEffect' },
    { wrong: 'useref', correct: 'useRef' },
    { wrong: 'usememo', correct: 'useMemo' },
    { wrong: 'usecallback', correct: 'useCallback' }
  ];

  for (const { wrong, correct } of commonHookTypos) {
    // Only match if it's all lowercase (not the correct camelCase version)
    const pattern = new RegExp(`\\b${wrong}\\s*\\(`, 'g');
    if (pattern.test(code)) {
      errors.push({
        type: 'error',
        category: 'typo',
        message: `Possible typo: "${wrong}" should be "${correct}"`,
        suggestion: `Use: ${correct}`
      });
    }
  }

  // 18. Check for window resize handlers without cleanup
  const hasWindowResize = /window\.addEventListener\s*\(\s*['"]resize['"]/g.test(code);
  const hasRemoveEventListener = /window\.removeEventListener/g.test(code);
  
  if (hasWindowResize && !hasRemoveEventListener) {
    warnings.push({
      type: 'warning',
      category: 'memory-leak',
      message: 'Window resize listener added without cleanup',
      suggestion: 'Remove listener in useEffect cleanup: return () => window.removeEventListener("resize", handler);'
    });
  }

  // 19. Check for console.log statements (code smell)
  const hasConsoleLog = /console\.log/g.test(code);
  if (hasConsoleLog) {
    warnings.push({
      type: 'warning',
      category: 'code-quality',
      message: 'Component contains console.log statements',
      suggestion: 'Remove console.log before deployment'
    });
  }

  // 20. Check for proper state initialization with initialState
  const hasStateInit = /useState\s*\(/g.test(code);
  const spreadsInitialState = /\.\.\.initialState/g.test(code);
  
  if (hasStateInit && hasPrimerProps && !spreadsInitialState) {
    warnings.push({
      type: 'warning',
      category: 'integration',
      message: 'Component uses useState but may not spread initialState',
      suggestion: 'Initialize state with: useState({ ...defaultValues, ...initialState })'
    });
  }

  // Theming rules — strip comments first so JSDoc examples don't self-trigger.
  const codeWithoutComments = stripComments(code);

  // 21. Hardcoded Tailwind palette classes without a dark: counterpart for the same utility.
  // Matches utility-(palette-name)(-shade)? but NOT semantic tokens (bg-card, text-foreground, etc.)
  // or Penn brand / chart tokens. File-wide: if dark:(utility)- appears anywhere for the same
  // utility prefix, the whole file is considered covered for that prefix.
  {
    const utilityPrefixes = 'bg|text|border|ring|stroke|fill|from|to|via|divide|outline|placeholder|caret|accent|decoration|shadow';
    const paletteNames = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';
    const paletteClassRe = new RegExp(
      `\\b(${utilityPrefixes})-(${paletteNames})(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?\\b`,
      'g',
    );
    const darkCoverageRe = new RegExp(
      `\\bdark:(${utilityPrefixes})-`,
      'g',
    );

    // Collect covered utility prefixes (e.g. "bg", "text") from dark: variants.
    const coveredPrefixes = new Set<string>();
    let dm: RegExpExecArray | null;
    while ((dm = darkCoverageRe.exec(codeWithoutComments)) !== null) {
      coveredPrefixes.add(dm[1]);
    }

    const uncoveredMatches: string[] = [];
    let pm: RegExpExecArray | null;
    paletteClassRe.lastIndex = 0;
    while ((pm = paletteClassRe.exec(codeWithoutComments)) !== null) {
      const prefix = pm[1];
      if (!coveredPrefixes.has(prefix)) {
        uncoveredMatches.push(pm[0]);
      }
    }

    if (uncoveredMatches.length > 0) {
      const unique = [...new Set(uncoveredMatches)];
      warnings.push({
        type: 'warning',
        category: 'theming',
        message: `Found ${uncoveredMatches.length} hardcoded Tailwind palette class(es) without a dark: counterpart: ${unique.slice(0, 5).join(', ')}${unique.length > 5 ? '…' : ''}. These bake in a single light-mode color and break dark mode.`,
        suggestion: 'For content-heavy UI use shadcn semantic tokens (bg-card, text-foreground, bg-muted, etc.). For decorative elements add a dark: variant for each utility prefix used (e.g. bg-blue-100 dark:bg-blue-800).',
        count: uncoveredMatches.length,
      });
    }
  }

  // 22. Inline SVG attributes with hardcoded color values.
  {
    const svgColorRe = /\b(stroke|fill)=["'](#[0-9a-fA-F]{3,8}|[a-z]+)["']/g;
    const svgMatches: string[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = svgColorRe.exec(codeWithoutComments)) !== null) {
      // Allow currentColor, none, transparent, inherit
      const val = sm[2].toLowerCase();
      if (!['currentcolor', 'none', 'transparent', 'inherit'].includes(val)) {
        svgMatches.push(sm[0]);
      }
    }
    if (svgMatches.length > 0) {
      warnings.push({
        type: 'warning',
        category: 'theming',
        message: `Found ${svgMatches.length} inline SVG attribute(s) with hardcoded colors: ${svgMatches.slice(0, 3).join(', ')}${svgMatches.length > 3 ? '…' : ''}. These ignore dark mode.`,
        suggestion: 'Use stroke="currentColor" / fill="currentColor" so the SVG inherits the text color, or use a CSS variable like var(--chart-1).',
        count: svgMatches.length,
      });
    }
  }

  // 22b. Runtime-computed dark: classes via template-literal interpolation or string concat.
  // Tailwind's content scanner only sees literal class strings; runtime-built dark: classes
  // are silently invisible and never reach the CSS output.
  {
    const runtimeDarkRe = /dark:\$\{|dark:[a-z-]*\$\{/g;
    const rdMatches: string[] = [];
    let rdm: RegExpExecArray | null;
    while ((rdm = runtimeDarkRe.exec(codeWithoutComments)) !== null) {
      rdMatches.push(rdm[0].slice(0, 40));
    }
    if (rdMatches.length > 0) {
      errors.push({
        type: 'error',
        category: 'theming',
        message: `Found ${rdMatches.length} runtime-computed dark: class(es). Tailwind's scanner only sees literal class strings — these dark variants will never be included in the CSS output.`,
        suggestion: 'Store the full dark: variant as a literal string in your data object (e.g. { light: "bg-blue-100", dark: "bg-blue-800 dark:bg-blue-800" }) instead of building it at runtime.',
        count: rdMatches.length,
      });
    }
  }

  // Compute stats
  const stats = {
    componentId,
    size: code.length,
    lines: code.split('\n').length,
    hasDefaultExport,
    hasPrimerProps,
    usesExternalLibraries
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats
  };
}

/**
 * Format validation result for tool response
 */
export function formatValidationResult(result: ValidationResult, componentId: string): {
  valid: boolean;
  message?: string;
  errors?: string[];
  warnings?: string[];
  stats?: any;
} {
  if (!result.valid) {
    return {
      valid: false,
      errors: result.errors.map(e => 
        `[${e.category}] ${e.message}${e.suggestion ? ` - ${e.suggestion}` : ''}`
      ),
      warnings: result.warnings.map(w => 
        `[${w.category}] ${w.message}${w.suggestion ? ` - ${w.suggestion}` : ''}`
      )
    };
  }

  return {
    valid: true,
    message: `Component "${componentId}" passed validation${result.warnings.length > 0 ? ` with ${result.warnings.length} warning(s)` : ''}`,
    warnings: result.warnings.length > 0 ? result.warnings.map(w => 
      `[${w.category}] ${w.message}${w.suggestion ? ` - ${w.suggestion}` : ''}`
    ) : undefined,
    stats: result.stats
  };
}
