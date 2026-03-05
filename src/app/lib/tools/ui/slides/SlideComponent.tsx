"use client";

import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import React, { useState, useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';
import { DraggableWindow } from '@/app/lib/ui/DraggableWindow';
import { PrimerUIElement } from '@/app/lib/ui/types';
import { getUIElementManager } from '@/app/lib/ui/UIElementManager';

// Custom URL transform that allows data URLs for images while maintaining security for other URLs
const allowDataUrls = (url: string) => {
  // Allow data URLs (for base64 images)
  if (url.startsWith('data:')) {
    return url;
  }
  // Fall back to default transform for all other URLs (maintains security)
  return defaultUrlTransform(url);
};

interface SlideComponentProps {
  id: string;
  title: string;
  content: string;
}

export function SlideComponent({ id, title, content }: SlideComponentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasAutoSized, setHasAutoSized] = useState(false);
  
  const [element, setElement] = useState<PrimerUIElement>(() => {
    const uiManager = getUIElementManager();
    const existing = uiManager.get(id);
    
    if (existing) {
      return existing;
    }
    
    // Create new element (don't register yet - will register in useEffect)
    // Get content area dimensions for proper positioning
    const contentElement = document.querySelector('.z-play-content') || document.querySelector('.z-content');
    let contentHeight = window.innerHeight;
    
    if (contentElement) {
      const rect = contentElement.getBoundingClientRect();
      contentHeight = rect.height;
    }
    
    // Position in center of content area (coordinates are top-left corner, content-area-relative)
    const slideWidth = 600;
    const slideHeight = 400;
    const centerX = (window.innerWidth - slideWidth) / 2;
    const centerY = (contentHeight - slideHeight) / 2;
    
    const newElement: PrimerUIElement = {
      id,
      kind: 'slide',
      title,
      x: Math.max(0, centerX),
      y: Math.max(0, centerY),
      w: slideWidth,
      h: slideHeight, // Initial height, will be auto-sized
      visible: true,
      zIndex: 20 // Will get proper z-index when registered
    };
    
    return newElement;
  });

  // Register with UIElementManager after mount
  useEffect(() => {
    const uiManager = getUIElementManager();
    const existing = uiManager.get(id);
    
    if (!existing) {
      // Set proper z-index and register
      const elementToRegister = {
        ...element,
        zIndex: uiManager.getNextZIndex()
      };
      uiManager.register(elementToRegister);
      setElement(elementToRegister);
    }
  }, [id]); // Only run on mount or if id changes

  // Auto-size height based on content
  useEffect(() => {
    if (!hasAutoSized && contentRef.current && element.visible) {
      // Wait a tick for content to render
      setTimeout(() => {
        if (contentRef.current) {
          const contentHeight = contentRef.current.scrollHeight;
          const titleBarHeight = 40; // Approximate title bar height
          const padding = 32; // Padding inside the window (px-6 py-4 = 24px + 16px)
          const buffer = 60; // Extra buffer to prevent scrollbar from appearing
          const minHeight = 200;
          const maxHeight = window.innerHeight - 200; // Leave space for header/toolbar
          
          const idealHeight = Math.min(
            Math.max(contentHeight + titleBarHeight + padding + buffer, minHeight),
            maxHeight
          );
          
          // Only auto-size if content needs more space than default
          if (idealHeight > element.h) {
            const uiManager = getUIElementManager();
            uiManager.resize(id, element.w, idealHeight);
            setHasAutoSized(true);
          }
        }
      }, 100);
    }
  }, [element.visible, hasAutoSized, id, element.h, element.w]);

  // Note: We no longer sync with SlideManager's activeSlides list
  // Visibility is now managed entirely by UIElementManager
  // This prevents hidden slides from being re-shown when new slides are created

  // Subscribe to UI element manager updates
  useEffect(() => {
    const uiManager = getUIElementManager();
    const unsubscribe = uiManager.subscribe(() => {
      const updated = uiManager.get(id);
      if (updated) {
        // Force a new object reference to trigger React re-render
        setElement(_prev => ({
          ...updated,
          // Ensure we're getting the latest values
          zIndex: updated.zIndex
        }));
      }
    });
    return () => unsubscribe();
  }, [id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const uiManager = getUIElementManager();
      uiManager.unregister(id);
    };
  }, [id]);

  const handleClose = () => {
    // Just hide the element, don't unload it
    const uiManager = getUIElementManager();
    uiManager.hide(id);
  };

  const handleMove = (id: string, x: number, y: number) => {
    const uiManager = getUIElementManager();
    uiManager.move(id, x, y);
  };

  const handleResize = (id: string, w: number, h: number) => {
    const uiManager = getUIElementManager();
    uiManager.resize(id, w, h);
  };

  const handleMaximize = (id: string, maximized: boolean) => {
    const uiManager = getUIElementManager();
    uiManager.maximize(id, maximized);
  };

  const handleBringToFront = (_id: string, _currentZIndex: number) => {
    const uiManager = getUIElementManager();
    uiManager.bringToFront(id);
  };

  return (
    <DraggableWindow
      element={element}
      icon={<FileText className="w-4 h-4" />}
      callbacks={{
        onClose: handleClose,
        onMove: handleMove,
        onResize: handleResize,
        onMaximize: handleMaximize,
        onBringToFront: handleBringToFront
      }}
    >
      <div className="px-4 py-4">
        <div ref={contentRef} className="text-black text-sm md:text-base prose prose-slate prose-ul:list-disc prose-li:marker:text-black max-w-none [&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:shadow-none [&_pre]:border-0">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            urlTransform={allowDataUrls}
            components={{
              code({ node: _node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code {...props} className={className}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </DraggableWindow>
  );
}
