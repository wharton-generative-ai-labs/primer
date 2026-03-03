/**
 * useAdminSocket
 *
 * Lightweight Socket.IO hook for management / admin pages.
 * Provides the ability to run backend agents (analytics, future helpers)
 * and receive real-time status updates — without pulling in the full
 * experience-oriented SocketController.
 *
 * Usage:
 *   const { runAgent, isConnected } = useAdminSocket();
 *   await runAgent({ experienceId, sessionId, agentKey, taskDescription }, {
 *     onStatus(msg)  { … },
 *     onComplete(res) { … },
 *     onError(err)    { … },
 *   });
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { env } from '@/config/env';
import { createModuleLogger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';

const logger = createModuleLogger('useAdminSocket');

// ── Types ───────────────────────────────────────────────────────────────

type Socket = any;
type IoFunction = (url: string, options: any) => Socket;

export interface AgentRunParams {
  experienceId: string;
  sessionId: string;
  agentKey: string;
  taskDescription: string;
  artifactIds?: string[];
}

export interface AgentRunStatusEvent {
  runId: string;
  status: string;
  agentName?: string;
  toolName?: string;
  action?: string;
}

export interface AgentRunCompleteEvent {
  runId: string;
  status: 'success' | 'error';
  message?: string;
  totalToolCalls?: number;
  error?: string;
}

export interface AgentRunCallbacks {
  onStatus?: (event: AgentRunStatusEvent) => void;
  onComplete?: (event: AgentRunCompleteEvent) => void;
  onError?: (error: string) => void;
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useAdminSocket() {
  const socketRef = useRef<Socket | null>(null);
  const ioRef = useRef<IoFunction | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Map<string, AgentRunCallbacks>>(new Map());
  const runCounterRef = useRef(0);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    let socket: Socket | null = null;

    const connect = async () => {
      try {
        if (!ioRef.current) {
          const socketIO = await import('socket.io-client');
          ioRef.current = socketIO.io;
        }

        const socketUrl = env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3000';

        socket = ioRef.current(socketUrl, {
          path: '/api/socketio',
          addTrailingSlash: false,
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          // No sessionId or experienceId — this is an admin connection
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          logger.info({ socketId: socket?.id }, 'Admin socket connected');
          setIsConnected(true);
        });

        socket.on('disconnect', () => {
          logger.info('Admin socket disconnected');
          setIsConnected(false);
        });

        socket.on('connect_error', (error: Error) => {
          logger.error(error, 'Admin socket connection error');
        });

        // Listen for toast notifications from backend agents
        socket.on('server:message', (data: any) => {
          if (data.type === 'toast.show' && data.data) {
            toastRef.current({
              title: data.data.message,
              variant: data.data.type === 'destructive' ? 'destructive' : 'default',
            });
          }
        });

        // Listen for agent run status updates
        socket.on('agent.run:status', (data: AgentRunStatusEvent) => {
          const cbs = listenersRef.current.get(data.runId);
          cbs?.onStatus?.(data);
        });

        // Listen for agent run completion
        socket.on('agent.run:complete', (data: AgentRunCompleteEvent) => {
          const cbs = listenersRef.current.get(data.runId);
          if (data.status === 'error') {
            cbs?.onError?.(data.error || 'Unknown error');
          }
          cbs?.onComplete?.(data);
          // Clean up listener
          listenersRef.current.delete(data.runId);
        });
      } catch (error) {
        logger.error(error, 'Failed to connect admin socket');
      }
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, []);

  /**
   * Run a backend agent via socket and receive real-time callbacks.
   * Returns the runId so callers can track it.
   */
  const runAgent = useCallback(
    (params: AgentRunParams, callbacks: AgentRunCallbacks): string | null => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        callbacks.onError?.('Socket not connected');
        return null;
      }

      runCounterRef.current++;
      const runId = `run_${Date.now()}_${runCounterRef.current}`;

      // Register callbacks for this run
      listenersRef.current.set(runId, callbacks);

      // Emit the agent.run event
      socket.emit('agent.run', {
        runId,
        experienceId: params.experienceId,
        sessionId: params.sessionId,
        agentKey: params.agentKey,
        taskDescription: params.taskDescription,
        artifactIds: params.artifactIds || [],
      });

      return runId;
    },
    []
  );

  return { runAgent, isConnected };
}
