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
    <Card className="border-primary/30">
      <CardContent className="py-4">
        {runningJobs.map(job => (
          <div key={job.jobId} className="flex items-center gap-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-foreground">
                Running {job.type === 'student' ? 'student' : 'class'} analytics...
              </p>
              {job.progress && (
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                    <span>
                      {job.progress.currentStatus || 'Processing...'}
                    </span>
                    <span>
                      {job.progress.current} / {job.progress.total}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
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

