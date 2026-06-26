"use client";

import React, { useState, useEffect } from "react";
import { AnalyticsPanelProps } from './types';
import {
  useAnalyticsAgents,
  useSessionsIndex,
  useAnalyticsJobs,
  useReportViewer
} from './hooks';
import {
  ClassSelector,
  AnalyticsAgentsSection,
  JobProgress,
  AnalyticsResults,
  ReportViewerDialog,
  EmptyState
} from './components';

/**
 * Main Analytics Panel component
 * 
 * Provides interface for:
 * - Selecting classes
 * - Running analytics agents
 * - Viewing student and class reports
 */
export function AnalyticsPanel({ experienceId, classes }: AnalyticsPanelProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // Load analytics agents from experience config
  const { studentAgent, classAgent, analyticsAgents } = useAnalyticsAgents(experienceId);

  // Manage sessions index
  const {
    sessionsIndex,
    isLoadingIndex,
    loadSessionsIndex,
    refreshSessionsIndex
  } = useSessionsIndex(experienceId);

  // Manage analytics jobs
  const {
    activeJobs,
    hasRunningJob,
    runningAgentKey,
    runAnalytics
  } = useAnalyticsJobs(experienceId, () => {
    // Rebuild sessions index when job completes (POST rescans the filesystem
    // and picks up newly-written analytics files, unlike GET which reads the
    // stale cached index)
    if (selectedClassId) {
      refreshSessionsIndex(selectedClassId);
    }
  });

  // Manage report viewing
  const {
    viewingReport,
    isLoadingReport,
    viewReport,
    viewClassReport,
    closeReport
  } = useReportViewer(experienceId);

  // Load sessions index when class is selected
  useEffect(() => {
    if (selectedClassId) {
      loadSessionsIndex(selectedClassId);
    }
  }, [selectedClassId, loadSessionsIndex]);

  // Set default class if only one exists
  useEffect(() => {
    if (classes.length === 1 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // Handle running analytics
  const handleRunAnalytics = (agentKey: string, scope: 'student' | 'class') => {
    runAnalytics(selectedClassId, agentKey, scope);
  };

  // Handle viewing class report
  const selectedClass = classes.find(c => c.id === selectedClassId);
  const handleViewClassReport = () => {
    viewClassReport(selectedClassId, selectedClass?.name);
  };

  // Handle refreshing sessions index
  const handleRefreshIndex = () => {
    refreshSessionsIndex(selectedClassId);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-brand">Analytics</h2>
          <p className="text-muted-foreground">
            Run AI-powered analytics on student and class performance
          </p>
        </div>
      </div>

      {/* Empty State - No Classes */}
      {classes.length === 0 && <EmptyState type="no-classes" />}

      {/* Empty State - No Analytics Agents */}
      {analyticsAgents.length === 0 && classes.length > 0 && (
        <EmptyState type="no-agents" />
      )}

      {/* Class Selector */}
      {classes.length > 0 && (
        <ClassSelector
          classes={classes}
          selectedClassId={selectedClassId}
          onClassChange={setSelectedClassId}
          onRefreshIndex={handleRefreshIndex}
          isLoadingIndex={isLoadingIndex}
          sessionsIndex={sessionsIndex}
        />
      )}

      {/* Analytics Agents Section */}
      {selectedClassId && analyticsAgents.length > 0 && (
        <AnalyticsAgentsSection
          studentAgent={studentAgent}
          classAgent={classAgent}
          experienceId={experienceId}
          onRun={handleRunAnalytics}
          disabled={hasRunningJob}
          hasSessionsData={!!sessionsIndex?.membersWithSessions}
          runningAgentKey={runningAgentKey}
        />
      )}

      {/* Job Progress */}
      <JobProgress activeJobs={activeJobs} />

      {/* Analytics Results */}
      {selectedClassId && sessionsIndex && (
        <AnalyticsResults
          sessionsIndex={sessionsIndex}
          onViewReport={(sessionId, email, name) =>
            viewReport(sessionId, email, name, selectedClass?.name)
          }
          onViewClassReport={handleViewClassReport}
        />
      )}

      {/* Report Viewer Dialog */}
      <ReportViewerDialog
        viewingReport={viewingReport}
        isLoadingReport={isLoadingReport}
        onClose={closeReport}
      />
    </div>
  );
}

