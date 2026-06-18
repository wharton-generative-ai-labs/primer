"use client";

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { AnalyticsAgentCard } from './AnalyticsAgentCard';
import { AnalyticsAgent } from '../types';

interface AnalyticsAgentsSectionProps {
  studentAgent?: AnalyticsAgent;
  classAgent?: AnalyticsAgent;
  experienceId: string;
  onRun: (agentKey: string, scope: 'student' | 'class') => void;
  disabled: boolean;
  hasSessionsData: boolean;
  runningAgentKey?: string | null;
}

/**
 * Section displaying available analytics agents
 */
export function AnalyticsAgentsSection({
  studentAgent,
  classAgent,
  experienceId,
  onRun,
  disabled,
  hasSessionsData,
  runningAgentKey
}: AnalyticsAgentsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analytics Agents
        </CardTitle>
        <CardDescription>
          Run AI agents to generate performance reports
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {studentAgent && (
          <AnalyticsAgentCard
            agent={studentAgent}
            experienceId={experienceId}
            onRun={onRun}
            disabled={disabled || !hasSessionsData}
            isRunning={runningAgentKey === studentAgent.key}
          />
        )}

        {classAgent && (
          <AnalyticsAgentCard
            agent={classAgent}
            experienceId={experienceId}
            onRun={onRun}
            disabled={disabled || !hasSessionsData}
            isRunning={runningAgentKey === classAgent.key}
          />
        )}
      </CardContent>
    </Card>
  );
}

