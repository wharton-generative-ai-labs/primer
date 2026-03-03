/**
 * Backend Agent Route
 * 
 * Main orchestrator for backend agent execution.
 * Delegates to specialized managers for different concerns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createServerToolContext } from './utils/context';
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/app/lib/rate-limit';
import { createModuleLogger } from '@/lib/logger';
import { auditBackendAgent } from '@/lib/audit-logger';
import {
  ValidationManager,
  ExperienceConfigLoader,
  ToolRegistrationManager,
  DelegationStatusManager,
  ToolExecutionManager,
  AIRequestHandler
} from './managers';

const logger = createModuleLogger('backend-agent');

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for backend agent requests (expensive AI API calls)
    const identifier = getClientIdentifier(request);
    const limitResult = rateLimit(identifier, rateLimitConfigs.strict);

    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: limitResult.message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limitResult.max.toString(),
            'X-RateLimit-Remaining': limitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(limitResult.resetTime).toISOString(),
            'Retry-After': Math.ceil((limitResult.resetTime - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // Get user email for audit logging
    const token = await getToken({ req: request });
    const userEmail = token?.email || 'anonymous';

    // Validate request
    const validationResult = await ValidationManager.validateRequest(request, userEmail);
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: validationResult.status }
      );
    }

    const validatedData = validationResult.data;

    logger.debug({
      agentType: validatedData.agentType,
      artifactIds: validatedData.artifactIds,
      taskDescription: validatedData.taskDescription,
      experienceId: validatedData.experienceId,
      imageNames: validatedData.imageNames,
      delegationId: validatedData.delegationId,
      sessionId: validatedData.sessionId,
    }, 'Backend agent request received');

    // Log audit event
    await auditBackendAgent(userEmail, request, {
      agentType: validatedData.agentType,
      experienceId: validatedData.experienceId,
      sessionId: validatedData.sessionId,
      delegationId: validatedData.delegationId,
      artifactCount: validatedData.artifactIds.length,
      imageCount: validatedData.imageNames.length,
      hasTaskDescription: !!validatedData.taskDescription,
    });

    // Load experience configuration
    let experience;
    try {
      experience = await ExperienceConfigLoader.loadExperience(
        validatedData.experienceId,
        validatedData.agentType
      );
    } catch (error) {
      logger.error(error, 'Failed to load experience');
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to load experience configuration' },
        { status: error instanceof Error && error.message.includes('No agent found') ? 404 : 500 }
      );
    }

    // Send status update: Loading agent (using agent name)
    const agentName = experience.agentConfig.name || validatedData.agentType;
    if (validatedData.delegationId && validatedData.sessionId) {
      await DelegationStatusManager.sendStatusMessage(
        validatedData.sessionId,
        validatedData.delegationId,
        `Starting ${agentName}`,
        agentName
      );
    }

    // Initialize tools
    const tools = await ToolRegistrationManager.initializeTools(experience.agentConfig);

    // Get provider configuration
    const providerConfig = AIRequestHandler.getProviderConfig(experience);

    // Create task message
    const taskMessage = AIRequestHandler.createTaskMessage(
      validatedData.taskDescription,
      validatedData.artifactIds
    );

    // Create tool context
    const userInfo = token ? { name: token.name, email: token.email } : undefined;
    const toolContext = await createServerToolContext(
      validatedData.experienceId,
      validatedData.sessionId,
      validatedData.delegationId,
      userInfo
    );
    
    // Add AI configuration to tool context so tools can access it
    (toolContext as any).aiConfig = experience.aiConfig;

    // Send status update: Thinking
    if (validatedData.delegationId && validatedData.sessionId) {
      await DelegationStatusManager.sendStatusMessage(
        validatedData.sessionId,
        validatedData.delegationId,
        'Thinking'
      );
    }

    // Send initial request to AI
    const initialResponse = await AIRequestHandler.sendInitialRequest(
      experience,
      taskMessage,
      tools,
      providerConfig
    );

    logger.debug({
      hasContent: !!initialResponse.content,
      contentLength: initialResponse.content?.length,
      hasToolCalls: !!initialResponse.tool_calls,
      toolCallsCount: initialResponse.tool_calls?.length || 0,
      toolCalls: initialResponse.tool_calls?.map((tc) => ({ name: tc.function.name, id: tc.id })),
    }, 'Initial response from agent');

    // Initialize message history
    const allMessages = AIRequestHandler.initializeMessageHistory(
      experience,
      taskMessage,
      initialResponse
    );

    let currentResponse = initialResponse;

    // Tool call tracking for safety limits
    const maxToolCalls = experience.agentConfig.maximumToolCalls || 100;
    let totalToolCalls = 0;
    let iterationCount = 0;
    const toolFailureCount = new Map<string, number>();

    // Handle tool calls in a loop until no more tool calls are needed
    while (currentResponse.tool_calls && currentResponse.tool_calls.length > 0) {
      iterationCount++;
      
      // Check if we've exceeded maximum tool calls
      const upcomingToolCalls = currentResponse.tool_calls.length;
      if (totalToolCalls + upcomingToolCalls > maxToolCalls) {
        logger.error({
          agentName,
          totalToolCalls,
          maxToolCalls,
          iterationCount,
          upcomingToolCalls
        }, 'Maximum tool calls exceeded');
        
        return NextResponse.json({
          success: false,
          error: `Agent "${agentName}" exceeded maximum tool calls (${maxToolCalls}). The task may be too complex or the agent may be stuck in a loop.`,
          details: {
            totalToolCalls,
            maxToolCalls,
            iterationCount,
            lastTools: currentResponse.tool_calls.map(tc => tc.function.name)
          },
          partialResult: currentResponse?.content,
          agentType: validatedData.agentType,
          sessionId: validatedData.sessionId
        }, { status: 200 }); // Non-fatal: return 200 with error details
      }

      // Send status updates for each tool call
      if (validatedData.delegationId && validatedData.sessionId) {
        for (const toolCall of currentResponse.tool_calls) {
          const toolName = toolCall.function.name;
          let action: string | undefined;
          
          // Try to extract action from tool arguments
          try {
            const args = JSON.parse(toolCall.function.arguments);
            action = args.action;
          } catch {
            // If parsing fails, action remains undefined
          }
          
          await DelegationStatusManager.sendToolExecution(
            validatedData.sessionId,
            validatedData.delegationId,
            toolName,
            agentName,
            action
          );
        }
      }

      // Execute all tool calls
      const toolResponses = await ToolExecutionManager.executeToolCalls(
        currentResponse.tool_calls,
        toolContext
      );

      // Track tool call count and consecutive failures
      for (let i = 0; i < currentResponse.tool_calls.length; i++) {
        const toolCall = currentResponse.tool_calls[i];
        const toolResponse = toolResponses[i];
        const toolName = toolCall.function.name;
        
        totalToolCalls++;
        
        // Extract action for logging
        let action: string | undefined;
        try {
          const args = JSON.parse(toolCall.function.arguments);
          action = args.action;
        } catch {
          // If parsing fails, action remains undefined
        }
        
        // Check if tool failed
        const toolFailed = toolResponse.role === 'tool' && 
          toolResponse.content && 
          typeof toolResponse.content === 'string' &&
          (toolResponse.content.includes('"status":"error"') || 
           toolResponse.content.includes('"status": "error"'));
        
        if (toolFailed) {
          const failCount = (toolFailureCount.get(toolName) || 0) + 1;
          toolFailureCount.set(toolName, failCount);
          
          logger.warn({
            agentName,
            toolName,
            action,
            failCount,
            iterationCount,
            totalToolCalls
          }, 'Tool call failed');
          
          // Check if tool has failed 5 times consecutively
          if (failCount >= 5) {
            logger.error({
              agentName,
              toolName,
              action,
              failCount,
              iterationCount,
              totalToolCalls
            }, 'Tool failed 5 times consecutively');
            
            return NextResponse.json({
              success: false,
              error: `Tool "${toolName}" failed 5 times consecutively. The agent may be stuck or the task may not be achievable.`,
              details: {
                toolName,
                action,
                consecutiveFailures: failCount,
                totalToolCalls,
                iterationCount
              },
              partialResult: currentResponse?.content,
              agentType: validatedData.agentType,
              sessionId: validatedData.sessionId
            }, { status: 200 }); // Non-fatal: return 200 with error details
          }
        } else {
          // Reset failure count on success
          toolFailureCount.set(toolName, 0);
          
          logger.debug({
            agentName,
            toolName,
            action,
            iterationCount,
            totalToolCalls
          }, 'Tool call succeeded');
        }
      }

      // Add tool responses to message history
      allMessages.push(...toolResponses);

      // Send status update: Thinking (tools executed, waiting for AI response)
      if (validatedData.delegationId && validatedData.sessionId) {
        await DelegationStatusManager.sendStatusMessage(
          validatedData.sessionId,
          validatedData.delegationId,
          'Thinking'
        );
      }

      // Get next response from AI
      currentResponse = await AIRequestHandler.sendFollowUpRequest(
        experience,
        allMessages,
        tools,
        providerConfig
      );

      if (currentResponse) {
        allMessages.push(currentResponse);
        logger.debug({
          agentName,
          hasToolCalls: !!currentResponse.tool_calls,
          toolCalls: currentResponse.tool_calls?.map((tc) => tc.function.name),
          iterationCount,
          totalToolCalls
        }, 'Next response received');
      } else {
        logger.warn({ agentName, iterationCount, totalToolCalls }, 'No next response from AI');
        break;
      }
    }

    logger.info({
      agentName,
      contentLength: currentResponse?.content?.length,
      totalToolCalls,
      iterationCount,
      maxToolCalls
    }, 'Backend agent completed');

    return NextResponse.json({
      success: true,
      message: currentResponse?.content || 'Task completed successfully',
      agentType: validatedData.agentType,
      sessionId: validatedData.sessionId,
      stats: {
        totalToolCalls,
        iterationCount,
        maxToolCalls
      }
    });

  } catch (error) {
    logger.error(error, 'Backend agent error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
