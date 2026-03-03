"use client";

import React, { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReportViewerDialogProps } from '../types';

/**
 * Dialog component for viewing analytics reports.
 *
 * The header (title, close button, download button) is sticky at the top
 * while the markdown body scrolls independently.
 */
export function ReportViewerDialog({
  viewingReport,
  isLoadingReport,
  onClose
}: ReportViewerDialogProps) {

  const handleDownload = useCallback(() => {
    if (!viewingReport) return;

    const blob = new Blob([viewingReport.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = viewingReport.downloadFilename || 'report.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [viewingReport]);

  return (
    <Dialog open={!!viewingReport} onOpenChange={onClose}>
      {/* 
        Remove the default overflow-y-auto from DialogContent so we can
        control scrolling ourselves: sticky header + scrollable body.
        The [&>button] selector targets the built-in Radix close button.
      */}
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col overflow-hidden bg-gray-900 border-white/20 text-white [&>button]:text-white">
        {/* Sticky header */}
        <DialogHeader className="flex-shrink-0 pr-20">
          <DialogTitle className="text-white truncate">
            {viewingReport?.title}
          </DialogTitle>
        </DialogHeader>

        {/* Download button — positioned top-right, aligned with the Radix close (X) button */}
        {viewingReport && !isLoadingReport && (
          <button
            onClick={handleDownload}
            className="absolute right-12 top-4 rounded-sm text-white/70 hover:text-white transition-opacity"
            title="Download report"
          >
            <Download className="h-4 w-4" />
            <span className="sr-only">Download</span>
          </button>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="prose prose-invert prose-sm max-w-none">
            {isLoadingReport ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-white/60" />
              </div>
            ) : viewingReport ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {viewingReport.content}
              </ReactMarkdown>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
