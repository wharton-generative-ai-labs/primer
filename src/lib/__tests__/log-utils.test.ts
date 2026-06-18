import { truncateForLogging, formatToolCallForLogging } from '../log-utils';

describe('log-utils', () => {
  describe('truncateForLogging', () => {
    it('should not truncate short strings', () => {
      const obj = { message: 'Hello world' };
      const result = truncateForLogging(obj, 200);
      expect(result.message).toBe('Hello world');
      expect(result.message_truncated).toBeUndefined();
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(300);
      const obj = { content: longString };
      const result = truncateForLogging(obj, 200);
      
      expect(result.content).toBe('a'.repeat(197) + '...');
      expect(result.content_truncated).toBe(true);
      expect(result.content_original_length).toBe(300);
    });

    it('should handle nested objects', () => {
      const obj = {
        title: 'Short title',
        data: {
          content: 'x'.repeat(300),
          nested: {
            description: 'y'.repeat(250)
          }
        }
      };
      
      const result = truncateForLogging(obj, 200);
      
      expect(result.title).toBe('Short title');
      expect(result.data.content).toBe('x'.repeat(197) + '...');
      expect(result.data.content_truncated).toBe(true);
      expect(result.data.nested.description).toBe('y'.repeat(197) + '...');
      expect(result.data.nested.description_truncated).toBe(true);
    });

    it('should handle arrays', () => {
      const obj = {
        items: [
          'short',
          'z'.repeat(300),
          { text: 'w'.repeat(250) }
        ]
      };
      
      const result = truncateForLogging(obj, 200);
      
      expect(result.items[0]).toBe('short');
      expect(result.items[1]).toBe('z'.repeat(197) + '...');
      expect(result.items[2].text).toBe('w'.repeat(197) + '...');
      expect(result.items[2].text_truncated).toBe(true);
    });

    it('should handle null and undefined', () => {
      expect(truncateForLogging(null)).toBeNull();
      expect(truncateForLogging(undefined)).toBeUndefined();
      
      const obj = { a: null, b: undefined };
      const result = truncateForLogging(obj);
      expect(result.a).toBeNull();
      expect(result.b).toBeUndefined();
    });

    it('should handle primitives', () => {
      expect(truncateForLogging(42)).toBe(42);
      expect(truncateForLogging(true)).toBe(true);
      expect(truncateForLogging('short')).toBe('short');
      expect(truncateForLogging('x'.repeat(300), 200)).toBe('x'.repeat(197) + '...');
    });
  });

  describe('formatToolCallForLogging', () => {
    it('should format tool call with short args', () => {
      const result = formatToolCallForLogging(
        'slide',
        { action: 'show', title: 'Test' },
        'call-123'
      );
      
      expect(result.callId).toBe('call-123');
      expect(result.toolName).toBe('slide');
      expect(result.args.action).toBe('show');
      expect(result.args.title).toBe('Test');
    });

    it('should format tool call with long content', () => {
      const longContent = '# Slide Content\n\n' + 'Lorem ipsum '.repeat(50);
      const result = formatToolCallForLogging(
        'slide',
        { 
          action: 'show', 
          title: 'Test Slide',
          content: longContent 
        },
        'call-456',
        200
      );
      
      expect(result.callId).toBe('call-456');
      expect(result.toolName).toBe('slide');
      expect(result.args.action).toBe('show');
      expect(result.args.title).toBe('Test Slide');
      expect(result.args.content.length).toBe(200); // 197 chars + '...'
      expect(result.args.content).toContain('...');
      expect(result.args.content_truncated).toBe(true);
      expect(result.args.content_original_length).toBe(longContent.length);
    });

    it('should format artifact display with long content', () => {
      const result = formatToolCallForLogging(
        'slide',
        { 
          action: 'showArtifact', 
          artifactId: 'artifact-789',
          title: 'My Artifact'
        },
        'call-789'
      );
      
      expect(result.callId).toBe('call-789');
      expect(result.toolName).toBe('slide');
      expect(result.args.action).toBe('showArtifact');
      expect(result.args.artifactId).toBe('artifact-789');
    });
  });
});
