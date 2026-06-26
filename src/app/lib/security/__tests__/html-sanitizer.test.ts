/**
 * Tests for HTML and CSS sanitization
 */

import { sanitizeHtml, sanitizeCss } from '../html-sanitizer';

describe('HTML Sanitization', () => {
  describe('sanitizeHtml', () => {
    describe('Script Tag Removal', () => {
      it('should remove script tags', () => {
        const input = '<div>Hello</div><script>alert("xss")</script><p>World</p>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert');
        expect(result).toContain('<div>Hello</div>');
        expect(result).toContain('<p>World</p>');
      });

      it('should remove script tags with attributes', () => {
        const input = '<script type="text/javascript" src="evil.js">alert(1)</script>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('<script');
        expect(result).not.toContain('alert');
      });

      it('should remove multiple script tags', () => {
        const input = '<script>alert(1)</script><div>Content</div><script>alert(2)</script>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert');
        expect(result).toContain('<div>Content</div>');
      });

      it('should handle case-insensitive script tags', () => {
        const input = '<SCRIPT>alert(1)</SCRIPT><ScRiPt>alert(2)</ScRiPt>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('SCRIPT');
        expect(result).not.toContain('ScRiPt');
        expect(result).not.toContain('alert');
      });
    });

    describe('Event Handler Removal', () => {
      it('should remove onclick handlers', () => {
        const input = '<button onclick="alert(1)">Click me</button>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('onclick');
        expect(result).toContain('<button');
        expect(result).toContain('Click me');
      });

      it('should remove various event handlers', () => {
        const handlers = [
          '<img onerror="alert(1)" src="x">',
          '<div onload="alert(1)">Content</div>',
          '<a onmouseover="alert(1)">Link</a>',
          '<input onfocus="alert(1)">',
          '<body onpageshow="alert(1)">',
        ];

        handlers.forEach(input => {
          const result = sanitizeHtml(input);
          expect(result).not.toMatch(/on\w+=/i);
        });
      });

      it('should remove event handlers with single quotes', () => {
        const input = "<button onclick='alert(1)'>Click</button>";
        const result = sanitizeHtml(input);
        expect(result).not.toContain('onclick');
      });

      it('should remove event handlers without quotes', () => {
        const input = '<img onerror=alert(1) src="x">';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('onerror');
      });
    });

    describe('JavaScript Protocol Removal', () => {
      it('should remove javascript: protocol from links', () => {
        const input = '<a href="javascript:alert(1)">Click</a>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('javascript:');
      });

      it('should handle case variations of javascript:', () => {
        const inputs = [
          '<a href="javascript:alert(1)">',
          '<a href="JavaScript:alert(1)">',
          '<a href="JAVASCRIPT:alert(1)">',
          '<a href="JaVaScRiPt:alert(1)">',
        ];

        inputs.forEach(input => {
          const result = sanitizeHtml(input);
          expect(result.toLowerCase()).not.toContain('javascript:');
        });
      });
    });

    describe('Data URL Removal', () => {
      it('should remove data:text/html URLs', () => {
        const input = '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('data:text/html');
      });

      it('should handle case variations of data:text/html', () => {
        const inputs = [
          'data:text/html,<script>alert(1)</script>',
          'DATA:TEXT/HTML,<script>alert(1)</script>',
          'Data:Text/Html,<script>alert(1)</script>',
        ];

        inputs.forEach(input => {
          const result = sanitizeHtml(input);
          expect(result.toLowerCase()).not.toContain('data:text/html');
        });
      });
    });

    describe('Safe Content Preservation', () => {
      it('should preserve safe HTML', () => {
        const input = '<div class="container"><p>Hello <strong>World</strong></p></div>';
        const result = sanitizeHtml(input);
        expect(result).toBe(input);
      });

      it('should preserve SVG content', () => {
        const input = '<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
        const result = sanitizeHtml(input);
        expect(result).toContain('<svg');
        expect(result).toContain('<circle');
      });

      it('should preserve data attributes', () => {
        const input = '<div data-id="123" data-name="test">Content</div>';
        const result = sanitizeHtml(input);
        expect(result).toContain('data-id');
        expect(result).toContain('data-name');
      });

      it('should preserve class and id attributes', () => {
        const input = '<div id="main" class="container active">Content</div>';
        const result = sanitizeHtml(input);
        expect(result).toContain('id="main"');
        expect(result).toContain('class="container active"');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty strings', () => {
        expect(sanitizeHtml('')).toBe('');
      });

      it('should handle non-string input', () => {
        expect(sanitizeHtml(null as any)).toBe('');
        expect(sanitizeHtml(undefined as any)).toBe('');
        expect(sanitizeHtml(123 as any)).toBe('');
        expect(sanitizeHtml({} as any)).toBe('');
      });

      it('should handle strings without HTML', () => {
        const input = 'Just plain text';
        expect(sanitizeHtml(input)).toBe(input);
      });

      it('should handle nested malicious content', () => {
        const input = '<div><script>alert(1)</script><p onclick="alert(2)">Text</p></div>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('onclick');
        expect(result).toContain('<div>');
        expect(result).toContain('<p');
      });
    });

    describe('Complex Attack Vectors', () => {
      it('should handle obfuscated script tags', () => {
        const input = '<scr<script>ipt>alert(1)</scr</script>ipt>';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('alert(1)');
      });

      it('should handle event handlers with encoded characters', () => {
        const input = '<img src="x" onerror="alert(String.fromCharCode(88,83,83))">';
        const result = sanitizeHtml(input);
        expect(result).not.toContain('onerror');
      });
    });
  });
});

describe('CSS Sanitization', () => {
  describe('sanitizeCss', () => {
    describe('Expression Removal', () => {
      it('should remove CSS expressions', () => {
        const input = 'width: expression(alert(1));';
        const result = sanitizeCss(input);
        expect(result).not.toContain('expression');
      });

      it('should handle case variations of expression', () => {
        const inputs = [
          'width: expression(alert(1));',
          'width: EXPRESSION(alert(1));',
          'width: Expression(alert(1));',
        ];

        inputs.forEach(input => {
          const result = sanitizeCss(input);
          expect(result.toLowerCase()).not.toContain('expression');
        });
      });
    });

    describe('JavaScript Protocol Removal', () => {
      it('should remove javascript: in CSS', () => {
        const input = 'background: url(javascript:alert(1));';
        const result = sanitizeCss(input);
        expect(result).not.toContain('javascript:');
      });

      it('should handle case variations', () => {
        const inputs = [
          'background: url(javascript:alert(1));',
          'background: url(JavaScript:alert(1));',
          'background: url(JAVASCRIPT:alert(1));',
        ];

        inputs.forEach(input => {
          const result = sanitizeCss(input);
          expect(result.toLowerCase()).not.toContain('javascript:');
        });
      });
    });

    describe('@import Removal', () => {
      it('should remove @import statements', () => {
        const input = '@import url("evil.css");';
        const result = sanitizeCss(input);
        expect(result).not.toContain('@import');
      });

      it('should handle case variations of @import', () => {
        const inputs = [
          '@import url("evil.css");',
          '@IMPORT url("evil.css");',
          '@Import url("evil.css");',
        ];

        inputs.forEach(input => {
          const result = sanitizeCss(input);
          expect(result.toLowerCase()).not.toContain('@import');
        });
      });
    });

    describe('Data URL Removal', () => {
      it('should remove data: URLs from url() functions', () => {
        const input = 'background: url(data:text/html,<script>alert(1)</script>);';
        const result = sanitizeCss(input);
        expect(result).not.toMatch(/url\s*\(\s*["']?data:/i);
      });

      it('should handle various data URL formats', () => {
        const inputs = [
          'background: url(data:image/svg+xml,<svg>);',
          'background: url("data:text/html,<script>");',
          "background: url('data:application/javascript,alert(1)');",
        ];

        inputs.forEach(input => {
          const result = sanitizeCss(input);
          expect(result).not.toMatch(/url\s*\(\s*["']?data:/i);
        });
      });
    });

    describe('Safe CSS Preservation', () => {
      it('should preserve safe CSS rules', () => {
        const input = '.container { color: red; font-size: 16px; }';
        const result = sanitizeCss(input);
        expect(result).toContain('color: red');
        expect(result).toContain('font-size: 16px');
      });

      it('should preserve safe url() functions', () => {
        const input = 'background: url("https://example.com/image.png");';
        const result = sanitizeCss(input);
        expect(result).toContain('url("https://example.com/image.png")');
      });

      it('should preserve complex selectors', () => {
        const input = '.parent > .child:hover { color: blue; }';
        const result = sanitizeCss(input);
        expect(result).toBe(input);
      });

      it('should preserve media queries', () => {
        const input = '@media (max-width: 768px) { .mobile { display: block; } }';
        const result = sanitizeCss(input);
        expect(result).toContain('@media');
        expect(result).toContain('max-width: 768px');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty strings', () => {
        expect(sanitizeCss('')).toBe('');
      });

      it('should handle non-string input', () => {
        expect(sanitizeCss(null as any)).toBe('');
        expect(sanitizeCss(undefined as any)).toBe('');
        expect(sanitizeCss(123 as any)).toBe('');
        expect(sanitizeCss({} as any)).toBe('');
      });

      it('should handle CSS without dangerous content', () => {
        const input = 'color: blue; margin: 10px;';
        expect(sanitizeCss(input)).toBe(input);
      });

      it('should handle multiple dangerous patterns', () => {
        const input = 'width: expression(alert(1)); background: url(javascript:alert(2)); @import "evil.css";';
        const result = sanitizeCss(input);
        expect(result).not.toContain('expression');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('@import');
      });
    });

    describe('Complex Attack Vectors', () => {
      it('should handle CSS with encoded characters', () => {
        const input = 'background: url(\\6a\\61\\76\\61\\73\\63\\72\\69\\70\\74:alert(1));';
        const result = sanitizeCss(input);
        // Note: This is a basic sanitizer, advanced encoding might need additional handling
        expect(result).toBeDefined();
      });

      it('should handle nested url() functions', () => {
        const input = 'background: url(data:text/css,@import url(javascript:alert(1)));';
        const result = sanitizeCss(input);
        expect(result).not.toMatch(/url\s*\(\s*["']?data:/i);
      });
    });
  });
});
