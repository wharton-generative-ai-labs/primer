import { useState, useCallback } from 'react';
import { Class } from '@/app/lib/types';

interface UseClassDetailsResult {
  selectedClass: Class | null;
  fetchClassDetails: (classId: string) => Promise<void>;
  addMembers: (classId: string, emails: string[]) => Promise<number>;
  removeMember: (classId: string, email: string) => Promise<void>;
  clearSelectedClass: () => void;
}

export function useClassDetails(experienceId: string): UseClassDetailsResult {
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  const fetchClassDetails = useCallback(async (classId: string) => {
    if (!experienceId) return;
    
    const response = await fetch(`/api/classes/${classId}?experienceId=${experienceId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch class details');
    }
    
    setSelectedClass(data.class);
  }, [experienceId]);

  const addMembers = useCallback(async (classId: string, emails: string[]): Promise<number> => {
    const response = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addMembers',
        experienceId,
        classId,
        emails
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add members');
    }
    
    await fetchClassDetails(classId);
    return data.addedCount;
  }, [experienceId, fetchClassDetails]);

  const removeMember = useCallback(async (classId: string, email: string) => {
    const response = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'removeMembers',
        experienceId,
        classId,
        emails: [email]
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to remove member');
    }
    
    await fetchClassDetails(classId);
  }, [experienceId, fetchClassDetails]);

  const clearSelectedClass = useCallback(() => {
    setSelectedClass(null);
  }, []);

  return {
    selectedClass,
    fetchClassDetails,
    addMembers,
    removeMember,
    clearSelectedClass
  };
}

