/**
 * ConfigInspector
 * 
 * Modal component that displays analysis of an experience.json configuration.
 * Shows runtime tool assignments, validation issues, and upgrade options.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ConfigAnalyzer, ExperienceAnalysis, AgentAnalysis, ValidationIssue } from '../lib/ConfigAnalyzer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';

interface ConfigInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  configContent: string;
  onUpgrade?: () => void;
}

export function ConfigInspector({ isOpen, onClose, configContent, onUpgrade }: ConfigInspectorProps) {
  const [analysis, setAnalysis] = useState<ExperienceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && configContent) {
      analyzeConfig();
    }
  }, [isOpen, configContent]);

  const analyzeConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const analyzer = new ConfigAnalyzer();
      const result = await analyzer.analyze(configContent);
      setAnalysis(result);
      // Auto-expand first agent
      if (result.agents.length > 0) {
        setExpandedAgents(new Set([result.agents[0].key]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze configuration');
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = (agentKey: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentKey)) {
      newExpanded.delete(agentKey);
    } else {
      newExpanded.add(agentKey);
    }
    setExpandedAgents(newExpanded);
  };

  const getSeverityIcon = (severity: ValidationIssue['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuration Inspector</DialogTitle>
          <DialogDescription>
            Runtime analysis of experience configuration
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Analyzing configuration...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <div className="font-medium text-red-900">Analysis Error</div>
                <div className="text-sm text-red-700 mt-1">{error}</div>
              </div>
            </div>
          </div>
        )}

        {analysis && (
          <div className="space-y-6">
            {/* Overview Section */}
            <section className="bg-white rounded-lg p-5 border border-gray-200">
              <h3 className="font-semibold text-lg mb-4 text-gray-900">Overview</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Title</span>
                  <span className="font-semibold text-gray-900">{analysis.title}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Version</span>
                  <span className="font-mono text-gray-700">{analysis.version}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Config</span>
                  <span className={`font-mono font-semibold ${analysis.configVersion < 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    v{analysis.configVersion}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Kind</span>
                  <span className="font-medium text-gray-700">{analysis.kind || 'N/A'}</span>
                </div>
                {analysis.author && (
                  <div className="col-span-2 flex items-baseline gap-2">
                    <span className="text-gray-500 text-xs uppercase tracking-wide">Author</span>
                    <span className="font-medium text-gray-700">{analysis.author}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Statistics Section */}
            <section className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-5 border border-gray-200">
              <h3 className="font-semibold text-lg mb-4 text-gray-900">Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <div className="text-3xl font-bold text-blue-600 mb-1">{analysis.stats.agentCount}</div>
                  <div className="text-sm font-medium text-gray-700">Total Agents</div>
                  <div className="text-xs text-gray-500 mt-1.5">
                    {analysis.stats.frontendAgentCount} frontend · {analysis.stats.backendAgentCount} backend
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <div className="text-3xl font-bold text-emerald-600 mb-1">{analysis.stats.totalUniqueTools}</div>
                  <div className="text-sm font-medium text-gray-700">Unique Tools</div>
                  <div className="text-xs text-gray-500 mt-1.5">Across all agents</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <div className="text-3xl font-bold text-purple-600 mb-1">{analysis.stats.sceneCount}</div>
                  <div className="text-sm font-medium text-gray-700">Scenes</div>
                  <div className="text-xs text-gray-500 mt-1.5">
                    {analysis.stats.soundCount} sounds · {analysis.stats.componentCount} components
                  </div>
                </div>
              </div>
            </section>

            {/* Validation Section */}
            {analysis.validation.issues.length > 0 && (
              <section className="bg-white rounded-lg p-5 border border-gray-200">
                <h3 className="font-semibold text-lg mb-4 text-gray-900">Validation</h3>
                <div className="space-y-3">
                  {analysis.validation.issues.map((issue, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm">{issue.message}</div>
                        {issue.suggestion && (
                          <div className="text-gray-600 text-xs mt-1.5 flex items-start gap-1">
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
              <section className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2 text-blue-900">Upgrade Available</h3>
                    <p className="text-sm text-blue-800 mb-3">
                      Upgrade from configVersion {analysis.upgrade.currentVersion} to {analysis.upgrade.targetVersion}
                    </p>
                    <div className="text-sm space-y-1.5">
                      <div className="font-medium text-blue-900">Changes:</div>
                      {analysis.upgrade.changes.map((change, idx) => (
                        <div key={idx} className="text-blue-700 flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>{change}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {onUpgrade && (
                    <Button 
                      onClick={onUpgrade} 
                      variant="default"
                      size="sm" 
                      className="shrink-0"
                    >
                      Upgrade Now
                    </Button>
                  )}
                </div>
              </section>
            )}

            {/* Agents Section */}
            <section>
              <h3 className="font-semibold text-lg mb-4 text-gray-900">Agents & Tools</h3>
              <div className="space-y-3">
                {analysis.agents.map((agent) => (
                  <div key={agent.key} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                    {/* Agent Header */}
                    <Button
                      onClick={() => toggleAgent(agent.key)}
                      variant="ghost"
                      className="w-full h-auto flex items-center justify-between p-4 hover:bg-gray-50 rounded-none"
                    >
                      <div className="flex items-center gap-3">
                        {expandedAgents.has(agent.key) ? (
                          <ChevronDown className="size-5 shrink-0" />
                        ) : (
                          <ChevronRight className="size-5 shrink-0" />
                        )}
                        <div className="text-left">
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-xs text-gray-500 font-normal">
                            {agent.type || 'unspecified'} • {agent.toolCount} tools
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {agent.model && (
                          <div className="text-gray-600 font-normal">{agent.model}</div>
                        )}
                        {agent.provider && (
                          <div className="text-xs text-gray-500 font-normal">{agent.provider}</div>
                        )}
                      </div>
                    </Button>

                    {/* Agent Details */}
                    {expandedAgents.has(agent.key) && (
                      <div className="border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                          <div className="flex items-baseline gap-2">
                            <span className="text-gray-500 text-xs uppercase tracking-wide">Tool Source</span>
                            <span className="font-medium text-gray-900">{getToolSourceLabel(agent)}</span>
                          </div>
                          {agent.temperature !== undefined && (
                            <div className="flex items-baseline gap-2">
                              <span className="text-gray-500 text-xs uppercase tracking-wide">Temperature</span>
                              <span className="font-mono text-gray-700">{agent.temperature}</span>
                            </div>
                          )}
                          {agent.downstreamAgents.length > 0 && (
                            <div className="col-span-2 flex items-baseline gap-2">
                              <span className="text-gray-500 text-xs uppercase tracking-wide">Downstream</span>
                              <span className="font-medium text-gray-700">{agent.downstreamAgents.join(', ')}</span>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-2">
                            Available Tools ({agent.toolCount})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {agent.availableTools.map((tool) => (
                              <span
                                key={tool}
                                className="px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-mono text-gray-700 hover:border-gray-300 transition-colors"
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
        )}

        <div className="flex justify-end gap-2 pt-4 border-t mt-6">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
