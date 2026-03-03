"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, BarChart3 } from 'lucide-react';
import { EmptyStateProps } from '../types';

/**
 * Empty state component for when there are no classes or analytics agents
 */
export function EmptyState({ type }: EmptyStateProps) {
  if (type === 'no-classes') {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border-white/10">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-white/30" />
          <h3 className="text-lg font-medium text-white mb-2">No Classes</h3>
          <p className="text-white/60 mb-4">
            Create a class to start running analytics on student performance.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/30 backdrop-blur-lg border-white/10">
      <CardContent className="py-12 text-center">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-white/30" />
        <h3 className="text-lg font-medium text-white mb-2">No Analytics Agents</h3>
        <p className="text-white/60">
          This experience doesn&apos;t have any analytics agents configured.
          Add agents with <code className="bg-black/50 px-1 rounded">analyticsConfig.runnable: true</code> to enable analytics.
        </p>
      </CardContent>
    </Card>
  );
}

