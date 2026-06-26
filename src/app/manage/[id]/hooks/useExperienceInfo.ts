import { useState, useEffect } from 'react';

export interface ExperienceInfo {
  title: string;
  authorEmail: string;
}

export function useExperienceInfo(experienceId: string): ExperienceInfo | null {
  const [experienceInfo, setExperienceInfo] = useState<ExperienceInfo | null>(null);

  useEffect(() => {
    async function fetchExperienceInfo() {
      if (!experienceId) return;
      
      try {
        const response = await fetch(`/api/storage/${experienceId}/experience.json`);
        if (response.ok) {
          const config = await response.json();
          setExperienceInfo({
            title: config.title || 'Untitled Experience',
            authorEmail: config.authorEmail || ''
          });
        }
      } catch (_err) {
        // Silently fail - experience info is optional
      }
    }
    
    fetchExperienceInfo();
  }, [experienceId]);

  return experienceInfo;
}

