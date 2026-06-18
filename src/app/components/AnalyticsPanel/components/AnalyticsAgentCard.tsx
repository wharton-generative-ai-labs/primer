"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2, Edit3 } from 'lucide-react';
import { AnalyticsAgentCardProps } from '../types';

/**
 * Component for displaying and running an analytics agent
 */
export function AnalyticsAgentCard({
  agent,
  experienceId,
  onRun,
  disabled,
  isRunning
}: AnalyticsAgentCardProps) {
  const isStudentAgent = agent.type === 'student';
  const colorClass = isStudentAgent
    ? 'text-blue-600 dark:text-blue-400'
    : 'text-purple-600 dark:text-purple-400';
  const description = isStudentAgent
    ? 'Runs for each student individually'
    : 'Runs once to aggregate all student data';

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
      <div>
        <h4 className="font-medium text-foreground">{agent.name}</h4>
        <p className="text-sm text-muted-foreground">{agent.description}</p>
        <p className={`text-xs ${colorClass} mt-1`}>
          {description}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => window.location.href = `/edit/${experienceId}`}
          size="sm"
        >
          <Edit3 className="size-5" />
          Edit Prompt
        </Button>
        <Button
          onClick={() => onRun(agent.key, agent.type)}
          disabled={disabled}
          size="sm"
        >
          {isRunning ? (
            <Loader2 className="size-5 animate-spin mr-2" />
          ) : (
            <Play className="size-5" />
          )}
          {isStudentAgent ? 'Run for All Students' : 'Run for Class'}
        </Button>
      </div>
    </div>
  );
}

