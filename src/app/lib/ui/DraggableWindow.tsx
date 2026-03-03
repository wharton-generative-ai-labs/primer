"use client";

/**
 * DraggableWindow - Shared container for all UI elements
 * 
 * Provides consistent behavior for slides, components, and other UI elements:
 * - Draggable title bar
 * - Resizable dimensions
 * - Maximize/restore functionality
 * - Z-index management
 * - Animation on mount/unmount
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize, Minimize } from 'lucide-react';
import { DraggableWindowProps, AnchorEdge } from './types';
import { getUIElementManager } from './UIElementManager';

// Minimum screen width to allow anchoring (disable on mobile)
const MIN_ANCHOR_WIDTH = 768;
// Distance to pull away from edge to unanchor
const UNANCHOR_DISTANCE = 100;
// Feature flag: Enable anchoring to top/bottom edges (currently disabled)
const VERTICAL_ANCHORING_ENABLED = false;

// Get the actual available viewport area by querying the play content container
const getAvailableViewportArea = (): { top: number; bottom: number; height: number } => {
  // Look for the PlayPageContent container which defines the actual content area
  // This is the area between the header and footer
  const contentElement = document.querySelector('.z-play-content');
  if (contentElement) {
    const rect = contentElement.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: window.innerHeight - rect.bottom,
      height: rect.height
    };
  }
  
  // Fallback: try z-content as secondary option
  const fallbackElement = document.querySelector('.z-content');
  if (fallbackElement) {
    const rect = fallbackElement.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: window.innerHeight - rect.bottom,
      height: rect.height
    };
  }
  
  // Last resort: use full viewport
  return {
    top: 0,
    bottom: 0,
    height: window.innerHeight
  };
};

export function DraggableWindow({ element, callbacks, children, icon }: DraggableWindowProps) {
  const [position, setPosition] = useState({ x: element.x, y: element.y });
  const [size, setSize] = useState({ width: element.w, height: element.h });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [maximized, setMaximized] = useState(element.maximized || false);
  const [preMaximizeState, setPreMaximizeState] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [anchoredTo, setAnchoredTo] = useState<AnchorEdge | null>(element.anchoredTo || null);
  const [anchorZone, setAnchorZone] = useState<AnchorEdge | null>(null);
  
  const resizeStart = useRef({ x: 0, y: 0, width: element.w, height: element.h });
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Get content area offset for coordinate translation
  const getContentAreaOffset = (): { left: number; top: number } => {
    const availableArea = getAvailableViewportArea();
    return { left: 0, top: availableArea.top };
  };

  // Sync with element prop changes
  useEffect(() => {
    if (!dragging && !resizing) {
      setPosition({ x: element.x, y: element.y });
      setSize({ width: element.w, height: element.h });
    }
  }, [element.x, element.y, element.w, element.h, dragging, resizing]);

  useEffect(() => {
    if (element.maximized !== undefined && element.maximized !== maximized) {
      const wasMaximized = maximized;
      const willBeMaximized = element.maximized;
      
      // If transitioning TO maximized, save current state first
      if (!wasMaximized && willBeMaximized) {
        setPreMaximizeState({
          x: position.x,
          y: position.y,
          w: size.width,
          h: size.height
        });
      }
      
      setMaximized(willBeMaximized);
      
      // If transitioning FROM maximized to not maximized (restore), apply the restore logic
      if (wasMaximized && !willBeMaximized && preMaximizeState) {
        setPosition({ x: preMaximizeState.x, y: preMaximizeState.y });
        setSize({ width: preMaximizeState.w, height: preMaximizeState.h });
        callbacks?.onMove?.(element.id, preMaximizeState.x, preMaximizeState.y);
        callbacks?.onResize?.(element.id, preMaximizeState.w, preMaximizeState.h);
      }
    }
  }, [element.maximized, maximized, preMaximizeState, position, size, callbacks, element.id]);

  useEffect(() => {
    if (element.anchoredTo !== undefined && element.anchoredTo !== anchoredTo) {
      setAnchoredTo(element.anchoredTo || null);
    }
  }, [element.anchoredTo]);

  // Track anchored window insets to detect changes
  const [anchoredInsets, setAnchoredInsets] = useState({ left: 0, right: 0, top: 0, bottom: 0 });

  // Recalculate maximized position when anchored insets change
  useEffect(() => {
    if (!maximized) return;
    
    const padding = 8;
    const availableArea = getAvailableViewportArea();
    const contentWidth = window.innerWidth;
    const contentHeight = availableArea.height;
    
    const maxWidth = contentWidth - padding - anchoredInsets.left - anchoredInsets.right;
    const maxHeight = contentHeight - padding - anchoredInsets.top - anchoredInsets.bottom;
    const topLeftX = anchoredInsets.left + (padding / 2);
    const topLeftY = anchoredInsets.top + (padding / 2);
    
    // Only update if values actually changed to prevent infinite loops
    const hasChanged = 
      Math.abs(position.x - topLeftX) > 0.5 ||
      Math.abs(position.y - topLeftY) > 0.5 ||
      Math.abs(size.width - maxWidth) > 0.5 ||
      Math.abs(size.height - maxHeight) > 0.5;
    
    if (hasChanged) {
      setPosition({ x: topLeftX, y: topLeftY });
      setSize({ width: maxWidth, height: maxHeight });
      callbacks?.onMove?.(element.id, topLeftX, topLeftY);
      callbacks?.onResize?.(element.id, maxWidth, maxHeight);
    }
  }, [maximized, anchoredInsets, callbacks, element.id, position.x, position.y, size.width, size.height]);

  // Subscribe to UI changes and update anchored insets
  useEffect(() => {
    const uiManager = getUIElementManager();
    
    const updateAnchoredInsets = () => {
      const anchoredElements = uiManager.getAnchoredElements();
      const insets = { left: 0, right: 0, top: 0, bottom: 0 };
      
      for (const anchoredEl of anchoredElements) {
        if (anchoredEl.id === element.id) continue;
        if (!anchoredEl.anchoredTo) continue;
        
        switch (anchoredEl.anchoredTo) {
          case 'left':
            insets.left = Math.max(insets.left, anchoredEl.w);
            break;
          case 'right':
            insets.right = Math.max(insets.right, anchoredEl.w);
            break;
          case 'top':
            insets.top = Math.max(insets.top, anchoredEl.h);
            break;
          case 'bottom':
            insets.bottom = Math.max(insets.bottom, anchoredEl.h);
            break;
        }
      }
      
      // Only update if changed
      setAnchoredInsets(prev => {
        if (prev.left !== insets.left || prev.right !== insets.right ||
            prev.top !== insets.top || prev.bottom !== insets.bottom) {
          return insets;
        }
        return prev;
      });
    };
    
    // Initial calculation
    updateAnchoredInsets();
    
    // Subscribe to changes
    const unsubscribe = uiManager.subscribe(updateAnchoredInsets);
    return () => unsubscribe();
  }, [element.id]);

  const bringToFront = () => {
    callbacks?.onBringToFront?.(element.id, element.zIndex);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (maximized) return; // Don't allow dragging when maximized
    bringToFront();
    setDragging(true);
    dragStartPos.current = { x: position.x, y: position.y };
    
    // Convert content-relative position to viewport-absolute for drag calculations
    const offset = getContentAreaOffset();
    const viewportX = position.x + offset.left;
    const viewportY = position.y + offset.top;
    setDragOffset({ x: e.clientX - viewportX, y: e.clientY - viewportY });
  };

  const detectAnchorZone = (x: number, y: number, windowWidth: number, _windowHeight: number): AnchorEdge | null => {
    // Don't allow anchoring on small screens
    if (window.innerWidth < MIN_ANCHOR_WIDTH) {
      return null;
    }

    const availableArea = getAvailableViewportArea();
    const contentWidth = window.innerWidth;
    const contentHeight = availableArea.height;

    // x, y are content-area-relative (top-left corner of window)
    // Calculate window edges in content-area coordinates
    const leftEdge = x;
    const rightEdge = x + windowWidth;
    const topEdge = y;
    const bottomEdge = y + _windowHeight;

    // Check if window is being dragged OFF the content area
    // This allows users to position windows at the edge without triggering anchoring
    
    // Horizontal anchoring (always enabled)
    if (leftEdge < 0) {
      return 'left';
    }
    if (rightEdge > contentWidth) {
      return 'right';
    }
    
    // Vertical anchoring (controlled by feature flag)
    if (VERTICAL_ANCHORING_ENABLED) {
      if (topEdge < 0) {
        return 'top';
      }
      if (bottomEdge > contentHeight) {
        return 'bottom';
      }
    }

    return null;
  };

  const calculateAnchoredPosition = (edge: AnchorEdge, windowWidth: number, windowHeight: number): { x: number; y: number; w: number; h: number } => {
    const availableArea = getAvailableViewportArea();
    const contentWidth = window.innerWidth;
    const contentHeight = availableArea.height;
    const padding = 8;

    const availableHeight = contentHeight - padding;

    switch (edge) {
      case 'left':
        return {
          x: padding / 2,
          y: padding / 2,
          w: windowWidth,
          h: availableHeight
        };
      case 'right':
        return {
          x: contentWidth - windowWidth - padding / 2,
          y: padding / 2,
          w: windowWidth,
          h: availableHeight
        };
      case 'top':
        return {
          x: padding / 2,
          y: padding / 2,
          w: contentWidth - padding,
          h: windowHeight
        };
      case 'bottom':
        return {
          x: padding / 2,
          y: contentHeight - windowHeight - padding / 2,
          w: contentWidth - padding,
          h: windowHeight
        };
    }
  };

  const shouldUnanchor = (currentX: number, currentY: number): boolean => {
    if (!anchoredTo) return false;

    const deltaX = Math.abs(currentX - dragStartPos.current.x);
    const deltaY = Math.abs(currentY - dragStartPos.current.y);

    switch (anchoredTo) {
      case 'left':
      case 'right':
        return deltaX > UNANCHOR_DISTANCE;
      case 'top':
      case 'bottom':
        return deltaY > UNANCHOR_DISTANCE;
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (dragging && !maximized) {
      // Calculate viewport-absolute position
      const viewportX = e.clientX - dragOffset.x;
      const viewportY = e.clientY - dragOffset.y;
      
      // Convert to content-area-relative position
      const offset = getContentAreaOffset();
      const newX = viewportX - offset.left;
      const newY = viewportY - offset.top;

      // Check if we should unanchor
      if (anchoredTo && shouldUnanchor(newX, newY)) {
        // Restore pre-anchor state if available
        if (element.preAnchorState) {
          setPosition({ x: element.preAnchorState.x, y: element.preAnchorState.y });
          setSize({ width: element.preAnchorState.w, height: element.preAnchorState.h });
          callbacks?.onMove?.(element.id, element.preAnchorState.x, element.preAnchorState.y);
          callbacks?.onResize?.(element.id, element.preAnchorState.w, element.preAnchorState.h);
        }
        setAnchoredTo(null);
        callbacks?.onAnchor?.(element.id, null);
        return;
      }

      // If not anchored, check for anchor zones
      if (!anchoredTo) {
        const zone = detectAnchorZone(newX, newY, size.width, size.height);
        if (zone !== anchorZone) {
          console.log('[DraggableWindow] Anchor zone changed:', zone);
        }
        setAnchorZone(zone);
        setPosition({ x: newX, y: newY });
        callbacks?.onMove?.(element.id, newX, newY);
      }
    } else if (resizing && !maximized && !anchoredTo) {
      // Only allow free resizing when not anchored
      const deltaX = e.clientX - resizeStart.current.x;
      const deltaY = e.clientY - resizeStart.current.y;
      const newWidth = Math.max(300, resizeStart.current.width + deltaX);
      const newHeight = Math.max(200, resizeStart.current.height + deltaY);
      
      // Top-left corner stays fixed, so position doesn't change
      setSize({ width: newWidth, height: newHeight });
      callbacks?.onResize?.(element.id, newWidth, newHeight);
    } else if (resizing && anchoredTo) {
      // Handle anchored resizing - only allow resizing along the anchor axis
      const deltaX = e.clientX - resizeStart.current.x;
      const deltaY = e.clientY - resizeStart.current.y;
      
      if (anchoredTo === 'left' || anchoredTo === 'right') {
        // For left/right anchored: allow width changes only
        const newWidth = Math.max(300, resizeStart.current.width + (anchoredTo === 'left' ? deltaX : -deltaX));
        const anchoredPos = calculateAnchoredPosition(anchoredTo, newWidth, size.height);
        setSize({ width: newWidth, height: anchoredPos.h });
        setPosition({ x: anchoredPos.x, y: anchoredPos.y });
        callbacks?.onResize?.(element.id, newWidth, anchoredPos.h);
        callbacks?.onMove?.(element.id, anchoredPos.x, anchoredPos.y);
      } else {
        // For top/bottom anchored: allow height changes only
        const newHeight = Math.max(200, resizeStart.current.height + (anchoredTo === 'top' ? deltaY : -deltaY));
        const anchoredPos = calculateAnchoredPosition(anchoredTo, size.width, newHeight);
        setSize({ width: anchoredPos.w, height: newHeight });
        setPosition({ x: anchoredPos.x, y: anchoredPos.y });
        callbacks?.onResize?.(element.id, anchoredPos.w, newHeight);
        callbacks?.onMove?.(element.id, anchoredPos.x, anchoredPos.y);
      }
    }
  };

  const handleMouseUp = () => {
    console.log('[DraggableWindow] Mouse up - dragging:', dragging, 'anchorZone:', anchorZone, 'anchoredTo:', anchoredTo);
    
    // Handle anchoring on mouse up if in anchor zone
    if (dragging && anchorZone && !anchoredTo) {
      console.log('[DraggableWindow] Anchoring to:', anchorZone);
      const preAnchorState = {
        x: position.x,
        y: position.y,
        w: size.width,
        h: size.height
      };
      
      const anchoredPos = calculateAnchoredPosition(anchorZone, size.width, size.height);
      setPosition({ x: anchoredPos.x, y: anchoredPos.y });
      setSize({ width: anchoredPos.w, height: anchoredPos.h });
      setAnchoredTo(anchorZone);
      
      callbacks?.onMove?.(element.id, anchoredPos.x, anchoredPos.y);
      callbacks?.onResize?.(element.id, anchoredPos.w, anchoredPos.h);
      callbacks?.onAnchor?.(element.id, anchorZone, preAnchorState);
    }
    
    setDragging(false);
    setResizing(false);
    setAnchorZone(null);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    if (maximized) return; // Don't allow resizing when maximized
    e.stopPropagation();
    bringToFront();
    setResizing(true);
    dragStartPos.current = { x: position.x, y: position.y };
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };
  };

  const handleMaximize = () => {
    if (!maximized) {
      // Save current state before maximizing
      setPreMaximizeState({
        x: position.x,
        y: position.y,
        w: size.width,
        h: size.height
      });
      
      // Calculate maximized dimensions accounting for anchored windows
      const padding = 8; // Small inset like Scene
      const availableArea = getAvailableViewportArea();
      const contentWidth = window.innerWidth;
      const contentHeight = availableArea.height;
      
      // Get insets from other anchored windows (excluding this window if it's anchored)
      const uiManager = getUIElementManager();
      const anchoredElements = uiManager.getAnchoredElements();
      const insets = { left: 0, right: 0, top: 0, bottom: 0 };
      
      // Calculate insets from all anchored windows except this one
      for (const anchoredEl of anchoredElements) {
        if (anchoredEl.id === element.id) continue; // Skip this window
        
        if (!anchoredEl.anchoredTo) continue;
        
        switch (anchoredEl.anchoredTo) {
          case 'left':
            insets.left = Math.max(insets.left, anchoredEl.w);
            break;
          case 'right':
            insets.right = Math.max(insets.right, anchoredEl.w);
            break;
          case 'top':
            insets.top = Math.max(insets.top, anchoredEl.h);
            break;
          case 'bottom':
            insets.bottom = Math.max(insets.bottom, anchoredEl.h);
            break;
        }
      }
      
      // Calculate available space minus anchored window space
      const maxWidth = contentWidth - padding - insets.left - insets.right;
      const maxHeight = contentHeight - padding - insets.top - insets.bottom;
      
      // Top-left position in content area (accounting for anchored windows)
      const topLeftX = insets.left + (padding / 2);
      const topLeftY = insets.top + (padding / 2);
      
      setPosition({ x: topLeftX, y: topLeftY });
      setSize({ width: maxWidth, height: maxHeight });
      setMaximized(true);
      
      callbacks?.onMaximize?.(element.id, true);
      callbacks?.onMove?.(element.id, topLeftX, topLeftY);
      callbacks?.onResize?.(element.id, maxWidth, maxHeight);
    } else {
      // Restore previous state
      if (preMaximizeState) {
        setPosition({ x: preMaximizeState.x, y: preMaximizeState.y });
        setSize({ width: preMaximizeState.w, height: preMaximizeState.h });
        callbacks?.onMove?.(element.id, preMaximizeState.x, preMaximizeState.y);
        callbacks?.onResize?.(element.id, preMaximizeState.w, preMaximizeState.h);
      }
      setMaximized(false);
      callbacks?.onMaximize?.(element.id, false);
    }
  };

  const handleClose = () => {
    callbacks?.onClose?.(element.id);
  };

  useEffect(() => {
    if (dragging || resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, resizing, dragOffset, size, maximized, anchorZone, anchoredTo, position, element.preAnchorState]);

  if (!element.visible) {
    return null;
  }

  // Render anchor zone indicators
  const renderAnchorZones = () => {
    if (!dragging || anchoredTo || window.innerWidth < MIN_ANCHOR_WIDTH) return null;

    const zones = [];
    const viewportWidth = window.innerWidth;
    const availableArea = getAvailableViewportArea();

    const zoneStyle = "fixed bg-blue-500/20 border-2 border-blue-500/50 pointer-events-none transition-opacity";
    const activeZoneStyle = "opacity-100";
    const inactiveZoneStyle = "opacity-0";

    // Show full-width/height zones when window is being dragged off-screen
    zones.push(
      <div
        key="left"
        className={`${zoneStyle} ${anchorZone === 'left' ? activeZoneStyle : inactiveZoneStyle}`}
        style={{
          left: 0,
          top: availableArea.top,
          width: 100,
          height: availableArea.height,
          zIndex: 9998
        }}
      />
    );

    zones.push(
      <div
        key="right"
        className={`${zoneStyle} ${anchorZone === 'right' ? activeZoneStyle : inactiveZoneStyle}`}
        style={{
          right: 0,
          top: availableArea.top,
          width: 100,
          height: availableArea.height,
          zIndex: 9998
        }}
      />
    );

    zones.push(
      <div
        key="top"
        className={`${zoneStyle} ${anchorZone === 'top' ? activeZoneStyle : inactiveZoneStyle}`}
        style={{
          left: 0,
          top: availableArea.top,
          width: viewportWidth,
          height: 100,
          zIndex: 9998
        }}
      />
    );

    zones.push(
      <div
        key="bottom"
        className={`${zoneStyle} ${anchorZone === 'bottom' ? activeZoneStyle : inactiveZoneStyle}`}
        style={{
          left: 0,
          bottom: availableArea.bottom,
          width: viewportWidth,
          height: 100,
          zIndex: 9998
        }}
      />
    );

    return zones;
  };

  return (
    <>
      {typeof window !== 'undefined' && createPortal(
        renderAnchorZones(),
        document.body
      )}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ 
            opacity: 1, 
            scale: 1,
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ 
            opacity: { duration: 0.2 },
            scale: { duration: 0.2 },
          }}
          style={{
            position: 'fixed',
            // Translate content-area-relative to viewport-absolute coordinates
            left: position.x + getContentAreaOffset().left,
            top: position.y + getContentAreaOffset().top,
            width: size.width,
            height: size.height,
            zIndex: element.zIndex,
          }}
          onMouseDown={bringToFront}
        >
        <div 
          className="w-full h-full bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl overflow-hidden"
          style={{
            minWidth: maximized ? 'auto' : 300,
            minHeight: maximized ? 'auto' : 200,
            border: '2px solid rgba(100, 100, 100, 0.3)',
          }}
        >
          {/* Header bar - draggable title bar (compact) */}
          <div 
            className="flex justify-between items-center px-2 py-1 bg-gray-50/80 border-b"
            style={{ 
              cursor: maximized ? 'pointer' : (dragging ? 'grabbing' : 'grab'),
              borderColor: 'rgba(100, 100, 100, 0.4)',
              userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleMaximize}
          >
            <div className="flex items-center gap-1.5">
              {icon && <span className="text-gray-600 text-xs">{icon}</span>}
              <span className="text-xs text-gray-700 font-medium truncate">
                {element.title}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {/* Maximize/Restore button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMaximize();
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors p-0.5 cursor-pointer flex items-center justify-center w-4 h-4"
                style={{ userSelect: 'none' }}
                onMouseDown={(e) => e.stopPropagation()}
                title={maximized ? "Restore" : "Maximize"}
              >
                {maximized ? (
                  <Minimize className="w-3 h-3" />
                ) : (
                  <Maximize className="w-3 h-3" />
                )}
              </button>
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors p-0.5 cursor-pointer flex items-center justify-center w-4 h-4"
                style={{ userSelect: 'none' }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <span className="text-sm leading-none">×</span>
              </button>
            </div>
          </div>

          {/* Content area - interactive and selectable */}
          <div 
            ref={contentRef}
            className="w-full overflow-hidden"
            style={{ 
              height: 'calc(100% - 24px)', // Account for compact header
              pointerEvents: dragging ? 'none' : 'auto',
              userSelect: dragging ? 'none' : 'auto'
            }}
          >
            {children}
          </div>

          {/* Resize handle - hidden when maximized, positioned based on anchor */}
          {!maximized && (
            <div
              onMouseDown={handleResizeStart}
              className={`absolute w-5 h-5 flex items-center justify-center ${
                anchoredTo === 'left' ? 'cursor-ew-resize right-0 top-1/2 -translate-y-1/2' :
                anchoredTo === 'right' ? 'cursor-ew-resize left-0 top-1/2 -translate-y-1/2' :
                anchoredTo === 'top' ? 'cursor-ns-resize bottom-0 left-1/2 -translate-x-1/2' :
                anchoredTo === 'bottom' ? 'cursor-ns-resize top-0 left-1/2 -translate-x-1/2' :
                'cursor-nwse-resize right-0 bottom-0'
              }`}
              style={{ zIndex: element.zIndex + 1 }}
            >
              <div
                className={`w-2.5 h-2.5 border-gray-400 ${
                  anchoredTo === 'left' || anchoredTo === 'right' ? 'border-r-2' :
                  anchoredTo === 'top' || anchoredTo === 'bottom' ? 'border-b-2' :
                  'border-r-2 border-b-2'
                }`}
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
    </>
  );
}
