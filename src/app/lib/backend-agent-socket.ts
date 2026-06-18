/**
 * Backend Agent Socket Execution
 * 
 * Executes backend agents via Socket.IO instead of HTTP.
 * This allows backend agents to use UI tools that require socket communication.
 *
 * Delegates to the shared backend-agent-core for the actual tool-call loop,
 * adding socket-specific status events and tool context.
 */

import { createModuleLogger } from '@/lib/logger';
import type { ToolContext } from '@/app/lib/tools/types';
import { executeBackendAgent } from '@/app/lib/backend-agent-core';

const logger = createModuleLogger('backend-agent-socket');

interface BackendAgentSocketParams {
  socket: any; // Socket instance
  requestManager: any; // ToolRequestManager instance
  callId: string;
  agentType: string;
  artifactIds: string[];
  taskDescription?: string;
  experienceId: string;
  sessionId: string;
  delegationId: string;
  imageNames?: string[];
  userInfo?: { name?: string | null; email?: string | null };
}

/**
 * Track D — delegation circuit breaker state.
 *
 * Maps `${sessionId}::${agentType}` → consecutive failure count.
 * Resets to 0 on successful execution. Exists to stop the OOM cascade
 * observed in QA Round 3, where the orchestrator re-delegated to
 * `experience-builder` 3+ times in a row, each round loading ~7.5 MB
 * of base64 PNGs into agent context until Node hit its heap limit.
 *
 * Threshold rationale (=2 prior failures, refuse 3rd):
 * - Track A + B should make this dead code in the canonical UUID-
 *   fabrication scenario.
 * - One retry rides out a transient (network/storage) hiccup.
 * - The 3rd attempt is the canary that surfaces a stuck loop instead
 *   of letting it grow unbounded.
 */
const FAILURE_THRESHOLD = 2;
const delegationFailures = new Map<string, number>();

function circuitBreakerKey(sessionId: string, agentType: string): string {
  return `${sessionId}::${agentType}`;
}

/**
 * Test-only reset hook. The Map is module-private and persists for the
 * life of the process (counters reset on success, on server restart, or
 * by explicit invalidation). Tests need a clean state between cases.
 */
export function __resetDelegationCircuitBreakerForTests(): void {
  delegationFailures.clear();
}

/**
 * Execute a backend agent via socket with streaming responses.
 *
 * Wrapped in a per-(sessionId, agentType) circuit breaker (Track D).
 * After two consecutive failures the third attempt is refused: a
 * destructive toast goes out so the client renders a reload tile, and
 * the orchestrator gets a structured error pointing at the trip. The
 * counter resets to zero on the next successful run.
 */
export async function executeBackendAgentViaSocket(params: BackendAgentSocketParams): Promise<void> {
  const {
    socket,
    requestManager,
    callId,
    agentType,
    artifactIds,
    taskDescription,
    experienceId,
    sessionId,
    delegationId,
    userInfo
  } = params;

  const breakerKey = circuitBreakerKey(sessionId, agentType);
  const priorFailures = delegationFailures.get(breakerKey) ?? 0;

  if (priorFailures >= FAILURE_THRESHOLD) {
    const message =
      `Build agent failed twice — please reload to retry. ` +
      `(circuit-breaker tripped for ${agentType})`;
    logger.warn(
      { sessionId, agentType, priorFailures, callId, delegationId },
      'Delegation circuit breaker tripped — refusing attempt',
    );

    // Destructive toast → client converts to a `phase-failure` window
    // event for build/result phases (see useHandleServerEvent.ts).
    socket.emit('server:message', {
      type: 'toast.show',
      data: {
        message,
        type: 'destructive',
      },
    });

    // Structured error response so the orchestrator stops re-delegating.
    socket.emit('tool.response', {
      callId,
      status: 'error',
      data: {
        error: message,
        circuitBreakerTripped: true,
        agentType,
      },
    });
    return;
  }

  try {
    logger.debug({
      agentType,
      artifactIds,
      taskDescription,
      experienceId,
      sessionId,
      delegationId,
      priorFailures,
    }, 'Executing backend agent via socket');

    // Create socket-aware tool context
    const toolContext = await createSocketToolContext({
      experienceId,
      sessionId,
      delegationId,
      socket,
      requestManager,
      userInfo,
      activeAgentKey: agentType,
    });

    const result = await executeBackendAgent({
      experienceId,
      sessionId,
      agentKey: agentType,
      taskDescription: taskDescription || '',
      artifactIds: artifactIds || [],
      toolContext,
      callbacks: {
        onStart: (agentName) => {
          socket.emit('delegation:status', {
            sessionId,
            delegationId,
            status: `Starting ${agentName}`,
            agentName
          });
        },
        onThinking: () => {
          socket.emit('delegation:status', {
            sessionId,
            delegationId,
            status: 'Thinking'
          });
        },
        onToolCall: (toolName, action) => {
          socket.emit('delegation:tool', {
            sessionId,
            delegationId,
            toolName,
            agentName: agentType,
            action
          });
        },
      },
    });

    // Successful run: clear the failure counter so transient hiccups
    // don't add up across the lifetime of a session.
    delegationFailures.delete(breakerKey);

    // Send final response
    socket.emit('tool.response', {
      callId,
      status: 'success',
      data: {
        message: result.message,
        agentType,
        artifactIds
      }
    });

  } catch (error) {
    const newFailureCount = priorFailures + 1;
    delegationFailures.set(breakerKey, newFailureCount);

    logger.error(
      { err: error, sessionId, agentType, failureCount: newFailureCount },
      'Error executing backend agent via socket',
    );
    socket.emit('tool.response', {
      callId,
      status: 'error',
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        agentType,
        failureCount: newFailureCount,
      }
    });
  }
}

/**
 * Create a socket-aware tool context for backend agents.
 *
 * Exported so the artifact write-fanout wrappers (which emit
 * `artifact.changed` / `artifact.deleted` after every successful storage
 * mutation) can be unit-tested without standing up a full socket server.
 */
export async function createSocketToolContext(params: {
  experienceId: string;
  sessionId: string;
  delegationId: string;
  socket: any;
  requestManager: any;
  userInfo?: { name?: string | null; email?: string | null };
  activeAgentKey?: string;
}): Promise<ToolContext> {
  const { experienceId, sessionId, delegationId, socket, requestManager, userInfo, activeAgentKey } = params;

  const { createServerToolContext } = await import('@/app/api/backend-agent/utils/context');
  const { listArtifactRevisions, readArtifactHead } = await import('@/app/lib/artifacts/storage');

  const baseContext = await createServerToolContext(experienceId, sessionId, delegationId, userInfo, activeAgentKey);

  // Helper: after a write, fan-out the latest record + revisions to the
  // frontend. Backend agent writes complete silently otherwise — without
  // this the doc panel banner / version switcher / library are blind to
  // anything the agent does. Best-effort: a fetch failure here doesn't
  // break the agent's flow, only the UI freshness.
  const emitArtifactChanged = async (artifactId: string) => {
    try {
      const head = await readArtifactHead({ experienceId, sessionId, artifactId });
      if (!head) {
        logger.warn({ artifactId }, 'emitArtifactChanged: head not found, skipping emit');
        return;
      }
      const listed = await listArtifactRevisions({ experienceId, sessionId, artifactId });
      socket.emit('artifact.changed', {
        sessionId,
        artifactId,
        artifact: head,
        revisions: listed?.revisions ?? [],
      });
    } catch (error) {
      logger.error({ err: error, artifactId }, 'Failed to emit artifact.changed');
    }
  };

  const baseCreate = baseContext.createArtifact;
  const baseUpdate = baseContext.updateArtifact;
  const baseDelete = baseContext.deleteArtifact;

  const socketContext: any = {
    ...baseContext,
    requestManager,
    sendClientEvent: (event: { type: string; data: any }) => {
      logger.debug({ type: event.type }, 'Sending client event via socket');
      socket.emit(event.type, event.data);
    },

    createArtifact: baseCreate
      ? async (...args: Parameters<NonNullable<typeof baseCreate>>) => {
          const result = await baseCreate(...args);
          if (result?.id) {
            await emitArtifactChanged(result.id);
          }
          return result;
        }
      : undefined,

    updateArtifact: baseUpdate
      ? async (...args: Parameters<NonNullable<typeof baseUpdate>>) => {
          const id = args[0];
          await baseUpdate(...args);
          if (id) {
            await emitArtifactChanged(id);
          }
        }
      : undefined,

    deleteArtifact: baseDelete
      ? async (...args: Parameters<NonNullable<typeof baseDelete>>) => {
          const id = args[0];
          await baseDelete(...args);
          if (id) {
            socket.emit('artifact.deleted', { sessionId, artifactId: id });
          }
        }
      : undefined,
  };

  return socketContext;
}
