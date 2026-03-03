/**
 * Inline Configuration Inspector Panel
 * Displays experience.json analysis in the editor area
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ConfigAnalyzer, ExperienceAnalysis, AgentAnalysis } from '@/app/lib/ConfigAnalyzer';
import logger from '@/lib/logger';

interface ConfigInspectorPanelProps {
  configContent: string;
  experienceId: string;
  onClose: () => void;
  onUpgradeComplete?: () => void;
}

export function ConfigInspectorPanel({ configContent, experienceId, onClose, onUpgradeComplete }: ConfigInspectorPanelProps) {
  const [analysis, setAnalysis] = useState<ExperienceAnalysis | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    async function analyze() {
      try {
        const analyzer = new ConfigAnalyzer();
        const result = await analyzer.analyze(configContent);
        setAnalysis(result);
        setError(null);
        // Auto-expand first agent
        if (result.agents.length > 0) {
          setExpandedAgents(new Set([result.agents[0].key]));
        }
      } catch (err) {
        logger.error({ err }, 'Failed to analyze config');
        setError(err instanceof Error ? err.message : 'Failed to analyze configuration');
      }
    }
    analyze();
  }, [configContent]);

  const toggleAgent = (key: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/experience/upgrade-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceId, configContent })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upgrade configuration');
      }

      logger.info({ experienceId }, 'Configuration upgraded successfully');
      
      // Notify parent to reload the file
      if (onUpgradeComplete) {
        onUpgradeComplete();
      }
    } catch (err) {
      logger.error({ err }, 'Failed to upgrade configuration');
      setError(err instanceof Error ? err.message : 'Failed to upgrade configuration');
    } finally {
      setUpgrading(false);
    }
  };

  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
    }
  };

  const getToolSourceLabel = (agent: AgentAnalysis): string => {
    switch (agent.toolSource.type) {
      case 'explicit':
        return 'Explicit (availableTools)';
      case 'toolSets':
        return `ToolSets: ${agent.toolSource.details.toolSetNames?.join(', ')}`;
      case 'toolGroups':
        return `Groups: ${agent.toolSource.details.groupNames?.join(', ')}`;
      case 'plugins':
        return `Plugins → Groups: ${agent.toolSource.details.mappedGroups?.join(', ')}`;
      case 'fallback':
        return 'Fallback (all tools)';
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-white p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Analysis Failed</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button variant="customOutline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white/30 mx-auto mb-4"></div>
          <p className="text-gray-400">Analyzing configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] text-white overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex justify-between items-center bg-[#252526]">
        <div>
          <h2 className="text-xl font-semibold">Configuration Inspector</h2>
          <p className="text-sm text-gray-400 mt-1">Runtime analysis of experience.json</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Overview Section */}
        <section className="bg-[#252526] rounded-lg p-5 border border-white/10">
          <h3 className="font-semibold text-lg mb-4">Overview</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="flex items-baseline gap-3">
              <span className="text-gray-500 text-xs uppercase tracking-wide w-20">Title</span>
              <span className="font-semibold">{analysis.title}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-gray-500 text-xs uppercase tracking-wide w-20">Version</span>
              <span className="font-mono text-gray-300">{analysis.version}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-gray-500 text-xs uppercase tracking-wide w-20">Config</span>
              <span className={`font-mono font-semibold ${analysis.configVersion < 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                v{analysis.configVersion}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-gray-500 text-xs uppercase tracking-wide w-20">Kind</span>
              <span className="font-medium text-gray-300">{analysis.kind || 'N/A'}</span>
            </div>
            {analysis.author && (
              <div className="col-span-2 flex items-baseline gap-3">
                <span className="text-gray-500 text-xs uppercase tracking-wide w-20">Author</span>
                <span className="font-medium text-gray-300">{analysis.author}</span>
              </div>
            )}
          </div>
        </section>

        {/* Statistics Section */}
        <section className="bg-gradient-to-br from-[#2a2d2e] to-[#252526] rounded-lg p-5 border border-white/10">
          <h3 className="font-semibold text-lg mb-4">Statistics</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1e1e1e] rounded-lg p-4 border border-white/10">
              <div className="text-3xl font-bold text-blue-400 mb-1">{analysis.stats.agentCount}</div>
              <div className="text-sm font-medium text-gray-300">Total Agents</div>
              <div className="text-xs text-gray-500 mt-1.5">
                {analysis.stats.frontendAgentCount} frontend · {analysis.stats.backendAgentCount} backend
              </div>
            </div>
            <div className="bg-[#1e1e1e] rounded-lg p-4 border border-white/10">
              <div className="text-3xl font-bold text-emerald-400 mb-1">{analysis.stats.totalUniqueTools}</div>
              <div className="text-sm font-medium text-gray-300">Unique Tools</div>
              <div className="text-xs text-gray-500 mt-1.5">Across all agents</div>
            </div>
            <div className="bg-[#1e1e1e] rounded-lg p-4 border border-white/10">
              <div className="text-3xl font-bold text-purple-400 mb-1">{analysis.stats.sceneCount}</div>
              <div className="text-sm font-medium text-gray-300">Scenes</div>
              <div className="text-xs text-gray-500 mt-1.5">
                {analysis.stats.soundCount} sounds · {analysis.stats.componentCount} components
              </div>
            </div>
          </div>
        </section>

        {/* Validation Section */}
        {analysis.validation.issues.length > 0 && (
          <section className="bg-[#252526] rounded-lg p-5 border border-white/10">
            <h3 className="font-semibold text-lg mb-4">Validation</h3>
            <div className="space-y-3">
              {analysis.validation.issues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-[#1e1e1e] rounded-md border border-white/5">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{issue.message}</div>
                    {issue.suggestion && (
                      <div className="text-gray-400 text-xs mt-1.5 flex items-start gap-1">
                        <span className="shrink-0">💡</span>
                        <span>{issue.suggestion}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Upgrade Section */}
        {analysis.upgrade.canUpgrade && (
          <section className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border border-blue-500/30 rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2 text-blue-300">Upgrade Available</h3>
                <p className="text-sm text-blue-200 mb-3">
                  Upgrade from configVersion {analysis.upgrade.currentVersion} to {analysis.upgrade.targetVersion}
                </p>
                <div className="text-sm space-y-1.5">
                  <div className="font-medium text-blue-300">Changes:</div>
                  {analysis.upgrade.changes.map((change, idx) => (
                    <div key={idx} className="text-blue-200 flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{change}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button 
                onClick={handleUpgrade} 
                disabled={upgrading}
                variant="default"
                size="sm" 
                className="shrink-0"
              >
                {upgrading ? 'Upgrading...' : 'Upgrade Now'}
              </Button>
            </div>
          </section>
        )}

        {/* Agents Section */}
        <section>
          <h3 className="font-semibold text-lg mb-4">Agents & Tools</h3>
          <div className="space-y-3">
            {analysis.agents.map((agent) => (
              <div key={agent.key} className="border border-white/10 rounded-lg overflow-hidden bg-[#252526]">
                {/* Agent Header */}
                <Button
                  onClick={() => toggleAgent(agent.key)}
                  variant="ghost"
                  className="w-full h-auto flex items-center justify-between p-4 hover:bg-bay-blue/20 hover:border-bay-blue/30 rounded-none transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    {expandedAgents.has(agent.key) ? (
                      <ChevronDown className="w-4 h-4 shrink-0 group-hover:text-white" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0 group-hover:text-white" />
                    )}
                    <div className="text-left">
                      <div className="font-medium group-hover:text-white">{agent.name}</div>
                      <div className="text-xs text-gray-400 font-normal group-hover:text-gray-200">
                        {agent.type || 'unspecified'} • {agent.toolCount} tools
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {(agent.model || agent.imageModel) && (
                      <div className="text-gray-300 font-normal group-hover:text-white">
                        {agent.imageModel && agent.model 
                          ? `${agent.imageModel} / ${agent.model}`
                          : agent.imageModel || agent.model}
                      </div>
                    )}
                    {agent.provider && (
                      <div className="text-xs text-gray-400 font-normal group-hover:text-gray-200">{agent.provider}</div>
                    )}
                  </div>
                </Button>

                {/* Agent Details */}
                {expandedAgents.has(agent.key) && (
                  <div className="border-t border-white/10 bg-gradient-to-br from-[#2a2d2e] to-[#1e1e1e] p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div className="flex items-baseline gap-3">
                        <span className="text-gray-500 text-xs uppercase tracking-wide w-28">Tool Source</span>
                        <span className="font-medium">{getToolSourceLabel(agent)}</span>
                      </div>
                      {agent.temperature !== undefined && (
                        <div className="flex items-baseline gap-3">
                          <span className="text-gray-500 text-xs uppercase tracking-wide w-28">Temperature</span>
                          <span className="font-mono text-gray-300">{agent.temperature}</span>
                        </div>
                      )}
                      {agent.downstreamAgents.length > 0 && (
                        <div className="col-span-2 flex items-baseline gap-3">
                          <span className="text-gray-500 text-xs uppercase tracking-wide w-28">Downstream</span>
                          <span className="font-medium text-gray-300">{agent.downstreamAgents.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-300 mb-2">
                        Available Tools ({agent.toolCount})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {agent.availableTools.map((tool) => (
                          <span
                            key={tool}
                            className="px-2.5 py-1 bg-[#1e1e1e] border border-white/10 rounded-md text-xs font-mono text-gray-300 hover:border-white/20 transition-colors"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
