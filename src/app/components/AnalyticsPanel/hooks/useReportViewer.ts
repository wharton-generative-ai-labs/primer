import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ReportViewState } from '../types';

/**
 * Hook to manage report viewing functionality
 */
export function useReportViewer(experienceId: string) {
  const { toast } = useToast();
  const [viewingReport, setViewingReport] = useState<ReportViewState | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  /**
   * View a student report
   */
  const viewReport = useCallback(async (
    sessionId: string,
    email: string,
    name?: string,
    className?: string,
  ) => {
    setIsLoadingReport(true);
    try {
      const filePath = `session_data/${sessionId}/analytics/student_report.md`;
      const response = await fetch(
        `/api/resource-content?experienceId=${experienceId}&path=${encodeURIComponent(filePath)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const displayLabel = name || email;
        const slugify = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+$/, '');
        const classSlug = className ? slugify(className) : null;
        const studentSlug = slugify(name || email);
        // [class name] [report type] [student name]
        const filename = classSlug
          ? `${classSlug}_Student_Report_${studentSlug}.md`
          : `Student_Report_${studentSlug}.md`;
        setViewingReport({
          title: `Student Report - ${displayLabel}`,
          content: data.content,
          downloadFilename: filename,
        });
      } else {
        throw new Error('Report not found');
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load report",
        variant: "destructive"
      });
    } finally {
      setIsLoadingReport(false);
    }
  }, [experienceId, toast]);

  /**
   * View class report
   */
  const viewClassReport = useCallback(async (classId: string, className?: string) => {
    if (!classId) return;
    
    setIsLoadingReport(true);
    try {
      const filePath = `class_data/${classId}/class_report.md`;
      const response = await fetch(
        `/api/resource-content?experienceId=${experienceId}&path=${encodeURIComponent(filePath)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const classSlug = (className || classId).replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+$/, '');
        setViewingReport({
          title: className ? `Class Report - ${className}` : 'Class Analytics Report',
          content: data.content,
          downloadFilename: `${classSlug}_Class_Report.md`,
        });
      } else {
        throw new Error('Class report not found');
      }
    } catch {
      toast({
        title: "Error",
        description: "Class report not found. Please run class analytics first.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingReport(false);
    }
  }, [experienceId, toast]);

  /**
   * Close report viewer
   */
  const closeReport = useCallback(() => {
    setViewingReport(null);
  }, []);

  return {
    viewingReport,
    isLoadingReport,
    viewReport,
    viewClassReport,
    closeReport
  };
}

