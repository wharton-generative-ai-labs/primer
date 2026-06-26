"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3, Eye } from 'lucide-react';
import { ClassReportSectionProps } from '../types';

/**
 * Component for viewing class-level analytics report
 */
export function ClassReportSection({ onViewClassReport }: ClassReportSectionProps) {
  return (
    <div className="pt-4 border-t border-border">
      <h4 className="text-sm font-medium text-muted-foreground mb-2">
        Class Report
      </h4>
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
        <div className="flex items-center gap-3">
          <BarChart3 className="size-5" />
          <span className="text-foreground">Aggregate Class Analysis</span>
        </div>
        <Button
          onClick={onViewClassReport}
          variant="outline"
        >
          <Eye className="size-5" />
          View Class Report
        </Button>
      </div>
    </div>
  );
}

