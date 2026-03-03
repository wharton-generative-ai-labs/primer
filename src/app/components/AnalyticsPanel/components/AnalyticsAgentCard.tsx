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
  const colorClass = isStudentAgent ? 'text-blue-400' : 'text-purple-400';
  const description = isStudentAgent 
    ? 'Runs for each student individually'
    : 'Runs once to aggregate all student data';

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-white/10">
      <div>
        <h4 className="font-medium text-white">{agent.name}</h4>
        <p className="text-sm text-white/60">{agent.description}</p>
        <p className={`text-xs ${colorClass} mt-1`}>
          {description}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => window.location.href = `/edit/${experienceId}`}
          variant="ghost"
          size="sm"
          className="text-white/60"
        >
          <Edit3 className="h-4 w-4 mr-1" />
          Edit Prompt
        </Button>
        <Button
          onClick={() => onRun(agent.key, agent.type)}
          disabled={disabled}
          variant="custom"
          size="sm"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {isStudentAgent ? 'Run for All Students' : 'Run for Class'}
        </Button>
      </div>
    </div>
  );
}

