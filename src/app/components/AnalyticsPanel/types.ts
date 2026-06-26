import { ClassSummary, ClassSessionsIndex, AnalyticsConfig, AnalyticsJobStatus } from "@/app/lib/types";

/**
 * Analytics agent configuration
 */
export interface AnalyticsAgent {
  key: string;
  name: string;
  description: string;
  type: 'student' | 'class';
  analyticsConfig: AnalyticsConfig;
}

/**
 * Props for the main AnalyticsPanel component
 */
export interface AnalyticsPanelProps {
  experienceId: string;
  classes: ClassSummary[];
}

/**
 * Props for ClassSelector component
 */
export interface ClassSelectorProps {
  classes: ClassSummary[];
  selectedClassId: string;
  onClassChange: (classId: string) => void;
  onRefreshIndex: () => void;
  isLoadingIndex: boolean;
  sessionsIndex: ClassSessionsIndex | null;
}

/**
 * Props for AnalyticsAgentCard component
 */
export interface AnalyticsAgentCardProps {
  agent: AnalyticsAgent;
  experienceId: string;
  onRun: (agentKey: string, scope: 'student' | 'class') => void;
  disabled: boolean;
  isRunning: boolean;
}

/**
 * Props for JobProgress component
 */
export interface JobProgressProps {
  activeJobs: Record<string, AnalyticsJobStatus>;
}

/**
 * Props for StudentReportsList component
 */
export interface StudentReportsListProps {
  sessionsIndex: ClassSessionsIndex;
  onViewReport: (sessionId: string, email: string, name?: string, className?: string) => void;
}

/**
 * Props for ClassReportSection component
 */
export interface ClassReportSectionProps {
  onViewClassReport: () => void;
}

/**
 * Props for ReportViewerDialog component
 */
export interface ReportViewerDialogProps {
  viewingReport: ReportViewState | null;
  isLoadingReport: boolean;
  onClose: () => void;
}

/**
 * Props for EmptyState component
 */
export interface EmptyStateProps {
  type: 'no-classes' | 'no-agents';
}

/**
 * Report viewing state
 */
export interface ReportViewState {
  title: string;
  content: string;
  downloadFilename: string;
}

