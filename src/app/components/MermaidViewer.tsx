"use client";

import React, { useEffect, useState } from 'react';
import { getCurrentDiagram, subscribeToStateUpdates, MermaidDiagram } from '@/app/lib/tools/ui/mermaid/index';

export default function MermaidViewer() {
  const [diagramData, setDiagramData] = useState<{ title: string; diagram: string } | null>(null);

  // Subscribe to mermaid state updates
  useEffect(() => {
    // Set initial state
    setDiagramData(getCurrentDiagram());

    // Subscribe to updates
    const unsubscribe = subscribeToStateUpdates(() => {
      setDiagramData(getCurrentDiagram());
    });

    return () => unsubscribe();
  }, []);

  if (!diagramData) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-diagram">
      <MermaidDiagram title={diagramData.title} diagram={diagramData.diagram} />
    </div>
  );
} 