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
    <div className="pt-4 border-t border-white/10">
      <h4 className="text-sm font-medium text-white/70 mb-2">
        Class Report
      </h4>
      <div className="flex items-center justify-between p-3 rounded-lg bg-black/20">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-4 w-4 text-purple-400" />
          <span className="text-white">Aggregate Class Analysis</span>
        </div>
        <Button
          onClick={onViewClassReport}
          variant="ghost"
          size="sm"
          className="text-purple-400"
        >
          <Eye className="h-4 w-4 mr-1" />
          View Class Report
        </Button>
      </div>
    </div>
  );
}

