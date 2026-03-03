"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { JobProgressProps } from '../types';

/**
 * Component displaying progress of running analytics jobs
 */
export function JobProgress({ activeJobs }: JobProgressProps) {
  const runningJobs = Object.values(activeJobs).filter(j => j.status === 'running');

  if (runningJobs.length === 0) {
    return null;
  }

  return (
    <Card className="bg-black/30 backdrop-blur-lg border-blue-500/30">
      <CardContent className="py-4">
        {runningJobs.map(job => (
          <div key={job.jobId} className="flex items-center gap-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            <div className="flex-1">
              <p className="text-white">
                Running {job.type === 'student' ? 'student' : 'class'} analytics...
              </p>
              {job.progress && (
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-white/60 mb-1">
                    <span>
                      {job.progress.currentStudentEmail || 'Processing...'}
                    </span>
                    <span>
                      {job.progress.current} / {job.progress.total}
                    </span>
                  </div>
                  <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all"
                      style={{ 
                        width: `${(job.progress.current / job.progress.total) * 100}%` 
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

