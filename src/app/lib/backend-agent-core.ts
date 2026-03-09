/**
 * Backend Agent Core Execution
 *
 * Shared tool-call loop used by both:
 *   - backend-agent-socket.ts  (experience delegation via Socket.IO)
 *   - server.ts agent.run      (admin / analytics via Socket.IO)
 *
 * Callers provide lightweight callbacks for status reporting so the core
 * stays transport-agnostic.
 */

import { createModuleLogger } from '@/lib/logger';
import type { ToolContext } from '@/app/lib/tools/types';
import {
  ExperienceConfigLoader,
  ToolRegistrationManager,
  ToolExecutionManager,
  AIRequestHandler,
} from '@/app/api/backend-agent/managers';
import type { LoadedExperience } from '@/app/api/backend-agent/managers';

const logger = createModuleLogger('backend-agent-core');

// ── Public types ────────────────────────────────────────────────────────

export interface AgentExecutionCallbacks {
  /** Called when the agent starts (after config is loaded). */
  onStart?: (agentName: string) => void;
  /** Called before each AI request ("Thinking"). */
  onThinking?: () => void;
  /** Called for each tool the AI wants to execute. */
  onToolCall?: (toolName: string, action?: string) => void;
}

export interface AgentExecutionParams {
  experienceId: string;
  sessionId: string;
  agentKey: string;
  taskDescription: string;
  artifactIds?: string[];
  toolContext: ToolContext;
  callbacks?: AgentExecutionCallbacks;
}

export interface AgentExecutionResult {
  message: string;
  totalToolCalls: number;
}

// ── Core execution ──────────────────────────────────────────────────────

/**
 * Run a backend agent to completion.
 *
 * This is the single source of truth for the "load config → AI request →
 * tool-call loop → final message" lifecycle.  Transport-specific concerns
 * (socket events, HTTP responses, file persistence) live in the callers.
 */
export async function executeBackendAgent(
  params: AgentExecutionParams
): Promise<AgentExecutionResult> {
  const {
    experienceId,
    agentKey,
    taskDescription,
    artifactIds = [],
    toolContext,
    callbacks,
  } = params;

  // Load experience configuration
  const experience: LoadedExperience = await ExperienceConfigLoader.loadExperience(
    experienceId,
    agentKey
  );

  const agentName = experience.agentConfig.name || agentKey;
  callbacks?.onStart?.(agentName);

  // Initialize tools
  const tools = await ToolRegistrationManager.initializeTools(experience.agentConfig);

  // Get provider configuration
  const providerConfig = AIRequestHandler.getProviderConfig(experience);

  // Create task message
  const taskMessage = AIRequestHandler.createTaskMessage(taskDescription, artifactIds);

  // Attach AI config to tool context (some tools need it)
  (toolContext as any).aiConfig = experience.aiConfig;

  // ── Initial AI request ────────────────────────────────────────────
  callbacks?.onThinking?.();

  const initialResponse = await AIRequestHandler.sendInitialRequest(
    experience,
    taskMessage,
    tools,
    providerConfig
  );

  logger.debug(
    {
      hasContent: !!initialResponse.content,
      contentLength: initialResponse.content?.length,
      toolCallsCount: initialResponse.tool_calls?.length || 0,
    },
    'Initial response from agent'
  );

  const allMessages = AIRequestHandler.initializeMessageHistory(
    experience,
    taskMessage,
    initialResponse
  );

  let currentResponse = initialResponse;

  // ── Tool-call loop ────────────────────────────────────────────────
  const maxToolCalls = experience.agentConfig.maximumToolCalls || 100;
  let totalToolCalls = 0;
  let iterationCount = 0;
  const toolFailureCount = new Map<string, number>();

  while (currentResponse.tool_calls && currentResponse.tool_calls.length > 0) {
    iterationCount++;

    // Guard: max tool calls
    const upcoming = currentResponse.tool_calls.length;
    if (totalToolCalls + upcoming > maxToolCalls) {
      logger.error(
        { agentName, totalToolCalls, maxToolCalls, iterationCount },
        'Maximum tool calls exceeded'
      );
      throw new Error(
        `Agent "${agentName}" exceeded maximum tool calls (${maxToolCalls})`
      );
    }

    // Notify caller about each tool call
    for (const toolCall of currentResponse.tool_calls) {
      const toolName = toolCall.function.name;
      let action: string | undefined;
      try {
        const args = JSON.parse(toolCall.function.arguments);
        action = args.action;
      } catch {
        // parsing failed — action stays undefined
      }
      callbacks?.onToolCall?.(toolName, action);
    }

    // Execute tool calls
    const toolResponses = await ToolExecutionManager.executeToolCalls(
      currentResponse.tool_calls,
      toolContext
    );

    // Track counts & consecutive failures per round (not per call within a batch).
    // Multiple failures of the same tool in a single batch count as one failed round,
    // since the model hasn't seen the error feedback yet and can't self-correct.
    const failedToolsThisRound = new Set<string>();
    const succeededToolsThisRound = new Set<string>();

    for (let i = 0; i < currentResponse.tool_calls.length; i++) {
      const toolCall = currentResponse.tool_calls[i];
      const toolResponse = toolResponses[i];
      const toolName = toolCall.function.name;
      totalToolCalls++;

      if (toolResponse.role === 'tool' && typeof toolResponse.content === 'string') {
        try {
          const parsed = JSON.parse(toolResponse.content);
          if (parsed.status === 'error') {
            failedToolsThisRound.add(toolName);
          } else {
            succeededToolsThisRound.add(toolName);
          }
        } catch {
          // JSON parse failure — not a structured error, ignore
        }
      }
    }

    for (const toolName of failedToolsThisRound) {
      if (succeededToolsThisRound.has(toolName)) {
        toolFailureCount.delete(toolName);
      } else {
        const count = (toolFailureCount.get(toolName) || 0) + 1;
        toolFailureCount.set(toolName, count);
        if (count >= 3) {
          logger.error(
            { toolName, failureCount: count, agentName },
            'Tool failed 3 consecutive rounds'
          );
          throw new Error(`Tool "${toolName}" failed 3 consecutive rounds`);
        }
      }
    }

    for (const toolName of succeededToolsThisRound) {
      toolFailureCount.delete(toolName);
    }

    allMessages.push(...toolResponses);

    // Next AI request
    callbacks?.onThinking?.();

    currentResponse = await AIRequestHandler.sendFollowUpRequest(
      experience,
      allMessages,
      tools,
      providerConfig
    );

    allMessages.push(currentResponse);
  }

  const finalMessage = currentResponse.content || 'Task completed successfully.';

  logger.info(
    { agentName, totalToolCalls, iterationCount, messageLength: finalMessage.length },
    'Backend agent completed'
  );

  return { message: finalMessage, totalToolCalls };
}
