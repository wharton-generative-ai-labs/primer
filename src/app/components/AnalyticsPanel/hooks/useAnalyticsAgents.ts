import { useState, useEffect } from 'react';
import { AnalyticsAgent } from '../types';

/**
 * Hook to load and manage analytics agents from experience configuration
 */
export function useAnalyticsAgents(experienceId: string) {
  const [analyticsAgents, setAnalyticsAgents] = useState<AnalyticsAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAnalyticsAgents() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/storage/${experienceId}/experience.json`);
        if (response.ok) {
          const config = await response.json();
          const agents: AnalyticsAgent[] = [];
          
          for (const [key, agent] of Object.entries(config.agents || {})) {
            const agentConfig = agent as any;
            if (agentConfig.analyticsConfig?.runnable) {
              agents.push({
                key,
                name: agentConfig.name,
                description: agentConfig.publicDescription,
                type: agentConfig.analyticsConfig.type,
                analyticsConfig: agentConfig.analyticsConfig
              });
            }
          }
          
          setAnalyticsAgents(agents);
        }
      } catch (_error) {
        // Silently fail - analytics agents are optional
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAnalyticsAgents();
  }, [experienceId]);

  const studentAgent = analyticsAgents.find(a => a.type === 'student');
  const classAgent = analyticsAgents.find(a => a.type === 'class');

  return {
    analyticsAgents,
    studentAgent,
    classAgent,
    isLoading
  };
}

