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
      <p className="text-white/50 text-sm py-4 text-center">
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
            className="flex items-center justify-between p-3 rounded-lg bg-black/20"
          >
            <div className="flex items-center gap-3">
              {hasReport ? (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              ) : member.totalSessions > 0 ? (
                <Clock className="h-4 w-4 text-yellow-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-400" />
              )}
              <div>
                <p className="text-white text-sm">
                  {member.name || email}
                </p>
                {member.name && (
                  <p className="text-white/40 text-xs">{email}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasReport && latestSession && (
                <>
                  <span className="text-xs text-white/40">
                    Generated{" "}
                    {latestSession.analyticsGeneratedAt && 
                      new Date(latestSession.analyticsGeneratedAt).toLocaleDateString()
                    }
                  </span>
                  <Button
                    onClick={() => onViewReport(latestSession.sessionId, email, member.name)}
                    variant="ghost"
                    size="sm"
                    className="text-blue-400"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </>
              )}
              {!hasReport && member.totalSessions > 0 && (
                <span className="text-xs text-yellow-400">
                  Pending analysis
                </span>
              )}
              {member.totalSessions === 0 && (
                <span className="text-xs text-red-400">
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

