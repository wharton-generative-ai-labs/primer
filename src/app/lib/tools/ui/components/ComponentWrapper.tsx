"use client";

/**
 * ComponentWrapper - Wrapper for Custom Components using DraggableWindow
 * 
 * Provides consistent behavior with slides:
 * - Draggable title bar
 * - Resizable dimensions
 * - Maximize functionality
 * - Z-index management
 * - Animation on mount/unmount
 */

import React, { useState, useEffect } from 'react';
import { Box } from 'lucide-react';
import { ComponentInstance } from './types';
import { DraggableWindow } from '@/app/lib/ui/DraggableWindow';
import { PrimerUIElement } from '@/app/lib/ui/types';
import { getUIElementManager } from '@/app/lib/ui/UIElementManager';

interface ComponentWrapperProps {
  instance: ComponentInstance;
  onClose: () => void;
  children: React.ReactNode;
}

export function ComponentWrapper({ instance, onClose: _onClose, children }: ComponentWrapperProps) {
  const calculateInitialSize = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Use 70% of viewport for both dimensions as a starting point
    const targetWidth = Math.min(Math.round(viewportWidth * 0.7), 1200);
    const targetHeight = Math.min(Math.round(viewportHeight * 0.7), 900);
    
    // Ensure minimum sizes
    const width = Math.max(targetWidth, 600);
    const height = Math.max(targetHeight, 500);
    
    return { width, height };
  };

  const [element, setElement] = useState<PrimerUIElement>(() => {
    const uiManager = getUIElementManager();
    const existing = uiManager.get(instance.instanceId);
    
    if (existing) {
      return existing;
    }
    
    const initialSize = calculateInitialSize();
    
    // Get content area dimensions for proper positioning
    const contentElement = document.querySelector('.z-play-content') || document.querySelector('.z-content');
    let contentHeight = window.innerHeight;
    
    if (contentElement) {
      const rect = contentElement.getBoundingClientRect();
      contentHeight = rect.height;
    }
    
    // Position in center of content area (coordinates are top-left corner, content-area-relative)
    const centerX = (window.innerWidth - initialSize.width) / 2;
    const centerY = (contentHeight - initialSize.height) / 2;
    
    // Create new element (don't register yet - will register in useEffect)
    const newElement: PrimerUIElement = {
      id: instance.instanceId,
      kind: 'component',
      title: instance.componentId,
      x: Math.max(0, centerX),
      y: Math.max(0, centerY),
      w: initialSize.width,
      h: initialSize.height,
      visible: true,
      zIndex: 20 // Will get proper z-index when registered
    };
    
    return newElement;
  });

  // Register with UIElementManager after mount
  useEffect(() => {
    const uiManager = getUIElementManager();
    const existing = uiManager.get(instance.instanceId);
    
    if (!existing) {
      // Set proper z-index and register
      const elementToRegister = {
        ...element,
        zIndex: uiManager.getNextZIndex()
      };
      uiManager.register(elementToRegister);
      setElement(elementToRegister);
    }
  }, [instance.instanceId]); // Only run on mount or if instanceId changes

  // Subscribe to UI element manager updates
  useEffect(() => {
    const uiManager = getUIElementManager();
    const unsubscribe = uiManager.subscribe(() => {
      const updated = uiManager.get(instance.instanceId);
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
  }, [instance.instanceId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const uiManager = getUIElementManager();
      uiManager.unregister(instance.instanceId);
    };
  }, [instance.instanceId]);

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
    uiManager.bringToFront(instance.instanceId);
  };

  const handleClose = () => {
    // Just hide the element, don't unload it
    const uiManager = getUIElementManager();
    uiManager.hide(instance.instanceId);
  };

  return (
    <DraggableWindow
      element={element}
      icon={<Box className="w-4 h-4" />}
      callbacks={{
        onClose: handleClose,
        onMove: handleMove,
        onResize: handleResize,
        onMaximize: handleMaximize,
        onBringToFront: handleBringToFront
      }}
    >
      {children}
    </DraggableWindow>
  );
}
