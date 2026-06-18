"use client";

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { StudentReportsList } from './StudentReportsList';
import { ClassReportSection } from './ClassReportSection';
import { ClassSessionsIndex } from '@/app/lib/types';

interface AnalyticsResultsProps {
  sessionsIndex: ClassSessionsIndex;
  onViewReport: (sessionId: string, email: string, name?: string, className?: string) => void;
  onViewClassReport: () => void;
}

/**
 * Component displaying analytics results (student and class reports)
 */
export function AnalyticsResults({
  sessionsIndex,
  onViewReport,
  onViewClassReport
}: AnalyticsResultsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Analytics Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Student Reports */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Student Reports
          </h4>
          <StudentReportsList
            sessionsIndex={sessionsIndex}
            onViewReport={onViewReport}
          />
        </div>

        {/* Class Report */}
        <ClassReportSection onViewClassReport={onViewClassReport} />
      </CardContent>
    </Card>
  );
}

