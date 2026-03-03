import { useState, useCallback, useRef } from 'react';
import { AnalyticsJobStatus } from '@/app/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  useAdminSocket,
  type AgentRunStatusEvent,
  type AgentRunCompleteEvent,
} from '@/app/hooks/useAdminSocket';
import { getToolDisplayName } from '@/app/lib/tools/ui/delegation/toolDisplayNames';

// Minimum time (ms) an "interesting" status (tool call) stays visible
// before "Thinking" can replace it.  Prevents rapid flash of tool names.
const MIN_STATUS_DISPLAY_MS = 3000;

/**
 * Creates a status updater that keeps tool/agent statuses visible for at
 * least MIN_STATUS_DISPLAY_MS before allowing a low-priority "Thinking"
 * status to overwrite them.  Interesting statuses always apply immediately.
 *
 * Call `flush()` when the agent run finishes to clear any pending timer.
 */
function createStatusDebouncer(applyStatus: (text: string) => void) {
  let lastInterestingAt = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  function update(text: string, isInteresting: boolean) {
    // Clear any pending "Thinking" timer — a new event supersedes it
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }

    if (isInteresting) {
      lastInterestingAt = Date.now();
      applyStatus(text);
      return;
    }

    // Low-priority ("Thinking") — delay if an interesting status is still fresh
    const elapsed = Date.now() - lastInterestingAt;
    if (elapsed >= MIN_STATUS_DISPLAY_MS) {
      applyStatus(text);
    } else {
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        applyStatus(text);
      }, MIN_STATUS_DISPLAY_MS - elapsed);
    }
  }

  function flush() {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  return { update, flush };
}

/**
 * Hook to manage analytics job execution via admin socket.
 *
 * Orchestrates multi-student runs client-side, delegating each individual
 * agent execution to the server via Socket.IO (agent.run).  Real-time
 * status events replace the old HTTP polling approach.
 */
export function useAnalyticsJobs(experienceId: string, onJobComplete?: () => void) {
  const { toast } = useToast();
  const { runAgent, isConnected } = useAdminSocket();
  const [activeJobs, setActiveJobs] = useState<Record<string, AnalyticsJobStatus>>({});
  const abortRef = useRef(false);

  // ── Helper: persist job to server (fire-and-forget) ─────────────────
  const persistJob = useCallback(async (job: AnalyticsJobStatus) => {
    try {
      await fetch('/api/analytics/run', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceId, job }),
      });
    } catch {
      // Best-effort persistence — don't block the UI
    }
  }, [experienceId]);

  // ── Helper: run a single agent via socket (returns a promise) ───────
  const runSingleAgent = useCallback(
    (
      sessionId: string,
      agentKey: string,
      taskDescription: string,
      onStatus?: (event: AgentRunStatusEvent) => void
    ): Promise<AgentRunCompleteEvent> => {
      return new Promise((resolve, reject) => {
        const runId = runAgent(
          { experienceId, sessionId, agentKey, taskDescription },
          {
            onStatus,
            onComplete: (event) => resolve(event),
            onError: (error) => reject(new Error(error)),
          }
        );

        if (!runId) {
          reject(new Error('Failed to start agent — socket not connected'));
        }
      });
    },
    [runAgent, experienceId]
  );

  // ── Main entry point ────────────────────────────────────────────────
  const runAnalytics = useCallback(
    async (classId: string, agentKey: string, scope: 'student' | 'class') => {
      if (!classId) {
        toast({ title: 'Error', description: 'Please select a class first', variant: 'destructive' });
        return;
      }

      if (!isConnected) {
        toast({ title: 'Error', description: 'Not connected to server. Please refresh the page.', variant: 'destructive' });
        return;
      }

      abortRef.current = false;

      // Create a job for tracking
      const jobId = `job_${Date.now()}`;
      const job: AnalyticsJobStatus = {
        jobId,
        experienceId,
        classId,
        agentKey,
        type: scope,
        status: 'running',
        startedAt: new Date().toISOString(),
      };

      setActiveJobs((prev) => ({ ...prev, [jobId]: job }));

      toast({ title: 'Analytics Started', description: `Running ${scope} analytics...` });

      try {
        if (scope === 'student') {
          await runStudentAnalytics(job, classId, agentKey);
        } else {
          await runClassAnalytics(job, classId, agentKey);
        }

        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        setActiveJobs((prev) => ({ ...prev, [jobId]: { ...job } }));
        persistJob(job);

        toast({ title: 'Analytics Complete', description: 'Analytics report has been generated' });
        onJobComplete?.();
      } catch (error) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.completedAt = new Date().toISOString();
        setActiveJobs((prev) => ({ ...prev, [jobId]: { ...job } }));
        persistJob(job);

        toast({
          title: 'Analytics Failed',
          description: job.error,
          variant: 'destructive',
        });
      }
    },
    [experienceId, isConnected, toast, onJobComplete, persistJob, runSingleAgent] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Student-level analytics ─────────────────────────────────────────
  async function runStudentAnalytics(
    job: AnalyticsJobStatus,
    classId: string,
    agentKey: string
  ) {
    // Fetch sessions index to know which students to process
    const indexRes = await fetch(
      `/api/analytics/sessions-index?experienceId=${encodeURIComponent(experienceId)}&classId=${encodeURIComponent(classId)}`
    );
    if (!indexRes.ok) throw new Error('Failed to load sessions index');
    const { index } = await indexRes.json();

    // Collect sessions to process (prefer student name over email for display)
    const sessionsToProcess: Array<{ email: string; displayName: string; sessionId: string }> = [];
    for (const [email, memberEntry] of Object.entries(index.members) as [string, any][]) {
      const sessionId = memberEntry.latestSession;
      if (!sessionId) continue;
      const session = memberEntry.sessions?.find((s: any) => s.sessionId === sessionId);
      if (session?.hasAnalytics) continue; // skip already-processed
      sessionsToProcess.push({ email, displayName: memberEntry.name || email, sessionId });
    }

    job.progress = { current: 0, total: sessionsToProcess.length };
    setActiveJobs((prev) => ({ ...prev, [job.jobId]: { ...job } }));

    for (const { email, displayName, sessionId } of sessionsToProcess) {
      if (abortRef.current) throw new Error('Aborted');

      job.progress!.currentStudentEmail = displayName;
      setActiveJobs((prev) => ({ ...prev, [job.jobId]: { ...job } }));

      const taskMessage = [
        `You are running student-level analytics for session ${sessionId}.`,
        '',
        'Your task is to analyze this student\'s session data and generate a comprehensive performance report.',
        '',
        'Use the listSessionFiles tool to discover what files are available in the session.',
        'Use the readSessionFile tool to read session files like transcripts and artifacts.',
        'Use the writeSessionFile tool to save your analytics report to: analytics/student_report.md',
        '',
        'Begin by exploring what data is available for this session.',
      ].join('\n');

      const debouncer = createStatusDebouncer((text) => {
        job.progress!.currentStudentEmail = text;
        setActiveJobs((prev) => ({ ...prev, [job.jobId]: { ...job } }));
      });

      const result = await runSingleAgent(sessionId, agentKey, taskMessage, (evt) => {
        if (evt.toolName) {
          debouncer.update(`${displayName} — ${getToolDisplayName(evt.toolName, evt.action)}`, true);
        } else if (evt.agentName) {
          debouncer.update(`${displayName} — ${evt.status}`, true);
        } else {
          debouncer.update(`${displayName} — Thinking`, false);
        }
      });

      debouncer.flush();

      if (result.status === 'error') {
        // Log but continue to next student
        console.warn(`Analytics failed for ${email}: ${result.error}`);
      }

      job.progress!.current++;
      setActiveJobs((prev) => ({ ...prev, [job.jobId]: { ...job } }));
    }
  }

  // ── Class-level analytics ───────────────────────────────────────────
  async function runClassAnalytics(
    job: AnalyticsJobStatus,
    classId: string,
    agentKey: string
  ) {
    job.progress = { current: 0, total: 1 };
    setActiveJobs((prev) => ({ ...prev, [job.jobId]: { ...job } }));

    const syntheticSessionId = `class_analytics_${classId}`;
    const taskMessage = [
      `You are running class-level analytics for class ${classId}.`,
      '',
      'Your task is to analyze all student reports and generate a comprehensive class performance report.',
      '',
      'Use the listClassSessions tool to get a list of all students and their sessions.',
      'Use the batchReadSessionFiles tool to efficiently read student reports from multiple sessions.',
      'Use the writeClassData tool to save your class analytics report to: class_report.md',
      '',
      'Begin by discovering what student data is available for analysis.',
    ].join('\n');

    const debouncer = createStatusDebouncer((text) => {
      job.progress!.currentStudentEmail = text;
      setActiveJobs((prev) => ({ ...prev, [job.jobId]: { ...job } }));
    });

    const result = await runSingleAgent(syntheticSessionId, agentKey, taskMessage, (evt) => {
      if (evt.toolName) {
        debouncer.update(getToolDisplayName(evt.toolName, evt.action), true);
      } else if (evt.agentName) {
        debouncer.update(evt.status, true);
      } else {
        debouncer.update('Thinking', false);
      }
    });

    debouncer.flush();

    if (result.status === 'error') {
      throw new Error(result.error || 'Class analytics failed');
    }

    job.progress!.current = 1;
    setActiveJobs((prev) => ({ ...prev, [job.jobId]: { ...job } }));
  }

  const runningJob = Object.values(activeJobs).find(
    (job) => job.status === 'running' || job.status === 'pending'
  );
  const hasRunningJob = !!runningJob;
  const runningAgentKey = runningJob?.agentKey ?? null;

  return {
    activeJobs,
    hasRunningJob,
    runningAgentKey,
    runAnalytics,
  };
}
