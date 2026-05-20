import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('observe-tool');

/**
 * @tool observe
 * @description Report the current PlayPage UI state without spatial analysis.
 *
 * Returns layout mode, what's in the document slot + library, visible notes,
 * scene state, and the conversation's current-agent pointer. See
 * docs/superpowers/specs/2026-04-15-panel-layout-and-tool-redesign.md §5.3
 * for the full payload shape.
 */
export async function observe(
  _args: Record<string, never>,
  context: ToolContext
): Promise<ToolResponse> {
  try {
    if (!context.sendClientEvent) {
      return {
        status: 'error',
        data: { error: 'Socket communication not available in this context' },
      };
    }
    const requestManager = (context as any).requestManager;
    if (!requestManager) {
      return {
        status: 'error',
        data: { error: 'Request manager not available in context' },
      };
    }

    const callId = `observe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.debug({ callId }, 'Requesting UI state from client');

    // The client-side ui.observe.request handler in useHandleServerEvent
    // emits the new simplified response shape directly via tool.result.
    const resultPromise = requestManager.createPendingRequest(
      callId,
      'tool_result',
      5000
    ) as Promise<{ status: 'success' | 'error'; data: any }>;

    context.sendClientEvent({
      type: 'ui.observe.request',
      data: { callId },
    });

    return await resultPromise;
  } catch (error) {
    logger.error(error, 'Error in observe tool');
    return {
      status: 'error',
      data: {
        error: error instanceof Error ? error.message : 'Unknown error in observe tool',
      },
    };
  }
}
