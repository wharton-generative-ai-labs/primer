"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, AlertCircle, Eye } from 'lucide-react';
import { StudentReportsListProps } from '../types';

/**
 * Component displaying list of student reports
 */
export function StudentReportsList({
  sessionsIndex,
  onViewReport
}: StudentReportsListProps) {
  const members = Object.entries(sessionsIndex.members);

  if (members.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4 text-center">
        No sessions found for class members
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {members.map(([email, member]) => {
        const hasReport = member.sessions.some(s => s.hasAnalytics);
        const latestSession = member.sessions.find(
          s => s.sessionId === member.latestSession
        );
        
        return (
          <div
            key={email}
            className="flex items-center justify-between p-3 rounded-lg bg-muted"
          >
            <div className="flex items-center gap-3">
              {hasReport ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : member.totalSessions > 0 ? (
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <div>
                <p className="text-foreground text-sm">
                  {member.name || email}
                </p>
                {member.name && (
                  <p className="text-muted-foreground text-xs">{email}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasReport && latestSession && (
                <>
                  <span className="text-xs text-muted-foreground">
                    Generated{" "}
                    {latestSession.analyticsGeneratedAt &&
                      new Date(latestSession.analyticsGeneratedAt).toLocaleDateString()
                    }
                  </span>
                  <Button
                    onClick={() => onViewReport(latestSession.sessionId, email, member.name)}
                    variant="outline"
                  >
                    <Eye className="size-5" />
                    View
                  </Button>
                </>
              )}
              {!hasReport && member.totalSessions > 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Pending analysis
                </span>
              )}
              {member.totalSessions === 0 && (
                <span className="text-xs text-destructive">
                  No sessions
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

