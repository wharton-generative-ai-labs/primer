/**
 * Tests for ToolExecutionManager
 * 
 * Verifies tool execution logic including:
 * - Single tool call execution
 * - Multiple tool calls execution
 * - Binary content protection for artifacts
 * - Error handling
 * - Tool response formatting
 */

import { ToolExecutionManager } from '../ToolExecutionManager';
import { ToolRegistry } from '@/app/lib/ToolRegistry';
import type { ToolContext } from '@/app/lib/tools/types';
import type { ToolCall } from '../types';

// Mock the ToolRegistry
jest.mock('@/app/lib/ToolRegistry');

// Mock the logger
jest.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('ToolExecutionManager', () => {
  let mockRegistry: jest.Mocked<ToolRegistry>;
  let mockToolContext: ToolContext;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock registry
    mockRegistry = {
      execute: jest.fn(),
      getInstance: jest.fn(),
    } as any;

    (ToolRegistry.getInstance as jest.Mock).mockReturnValue(mockRegistry);

    // Create mock tool context
    mockToolContext = {
      experienceId: 'exp-123',
      sessionId: 'sess-456',
      userEmail: 'test@example.com',
      getArtifact: jest.fn(),
      saveArtifact: jest.fn(),
      listArtifacts: jest.fn(),
      deleteArtifact: jest.fn(),
    } as any;
  });

  describe('executeToolCall', () => {
    describe('Successful Execution', () => {
      it('should execute a tool call successfully', async () => {
        const toolCall: ToolCall = {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'test_tool',
            arguments: JSON.stringify({ param: 'value' }),
          },
        };

        const mockResult = {
          status: 'success',
          data: { result: 'test result' },
        };

        mockRegistry.execute.mockResolvedValue(mockResult);

        const response = await ToolExecutionManager.executeToolCall(
          toolCall,
          mockToolContext
        );

        expect(response).toEqual({
          role: 'tool',
          tool_call_id: 'call_123',
          content: JSON.stringify(mockResult),
        });

        expect(mockRegistry.execute).toHaveBeenCalledWith(
          'test_tool',
          { param: 'value' },
          mockToolContext
        );
      });

      it('should parse tool arguments correctly', async () => {
        const toolCall: ToolCall = {
          id: 'call_456',
          type: 'function',
          function: {
            name: 'complex_tool',
            arguments: JSON.stringify({
              string: 'text',
              number: 42,
              boolean: true,
              array: [1, 2, 3],
              object: { nested: 'value' },
            }),
          },
        };

        mockRegistry.execute.mockResolvedValue({ status: 'success' });

        await ToolExecutionManager.executeToolCall(toolCall, mockToolContext);

        expect(mockRegistry.execute).toHaveBeenCalledWith(
          'complex_tool',
          {
            string: 'text',
            number: 42,
            boolean: true,
            array: [1, 2, 3],
            object: { nested: 'value' },
          },
          mockToolContext
        );
      });

      it('should format tool response correctly', async () => {
        const toolCall: ToolCall = {
          id: 'call_789',
          type: 'function',
          function: {
            name: 'format_test',
            arguments: '{}',
          },
        };

        const mockResult = {
          status: 'success',
          data: { message: 'formatted' },
        };

        mockRegistry.execute.mockResolvedValue(mockResult);

        const response = await ToolExecutionManager.executeToolCall(
          toolCall,
          mockToolContext
        );

        expect(response.role).toBe('tool');
        expect(response.tool_call_id).toBe('call_789');
        expect(response.content).toBe(JSON.stringify(mockResult));
      });
    });

    describe('Binary Content Protection', () => {
      it('should protect binary artifact content', async () => {
        const toolCall: ToolCall = {
          id: 'call_artifact',
          type: 'function',
          function: {
            name: 'artifact',
            arguments: JSON.stringify({ action: 'get', id: 'img-123' }),
          },
        };

        const mockArtifact = {
          id: 'img-123',
          name: 'image.png',
          type: 'image/png',
          content: 'base64encodedimagedata...',
          isText: false,
          contentType: 'image/png',
        };

        (mockToolContext.getArtifact as jest.Mock).mockResolvedValue(mockArtifact);

        mockRegistry.execute.mockImplementation(async (name, args, context) => {
          // Simulate artifact tool calling getArtifact
          const artifact = await context.getArtifact!(args.id);
          return { status: 'success', data: artifact };
        });

        const response = await ToolExecutionManager.executeToolCall(
          toolCall,
          mockToolContext
        );

        expect(response.role).toBe('tool');
        
        const parsedContent = JSON.parse(response.content);
        expect(parsedContent.status).toBe('success');
        expect(parsedContent.data.content).toContain('[BINARY CONTENT');
        expect(parsedContent.data.content).toContain('25 characters');
        expect(parsedContent.data.isText).toBe(true);
      });

      it('should not modify text artifact content', async () => {
        const toolCall: ToolCall = {
          id: 'call_text_artifact',
          type: 'function',
          function: {
            name: 'artifact',
            arguments: JSON.stringify({ action: 'get', id: 'txt-123' }),
          },
        };

        const mockArtifact = {
          id: 'txt-123',
          name: 'document.txt',
          type: 'text/plain',
          content: 'This is text content',
          isText: true,
          contentType: 'text/plain',
        };

        (mockToolContext.getArtifact as jest.Mock).mockResolvedValue(mockArtifact);

        mockRegistry.execute.mockImplementation(async (name, args, context) => {
          const artifact = await context.getArtifact!(args.id);
          return { status: 'success', data: artifact };
        });

        const response = await ToolExecutionManager.executeToolCall(
          toolCall,
          mockToolContext
        );

        const parsedContent = JSON.parse(response.content);
        expect(parsedContent.data.content).toBe('This is text content');
        expect(parsedContent.data.isText).toBe(true);
      });

      it('should only apply protection to artifact get action', async () => {
        const toolCall: ToolCall = {
          id: 'call_save_artifact',
          type: 'function',
          function: {
            name: 'artifact',
            arguments: JSON.stringify({ action: 'save', content: 'data' }),
          },
        };

        mockRegistry.execute.mockResolvedValue({ status: 'success' });

        await ToolExecutionManager.executeToolCall(toolCall, mockToolContext);

        // Should use original context, not modified one
        expect(mockRegistry.execute).toHaveBeenCalledWith(
          'artifact',
          { action: 'save', content: 'data' },
          mockToolContext
        );
      });

      it('should handle missing getArtifact function', async () => {
        const toolCall: ToolCall = {
          id: 'call_no_get',
          type: 'function',
          function: {
            name: 'artifact',
            arguments: JSON.stringify({ action: 'get', id: 'test' }),
          },
        };

        const contextWithoutGet = { ...mockToolContext };
        delete contextWithoutGet.getArtifact;

        mockRegistry.execute.mockResolvedValue({ status: 'success' });

        await ToolExecutionManager.executeToolCall(toolCall, contextWithoutGet);

        expect(mockRegistry.execute).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle tool execution errors', async () => {
        const toolCall: ToolCall = {
          id: 'call_error',
          type: 'function',
          function: {
            name: 'failing_tool',
            arguments: '{}',
          },
        };

        mockRegistry.execute.mockRejectedValue(new Error('Tool failed'));

        const response = await ToolExecutionManager.executeToolCall(
          toolCall,
          mockToolContext
        );

        expect(response.role).toBe('tool');
        expect(response.tool_call_id).toBe('call_error');
        
        const parsedContent = JSON.parse(response.content);
        expect(parsedContent.status).toBe('error');
        expect(parsedContent.data.error).toBe('Tool failed');
      });

      it('should handle JSON parse errors in arguments', async () => {
        const toolCall: ToolCall = {
          id: 'call_bad_json',
          type: 'function',
          function: {
            name: 'test_tool',
            arguments: 'invalid json {',
          },
        };

        const response = await ToolExecutionManager.executeToolCall(
          toolCall,
          mockToolContext
        );

        expect(response.role).toBe('tool');
        const parsedContent = JSON.parse(response.content);
        expect(parsedContent.status).toBe('error');
        expect(parsedContent.data.error).toBeTruthy();
      });

      it('should handle non-Error exceptions', async () => {
        const toolCall: ToolCall = {
          id: 'call_string_error',
          type: 'function',
          function: {
            name: 'test_tool',
            arguments: '{}',
          },
        };

        mockRegistry.execute.mockRejectedValue('String error');

        const response = await ToolExecutionManager.executeToolCall(
          toolCall,
          mockToolContext
        );

        const parsedContent = JSON.parse(response.content);
        expect(parsedContent.status).toBe('error');
        expect(parsedContent.data.error).toBe('Unknown error');
      });

      it('should handle null/undefined errors', async () => {
        const toolCall: ToolCall = {
          id: 'call_null_error',
          type: 'function',
          function: {
            name: 'test_tool',
            arguments: '{}',
          },
        };

        mockRegistry.execute.mockRejectedValue(null);

        const response = await ToolExecutionManager.executeToolCall(
          toolCall,
          mockToolContext
        );

        const parsedContent = JSON.parse(response.content);
        expect(parsedContent.status).toBe('error');
        expect(parsedContent.data.error).toBe('Unknown error');
      });
    });
  });

  describe('executeToolCalls', () => {
    it('should execute multiple tool calls sequentially', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'tool1', arguments: '{}' },
        },
        {
          id: 'call_2',
          type: 'function',
          function: { name: 'tool2', arguments: '{}' },
        },
        {
          id: 'call_3',
          type: 'function',
          function: { name: 'tool3', arguments: '{}' },
        },
      ];

      mockRegistry.execute
        .mockResolvedValueOnce({ status: 'success', data: 'result1' })
        .mockResolvedValueOnce({ status: 'success', data: 'result2' })
        .mockResolvedValueOnce({ status: 'success', data: 'result3' });

      const responses = await ToolExecutionManager.executeToolCalls(
        toolCalls,
        mockToolContext
      );

      expect(responses).toHaveLength(3);
      expect(responses[0].tool_call_id).toBe('call_1');
      expect(responses[1].tool_call_id).toBe('call_2');
      expect(responses[2].tool_call_id).toBe('call_3');

      expect(mockRegistry.execute).toHaveBeenCalledTimes(3);
    });

    it('should handle empty tool calls array', async () => {
      const responses = await ToolExecutionManager.executeToolCalls(
        [],
        mockToolContext
      );

      expect(responses).toEqual([]);
      expect(mockRegistry.execute).not.toHaveBeenCalled();
    });

    it('should continue execution if one tool fails', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'tool1', arguments: '{}' },
        },
        {
          id: 'call_2',
          type: 'function',
          function: { name: 'tool2', arguments: '{}' },
        },
      ];

      mockRegistry.execute
        .mockRejectedValueOnce(new Error('Tool 1 failed'))
        .mockResolvedValueOnce({ status: 'success', data: 'result2' });

      const responses = await ToolExecutionManager.executeToolCalls(
        toolCalls,
        mockToolContext
      );

      expect(responses).toHaveLength(2);
      
      const firstResponse = JSON.parse(responses[0].content);
      expect(firstResponse.status).toBe('error');
      
      const secondResponse = JSON.parse(responses[1].content);
      expect(secondResponse.status).toBe('success');
    });

    it('should execute tools with different arguments', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'calculator',
            arguments: JSON.stringify({ operation: 'add', a: 1, b: 2 }),
          },
        },
        {
          id: 'call_2',
          type: 'function',
          function: {
            name: 'calculator',
            arguments: JSON.stringify({ operation: 'multiply', a: 3, b: 4 }),
          },
        },
      ];

      mockRegistry.execute
        .mockResolvedValueOnce({ status: 'success', data: 3 })
        .mockResolvedValueOnce({ status: 'success', data: 12 });

      const responses = await ToolExecutionManager.executeToolCalls(
        toolCalls,
        mockToolContext
      );

      expect(responses).toHaveLength(2);
      expect(mockRegistry.execute).toHaveBeenNthCalledWith(
        1,
        'calculator',
        { operation: 'add', a: 1, b: 2 },
        mockToolContext
      );
      expect(mockRegistry.execute).toHaveBeenNthCalledWith(
        2,
        'calculator',
        { operation: 'multiply', a: 3, b: 4 },
        mockToolContext
      );
    });

    it('should maintain order of tool call responses', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call_first',
          type: 'function',
          function: { name: 'tool', arguments: '{}' },
        },
        {
          id: 'call_second',
          type: 'function',
          function: { name: 'tool', arguments: '{}' },
        },
        {
          id: 'call_third',
          type: 'function',
          function: { name: 'tool', arguments: '{}' },
        },
      ];

      mockRegistry.execute.mockResolvedValue({ status: 'success' });

      const responses = await ToolExecutionManager.executeToolCalls(
        toolCalls,
        mockToolContext
      );

      expect(responses[0].tool_call_id).toBe('call_first');
      expect(responses[1].tool_call_id).toBe('call_second');
      expect(responses[2].tool_call_id).toBe('call_third');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle mixed success and error responses', async () => {
      const toolCalls: ToolCall[] = [
        {
          id: 'call_success',
          type: 'function',
          function: { name: 'working_tool', arguments: '{}' },
        },
        {
          id: 'call_error',
          type: 'function',
          function: { name: 'broken_tool', arguments: '{}' },
        },
        {
          id: 'call_success2',
          type: 'function',
          function: { name: 'working_tool', arguments: '{}' },
        },
      ];

      mockRegistry.execute
        .mockResolvedValueOnce({ status: 'success', data: 'ok' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ status: 'success', data: 'ok' });

      const responses = await ToolExecutionManager.executeToolCalls(
        toolCalls,
        mockToolContext
      );

      expect(responses).toHaveLength(3);
      
      const response1 = JSON.parse(responses[0].content);
      expect(response1.status).toBe('success');
      
      const response2 = JSON.parse(responses[1].content);
      expect(response2.status).toBe('error');
      
      const response3 = JSON.parse(responses[2].content);
      expect(response3.status).toBe('success');
    });

    it('should handle complex tool result objects', async () => {
      const toolCall: ToolCall = {
        id: 'call_complex',
        type: 'function',
        function: {
          name: 'complex_tool',
          arguments: '{}',
        },
      };

      const complexResult = {
        status: 'success',
        data: {
          nested: {
            deeply: {
              value: 'test',
              array: [1, 2, 3],
            },
          },
          metadata: {
            timestamp: '2024-01-01T00:00:00Z',
            version: '1.0',
          },
        },
      };

      mockRegistry.execute.mockResolvedValue(complexResult);

      const response = await ToolExecutionManager.executeToolCall(
        toolCall,
        mockToolContext
      );

      const parsedContent = JSON.parse(response.content);
      expect(parsedContent).toEqual(complexResult);
    });
  });
});
