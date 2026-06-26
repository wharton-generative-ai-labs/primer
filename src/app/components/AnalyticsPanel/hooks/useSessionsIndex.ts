import { useState, useCallback } from 'react';
import { ClassSessionsIndex } from '@/app/lib/types';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to manage sessions index for a class
 */
export function useSessionsIndex(experienceId: string) {
  const { toast } = useToast();
  const [sessionsIndex, setSessionsIndex] = useState<ClassSessionsIndex | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState(false);

  /**
   * Load sessions index for a specific class
   */
  const loadSessionsIndex = useCallback(async (classId: string) => {
    if (!classId) {
      setSessionsIndex(null);
      return;
    }
    
    setIsLoadingIndex(true);
    try {
      const response = await fetch(
        `/api/analytics/sessions-index?experienceId=${experienceId}&classId=${classId}`
      );
      const data = await response.json();
      setSessionsIndex(data.index || null);
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load sessions index",
        variant: "destructive"
      });
    } finally {
      setIsLoadingIndex(false);
    }
  }, [experienceId, toast]);

  /**
   * Refresh sessions index for the current class
   */
  const refreshSessionsIndex = useCallback(async (classId: string) => {
    if (!classId) return;
    
    setIsLoadingIndex(true);
    try {
      const response = await fetch('/api/analytics/sessions-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId,
          classId
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSessionsIndex(data.index);
        toast({
          title: "Index Updated",
          description: data.message
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refresh sessions index",
        variant: "destructive"
      });
    } finally {
      setIsLoadingIndex(false);
    }
  }, [experienceId, toast]);

  return {
    sessionsIndex,
    isLoadingIndex,
    loadSessionsIndex,
    refreshSessionsIndex
  };
}

