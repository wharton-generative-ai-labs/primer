import { useState, useCallback } from 'react';
import { ClassSummary } from '@/app/lib/types';

interface UseClassesResult {
  classes: ClassSummary[];
  isLoading: boolean;
  error: string | null;
  fetchClasses: () => Promise<void>;
  createClass: (name: string, description?: string) => Promise<void>;
  deleteClass: (classId: string) => Promise<void>;
  toggleClassActive: (classId: string, currentlyActive: boolean) => Promise<void>;
}

export function useClasses(experienceId: string): UseClassesResult {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    if (!experienceId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/classes?experienceId=${experienceId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch classes');
      }
      
      setClasses(data.classes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch classes');
    } finally {
      setIsLoading(false);
    }
  }, [experienceId]);

  const createClass = useCallback(async (name: string, description?: string) => {
    const response = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        experienceId,
        name: name.trim(),
        description: description?.trim() || undefined
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create class');
    }
    
    await fetchClasses();
  }, [experienceId, fetchClasses]);

  const deleteClass = useCallback(async (classId: string) => {
    const response = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        experienceId,
        classId
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete class');
    }
    
    await fetchClasses();
  }, [experienceId, fetchClasses]);

  const toggleClassActive = useCallback(async (classId: string, currentlyActive: boolean) => {
    const response = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        experienceId,
        classId,
        isActive: !currentlyActive
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update class');
    }
    
    await fetchClasses();
  }, [experienceId, fetchClasses]);

  return {
    classes,
    isLoading,
    error,
    fetchClasses,
    createClass,
    deleteClass,
    toggleClassActive
  };
}

