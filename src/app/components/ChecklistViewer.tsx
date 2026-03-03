'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useArtifact, Artifact as ArtifactType } from '@/app/contexts/ArtifactContext';
import { Button } from "@/components/ui/button";
import { X, CheckCircle2, Circle, BarChart3 } from 'lucide-react';

// Track the highest z-index among all checklists
let highestZIndex = 30;

interface ChecklistViewerProps {
  artifactId: string | null;
  isVisible: boolean;
  onClose: () => void;
  agentName?: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  line: number;
  type: 'header' | 'item';
  level?: number; // for headers (1, 2, 3, etc.)
}

export function ChecklistViewer({ artifactId, isVisible, onClose, agentName }: ChecklistViewerProps) {
  const { getArtifact, artifacts } = useArtifact();
  
  const [artifact, setArtifact] = useState<ArtifactType | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Drag and resize state
  const [position, setPosition] = useState({ x: window.innerWidth - 200, y: 20 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 384, height: 500 }); // w-96 = 384px
  const [resizing, setResizing] = useState(false);
  const [zIndex, setZIndex] = useState(highestZIndex);
  const resizeStart = useRef({ x: 0, y: 0, width: 384, height: 500 });

  // Parse checklist content into structured items
  const parseChecklistContent = useCallback((content: string): ChecklistItem[] => {
    if (!content) return [];
    const lines = content.split('\n');
    const checklistItems: ChecklistItem[] = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Parse markdown headers
      const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2];
        
        checklistItems.push({
          id: `header-${index}`,
          text,
          checked: false,
          line: index,
          type: 'header',
          level
        });
      }
      // Parse checklist items
      else if (trimmedLine.match(/^- \[[ x]\]/)) {
        const checked = trimmedLine.startsWith('- [x]');
        const text = trimmedLine.replace(/^- \[[ x]\]\s*/, '');
        
        checklistItems.push({
          id: `item-${index}`,
          text,
          checked,
          line: index,
          type: 'item'
        });
      }
    });
    
    return checklistItems;
  }, []);

  // Load artifact data
  const loadArtifact = useCallback(async () => {
    if (!artifactId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const artifactData = await getArtifact(artifactId);
      if (artifactData) {
        setArtifact(artifactData);
        setItems(parseChecklistContent(artifactData.content));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load checklist');
    } finally {
      setIsLoading(false);
    }
  }, [artifactId, getArtifact, parseChecklistContent]);

  // Initial load
  useEffect(() => {
    if (isVisible && artifactId) {
      loadArtifact();
    }
  }, [isVisible, artifactId, loadArtifact]);

  // Subscribe to artifact updates by watching the artifacts array
  useEffect(() => {
    if (!artifactId || !isVisible) return;

    const currentArtifactMeta = artifacts.find(a => a.id === artifactId);
    if (currentArtifactMeta && currentArtifactMeta.updatedAt !== artifact?.updatedAt) {
      // Reload the full artifact with content
      loadArtifact();
    }
  }, [artifacts, artifactId, isVisible, artifact, loadArtifact]);

  // Drag and resize handlers
  const bringToFront = () => {
    highestZIndex += 1;
    setZIndex(highestZIndex);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    bringToFront();
    setDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (dragging) {
      setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    } else if (resizing) {
      const deltaX = e.clientX - resizeStart.current.x;
      const deltaY = e.clientY - resizeStart.current.y;
      setSize({
        width: Math.max(300, resizeStart.current.width + deltaX),
        height: Math.max(200, resizeStart.current.height + deltaY)
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
    setResizing(false);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    bringToFront();
    setResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };
  };

  // Effect for drag and resize event listeners
  useEffect(() => {
    if (dragging || resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, resizing, dragOffset, size]);

  // Calculate progress (only count actual checklist items, not headers)
  const checklistOnlyItems = items.filter(item => item.type === 'item');
  const totalItems = checklistOnlyItems.length;
  const completedItems = checklistOnlyItems.filter(item => item.checked).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className="fixed bg-white/95 backdrop-blur-lg rounded-lg shadow-xl border border-gray-200 flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: zIndex,
        minWidth: 300,
        minHeight: 200,
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <div>
            <h3 className="font-semibold text-gray-900">
              {agentName ? `${agentName} Checklist` : artifact?.name || 'Checklist'}
            </h3>
            <p className="text-sm text-gray-600">
              {completedItems}/{totalItems} items ({progressPercent}%)
            </p>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-2">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        style={{ height: size.height - 120 }} // Account for header, progress bar, and footer
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-red-600 text-sm p-4 bg-red-50 rounded">
            {error}
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => {
              if (item.type === 'header') {
                return (
                  <div 
                    key={item.id}
                    className={`${
                      item.level === 1 ? 'mt-4 pt-3 border-t border-gray-300' : 'mt-3'
                    } mb-2`}
                  >
                    <h4 className={`font-semibold text-gray-900 ${
                      item.level === 1 ? 'text-base' : 'text-sm'
                    }`}>
                      {item.text}
                    </h4>
                  </div>
                );
              }
              
              return (
                <div 
                  key={item.id}
                  className={`flex items-center gap-3 p-2 rounded transition-colors ml-2 ${
                    item.checked ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-800'
                  }`}
                >
                  {item.checked ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${item.checked ? 'line-through' : ''}`}>
                    {item.text}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-gray-500 text-sm text-center py-8">
            No checklist items found
          </div>
        )}
      </div>

      {/* Footer */}
      {artifact?.metadata?.tags && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50/50">
          <div className="flex flex-wrap gap-1">
            {artifact.metadata.tags.map((tag, index) => (
              <span 
                key={index}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '20px',
          height: '20px',
          cursor: 'nwse-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: zIndex + 1
        }}
      >
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRight: '2px solid #888',
            borderBottom: '2px solid #888'
          }}
        />
      </div>
    </div>
  );
} 