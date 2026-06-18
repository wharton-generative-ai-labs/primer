"use client";

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { sanitizeHtml } from '@/app/lib/security/html-sanitizer';

// Track if mermaid has been initialized
let mermaidInitialized = false;

const initializeMermaid = () => {
  if (mermaidInitialized) return;
  
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: "base",
    darkMode: true,
    themeVariables: {
      background: '#fff',
      primaryColor: '#2d3748',
      secondaryColor: '#2d3748',
      tertiaryColor: '#2d3748',
      primaryTextColor: '#ffffff',
      secondaryTextColor: '#ffffff',
      tertiaryTextColor: '#ffffff',
      primaryBorderColor: '#63b3ed',
      secondaryBorderColor: '#63b3ed',
      tertiaryBorderColor: '#63b3ed',
      lineColor: '#90cdf4',
      edgeLabelBackground: '#2d3748',
      clusterBkg: '#2d3748',
      clusterBorder: '#63b3ed',
      fontFamily: 'sans-serif',
      fontSize: '16px',
      nodeBorder: '#63b3ed',
      mainBkg: '#2d3748',
      nodeBkg: '#2d3748',
      textColor: '#ffffff',
      labelTextColor: '#ffffff',
      entityTextColor: '#ffffff',
      attributeTextColor: '#ffffff',
      relationshipTextColor: '#ffffff',
      relationshipLabelTextColor: '#ffffff',
      classText: '#ffffff',
      titleColor: '#ffffff',
      fillColor: '#2d3748',
      defaultLabelColor: '#ffffff',
      rowEven: '#1a202c',
      rowOdd: '#2d3748',
      classData: '#2d3748',
      classBkg: '#2d3748',
      actorTextColor: '#ffffff',
      actorBkg: '#2d3748',
      actorBorder: '#63b3ed',
      actorLineColor: '#90cdf4',
      signalTextColor: '#ffffff',
      signalColor: '#90cdf4',
      noteTextColor: '#000000',
      noteBkgColor: '#90cdf4',
      noteBorderColor: '#63b3ed',
      pieSectionTextColor: '#ffffff',
      pieHoverTextColor: '#ffffff',
      pieLegendTextColor: '#ffffff',
      pie1: '#2d3748',
      pie2: '#4a5568',
      pie3: '#718096',
      pie4: '#a0aec0',
      pie5: '#cbd5e0'
    },
  });
  
  mermaidInitialized = true;
};

interface MermaidDiagramProps {
  title: string;
  diagram: string;
  /**
   * Visual theme for the container chrome (bg, error/loading states, zoom
   * controls). Mermaid's node/text colors come from the singleton mermaid.js
   * init and are not affected. Default 'dark' for the legacy overlay context;
   * pass 'light' when rendering inside the white DocumentPanel.
   */
  theme?: 'dark' | 'light';
}

export function MermaidDiagram({ diagram, theme = 'dark' }: MermaidDiagramProps) {
  const isLight = theme === 'light';
  const defaultScale = 1.0;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(defaultScale);
  const maxScale = 2.5;
  const minScale = 0.25;
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastPosition = useRef({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const svgSize = useRef<{ width: number; height: number } | null>(null);

  // Render the mermaid diagram
  useEffect(() => {
    let isMounted = true;

    const renderDiagram = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setPosition(null); // Reset position for new diagram
        
        // Initialize mermaid if needed
        initializeMermaid();
        
        // Generate a valid ID
        const diagramId = `mermaid-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        // Preprocess the diagram text
        const processedDiagram = diagram.trim().startsWith('pie') 
          ? diagram 
          : diagram
              .replace(/["]/g, "'")
              .replace(/\s+\+\s+/g, " & ");
        
        const { svg } = await mermaid.render(diagramId, processedDiagram);
        
        if (isMounted) {
          // Sanitize SVG content to prevent XSS attacks
          const sanitizedSvg = sanitizeHtml(svg);
          setSvgContent(sanitizedSvg);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        const logger = (await import('@/lib/logger')).createModuleLogger('MermaidDiagram');
        logger.error(err, 'Failed to render diagram');
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          setIsLoading(false);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [diagram]);

  // Center diagram once after SVG loads (only when position is null)
  useEffect(() => {
    if (!svgContent || position !== null || !containerRef.current) return;

    // Wait for DOM to update
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      
      // Parse SVG to get dimensions
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgEl = svgDoc.querySelector('svg');
      
      let svgWidth = 400;
      let svgHeight = 300;
      
      if (svgEl) {
        // Try to get dimensions from viewBox or width/height attributes
        const viewBox = svgEl.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.split(/\s+/);
          if (parts.length >= 4) {
            svgWidth = parseFloat(parts[2]) || svgWidth;
            svgHeight = parseFloat(parts[3]) || svgHeight;
          }
        } else {
          svgWidth = parseFloat(svgEl.getAttribute('width') || '') || svgWidth;
          svgHeight = parseFloat(svgEl.getAttribute('height') || '') || svgHeight;
        }
      }
      
      svgSize.current = { width: svgWidth, height: svgHeight };
      
      // Scale dimensions
      const scaledWidth = svgWidth * scale;
      const scaledHeight = svgHeight * scale;
      
      const newX = (containerRect.width - scaledWidth) / 2;
      const newY = (containerRect.height - scaledHeight) / 2;

      setPosition({ x: newX, y: newY });
    }, 50);

    return () => clearTimeout(timer);
  }, [svgContent, position, scale]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    lastPosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastPosition.current.x;
    const deltaY = e.clientY - lastPosition.current.y;

    setPosition(prev => prev ? {
      x: prev.x + deltaX,
      y: prev.y + deltaY
    } : prev);

    lastPosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomIn = () => setScale(s => Math.min(s + 0.25, maxScale));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, minScale));
  
  const resetZoom = () => {
    setScale(defaultScale);
    // Force recenter by resetting position
    setPosition(null);
  };

  if (error) {
    return (
      <div className={`w-full h-full flex items-center justify-center rounded-lg p-4 ${isLight ? 'bg-red-50' : 'bg-black/50'}`}>
        <div className={`text-sm max-w-md text-center ${isLight ? 'text-red-700' : 'text-red-500'}`}>
          <div className="font-bold mb-2">Error rendering diagram</div>
          <div className="text-xs opacity-80">{error}</div>
        </div>
      </div>
    );
  }

  if (isLoading || !svgContent) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${isLight ? '' : 'bg-black/30'}`}>
        <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-white'}`}>Loading diagram...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-0 p-1 md:p-2">
        <div
          ref={containerRef}
          className={`relative w-full h-full overflow-hidden ${isLight ? '' : 'bg-black/30'}`}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            style={{
              position: 'absolute',
              left: position?.x ?? 0,
              top: position?.y ?? 0,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            className={`pointer-events-auto [&_svg]:!overflow-visible ${isLight ? '' : '[&_svg]:!bg-gray-900'}`}
            onMouseDown={handleMouseDown}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2 pointer-events-auto z-10">
        <button
          onClick={zoomOut}
          className={`p-2 rounded-lg ${isLight ? 'bg-white/80 text-slate-600 hover:bg-white shadow-sm border border-slate-200' : 'bg-black hover:bg-black/70 text-white'}`}
          title="Zoom Out"
        >
          <ZoomOut size={20} />
        </button>
        <button
          onClick={resetZoom}
          className={`p-2 rounded-lg ${isLight ? 'bg-white/80 text-slate-600 hover:bg-white shadow-sm border border-slate-200' : 'bg-black hover:bg-black/70 text-white'}`}
          title="Reset Zoom"
        >
          <Maximize size={20} />
        </button>
        <button
          onClick={zoomIn}
          className={`p-2 rounded-lg ${isLight ? 'bg-white/80 text-slate-600 hover:bg-white shadow-sm border border-slate-200' : 'bg-black hover:bg-black/70 text-white'}`}
          title="Zoom In"
        >
          <ZoomIn size={20} />
        </button>
      </div>
    </div>
  );
}

